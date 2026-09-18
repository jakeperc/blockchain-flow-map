# Ledger Atlas operations

The hosted application opens in **DEMO DATA**. All jurisdictions, entities, classifications and transaction values in that mode are deterministic synthetic fixtures. No API key or evidence dataset was supplied during the build. No live provider has been validated end to end in this deployment.

## Supported production paths

| Chain | Input | V1 allowlist |
| --- | --- | --- |
| Ethereum | Server JSON-RPC, finalized logs, persisted cursor | Native USDC and USDT |
| Base | Same finalized EVM adapter, chain-ID checked | Native USDC |
| Arbitrum | Same finalized EVM adapter, chain-ID checked | Native USDC |
| Tron | TronGrid confirmed transfer events, persistent pagination | USDT |
| Solana | Authenticated normalized transfer-indexer intake and coverage watermark | Native USDC and USDT |

Not every token/chain pair is native or active. Wrapped substitutes are intentionally not silently admitted. The Solana integration requires an external complete transfer indexer; it does not sample transfers involving the mint address and imply complete coverage. The provider contract is implemented, but a specific Solana provider subscription is not configured.

## Secrets and collection

Set the server-only values described in `.env.example` through deployment runtime settings. Use a cryptographically random INGEST_SECRET of at least 24 characters. No secret appears in the browser or source. Run `scripts/collector.mjs` in a persistent server process with `LEDGER_ATLAS_ORIGIN` and `INGEST_SECRET`. It posts to `/api/collect` with backoff, independently of browser sessions. If the host's owner sign-in gate applies, the collector also requires an approved machine-access route; do not weaken site access to work around it.

Deployments include D1 schema migrations. D1 stores normalized events, entity evidence, time-stamped prices, capture cursors and health. No production synthetic records are inserted. Event replay uses `INSERT OR IGNORE` with chain + transaction + event index; cursor progress follows durable writes. EVM only processes finalized blocks and checks provider chain ID and block hash. Tron uses confirmed events and fixed-range paginated replay.

EVM polling starts nine finalized blocks before connection; it is not a historical full-chain backfill. Collection uses bounded batches to avoid overwhelming the Worker. Monitoring must confirm it catches up under real traffic and provider quotas. The demo supports all requested windows immediately; production windows contain only captured history. The UI reports the capture watermark, not an invented current-time total.

## USD valuation

Post authenticated batches of `{asset, at, usd, source}` to `/api/prices`. Supply a reputable timestamped price feed and historical prices before backfill. Polling uses a price within five minutes of each block time; otherwise USD is null. A failed or absent price feed never implies a $1 peg. Atomic token amounts are stored as strings; USD is floating-point analytics, not accounting-grade arithmetic. Unpriced event counts remain visible and USD coverage is therefore coverage of priced adjusted value only.

## Normalized intake

POST `/api/ingest` with `Authorization: Bearer <INGEST_SECRET>` and an array of at most 100 records matching `intakeSchema` in `lib/atlas/connectors.ts`. Solana endpoints must identify the token-account owners, not the token accounts themselves. Use signature + outer/inner instruction index as event identity. Adapter must reject reverted or unfinalized transactions. Raw indexer data is not accepted as geographic evidence.

Each record includes chain, transactionId, eventIndex, blockNumber, blockHash, blockTime (ms), tokenContract, amountAtomic, sender, receiver, finality, economicClass, classificationEvidence and an optional timestamped price. Defaults retain unknown economic purpose as unresolved. Known classifications require evidence notes. The trusted adapter is responsible for evidence-based bot/router/bridge and high-frequency labeling; heuristics are not invented from transfer amount alone.

After durable Solana event batches, POST `/api/watermark` with chain `Solana`, coverageStart, capturedTo, cursor, and complete `true`. The adapter must certify contiguous capture including zero-event intervals. This is a trusted-provider contract, not independently proven completeness. Arbitrary request arrival does not make the feed live.

## Attribution registry

POST `/api/evidence` with authenticated batches `{chain,address,attribution}`. The attribution object must have entity, addressCluster, category, jurisdiction, confidence, score, source, sourceUrl, evidenceNote, lastVerified, association `operating entity` and synthetic `false`. Use exact operating-entity evidence, not an exchange's broad corporate headquarters. Reviewed evidence must exist before ingested events can be mapped. Unknown, stale, MEDIUM, unsupported-country and synthetic evidence cannot form production corridors.

Evidence changes affect subsequent ingestion. Existing events keep their historical evidence and classification version. Reclassification and revocation of previously stored decisions require an audited reprocessing job; automatic retroactive mutation is deliberately not performed. Public-read endpoints never allow evidence edits.

## Read model and limitations

`/api/snapshot` performs SQL rolling aggregation for 5M, 1H, 24H and 7D. `/api/stream` emits only snapshots with bounded transaction samples via SSE and reconnects after 40 seconds. It never ingests directly. Feed health requires fresh collection, complete caught-up configured streams, and a reasonable finalized watermark. Unconfigured chains are individually labeled. Historical baselines require four complete preceding windows.

All corridor totals are SQL sums. Detail payloads currently include the top six transfers for the highest 80 corridors; entity values in production detail are **sample participation**, not full-corridor entity totals. No event-level firehose reaches the client. Production deployment still needs a real price service, reviewed attribution registry, provider setup, collector hosting and load validation before it can be represented as an operational intelligence feed.

## Data references

- Ethereum JSON-RPC: https://ethereum.github.io/execution-apis/api/methods/eth_getLogs/
- Native USDC allowlist: https://developers.circle.com/stablecoins/usdc-contract-addresses
- Tether protocols: https://tether.to/supported-protocols/
- Tron pagination: https://developers.tron.network/reference/get-events-by-contract-address
- Geography: world-atlas 2.0.2 / Natural Earth public domain

## Verification environment

Pure data-model regression checks and TypeScript validation pass. Browser interaction checks used desktop, 390px and 768px frame widths. The browser did not expose WebGL, so the Three.js path could be compiled but not visually exercised here; the compatibility map was tested. WebMCP registration is feature-detected and source-validated, but execution testing was unavailable because document.modelContext was not supported.
