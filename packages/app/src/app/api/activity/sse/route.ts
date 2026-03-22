import { NextRequest } from "next/server";
import { getActivityLog } from "@agentgate/mcp-server/activity-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const log = getActivityLog();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Handle Last-Event-ID reconnection replay
      const lastEventId = req.headers.get("Last-Event-ID");
      if (lastEventId) {
        const lastId = parseInt(lastEventId, 10);
        if (!isNaN(lastId)) {
          const missed = log.getAll().filter((e) => e.id > lastId);
          for (const event of missed) {
            controller.enqueue(
              encoder.encode(
                `id: ${event.id}\nevent: activity\ndata: ${JSON.stringify(event)}\n\n`,
              ),
            );
          }
        }
      }

      // Subscribe to new live events
      const unsub = log.onEvent((event) => {
        try {
          controller.enqueue(
            encoder.encode(
              `id: ${event.id}\nevent: activity\ndata: ${JSON.stringify(event)}\n\n`,
            ),
          );
        } catch {
          // Stream may be closing — ignore enqueue errors
        }
      });

      // 30-second heartbeat keepalive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // Stream may be closing — ignore
        }
      }, 30_000);

      // Cleanup on client disconnect
      req.signal.addEventListener("abort", () => {
        unsub();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed — ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
