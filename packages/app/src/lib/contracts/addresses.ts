import type { Address } from "viem";

export const TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as Address;

export const BASE_WSTETH =
  "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452" as Address;

export const L1_ADDRESSES = {
  stETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as Address,
  wstETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as Address,
};
