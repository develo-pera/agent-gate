/**
 * Dual-mode execution helper for MCP write tools.
 *
 * First-party agents (with walletClient): signs and submits transactions.
 * Third-party agents (no walletClient): returns unsigned transaction calldata.
 */

import { encodeFunctionData, type Abi, type Address } from "viem";
import type { AgentGateContext } from "./context";
import { activityLog } from "./activity-log";

export interface WriteContractParams {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  value?: bigint;
}

export interface UnsignedTransaction {
  to: Address;
  data: `0x${string}`;
  value: string;
  chainId: number;
  meta?: {
    tool: string;
    description: string;
    would_revert?: boolean;
  };
}

export interface ExecuteResult {
  mode: "executed";
  tx_hash: string;
  status: string;
  block_number: string;
}

export interface PrepareResult {
  mode: "unsigned_transaction";
  transactions: UnsignedTransaction[];
  instructions: string;
}

/**
 * Execute a single writeContract call or return unsigned tx.
 */
export async function executeOrPrepare(
  ctx: AgentGateContext,
  params: WriteContractParams,
  toolName: string,
  description: string,
): Promise<ExecuteResult | PrepareResult> {
  if (ctx.walletClient) {
    const hash = await ctx.walletClient.writeContract({
      account: ctx.walletAccount!,
      chain: ctx.chain,
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
      value: params.value,
    });
    const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });
    const result: ExecuteResult = {
      mode: "executed",
      tx_hash: hash,
      status: receipt.status,
      block_number: receipt.blockNumber.toString(),
    };

    if (ctx.activeEventId != null) {
      activityLog.enrichEvent(ctx.activeEventId, {
        txHash: result.tx_hash,
        txStatus: result.status,
        blockNumber: result.block_number,
      });
    }

    return result;
  }

  // Third-party: return unsigned transaction
  const calldata = encodeFunctionData({
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
  });

  return {
    mode: "unsigned_transaction",
    transactions: [{
      to: params.address,
      data: calldata,
      value: (params.value || 0n).toString(),
      chainId: ctx.chain.id,
      meta: { tool: toolName, description },
    }],
    instructions: "Sign this transaction with your wallet and submit to the network.",
  };
}

/**
 * Execute multiple writeContract calls in sequence, or return all as unsigned txs.
 * Used for multi-step operations like approve+supply.
 */
export async function executeOrPrepareMany(
  ctx: AgentGateContext,
  steps: Array<{ params: WriteContractParams; toolName: string; description: string }>,
): Promise<ExecuteResult | PrepareResult> {
  if (ctx.walletClient) {
    let lastHash = "";
    let lastReceipt: any;
    for (const step of steps) {
      lastHash = await ctx.walletClient.writeContract({
        account: ctx.walletAccount!,
        chain: ctx.chain,
        address: step.params.address,
        abi: step.params.abi,
        functionName: step.params.functionName,
        args: step.params.args,
        value: step.params.value,
      });
      lastReceipt = await ctx.publicClient.waitForTransactionReceipt({ hash: lastHash });
    }
    const result: ExecuteResult = {
      mode: "executed",
      tx_hash: lastHash,
      status: lastReceipt.status,
      block_number: lastReceipt.blockNumber.toString(),
    };

    if (ctx.activeEventId != null) {
      activityLog.enrichEvent(ctx.activeEventId, {
        txHash: result.tx_hash,
        txStatus: result.status,
        blockNumber: result.block_number,
      });
    }

    return result;
  }

  // Third-party: return all unsigned transactions in order
  const transactions: UnsignedTransaction[] = steps.map((step) => ({
    to: step.params.address,
    data: encodeFunctionData({
      abi: step.params.abi,
      functionName: step.params.functionName,
      args: step.params.args,
    }),
    value: (step.params.value || 0n).toString(),
    chainId: ctx.chain.id,
    meta: { tool: step.toolName, description: step.description },
  }));

  return {
    mode: "unsigned_transaction",
    transactions,
    instructions: "Sign and submit these transactions in order. Each must confirm before sending the next.",
  };
}
