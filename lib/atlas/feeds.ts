/**
 * Per-chain feed configuration for the browser live client: the keyless public RPC endpoints it reads and the request
 * limits measured for each. Pure data, so live-client.ts, the registry verifier and the diagnostic scripts share one
 * source of truth. Every limit here is a measurement (scripts/probe-endpoint-caps.mjs; facts table in
 * docs/LIVE-FEED.md). Re-measure before changing one.
 *
 * `largeBody` marks the endpoints that serve the registry-filtered settlement queries. Their address list sits in an
 * indexed topic position at ~68 bytes per address, so each request is tens of KB, and a public node refuses a list or
 * a block span above its own cap. Each largeBody endpoint therefore carries its measured `maxTopics` (largest address
 * list accepted) and `maxRange` (largest filtered eth_getLogs block span accepted), and verify-registry.cjs fails the
 * build when a chain's evidenced-address filter or its chunk size exceeds the smallest cap among them: otherwise every
 * filtered request to that endpoint fails and the feed degrades to Partial. The other endpoints serve only small calls
 * (headers and the unfiltered sample).
 */
import type {Chain} from './model';

export interface Endpoint {url:string;largeBody:boolean;maxTopics?:number;maxRange?:number}
export interface FeedConfig{
 endpoints:Endpoint[];chainId:number;
 /** Nominal block interval, for interpolated timestamps and for sizing one hour in blocks. */
 slotMs:number;
 /** Blocks in the backfilled hour. */
 blocks:number;
 /** Blocks per filtered eth_getLogs request. */
 chunk:number;
 /** Blocks per live poll when caught up, and when catching up. */
 liveRange:number;catchupRange:number;
 /** Pause between backfill requests, for endpoints that rate-limit bursts. */
 pauseMs:number;
 /** Unfiltered blocks per denominator sample. Sized to a few hundred logs on each chain. */
 sampleBlocks:number;
}
/** Date the maxTopics and maxRange figures below were last measured (Base and Avalanche on 2026-10-21, Tron on 2026-10-06, Polygon and Optimism on 2026-10-01). */
export const ENDPOINTS_MEASURED='2026-10-21';
/**
 * Endpoints, all keyless and browser-callable (CORS confirmed 2026-09-21). One hour is 300 Ethereum blocks, 1,800 Base
 * blocks or 14,400 Arbitrum blocks. Measured 2026-09-21 in the live request shape, three tries per size:
 *  - 4800 and 5000 are the largest sizes tried, so they are lower bounds rather than caps.
 *  - eth.drpc.org and the Tenderly gateway reject 1,024 addresses in one position ("exceed max topics"); 1,000 passes.
 *  - arb1.arbitrum.io counts the token contracts and the event topic against a 1,000-selector limit, so with Arbitrum's
 *    two contracts it takes at most 997 addresses (998 fails). Adding a token contract lowers that by one. It also
 *    rate-limits bursts, hence the pause between Arbitrum backfill requests.
 *  - 1rpc.io/eth was a filter endpoint until 2026-09-20; on 2026-09-21 it refused the 805-address filter 3 of 3 times
 *    (HTTP 503, and an upstream asking for an OnFinality API key), so it now serves only small calls.
 *  - eth-pokt.nodies.app returns 403 to any large POST; arbitrum.drpc.org takes the filter only over 100 blocks; the 1rpc
 *    L2 endpoints cap eth_getLogs at 50 blocks and rate-limit. They serve headers and the unfiltered sample.
 */
