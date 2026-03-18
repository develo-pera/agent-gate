import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { normalize } from "viem/ens";
import type { Address } from "viem";
import type { AgentGateContext } from "../index.js";

export function registerEnsTools(server: McpServer, ctx: AgentGateContext) {

  // ── ens_resolve: ENS name → address ─────────────────────────────────
  server.tool(
    "ens_resolve",
    "Resolve an ENS name to its Ethereum address. Agents can use ENS names instead of raw hex addresses for identity and payments.",
    {
      name: z.string().describe("ENS name to resolve (e.g., 'vitalik.eth')"),
    },
    async ({ name }) => {
      try {
        const ensAddress = await ctx.publicClient.getEnsAddress({
          name: normalize(name),
        });

        if (!ensAddress) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                name,
                resolved: false,
                error: `No address found for ${name}`,
              }, null, 2),
            }],
          };
        }

        // Also try to get avatar and text records
        let avatar: string | null = null;
        let description: string | null = null;
        try {
          avatar = await ctx.publicClient.getEnsAvatar({ name: normalize(name) });
        } catch { /* optional */ }
        try {
          description = await ctx.publicClient.getEnsText({
            name: normalize(name),
            key: "description",
          });
        } catch { /* optional */ }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              name,
              resolved: true,
              address: ensAddress,
              avatar: avatar || undefined,
              description: description || undefined,
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{
            type: "text" as const,
            text: `Error resolving ENS name: ${e instanceof Error ? e.message : "unknown"}`,
          }],
          isError: true,
        };
      }
    }
  );

  // ── ens_reverse: address → ENS name ─────────────────────────────────
  server.tool(
    "ens_reverse",
    "Reverse-resolve an Ethereum address to its primary ENS name. Useful for displaying human-readable agent identities.",
    {
      address: z.string().describe("Ethereum address to reverse-resolve"),
    },
    async ({ address }) => {
      try {
        const name = await ctx.publicClient.getEnsName({
          address: address as Address,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              address,
              ens_name: name || null,
              has_ens: !!name,
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{
            type: "text" as const,
            text: `Error reverse-resolving: ${e instanceof Error ? e.message : "unknown"}`,
          }],
          isError: true,
        };
      }
    }
  );
}
