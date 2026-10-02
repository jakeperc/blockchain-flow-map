/**
 * Chains the Landmarks page can show, with their explorers and dot colours. Self-contained so the build scripts can
 * import it without compiling. The chains the map also reads must match lib/atlas/geography.ts exactly (same colour,
 * same explorer links); scripts/verify-landmarks.mjs asserts that, so the two pages cannot drift. Bitcoin and Liquid
 * live only here: adding them to CHAINS in lib/atlas/model.ts would make the map list them as "Not connected".
 */

export interface ChainInfo {
  name: string;
  /** The explorer a reader is sent to, and whose own name tags count under decision D7 (tag tier). */
  explorer: string;
  /** Host whose name tags are admissible for this chain, or null when the explorer publishes none. */
  tagHost: string | null;
  tx: (h: string) => string;
  address: (a: string) => string;
  color: string;
  /** Native asset symbol. */
  native: string;
}

export const CHAIN_INFO: Record<string, ChainInfo> = {
  Bitcoin: {name: 'Bitcoin', explorer: 'mempool.space', tagHost: null, tx: (h) => `https://mempool.space/tx/${h}`, address: (a) => `https://mempool.space/address/${a}`, color: '#d6a35f', native: 'BTC'},
  Liquid: {name: 'Liquid', explorer: 'Blockstream Explorer', tagHost: null, tx: (h) => `https://blockstream.info/liquid/tx/${h}`, address: (a) => `https://blockstream.info/liquid/address/${a}`, color: '#8fb8c8', native: 'L-BTC'},
  Ethereum: {name: 'Ethereum', explorer: 'Etherscan', tagHost: 'etherscan.io', tx: (h) => `https://etherscan.io/tx/${h}`, address: (a) => `https://etherscan.io/address/${a}`, color: '#92a9e7', native: 'ETH'},
  Base: {name: 'Base', explorer: 'Basescan', tagHost: 'basescan.org', tx: (h) => `https://basescan.org/tx/${h}`, address: (a) => `https://basescan.org/address/${a}`, color: '#5c9ddd', native: 'ETH'},
  Arbitrum: {name: 'Arbitrum', explorer: 'Arbiscan', tagHost: 'arbiscan.io', tx: (h) => `https://arbiscan.io/tx/${h}`, address: (a) => `https://arbiscan.io/address/${a}`, color: '#81bfb3', native: 'ETH'},
  Polygon: {name: 'Polygon', explorer: 'Polygonscan', tagHost: 'polygonscan.com', tx: (h) => `https://polygonscan.com/tx/${h}`, address: (a) => `https://polygonscan.com/address/${a}`, color: '#c49ad2', native: 'POL'},
  Optimism: {name: 'Optimism', explorer: 'Optimistic Etherscan', tagHost: 'optimistic.etherscan.io', tx: (h) => `https://optimistic.etherscan.io/tx/${h}`, address: (a) => `https://optimistic.etherscan.io/address/${a}`, color: '#c9c77f', native: 'ETH'},
  Avalanche: {name: 'Avalanche', explorer: 'Snowscan', tagHost: 'snowscan.xyz', tx: (h) => `https://snowscan.xyz/tx/${h}`, address: (a) => `https://snowscan.xyz/address/${a}`, color: '#d98fae', native: 'AVAX'},
  Tron: {name: 'Tron', explorer: 'Tronscan', tagHost: 'tronscan.org', tx: (h) => `https://tronscan.org/#/transaction/${h}`, address: (a) => `https://tronscan.org/#/address/${a}`, color: '#de967d', native: 'TRX'},
  Solana: {name: 'Solana', explorer: 'Solscan', tagHost: null, tx: (h) => `https://solscan.io/tx/${h}`, address: (a) => `https://solscan.io/account/${a}`, color: '#b7a0d9', native: 'SOL'},
};

/** Chains whose history only one keyless operator serves today; their entries carry a "one public source" badge. */
export const SINGLE_SOURCE_CHAINS = ['Tron', 'Solana', 'Liquid'];