export const FEEDS:Partial<Record<Chain,FeedConfig>>={
 Ethereum:{
  endpoints:[{url:'https://eth.drpc.org',largeBody:true,maxTopics:1000,maxRange:100},{url:'https://rpc.mevblocker.io',largeBody:true,maxTopics:4800,maxRange:5000},{url:'https://1rpc.io/eth',largeBody:false},{url:'https://eth-pokt.nodies.app',largeBody:false}],
  chainId:1,slotMs:12000,blocks:300,chunk:50,liveRange:6,catchupRange:50,pauseMs:0,sampleBlocks:2
 },
 Base:{
  // Re-measured 2026-10-21. mainnet.base.org served the filter over 2,000 blocks on 2026-09-21; that day it answered
  // a wider filtered read with HTTP 413 and -32614 "eth_getLogs is limited to a 200 range", then refused every
  // eth_getLogs from the measuring machine with HTTP 429 -32011 "request limit reached" while still answering other
  // calls, so it serves only the small calls. base.gateway.tenderly.co and rpc.sentio.xyz/base take 4,800 addresses
  // but only 1,000 blocks, and returned the same logs as publicnode, so the chunk is 1,000 rather than 1,500: the
  // 1,800-block hour is two chunks either way, and the filtered feed has three endpoints instead of one. Sentio
  // refuses a wider read with HTTP 429, which the client takes as a rate limit, so catchupRange stays at the chunk.
  endpoints:[{url:'https://base-rpc.publicnode.com',largeBody:true,maxTopics:4800,maxRange:5000},{url:'https://base.gateway.tenderly.co',largeBody:true,maxTopics:4800,maxRange:1000},{url:'https://rpc.sentio.xyz/base',largeBody:true,maxTopics:4800,maxRange:1000},{url:'https://mainnet.base.org',largeBody:false},{url:'https://1rpc.io/base',largeBody:false}],
  chainId:8453,slotMs:2000,blocks:1800,chunk:1000,liveRange:30,catchupRange:1000,pauseMs:0,sampleBlocks:2
 },
 Arbitrum:{
  endpoints:[{url:'https://arbitrum.gateway.tenderly.co',largeBody:true,maxTopics:1000,maxRange:5000},{url:'https://arb1.arbitrum.io/rpc',largeBody:true,maxTopics:997,maxRange:5000},{url:'https://arbitrum.drpc.org',largeBody:false},{url:'https://1rpc.io/arb',largeBody:false}],
  chainId:42161,slotMs:250,blocks:14400,chunk:1200,liveRange:200,catchupRange:1200,pauseMs:350,sampleBlocks:40
 },
 /**
  * Added 2026-09-25 after measuring four issuer-native candidates (docs/measurements/2026-09-25/
  * new-chain-candidates.md). Celo was rejected despite being the busiest chain of the four by raw volume — its
  * traffic is retail, and only three evidenced wallets touched it in three days — and Optimism was third on both
  * value and wallet count. BNB Chain was excluded before measuring: its stablecoins are bridge-issued pegs
  * (decision D4). Polygon was chosen alongside Avalanche, parked, and switched on 2026-10-01; see below.
  */
 Avalanche:{
  // Re-measured 2026-10-21. api.avax.network served the filter over 5,000 blocks on 2026-09-25; it now caps a
  // filtered eth_getLogs at 100 blocks (10 a few hours earlier the same day) and answers a wider one with HTTP 200
  // and -32602 "block range too large", so it serves only the small calls. It echoes the request origin instead of
  // sending '*', which is fine for a real page load. avalanche.gateway.tenderly.co, found the same day, takes 5,000
  // blocks and 4,800 addresses like publicnode and returned the same logs, so the filtered feed keeps two endpoints.
  // avalanche.drpc.org caps the filter at 100 blocks, so it too serves only the small calls (headers and the
  // unfiltered sample) and does not drag the chunk down. 3,000 blocks is one hour at the measured 1.14 s block
  // time, rounded to a nominal 1.2 s; real header times are interpolated anyway.
  endpoints:[{url:'https://avalanche-c-chain-rpc.publicnode.com',largeBody:true,maxTopics:4800,maxRange:5000},{url:'https://avalanche.gateway.tenderly.co',largeBody:true,maxTopics:4800,maxRange:5000},{url:'https://api.avax.network/ext/bc/C/rpc',largeBody:false},{url:'https://avalanche.drpc.org',largeBody:false}],
  chainId:43114,slotMs:1200,blocks:3000,chunk:1500,liveRange:40,catchupRange:1500,pauseMs:0,sampleBlocks:60
 },
 /**
  * Switched on 2026-10-01 (docs/measurements/2026-10-01/). Polygon cleared the activity gate
  * on 2026-09-25 and was parked the next day, because the 90-day dormancy scan decision D2 requires did not fit
  * on the keyless endpoints known then: polygon-bor-rpc.publicnode.com prunes history older than ~37 hours and
  * polygon.drpc.org serves 100 blocks per request (~102,000 requests a month). polygon.gateway.tenderly.co serves
  * the full 90 days in 200,000-block spans and returned the same logs as drpc at four depths, so the scan is a
  * few dozen requests and the 100-block chunk drpc forced is gone: drpc now serves only the small calls.
  * USDC only: Polygon's widely used USDT is bridge-issued (evm.ts). 2,400 blocks is one hour.
  */
 Polygon:{
  // polygon-rpc.com answers HTTP 401 "API key disabled, tenant disabled" and is deliberately not listed.
  endpoints:[{url:'https://polygon.gateway.tenderly.co',largeBody:true,maxTopics:1000,maxRange:5000},{url:'https://polygon-bor-rpc.publicnode.com',largeBody:true,maxTopics:1000,maxRange:5000},{url:'https://rpc.sentio.xyz/matic',largeBody:true,maxTopics:4800,maxRange:5000},{url:'https://polygon.drpc.org',largeBody:false}],
  chainId:137,slotMs:1500,blocks:2400,chunk:1200,liveRange:40,catchupRange:1200,pauseMs:0,sampleBlocks:10
 },
 /**
  * Added 2026-10-01 in the same wave as Polygon, so the 24H and 7D windows re-lock once rather than twice.
  * Third on measured evidenced activity on both 2026-09-25 and 2026-10-01 (12 wallets, ~$27.6M in three days,
  * mostly Coinbase). USDC only: Tether publishes no USDT contract for OP Mainnet. 1,800 blocks is one hour.
  */
 Optimism:{
  // optimism.drpc.org refuses filtered ranges on its free plan, so it serves only the small calls.
  endpoints:[{url:'https://optimism.gateway.tenderly.co',largeBody:true,maxTopics:4800,maxRange:5000},{url:'https://optimism-rpc.publicnode.com',largeBody:true,maxTopics:4800,maxRange:5000},{url:'https://mainnet.optimism.io',largeBody:true,maxTopics:1000,maxRange:5000},{url:'https://optimism.drpc.org',largeBody:false}],
  chainId:10,slotMs:2000,blocks:1800,chunk:1500,liveRange:30,catchupRange:1500,pauseMs:0,sampleBlocks:10
 },
 /**
  * Added 2026-10-06 (docs/measurements/2026-10-06/). Tron speaks EVM-shaped JSON-RPC with no key:
  * addresses inside topics and logs are the 20-byte hex form of the base58 T-address (tron.ts converts both ways), and
  * USDT TR7NHq…Lj6t is 0xa614f803b6fd780986a42c78ec9c7f77e6ded13c. USDT only: Circle no longer issues USDC on Tron.
  * Tron is not an EVM chain in the model, so it is never a derivation target; every Tron row is a Tronscan tag (D6).
  * Measured 2026-10-06 in the live request shape: eth_chainId 0x2b6653dc on both filter endpoints, block timestamps in
  * seconds, 3-second blocks, about 44 USDT logs per block unfiltered. Both filter endpoints take 1,000 addresses in a
  * position and serve 90 days back, and both refuse any reply over 10,000 logs (-32005), so the binding limit is the
  * busiest wallets' log count, not the block span: 600-block chunks keep a reply well under it.
  * tron-evm-rpc.publicnode.com sends brotli (one hour of the nine first wallets: 0.67 MB on the wire, against 5.29 MB
  * from api.trongrid.io, which does not compress), so it comes first and TronGrid is the fallback.
  */
 Tron:{
  endpoints:[{url:'https://tron-evm-rpc.publicnode.com',largeBody:true,maxTopics:1000,maxRange:1200},{url:'https://api.trongrid.io/jsonrpc',largeBody:true,maxTopics:1000,maxRange:1200},{url:'https://tron-rpc.publicnode.com/jsonrpc',largeBody:false}],
  chainId:728126428,slotMs:3000,blocks:1200,chunk:600,liveRange:20,catchupRange:600,pauseMs:250,sampleBlocks:6
 }
};
