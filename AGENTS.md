# Instructions for coding agents

Read `HANDOFF.md` first. It is the current state of the project, the rules, and the
workflows. `docs/METHODOLOGY.md` explains the evidence model in depth and
`docs/PLAN-2026-09.md` is the approved plan behind the last four commits.

Hard rules, in short:

- Every address-to-entity attribution needs the address's own explorer page showing a
  public name tag. No guessing, no third-party compilations. Store the tag verbatim.
- Never add deposit addresses, funders, routers, bridges, token contracts or issuer
  treasuries to the registry. Never bypass explorer CAPTCHAs.
- `lib/atlas/known-addresses.ts` is generated. Edit `scripts/registry/addresses.txt`,
  run `probe-code.mjs` then `gen-addresses.mjs`, and let the generator refuse orphans.
- `node scripts/verify-all.mjs` must pass before any build. `pnpm build:live` is gated on
  it; do not remove the gate or weaken a failing assertion.
- The live build is static and keyless. Do not add a server, runtime env vars or API keys.
- The observed-onchain figure is a declared sample. Never scale it up.
- Lint has 45 pre-existing errors (recounted 2026-09-21). Do not add to that count.
- No synthetic data, ever. Everything shown must be real, live or recent. Never fall back
  to simulated values when a feed fails; show the honest health state. The old demo engine
  in `lib/atlas/engine.ts` is slated for removal.
- Add as much real data and as many sources as free APIs and public endpoints allow. When
  free sources are running out (rate limits, key-only chains, exhausted labels), stop and
  tell Jake which free/paid APIs to get and what each unlocks. He signs up himself.
- Commit as `git -c user.email="223131039+jakeperc@users.noreply.github.com" -c user.name="Jake Percy"`.

Deliverable for Jake is a zip of `dist-live/` that he FTPs into a folder under
`public_html` on jakepercy.com.
