# Ledger Atlas methodology v1

An address does not reveal its owner's physical location. Endpoints represent evidenced jurisdiction associations of specific operating entities, not customers, beneficial owners, users, IP locations or headquarters by default. Borders are cartographic references and do not assert sovereignty.

Observed value is all priced qualifying allowlisted USDT/USDC transfer logs in the captured dataset. Amounts retain atomic strings; USD is derived from a time-stamped price. Unpriced events are counted separately, never valued at an assumed peg. Deduplication uses chain + transaction hash/signature + event/instruction index; a transaction may contain many transfers.

Adjusted value excludes confirmed mint/burn, bridge legs, self/same-entity transfers, exchange treasury, bots and infrastructure. Unresolved and DeFi activity is retained and separately identified: this is a candidate economic activity estimate, not proof of payment. Classification is versioned.

Mapped value requires included adjusted events with two specific jurisdiction associations, different jurisdictions, at least HIGH confidence (score >= .80), inspectable source/evidence, and verification within 180 days. MEDIUM and UNKNOWN never draw a route. Scores are ordinal analyst assessments, not calibrated probabilities. Production rejects synthetic evidence. Headquarters alone are insufficient.

Global coverage = mapped cross-border USD / adjusted USD. Domestic, unresolved and unknown geography remain in the denominator. Country coverage = mapped inbound + outbound / adjusted value touching at least one admissible endpoint in that country. Unknown endpoints cannot enter a country's denominator. This describes dataset coverage, not national payment coverage.

Ranking uses log USD value, recency, confidence and anomaly, with 15% incumbent hysteresis. The renderer retains objects and interpolates width/opacity. Width uses bounded log10 USD. Color shows the dominant value-weighted chain, asset or confidence category; inspection shows all components. Particle speed and arc height carry no quantity. Anchors are jurisdiction references, not cities.

Jurisdiction activity glow (client build): a jurisdiction anchor is lit in proportion to adjusted value touching at least one admissible endpoint there (the same known-endpoint denominator used for country coverage). A glow is one-sided evidenced activity and never draws or implies a route; routes still require two admissible endpoints in different jurisdictions.

Inferred deposit addresses (client build): exchange customers deposit to per-customer addresses that the exchange sweeps into a labelled hot wallet. Within the retained buffer, an unlabelled address whose only outgoing transfers go to one registry entity, after receiving from outside that entity, and which forwarded at least 80% of what it received, is treated as that entity's deposit address. Such evidence is marked INFERRED in its category, source and note, cites the sweep transaction, carries HIGH confidence at the minimum admissible score, and is never persisted. It is inference from on-chain behaviour, not a published label; inspect any route to see which endpoints rest on it.

Baselines use preceding same-duration windows; at least four complete windows are required. Ratio = current / mean; z-score uses sample standard deviation. Production does not claim baseline availability from incomplete capture. Unusual activity is not evidence of illegality.

Demo uses a fixed seed and clock, the same Transfer and Corridor contracts, fictional entities, nominal synthetic USD prices and synthetic evidence. It is reproducible and is never labeled LIVE. No demo transaction links to a real block explorer.

Feed LIVE requires configured streams to be fresh and caught up. A browser connection alone is not proof of health. Unknown attribution yields an empty map even when onchain data flows.
