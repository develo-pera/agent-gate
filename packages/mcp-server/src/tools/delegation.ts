import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  type Address,
  encodeFunctionData,
  parseEther,
  parseUnits,
  erc20Abi,
} from "viem";
import {
  Implementation,
  toMetaMaskSmartAccount,
  createDelegation,
  createExecution,
  ExecutionMode,
  getSmartAccountsEnvironment,
} from "@metamask/smart-accounts-kit";
import { DelegationManager } from "@metamask/smart-accounts-kit/contracts";
import { privateKeyToAccount } from "viem/accounts";
import type { AgentGateContext } from "../context.js";

// ── State: store signed delegations in memory ─────────────────────────
// In production you'd persist these (IPFS, DB, etc.)
const delegationStore: Map<string, {
  delegation: any;
  signature: string;
  from: Address;
  to: Address;
  createdAt: number;
}> = new Map();

export function registerDelegationTools(server: McpServer, ctx: AgentGateContext) {

  // ── delegate_create_account: Create a MetaMask Smart Account ────────
  server.tool(
    "delegate_create_account",
    "Create a MetaMask Smart Account (ERC-4337) for an agent. This is required before creating or redeeming delegations. Returns the smart account address.",
    {
      private_key: z.string().optional().describe("Private key for the account signer (uses server wallet if omitted)"),
      dry_run: z.boolean().optional(),
    },
    async ({ private_key, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;

      const signerKey = (private_key || process.env.PRIVATE_KEY) as `0x${string}` | undefined;
      if (!signerKey) {
        return { content: [{ type: "text" as const, text: "Error: No private key available. Set PRIVATE_KEY env var." }], isError: true };
      }

      const account = privateKeyToAccount(signerKey);

      if (isDry) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "dry_run",
              action: "create_smart_account",
              signer_address: account.address,
              implementation: "Hybrid",
              chain: ctx.chain.name,
              chain_id: ctx.chain.id,
              note: "Will deploy a MetaMask Hybrid Smart Account via ERC-4337. Requires a bundler for UserOp submission.",
            }, null, 2),
          }],
        };
      }

      try {
        const smartAccount = await toMetaMaskSmartAccount({
          client: ctx.publicClient,
          implementation: Implementation.Hybrid,
          deployParams: [account.address, [], [], []],
          deploySalt: "0x",
          signer: { account },
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "executed",
              action: "create_smart_account",
              smart_account_address: smartAccount.address,
              signer_address: account.address,
              implementation: "Hybrid",
              chain: ctx.chain.name,
              note: "Smart account created. Use this address as 'from' in delegate_create.",
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error creating smart account: ${e instanceof Error ? e.message : "unknown"}` }],
          isError: true,
        };
      }
    }
  );

  // ── delegate_create: Create and sign a scoped delegation ────────────
  server.tool(
    "delegate_create",
    "Create an ERC-7710 delegation granting another agent scoped permission to act on your behalf. " +
    "The delegation is signed off-chain and stored for the delegate to redeem later. " +
    "Uses MetaMask Smart Accounts Kit with caveat enforcers for restrictions.",
    {
      delegate_address: z.string().describe("Address of the agent/account receiving the delegation"),
      scope_type: z.enum([
        "erc20TransferAmount",
        "nativeTokenTransferAmount",
      ]).describe("Type of permission scope"),
      token_address: z.string().optional().describe("ERC-20 token address (required for erc20TransferAmount)"),
      max_amount: z.string().describe("Maximum amount the delegate can spend (human-readable, e.g. '0.5')"),
      token_decimals: z.number().optional().describe("Token decimals (default: 18)"),
      dry_run: z.boolean().optional(),
    },
    async ({ delegate_address, scope_type, token_address, max_amount, token_decimals, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;
      const decimals = token_decimals || 18;

      const signerKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
      if (!signerKey) {
        return { content: [{ type: "text" as const, text: "Error: No PRIVATE_KEY configured." }], isError: true };
      }

      const account = privateKeyToAccount(signerKey);

      if (isDry) {
        const scopeDescription = scope_type === "erc20TransferAmount"
          ? `Delegate can transfer up to ${max_amount} of token ${token_address}`
          : `Delegate can transfer up to ${max_amount} native ETH`;

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "dry_run",
              action: "create_delegation",
              from: account.address,
              to: delegate_address,
              scope: {
                type: scope_type,
                max_amount,
                token_address: token_address || "native",
                description: scopeDescription,
              },
              chain: ctx.chain.name,
              framework: "MetaMask Smart Accounts Kit (ERC-7710)",
              steps: [
                "1. Create MetaMask Smart Account for delegator (if not exists)",
                "2. createDelegation() with scope and caveat enforcers",
                "3. signDelegation() — off-chain signature by delegator",
                "4. Store signed delegation for delegate to redeem",
              ],
            }, null, 2),
          }],
        };
      }

      try {
        // Create delegator smart account
        const delegatorSmartAccount = await toMetaMaskSmartAccount({
          client: ctx.publicClient,
          implementation: Implementation.Hybrid,
          deployParams: [account.address, [], [], []],
          deploySalt: "0x",
          signer: { account },
        });

        // Build scope based on type
        let scope: any;
        if (scope_type === "erc20TransferAmount") {
          if (!token_address) {
            return { content: [{ type: "text" as const, text: "Error: token_address required for erc20TransferAmount scope." }], isError: true };
          }
          scope = {
            type: "erc20TransferAmount",
            tokenAddress: token_address,
            maxAmount: parseUnits(max_amount, decimals),
          };
        } else {
          scope = {
            type: "nativeTokenTransferAmount",
            maxAmount: parseEther(max_amount),
          };
        }

        // Create the delegation
        const delegation = createDelegation({
          to: delegate_address as Address,
          from: delegatorSmartAccount.address,
          environment: delegatorSmartAccount.environment,
          scope,
        });

        // Sign the delegation
        const signature = await delegatorSmartAccount.signDelegation({
          delegation,
        });

        const signedDelegation = { ...delegation, signature };

        // Store it
        const delegationId = `del_${Date.now()}_${delegate_address.slice(0, 8)}`;
        delegationStore.set(delegationId, {
          delegation: signedDelegation,
          signature: signature as string,
          from: delegatorSmartAccount.address,
          to: delegate_address as Address,
          createdAt: Date.now(),
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "executed",
              action: "create_delegation",
              delegation_id: delegationId,
              from: delegatorSmartAccount.address,
              to: delegate_address,
              scope: {
                type: scope_type,
                max_amount,
                token_address: token_address || "native",
              },
              chain: ctx.chain.name,
              status: "signed_and_stored",
              note: "Delegation signed off-chain and stored. The delegate can now redeem it using delegate_redeem.",
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error creating delegation: ${e instanceof Error ? e.message : "unknown"}` }],
          isError: true,
        };
      }
    }
  );

  // ── delegate_redeem: Execute an action using a stored delegation ─────
  server.tool(
    "delegate_redeem",
    "Redeem a delegation to execute an action on behalf of the delegator. " +
    "The execution must satisfy the delegation's scope and caveat enforcers. " +
    "Sends the tx to the DelegationManager which validates and executes.",
    {
      delegation_id: z.string().describe("Delegation ID returned by delegate_create"),
      target_contract: z.string().describe("Contract to call (e.g. treasury address, token address)"),
      call_data: z.string().describe("Hex-encoded calldata for the target function (use viem's encodeFunctionData)"),
      dry_run: z.boolean().optional(),
    },
    async ({ delegation_id, target_contract, call_data, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;

      const stored = delegationStore.get(delegation_id);
      if (!stored) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "Delegation not found",
              delegation_id,
              available_delegations: Array.from(delegationStore.keys()),
            }, null, 2),
          }],
          isError: true,
        };
      }

      if (isDry) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "dry_run",
              action: "redeem_delegation",
              delegation_id,
              delegator: stored.from,
              delegate: stored.to,
              target: target_contract,
              call_data: call_data.slice(0, 20) + "...",
              chain: ctx.chain.name,
              steps: [
                "1. Load signed delegation from store",
                "2. createExecution() with target + calldata",
                "3. DelegationManager.encode.redeemDelegations()",
                "4. Send tx to DelegationManager contract on-chain",
                "5. Manager validates caveats → executes on delegator's behalf",
              ],
            }, null, 2),
          }],
        };
      }

      try {
        // Create execution
        const execution = createExecution({
          target: target_contract as Address,
          callData: call_data as `0x${string}`,
        });

        // Encode redeemDelegations calldata
        const redeemCalldata = DelegationManager.encode.redeemDelegations({
          delegations: [[stored.delegation]],
          modes: [ExecutionMode.SingleDefault],
          executions: [[execution]],
        });

        // Get the DelegationManager address for this chain
        const environment = getSmartAccountsEnvironment(ctx.chain.id);

        if (!ctx.walletClient) {
          // Third-party agent: return unsigned transaction
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                mode: "unsigned_transaction",
                transactions: [{
                  to: environment.DelegationManager,
                  data: redeemCalldata,
                  value: "0",
                  chainId: ctx.chain.id,
                  meta: { tool: "delegate_redeem", description: "Redeem delegation via DelegationManager" },
                }],
                instructions: "Sign this transaction with your wallet and submit to the network.",
              }, null, 2),
            }],
          };
        }

        const txHash = await ctx.walletClient.sendTransaction({
          account: ctx.walletAccount!,
          chain: ctx.chain,
          to: environment.DelegationManager as Address,
          data: redeemCalldata as `0x${string}`,
        });

        const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash: txHash });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "executed",
              action: "redeem_delegation",
              delegation_id,
              delegator: stored.from,
              delegate: stored.to,
              target: target_contract,
              tx_hash: txHash,
              block_number: receipt.blockNumber.toString(),
              status: receipt.status,
              explorer: `https://basescan.org/tx/${txHash}`,
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error redeeming delegation: ${e instanceof Error ? e.message : "unknown"}` }],
          isError: true,
        };
      }
    }
  );

  // ── delegate_list: List stored delegations ──────────────────────────
  server.tool(
    "delegate_list",
    "List all delegations stored in this session — both granted and received.",
    {},
    async () => {
      const delegations = Array.from(delegationStore.entries()).map(([id, d]) => ({
        id,
        from: d.from,
        to: d.to,
        created: new Date(d.createdAt).toISOString(),
      }));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            count: delegations.length,
            delegations,
            note: delegations.length === 0
              ? "No delegations stored. Use delegate_create to create one."
              : "Use delegation_id with delegate_redeem to execute.",
          }, null, 2),
        }],
      };
    }
  );

  // ── delegate_revoke: Disable a delegation on-chain ──────────────────
  server.tool(
    "delegate_revoke",
    "Disable a delegation on-chain via DelegationManager.disableDelegation(). Once disabled, the delegate can no longer redeem it. This is irreversible.",
    {
      delegation_id: z.string().describe("Delegation ID to revoke"),
      dry_run: z.boolean().optional(),
    },
    async ({ delegation_id, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;

      const stored = delegationStore.get(delegation_id);
      if (!stored) {
        return {
          content: [{ type: "text" as const, text: `Error: Delegation ${delegation_id} not found.` }],
          isError: true,
        };
      }

      if (isDry) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "dry_run",
              action: "revoke_delegation",
              delegation_id,
              from: stored.from,
              to: stored.to,
              note: "Will call DelegationManager.disableDelegation() on-chain. This is irreversible.",
            }, null, 2),
          }],
        };
      }

      try {
        const disableCalldata = DelegationManager.encode.disableDelegation({
          delegation: stored.delegation,
        });

        const environment = getSmartAccountsEnvironment(ctx.chain.id);

        if (!ctx.walletClient) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                mode: "unsigned_transaction",
                transactions: [{
                  to: environment.DelegationManager,
                  data: disableCalldata,
                  value: "0",
                  chainId: ctx.chain.id,
                  meta: { tool: "delegate_revoke", description: "Disable delegation via DelegationManager" },
                }],
                instructions: "Sign this transaction with your wallet and submit to the network.",
              }, null, 2),
            }],
          };
        }

        const txHash = await ctx.walletClient.sendTransaction({
          account: ctx.walletAccount!,
          chain: ctx.chain,
          to: environment.DelegationManager as Address,
          data: disableCalldata as `0x${string}`,
        });

        const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash: txHash });

        // Remove from local store
        delegationStore.delete(delegation_id);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "executed",
              action: "revoke_delegation",
              delegation_id,
              tx_hash: txHash,
              status: receipt.status,
              explorer: `https://basescan.org/tx/${txHash}`,
              note: "Delegation disabled on-chain and removed from local store.",
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error revoking delegation: ${e instanceof Error ? e.message : "unknown"}` }],
          isError: true,
        };
      }
    }
  );
}
