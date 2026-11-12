# Claude project instructions

Read `AGENTS.md`, then `work/HANDOFF.md` when it exists: the maintainer's local notes on the current state, the rules
in practice, recent changes, verification and remaining work, kept out of the repository on purpose. Follow the links
in `AGENTS.md` to `docs/METHODOLOGY.md` and the relevant measurement reports when changing the registry.

After a material code, data, evidence, or deployment change, update `work/HANDOFF.md` when you commit: what changed,
verification results, unresolved work, and whether `dist-live/` was rebuilt. Never commit it. Keep the short status in
`README.md` synchronized. Do not rely on a prior chat as the sole handoff to the next agent.

## Fixes: issue first, then a pull request
- When you find a problem in this repo (something wrong, broken, missing or misleading), open a GitHub issue before fixing it: what is wrong, how it shows up, the likely cause.
- Fix it on a short branch and open a pull request whose description says `Fixes #<issue>`. The maintainer approves the merge; merging closes the issue.
- New features may skip the issue. Automated data publishes and scheduled runs never open one.
- Issue and pull request text is public. Run it through the local text guard before posting; it follows the same rules as files in this repo (no machine paths, no protected names).
- After the merge, pull the default branch and leave this checkout on it, clean, before the session ends.
