# Ledger Atlas

A full-screen, stablecoin-first map of **attributed cross-border onchain settlement**. Built with Three.js, Equal Earth geography, React and server-side Cloudflare D1 aggregation.

## Delivery status

The application runs immediately in a clearly labeled deterministic **DEMO DATA** environment. No API credentials, real entity attribution registry or production price service were provided. Production mode remains unconnected until those are configured. Provider connectors have not been validated against live paid feeds. The WebGL renderer is included; the available browser test environment lacked WebGL, so interaction QA covered the compatibility renderer.

## Experience

- Country and corridor exploration, explicit provenance, underlying transactions and confidence color mode.
- 5M, 1H, 24H and 7D rolling windows, a 24-hour replay timeline, seed controls and chain filtering.
- Three separate monetary totals, transparent adjustments and geographically unallocated value.
- Bounded, hysteresis-ranked routes, constant-speed directional particles, log-scaled widths and sampled large-transfer pulses.
- Three.js geometry and GPU particle buffers, adaptive rendering, touch navigation and an SVG compatibility renderer.

## Structure

- `lib/atlas/model.ts`: semantic contracts for transfers, entity evidence and corridors.
- `lib/atlas/engine.ts`: deterministic fixtures, versioned economic classification and aggregation.
- `lib/atlas/connectors.ts`: server-only finalized EVM and confirmed Tron connectors; validated common intake contract.
- `lib/atlas/production.ts`: persistent SQL window aggregation and baseline completeness checks.
- `lib/atlas/store.ts`: database access, evidence resolution, deduplication and ingestion authorization.
- `components/world-map.tsx`: Three.js world renderer. `map-fallback.tsx`: unsupported-device fallback.
- `components/atlas.tsx`: observation, exploration and investigation UI.
- `db/schema.ts`, `drizzle/`: durable state and schema migrations.

Pipeline: chain providers → normalization → stable event identity / deduplication → timestamped USD valuation → economic classification → entity evidence → jurisdiction admissibility → rolling SQL aggregation → SSE → bounded map rendering.

Read [Methodology](docs/METHODOLOGY.md) and [Operations](docs/OPERATIONS.md) before connecting real data. Those files describe the source contract, excluded economics, evidence thresholds, coverage denominators, operational limitations and secrets.

## Local development

Use the declared pnpm version and lockfile. `pnpm dev` runs the development server; `pnpm build` creates the Worker. In a Sites-managed environment use the Sites build/preview workflow. The hosted application is private by default.

For local D1 after the build, apply each pending generated migration once:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_mute_romulus.sql
```

Generate new schema changes with `pnpm db:generate`. Never rewrite an applied migration. Deployment applies migrations to its own managed database.

## Static live build (no backend)

`pnpm build:live` builds the full UI as plain static files in `dist-live/` with an in-browser live source for Ethereum, Base and Arbitrum (`lib/atlas/live-client.ts`) in place of the server API, deployable by FTP to any folder. See [live-lite/README.md](live-lite/README.md) for scope and limits.

## Validation

`node node_modules/typescript/bin/tsc --noEmit` checks the application.

The conservation and attribution gate regression check runs after compiling the pure model:

```sh
node node_modules/typescript/bin/tsc lib/atlas/model.ts lib/atlas/geography.ts lib/atlas/engine.ts --module commonjs --outDir /tmp/ledger-atlas-check --target ES2020 --skipLibCheck --esModuleInterop
node scripts/verify-model.cjs /tmp/ledger-atlas-check
```

The evidence registry check compiles the same way with `lib/atlas/known-addresses.ts lib/atlas/known-entities.ts` added, then runs `node scripts/verify-registry.cjs <outDir>`: every address must resolve to an entity, every jurisdiction must exist in `lib/atlas/geography.ts`, and every attribution must be admissible today. Note: the compile output directory needs a `package.json` containing `{"type":"commonjs"}` if a parent directory declares ES modules.

The check verifies all four windows, seed reproducibility, monetary conservation, reconnect deduplication, geographic rejection, production isolation, economic exclusions, missing prices and chain filters. Browser QA covers desktop/mobile layouts, evidence inspection, source switching and controls.

## Attribution

Created for Jake Percy. Geography: Natural Earth via world-atlas 2.0.2 (public domain). Data fixture entities and addresses are fictional. The simulated monetary values carry no statement about actual jurisdictions.
