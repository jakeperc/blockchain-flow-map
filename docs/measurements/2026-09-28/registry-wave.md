# Country wallet screen and Avalanche first-party labels — 2026-09-28

## Method

`label-scan.mjs` queried the public Snowscan and Basescan search indexes for country-specific
exchange names. These were leads, not attribution evidence. After removing addresses already
evidenced on each chain and applying a lightweight title filter for deposit/funder/token plumbing, `screen-activity.mjs`
queried issuer-native USDC/USDT Transfer logs through the project's free public RPC pools.
Snowscan candidates used a three-day Avalanche window; Basescan and Etherscan candidates
used seven days on Base and Ethereum respectively. All three screens had **zero failed
chunk queries**. Values below are incoming plus
outgoing token units at face value, used only to prioritise wallet evidence. They are not
net flows, mapped settlement, or estimates of national activity.

| Screen | Previously unevidenced candidates | Active | Admitted |
| --- | ---: | ---: | ---: |
| Snowscan / Avalanche, 3 days | 98 | 1 | 1 |
| Basescan / Base, 7 days | 115 | 0 | 0 |
| Etherscan / Ethereum, 7 days | 19 | 1 | 0 |

Seven previously derived Avalanche wallets whose own Snowscan pages had public tags were
screened separately. Four cleared the $100k three-day admission floor; Lemon Cash 8 and
Bitpanda 18 were below it, and Coinsquare 27 was idle. They remain derived evidence.

A country-focused re-scan of **35 Etherscan search terms** found no new unregistered
address hit relative to the 2026-09-21 `label-scan.json`. Search results can be capped,
so this is a useful monthly check, not proof that every tag has been enumerated.
Of 19 previously unregistered, wallet-like hits from those terms, **Kanga Exchange 1**
alone was active in the seven-day Ethereum screen: about $22.1M of incoming plus outgoing
USDC/USDT. Its [own Etherscan page](https://etherscan.io/address/0x42d17b7f3532ec2f7c4e4e5e239baa476846e2cd)
shows that tag. It was **not admitted**: the [Polish KNF warning](https://www.knf.gov.pl/en/CONSUMERS/Information_for_the_financial_market_consumers/Public_warnings?warningName=kanga.exchange&warningTypeId=all)
says the companies behind kanga.exchange are not registered in Poland, Kanga's
[EU platform](https://kangaexchange.eu/pl/about) names a separate Latvia entity,
and Kanga's [whitepaper](https://s3.kanga.services/assets/v1/projects/kanga-exchange/kng/white_paper-en.pdf)
describes a Belize company as a *previous* operator. The brand-level address tag
does not identify one current operating or custodying entity. In particular, the
wallet cannot be assigned to Poland merely because Kanga has a Polish presence.

## Admitted Snowscan rows

Each link is the address's **own Avalanche explorer page**, read on 2026-09-28. The tag
column stores the text shown on that page verbatim. Entity jurisdiction still comes from
the regulator or company document linked in `lib/atlas/known-entities.ts`.
Thailand's [SEC licensee register](https://market.sec.or.th/LicenseCheck/views/DABusiness?exchange/en)
was re-read on 2026-09-28 and names Bitkub Online Company Limited as a digital asset exchange.

| Entity jurisdiction | Address and public tag | Three-day activity | Change |
| --- | --- | ---: | --- |
| Thailand (Bitkub Online Company Limited) | [Bitkub 10](https://snowscan.xyz/address/0x91013c9c7c2a856b26df52a8a117afeb9fc90379) | $363k | New wallet |
| South Africa (VALR (Pty) Ltd) | [VALR: Hot Wallet](https://snowscan.xyz/address/0x05cdb1526f6e224e02919a4c018d9784ea25eb3d) | $54.39M | Derived → first-party |
| Türkiye (BtcTurk) | [BtcTurk 13](https://snowscan.xyz/address/0x76ec5a0d3632b2133d9f1980903305b62678fbd3) | $12.92M | Derived → first-party |
| Taiwan (MaiCoin) | [MaiCoin 1](https://snowscan.xyz/address/0x477b8d5ef7c2c42db84deb555419cd817c336b6f) | $2.02M | Derived → first-party |
| Gibraltar (Bitso operator) | [Bitso 1](https://snowscan.xyz/address/0x58b704065b7aff3ed351052f8560019e05925023) | $324k | Derived → first-party |

The four promotions do not add unique chain addresses to `evidencedAddresses()`. They
replace `DERIVED` with first-party evidence and make those wallets eligible to anchor
deposit inference. No corridor improvement is claimed without a matched-window replay.
The full 90-day dormancy refresh on 2026-09-28 completed with no failed ranges and
measured **24 active of 764** evidenced Avalanche addresses, including the new Bitkub row.

Source artifacts: `snowscan-scan.json`, `snowscan-unknown.txt`, `snowscan-activity.json`,
`snowscan-promotions-activity.json`, `basescan-scan.json`, `basescan-unknown.txt`, and
`basescan-activity.json`, `etherscan-country-scan.json`,
`etherscan-country-unknown.txt`, and `etherscan-country-activity.json` in this directory.
