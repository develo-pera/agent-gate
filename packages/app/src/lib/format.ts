import { formatEther } from "viem";

export function formatWsteth(value: bigint | undefined): string {
  if (value === undefined) return "0.0000";
  const raw = formatEther(value);
  const num = parseFloat(raw);
  return num.toFixed(4);
}

export function formatRate(value: bigint | undefined): string {
  if (value === undefined) return "0.000000";
  const raw = formatEther(value);
  const num = parseFloat(raw);
  return num.toFixed(6);
}

export function formatUsd(value: number | undefined): string {
  if (value === undefined) return "\u2014";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
