export const TREASURY_ABI = [
  {
    name: "getTotalVaultStatus",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "totalPrincipal", type: "uint256" },
      { name: "totalBalance", type: "uint256" },
      { name: "totalYield", type: "uint256" },
      { name: "numDepositors", type: "uint256" },
    ],
  },
  {
    name: "getVaultStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      { name: "depositedPrincipal", type: "uint256" },
      { name: "availableYield", type: "uint256" },
      { name: "totalBalance", type: "uint256" },
      { name: "hasVault", type: "bool" },
    ],
  },
  {
    name: "getCurrentRate",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getSpenderConfig",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "agent", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "authorized", type: "bool" },
      { name: "yieldOnly", type: "bool" },
      { name: "maxPerTx", type: "uint256" },
      { name: "spentInWindow", type: "uint256" },
      { name: "windowStart", type: "uint40" },
      { name: "windowDuration", type: "uint40" },
      { name: "windowAllowance", type: "uint256" },
    ],
  },
  {
    name: "isAuthorizedSpender",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "agent", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  // ── Events ──
  {
    name: "Deposited",
    type: "event",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "wstETHAmount", type: "uint256", indexed: false },
      { name: "stETHValue", type: "uint256", indexed: false },
    ],
  },
  {
    name: "YieldWithdrawn",
    type: "event",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "wstETHAmount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "SpenderAuthorized",
    type: "event",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "spender", type: "address", indexed: true },
      { name: "maxPerTx", type: "uint256", indexed: false },
      { name: "windowDuration", type: "uint40", indexed: false },
      { name: "windowAllowance", type: "uint256", indexed: false },
    ],
  },
  {
    name: "SpenderRevoked",
    type: "event",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "spender", type: "address", indexed: true },
    ],
  },
  {
    name: "PrincipalWithdrawn",
    type: "event",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "wstETHAmount", type: "uint256", indexed: false },
    ],
  },
] as const;
