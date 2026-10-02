# Blockchain Flow Map

> {{summary}} {{caveat}}

**What it shows.** A full-screen map: an interactive globe that unfolds into an Equal Earth map. It is by Jake Percy, and the page was formerly named Ledger Atlas. The page labels itself "THE SETTLEMENT MAP", "Attributed cross-border stablecoin settlement." and "GLOBAL SETTLEMENT INTELLIGENCE". Its drawing rule, in its words: "{{rule}}"

**How to read it.** Value is USD at a timestamped price; an unpriced transfer is counted separately and is "never assigned a $1 peg". Observed value is every priced USDC or USDT transfer the page reads. Adjusted value removes "confirmed mint/burn, bridge legs, self/same-entity transfers, exchange treasury, bots and infrastructure". The mapped layer is labelled "Geographically attributed": "Both endpoints need operating-entity evidence, an explicit jurisdiction, HIGH or VERIFIED confidence, and review within 180 days." The two jurisdictions must differ. "Global coverage = mapped cross-border USD / adjusted USD." A line's width is bounded log USD, but "Particle speed, the short comet tail behind each particle and arc height carry no quantity", and "the brighter end of a line is its destination". A glow, beam or brighter land marks one-sided evidenced activity at a jurisdiction and is never a route. Times are UTC.

**Evidence.** Evidence comes in three kinds. A first-party label is a public name tag read on that chain's own block explorer, rated VERIFIED ("Documented primary evidence") or HIGH ("Corroborated operating-entity evidence"). DERIVED evidence reuses an Ethereum label for a plain key-controlled account on another chain ("Contract addresses never derive") and is "never VERIFIED". INFERRED evidence is an unlabelled deposit address seen sweeping into a first-party-labelled wallet ("It is inference from on-chain behaviour, not a published label"). All three face one bar, "at least HIGH confidence (score >= .80), inspectable source/evidence, and verification within 180 days", so any can draw a route, but "only a first-party label may anchor a deposit-address inference; derived evidence never does". "Anyone can send to an address on another chain without the owner's cooperation, so derived evidence is weaker as a receiver than as a sender". The clock behind "verification within 180 days" runs from the "Last verified" date on each evidence card (for a first-party label, the earlier of when its explorer page was read and when its entity's jurisdiction source was last checked), counted at each transfer's own time.

**Do not conclude.** An address does not reveal where its owner is: "Endpoints represent evidenced jurisdiction associations of specific operating entities, not customers, beneficial owners, users, IP locations or headquarters by default." A missing line is not missing activity: "This is not evidence of no onchain activity." Coverage describes "dataset coverage, not national payment coverage". The first headline figure is labelled "Observed on evidenced wallets" when the page holds an unfiltered sample and "Observed onchain" when it does not (24H, 7D, early in a session). Despite its shorter label "Observed onchain", the figure is not whole-chain volume: both labels sit on a count of only the transfers that touch an evidenced wallet ("This build requests only transfers touching an evidenced wallet, so the figures above describe evidenced settlement, not all on-chain activity."). The unfiltered sample is how the page states the evidenced share ("To say how small that share is without guessing, a plain unfiltered slice of chain time is read periodically and accounted identically."); it appears under "Unfiltered sample" in the Data & coverage panel, is not added to the headline figures, and is "never scaled up to the window". The page adds "Stablecoin transfers do not prove trade, remittances or beneficial ownership. Adjusted activity is an estimate." and "Entity evidence is time-bound and can be wrong." The methodology adds "Unusual activity is not evidence of illegality." The "Largest unplaced counterparties" list is "Research leads only: an address is attributed from its own explorer name tag and an operator document, never from who it transacts with." Only issuer-published contracts are read: "A bridge-issued pegged token is therefore excluded even where it dominates a chain's volume", which is why BNB Chain is absent.

**Views.** The map is one screen. Inside it: the global view (globe or Equal Earth map, three headline figures, leading corridors, {{windows}}, Playback, and a Raw events switch: "They are not an unfiltered transaction feed."); an "Explore a jurisdiction" panel; a corridor panel with baselines and "Why is this mapped here?" evidence cards; an Unmapped tab ("Where the map goes quiet."); and Methodology and "Data & coverage" panels, the latter with per-chain health (LIVE, Backfilling, Partial, Delayed, Reconnecting, Connecting, Misconfigured). None of these views has an address: the map has no URL routes or hash links. The only URL parameters are two debug flags, ?fallback=svg (the flat SVG map) and ?debug=map (renderer statistics).

**Landmarks.** A second page lists landmark transactions, all-time and recent, as static text with an id per story. Each is read from its own chain by two Bitcoin operators or three Ethereum endpoints, which must agree. A name comes only from an explorer's own tag crediting no outside source, or a court, government or party document identifying the address or transaction, by its id or by a description that a complete read matches to exactly one transaction; news and analytics firms never name anyone.

**Data and freshness.** Live, in the visitor's browser: "read directly by your browser (no server, no database)". Each chain's allowlisted USDC and USDT Transfer logs are requested with eth_getLogs from keyless public RPC nodes, filtered by a list of evidenced addresses in the sender position and again in the receiver position: a transfer comes back when either end is on the list, and both ends are then looked up in the whole registry. A small unfiltered sample is read separately, periodically. Prices come from CoinGecko, with Coinbase Exchange and Kraken as fallbacks. The address registry is not fetched: it is bundled into the page at build time. The 5M and 1H windows come from transfers held in memory. 24H and 7D are assembled from "summaries of every completed 15 minutes this browser has watched", kept in that browser's own storage (IndexedDB); in the methodology's words, "it is one browser's record of what it watched". There is no API and no file of flows; the only data file is the map outline listed under Data. Current figures exist only inside a running browser tab, so a reader that cannot run the page has no source for them, and none appear here.

{{current}}

**Author.** Jake Percy; the Methodology panel is signed "BLOCKCHAIN FLOW MAP BY JAKE PERCY". Contact details are in the hub file linked under Related.

## Data

- [world-110m.json]({{site}}world-110m.json): the only data file the site serves; Natural Earth country outlines as TopoJSON at 110m scale, static cartography with no flow, price or registry content; "Cartographic boundaries do not assert sovereignty."

## Methodology

- [methodology{{methodExt}}]({{site}}methodology{{methodExt}}): methodology v1 in full: the layers, the coverage formula, the visual encodings, inferred and derived evidence, issuer-published contracts, recorded history and baselines

## Related

- [Blockchain Flow Map]({{site}}): the dashboard (needs JavaScript)
- [Landmarks]({{site}}landmarks.html): landmark transactions, with sources (static text)
- [Jake Percy]({{hub}}): the author and his other dashboards

## Optional

- [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses): the issuer registry the page cites for USDC contracts
- [Tether supported protocols](https://tether.to/supported-protocols/): the issuer list the page cites for USDT contracts
- [Natural Earth terms of use](https://www.naturalearthdata.com/about/terms-of-use/): the geography credit, "Public-domain geography"
