import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { namehash, type Address } from "viem";
import type { AgentGateContext } from "../context.js";

// ── Base L2 Basename contracts ────────────────────────────────────────
const REVERSE_REGISTRAR = "0x79ea96012eea67a83431f1701b3dff7e37f9e282" as Address;
const L2_RESOLVER = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD" as Address;

const REVERSE_REGISTRAR_ABI = [
  {
    name: "node",
    type: "function",
    stateMutability: "pure" as const,
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const L2_RESOLVER_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view" as const,
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "addr",
    type: "function",
    stateMutability: "view" as const,
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export function registerEnsTools(server: McpServer, ctx: AgentGateContext) {

  // ── ens_resolve: Basename → address ────────────────────────────────
  server.tool(
    "ens_resolve",
    "Resolve a Base name (e.g. hackaclaw.base.eth) to its address. Works with Basenames on Base L2.",
    {
      name: z.string().describe("Base name to resolve (e.g., 'hackaclaw.base.eth')"),
    },
    async ({ name }) => {
      try {
        const node = namehash(name);
        const address = await ctx.publicClient.readContract({
          address: L2_RESOLVER,
          abi: L2_RESOLVER_ABI,
          functionName: "addr",
          args: [node],
        });

        if (!address || address === "0x0000000000000000000000000000000000000000") {
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

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              name,
              resolved: true,
              address,
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{
            type: "text" as const,
            text: `Error resolving name: ${e instanceof Error ? e.message : "unknown"}`,
          }],
          isError: true,
        };
      }
    }
  );

  // ── ens_reverse: address → Basename ────────────────────────────────
  server.tool(
    "ens_reverse",
    "Reverse-resolve an address to its Base name. Returns the human-readable name for an agent address.",
    {
      address: z.string().describe("Address to reverse-resolve"),
    },
    async ({ address }) => {
      try {
        const node = await ctx.publicClient.readContract({
          address: REVERSE_REGISTRAR,
          abi: REVERSE_REGISTRAR_ABI,
          functionName: "node",
          args: [address as Address],
        });

        const name = await ctx.publicClient.readContract({
          address: L2_RESOLVER,
          abi: L2_RESOLVER_ABI,
          functionName: "name",
          args: [node],
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              address,
              basename: name || null,
              has_basename: !!name,
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
