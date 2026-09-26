/**
 * Per-chain feed configuration for the browser live client: the keyless public RPC endpoints it reads and the request
 * limits measured for each. Pure data, so live-client.ts, the registry verifier and the diagnostic scripts share one
 * source of truth. Every limit here is a measurement (scripts/probe-endpoint-caps.mjs; facts table in HANDOFF.md
 * section 5). Re-measure before changing one.
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
/** Date the maxTopics and maxRange figures below were measured (Polygon and Avalanche on 2026-09-25). */
export const ENDPOINTS_MEASURED='2026-09-25';
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
  endpoints:[{url:'https://mainnet.base.org',largeBody:true,maxTopics:4800,maxRange:2000},{url:'https://base-rpc.publicnode.com',largeBody:true,maxTopics:4800,maxRange:5000},{url:'https://1rpc.io/base',largeBody:false}],
  chainId:8453,slotMs:2000,blocks:1800,chunk:1500,liveRange:30,catchupRange:1500,pauseMs:0,sampleBlocks:2
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
  * (decision D4). Polygon was chosen alongside Avalanche and then parked; see PARKED below.
  */
 Avalanche:{
  // api.avax.network echoes the request origin instead of sending '*', which is fine for a real page load.
  // avalanche.drpc.org caps the filter at 100 blocks and timed out on the largest list, so it serves only the
  // small calls (headers and the unfiltered sample) and does not drag the chunk down. 3,000 blocks is one hour
  // at the measured 1.14 s block time, rounded to a nominal 1.2 s; real header times are interpolated anyway.
  endpoints:[{url:'https://api.avax.network/ext/bc/C/rpc',largeBody:true,maxTopics:4800,maxRange:5000},{url:'https://avalanche-c-chain-rpc.publicnode.com',largeBody:true,maxTopics:4800,maxRange:5000},{url:'https://avalanche.drpc.org',largeBody:false}],
  chainId:43114,slotMs:1200,blocks:3000,chunk:1500,liveRange:40,catchupRange:1500,pauseMs:0,sampleBlocks:60
 }
};
/**
 * Measured, working, and deliberately NOT read by the build (Jake's decision, 2026-09-26). Polygon cleared the
 * activity gate (20 evidenced wallets in one day, the broadest geography of the four candidates), and its live
 * feed works on these endpoints. What it cannot do on free endpoints is the 90-day dormancy scan decision D2
 * requires: polygon-bor-rpc.publicnode.com prunes history older than ~37 hours ("History has been pruned for
 * this block"), and polygon.drpc.org keeps full history but serves at most 100 blocks per request, so a scan is
 * ~102,000 requests, about 8 hours, every month. Shipping it unmeasured would mean every open tab uploading the
 * full 763-address filter on each poll, around 19 MB an hour — the cost D2 exists to remove.
 * Switch-on conditions: a keyed Polygon endpoint with archive access, or the phase-2 backend running the scan.
 * Then move this into FEEDS and add Polygon back to CHAINS and EVM_CHAINS in model.ts.
 */
export const PARKED:Partial<Record<string,FeedConfig>>={
 Polygon:{
  // polygon-rpc.com now answers HTTP 401 "API key disabled, tenant disabled" and is deliberately not listed.
  // drpc takes the filter over only 100 blocks, which binds the chunk. 2,400 blocks is one hour.
  endpoints:[{url:'https://polygon-bor-rpc.publicnode.com',largeBody:true,maxTopics:1000,maxRange:5000},{url:'https://polygon.drpc.org',largeBody:true,maxTopics:1000,maxRange:100}],
  chainId:137,slotMs:1500,blocks:2400,chunk:100,liveRange:40,catchupRange:100,pauseMs:0,sampleBlocks:2
 }
};
