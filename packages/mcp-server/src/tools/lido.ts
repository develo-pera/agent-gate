import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseEther, formatEther, type Address } from "viem";
import type { AgentGateContext } from "../index.js";

// ── Lido contract ABIs (minimal) ──────────────────────────────────────
const LIDO_ABI = [
  {
    name: "submit",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "_referral", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "sharesOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getPooledEthByShares",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_sharesAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getTotalPooledEther",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getTotalShares",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const WSTETH_ABI = [
  {
    name: "wrap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_stETHAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "unwrap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_wstETHAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getStETHByWstETH",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_wstETHAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getWstETHByStETH",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_stETHAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "stEthPerToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ── Address helpers ───────────────────────────────────────────────────
function getAddresses(chainId: number) {
  if (chainId === 1) {
    return {
      stETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as Address,
      wstETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as Address,
      withdrawalQueue: "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1" as Address,
    };
  }
  if (chainId === 8453) {
    // Base — wstETH bridged via canonical Lido bridge
    return {
      stETH: "0x0000000000000000000000000000000000000000" as Address, // no native stETH on Base
      wstETH: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452" as Address,
      withdrawalQueue: "0x0000000000000000000000000000000000000000" as Address, // withdrawals via L1
    };
  }
  if (chainId === 42161) {
    // Arbitrum — wstETH bridged via canonical Lido bridge
    return {
      stETH: "0x0000000000000000000000000000000000000000" as Address,
      wstETH: "0x5979D7b546E38E414F7E9822514be443A4800529" as Address,
      withdrawalQueue: "0x0000000000000000000000000000000000000000" as Address,
    };
  }
  // Holesky testnet (fallback)
  return {
    stETH: "0x3F1c547b21f65e10480dE3ad8E19fAAC46C95034" as Address,
    wstETH: "0x8d09a4502Cc8Cf1547aD300E066060D043f6982D" as Address,
    withdrawalQueue: "0xc7cc160b58F8Bb0baC94b80847E2CF2800565C50" as Address,
  };
}

// ── Register all Lido tools ───────────────────────────────────────────
export function registerLidoTools(server: McpServer, ctx: AgentGateContext) {
  const addrs = getAddresses(ctx.chain.id);

  // ── lido_stake: Stake ETH to receive stETH ──────────────────────────
  server.tool(
    "lido_stake",
    "Stake ETH with Lido to receive stETH. Returns stETH amount received.",
    {
      amount_eth: z.string().describe("Amount of ETH to stake (e.g. '1.5')"),
      referral: z.string().optional().describe("Referral address (optional, defaults to zero address)"),
      dry_run: z.boolean().optional().describe("Simulate without executing (default: uses server DRY_RUN setting)"),
    },
    async ({ amount_eth, referral, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;
      const value = parseEther(amount_eth);
      const referralAddr = (referral || "0x0000000000000000000000000000000000000000") as Address;

      if (isDry) {
        // Simulate: estimate stETH received (1:1 at current rate)
        const totalPooled = await ctx.publicClient.readContract({
          address: addrs.stETH,
          abi: LIDO_ABI,
          functionName: "getTotalPooledEther",
        });
        const totalShares = await ctx.publicClient.readContract({
          address: addrs.stETH,
          abi: LIDO_ABI,
          functionName: "getTotalShares",
        });
        const estimatedShares = (value * totalShares) / totalPooled;
        const estimatedSteth = (estimatedShares * totalPooled) / totalShares;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                mode: "dry_run",
                action: "stake",
                input_eth: amount_eth,
                estimated_steth: formatEther(estimatedSteth),
                estimated_shares: estimatedShares.toString(),
                referral: referralAddr,
                contract: addrs.stETH,
                note: "Dry run — no transaction sent. stETH is minted 1:1 with ETH deposited.",
              }, null, 2),
            },
          ],
        };
      }

      if (!ctx.walletClient) {
        return {
          content: [{ type: "text" as const, text: "Error: No wallet configured. Set PRIVATE_KEY env var or use dry_run mode." }],
          isError: true,
        };
      }

      const hash = await ctx.walletClient.writeContract({
        address: addrs.stETH,
        abi: LIDO_ABI,
        functionName: "submit",
        args: [referralAddr],
        value,
      });

      const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              mode: "executed",
              action: "stake",
              input_eth: amount_eth,
              tx_hash: hash,
              block_number: receipt.blockNumber.toString(),
              status: receipt.status,
              contract: addrs.stETH,
            }, null, 2),
          },
        ],
      };
    }
  );

  // ── lido_wrap: Convert stETH ↔ wstETH ──────────────────────────────
  server.tool(
    "lido_wrap",
    "Convert between stETH and wstETH. wstETH is non-rebasing (better for DeFi integrations).",
    {
      direction: z.enum(["wrap", "unwrap"]).describe("'wrap' = stETH→wstETH, 'unwrap' = wstETH→stETH"),
      amount: z.string().describe("Amount to convert (in stETH for wrap, wstETH for unwrap)"),
      dry_run: z.boolean().optional(),
    },
    async ({ direction, amount, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;
      const value = parseEther(amount);

      if (direction === "wrap") {
        const estimated = await ctx.publicClient.readContract({
          address: addrs.wstETH,
          abi: WSTETH_ABI,
          functionName: "getWstETHByStETH",
          args: [value],
        });

        if (isDry) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                mode: "dry_run",
                action: "wrap",
                input_steth: amount,
                estimated_wsteth: formatEther(estimated),
                contract: addrs.wstETH,
              }, null, 2),
            }],
          };
        }

        if (!ctx.walletClient) {
          return { content: [{ type: "text" as const, text: "Error: No wallet configured." }], isError: true };
        }

        const hash = await ctx.walletClient.writeContract({
          address: addrs.wstETH,
          abi: WSTETH_ABI,
          functionName: "wrap",
          args: [value],
        });
        const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ mode: "executed", action: "wrap", tx_hash: hash, status: receipt.status }, null, 2),
          }],
        };
      } else {
        // unwrap
        const estimated = await ctx.publicClient.readContract({
          address: addrs.wstETH,
          abi: WSTETH_ABI,
          functionName: "getStETHByWstETH",
          args: [value],
        });

        if (isDry) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                mode: "dry_run",
                action: "unwrap",
                input_wsteth: amount,
                estimated_steth: formatEther(estimated),
                contract: addrs.wstETH,
              }, null, 2),
            }],
          };
        }

        if (!ctx.walletClient) {
          return { content: [{ type: "text" as const, text: "Error: No wallet configured." }], isError: true };
        }

        const hash = await ctx.walletClient.writeContract({
          address: addrs.wstETH,
          abi: WSTETH_ABI,
          functionName: "unwrap",
          args: [value],
        });
        const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ mode: "executed", action: "unwrap", tx_hash: hash, status: receipt.status }, null, 2),
          }],
        };
      }
    }
  );

  // ── lido_get_apr: Current staking APR ───────────────────────────────
  server.tool(
    "lido_get_apr",
    "Get the current Lido stETH staking APR and protocol stats.",
    {},
    async () => {
      try {
        const apiBase = ctx.chain.id === 1
          ? "https://eth-api.lido.fi"
          : "https://eth-api-hoodi.testnet.fi";
        const res = await fetch(`${apiBase}/v1/protocol/steth/apr/last`);
        const data = await res.json();

        const totalPooled = await ctx.publicClient.readContract({
          address: addrs.stETH,
          abi: LIDO_ABI,
          functionName: "getTotalPooledEther",
        });
        const totalShares = await ctx.publicClient.readContract({
          address: addrs.stETH,
          abi: LIDO_ABI,
          functionName: "getTotalShares",
        });
        const exchangeRate = Number(totalPooled) / Number(totalShares);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              apr: data,
              total_pooled_ether: formatEther(totalPooled),
              total_shares: totalShares.toString(),
              steth_per_share: exchangeRate.toFixed(18),
              wsteth_exchange_rate: exchangeRate.toFixed(6),
              network: ctx.chain.name,
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error fetching APR: ${e instanceof Error ? e.message : "unknown"}` }],
          isError: true,
        };
      }
    }
  );

  // ── lido_balance: Check stETH/wstETH balances ───────────────────────
  server.tool(
    "lido_balance",
    "Check stETH and wstETH balance for an address.",
    {
      address: z.string().describe("Ethereum address to check"),
    },
    async ({ address }) => {
      const addr = address as Address;

      const [stethBal, wstethBal, shares] = await Promise.all([
        ctx.publicClient.readContract({
          address: addrs.stETH,
          abi: LIDO_ABI,
          functionName: "balanceOf",
          args: [addr],
        }),
        ctx.publicClient.readContract({
          address: addrs.wstETH,
          abi: WSTETH_ABI,
          functionName: "balanceOf",
          args: [addr],
        }),
        ctx.publicClient.readContract({
          address: addrs.stETH,
          abi: LIDO_ABI,
          functionName: "sharesOf",
          args: [addr],
        }),
      ]);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            address: addr,
            steth_balance: formatEther(stethBal),
            wsteth_balance: formatEther(wstethBal),
            shares: shares.toString(),
            network: ctx.chain.name,
          }, null, 2),
        }],
      };
    }
  );

  // ── lido_rewards: Fetch reward history via Lido API ─────────────────
  server.tool(
    "lido_rewards",
    "Fetch stETH reward history for an address using Lido's Reward History API.",
    {
      address: z.string().describe("Ethereum address"),
      limit: z.number().optional().describe("Number of entries (default 10)"),
    },
    async ({ address, limit }) => {
      try {
        const apiBase = ctx.chain.id === 1
          ? "https://eth-api.lido.fi"
          : "https://eth-api-hoodi.testnet.fi";
        const url = `${apiBase}/v1/protocol/steth/rewards?address=${address}&limit=${limit || 10}&onlyRewards=true`;
        const res = await fetch(url);
        const data = await res.json();

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              address,
              rewards: data,
              network: ctx.chain.name,
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error fetching rewards: ${e instanceof Error ? e.message : "unknown"}` }],
          isError: true,
        };
      }
    }
  );

  // ── lido_governance: Fetch active DAO proposals ─────────────────────
  server.tool(
    "lido_governance",
    "Fetch active and recent Lido DAO governance proposals from Snapshot (off-chain votes) and Aragon on-chain voting. " +
    "Returns proposal titles, status, vote counts, and links. Agents can use this to monitor governance and inform decisions.",
    {
      state: z.enum(["active", "closed", "all"]).optional().describe("Filter by proposal state (default: active)"),
      limit: z.number().optional().describe("Number of proposals to return (default: 5)"),
    },
    async ({ state, limit }) => {
      const proposalState = state || "active";
      const proposalLimit = limit || 5;

      try {
        // Query Snapshot GraphQL API for Lido DAO proposals
        // Lido's Snapshot space: "lido-snapshot.eth"
        const snapshotQuery = {
          query: `{
            proposals(
              first: ${proposalLimit},
              skip: 0,
              where: {
                space_in: ["lido-snapshot.eth"],
                ${proposalState !== "all" ? `state: "${proposalState}"` : ""}
              },
              orderBy: "created",
              orderDirection: desc
            ) {
              id
              title
              body
              choices
              start
              end
              state
              scores
              scores_total
              votes
              quorum
              link
              author
            }
          }`,
        };

        const snapshotRes = await fetch("https://hub.snapshot.org/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshotQuery),
        });

        const snapshotData = await snapshotRes.json();
        const proposals = snapshotData?.data?.proposals || [];

        // Also fetch on-chain Aragon votes from Lido's voting API
        let aragonVotes: any[] = [];
        try {
          const aragonRes = await fetch(
            "https://vote.lido.fi/api/votes?limit=5&offset=0"
          );
          if (aragonRes.ok) {
            const aragonData = await aragonRes.json();
            aragonVotes = aragonData?.votes || aragonData || [];
          }
        } catch {
          // Aragon API may not be publicly available — that's ok
        }

        // Format proposals for the agent
        const formattedProposals = proposals.map((p: any) => {
          const totalVotes = p.scores_total || 0;
          const choiceResults = (p.choices || []).map((choice: string, i: number) => ({
            choice,
            votes: p.scores?.[i]?.toFixed(2) || "0",
            percentage: totalVotes > 0
              ? ((p.scores?.[i] / totalVotes) * 100).toFixed(1) + "%"
              : "0%",
          }));

          return {
            id: p.id,
            title: p.title,
            state: p.state,
            type: "snapshot",
            start: new Date(p.start * 1000).toISOString(),
            end: new Date(p.end * 1000).toISOString(),
            total_votes: p.votes,
            total_voting_power: totalVotes.toFixed(2),
            results: choiceResults,
            link: p.link || `https://snapshot.org/#/lido-snapshot.eth/proposal/${p.id}`,
            summary: p.body?.slice(0, 200) + (p.body?.length > 200 ? "..." : ""),
          };
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              source: "Lido DAO Governance",
              snapshot_space: "lido-snapshot.eth",
              filter: proposalState,
              count: formattedProposals.length,
              proposals: formattedProposals,
              aragon_votes: aragonVotes.length > 0
                ? aragonVotes.slice(0, 3).map((v: any) => ({
                    id: v.id || v.voteId,
                    status: v.status || v.open ? "active" : "closed",
                    link: `https://vote.lido.fi/vote/${v.id || v.voteId}`,
                  }))
                : "Aragon on-chain votes not available via public API — check https://vote.lido.fi",
              links: {
                snapshot: "https://snapshot.org/#/lido-snapshot.eth",
                aragon: "https://vote.lido.fi",
                research_forum: "https://research.lido.fi",
                easy_track: "https://easytrack.lido.fi",
              },
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error fetching governance data: ${e instanceof Error ? e.message : "unknown"}` }],
          isError: true,
        };
      }
    }
  );

  // ── lido_governance_vote: Cast a Snapshot vote ──────────────────────
  server.tool(
    "lido_governance_vote",
    "Cast a vote on an active Lido DAO Snapshot proposal. Requires the voter to hold LDO tokens. " +
    "Snapshot votes are off-chain (gasless) — they require an EIP-712 signature, not a transaction.",
    {
      proposal_id: z.string().describe("Snapshot proposal ID (from lido_governance results)"),
      choice: z.number().describe("Choice index (1-based, matching the 'choices' array from the proposal)"),
      dry_run: z.boolean().optional(),
    },
    async ({ proposal_id, choice, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;

      if (isDry) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "dry_run",
              action: "governance_vote",
              proposal_id,
              choice,
              note: "Will sign an EIP-712 typed data message for Snapshot voting. This is gasless — no on-chain transaction needed. Requires the signer to hold LDO tokens at the snapshot block.",
              steps: [
                "1. Fetch proposal details to validate choice index",
                "2. Construct EIP-712 vote message",
                "3. Sign with wallet private key",
                "4. Submit signed vote to Snapshot hub API",
              ],
            }, null, 2),
          }],
        };
      }

      if (!ctx.walletClient?.account) {
        return { content: [{ type: "text" as const, text: "Error: No wallet configured. Snapshot voting requires a signer." }], isError: true };
      }

      try {
        // Snapshot vote via their sequencer API
        // Ref: https://docs.snapshot.org/tools/api/cast-a-vote
        const address = ctx.walletClient.account.address;

        const voteMsg = {
          space: "lido-snapshot.eth",
          proposal: proposal_id,
          type: "single-choice",
          choice,
          app: "agentgate",
        };

        // Sign EIP-712 vote message
        const domain = {
          name: "snapshot",
          version: "0.1.4",
        };

        const types = {
          Vote: [
            { name: "from", type: "address" },
            { name: "space", type: "string" },
            { name: "timestamp", type: "uint64" },
            { name: "proposal", type: "bytes32" },
            { name: "choice", type: "uint32" },
            { name: "reason", type: "string" },
            { name: "app", type: "string" },
            { name: "metadata", type: "string" },
          ],
        };

        const timestamp = Math.floor(Date.now() / 1000);

        const message = {
          from: address,
          space: "lido-snapshot.eth",
          timestamp: BigInt(timestamp),
          proposal: proposal_id as `0x${string}`,
          choice,
          reason: "",
          app: "agentgate",
          metadata: "{}",
        };

        const signature = await ctx.walletClient.signTypedData({
          domain,
          types,
          primaryType: "Vote",
          message,
        });

        // Submit to Snapshot sequencer
        const submitRes = await fetch("https://seq.snapshot.org", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            sig: signature,
            data: {
              domain,
              types,
              message: {
                ...message,
                timestamp: Number(timestamp),
              },
            },
          }),
        });

        const submitData = await submitRes.json();

        if (submitData.error) {
          return {
            content: [{ type: "text" as const, text: `Snapshot vote error: ${JSON.stringify(submitData.error)}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "executed",
              action: "governance_vote",
              proposal_id,
              choice,
              voter: address,
              receipt: submitData,
              link: `https://snapshot.org/#/lido-snapshot.eth/proposal/${proposal_id}`,
              note: "Vote cast successfully on Snapshot. Gasless — no on-chain tx needed.",
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error casting vote: ${e instanceof Error ? e.message : "unknown"}` }],
          isError: true,
        };
      }
    }
  );
}
