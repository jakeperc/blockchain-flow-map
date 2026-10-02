```json
{
  "id": "silk-road-2020",
  "list": "all-time",
  "category": "seizure",
  "label": "Silk Road bitcoin",
  "title": "The Silk Road bitcoin moves, and the US claims it",
  "dek": "On 3 November 2020 the address that a US complaint says held bitcoin taken from Silk Road paid out {{leg1.amount}}, then {{leg2.amount}} [1]. Two days later prosecutors filed to forfeit the coins, saying the United States took custody that day [1][3].",
  "criterion": "A forfeiture whose court filing names the address that held the coins [1], with the chain showing them leave it on the day the government says it took custody.",
  "priority": 8,
  "legs": [
    {
      "id": "leg1",
      "chain": "Bitcoin",
      "txid": "0d13a52e3b640d05cdf31b41f335b327f126cb79d9eec1e2bc46556ef30a0b57",
      "idSource": "m1",
      "basis": "btc-output",
      "output": 0,
      "asset": "BTC",
      "from": {"role": "the address that held the coins", "label": "Address named in the US forfeiture complaint", "evidence": {"kind": "document", "source": 1, "identifies": "address"}},
      "to": {"role": "the receiving address"},
      "todayApplicable": true
    },
    {
      "id": "leg2",
      "chain": "Bitcoin",
      "txid": "3f036ff88bb851b57a1e28780dbce35a6457a8b57995c095b55b3b0cf48ba9fd",
      "idSource": "m1",
      "basis": "btc-output",
      "output": 0,
      "asset": "BTC",
      "from": {"role": "the address that held the coins", "label": "Address named in the US forfeiture complaint", "evidence": {"kind": "document", "source": 1, "identifies": "address"}},
      "to": {"role": "the receiving address"},
      "todayApplicable": true
    }
  ],
  "matches": [
    {"id": "m1", "source": 1, "type": "btc-address-spend", "set": true, "address": "1HQ3Go3ggs8pFnXuHVHRytPCq5fGG8Hbhx", "window": {"from": "2020-11-03T00:00:00Z", "to": "2020-11-03T23:59:59Z"}}
  ],
  "status": {"asOf": "2026-10-02", "text": "The receiving address had not spent any of the coins when this page last read the chain."},
  "sources": [
    {
      "n": 1, "kind": "document", "docType": "court", "publisher": "US District Court, Northern District of California", "title": "Complaint for Forfeiture, United States v. Approximately 69,370 Bitcoin (3:20-cv-07811)", "date": "2020-11-05",
      "url": "https://www.courtlistener.com/docket/18607888/1/united-states-v-approximately-69370-bitcoin-btc-bitcoin-gold-btg/",
      "archive": "https://web.archive.org/web/20240822170225/https://www.courtlistener.com/docket/18607888/1/united-states-v-approximately-69370-bitcoin-btc-bitcoin-gold-btg/",
      "read": "2026-10-02",
      "quote": "On November 3, 2020, the United States took custody of the Defendant Property",
      "addresses": ["1HQ3Go3ggs8pFnXuHVHRytPCq5fGG8Hbhx"]
    },
    {
      "n": 2, "kind": "reporting", "publisher": "Elliptic", "author": "Tom Robinson", "title": "$1 Billion of Silk Road Bitcoins Are On The Move", "date": "2020-11-04",
      "url": "https://www.elliptic.co/blog/1-billion-silk-road-bitcoins-are-on-the-move",
      "archive": "https://web.archive.org/web/20201105082822/https://www.elliptic.co/blog/1-billion-silk-road-bitcoins-are-on-the-move",
      "read": "2026-10-02",
      "quote": "69,369 bitcoins, worth close to $1 billion, moved out of the bitcoin address",
      "txids": ["3f036ff88bb851b57a1e28780dbce35a6457a8b57995c095b55b3b0cf48ba9fd"],
      "addresses": ["1HQ3Go3ggs8pFnXuHVHRytPCq5fGG8Hbhx"]
    },
    {
      "n": 3, "kind": "document", "docType": "government", "publisher": "US Attorney's Office, Northern District of California", "title": "United States Files A Civil Action To Forfeit Cryptocurrency Valued At Over One Billion U.S. Dollars", "date": "2020-11-05",
      "url": "https://www.justice.gov/usao-ndca/pr/united-states-files-civil-action-forfeit-cryptocurrency-valued-over-one-billion-us",
      "archive": "https://web.archive.org/web/20201106224138/https://www.justice.gov/usao-ndca/pr/united-states-files-civil-action-forfeit-cryptocurrency-valued-over-one-billion-us",
      "read": "2026-10-02",
      "quote": "seized by law enforcement on November 3, 2020"
    },
    {
      "n": 4, "kind": "document", "docType": "government", "publisher": "US Department of Justice, Office of the Pardon Attorney", "title": "Clemency Grants by President Donald J. Trump (2025-Present)", "date": "2025-04-24",
      "url": "https://www.justice.gov/pardon/clemency-grants-president-donald-j-trump-2025-present",
      "archive": "https://web.archive.org/web/20250424233712/https://www.justice.gov/pardon/clemency-grants-president-donald-j-trump-2025-present",
      "read": "2026-10-02",
      "quote": "January 21, 2025 - 1 Pardon"
    }
  ]
}
```

## What happened

On 5 November 2020 federal prosecutors in San Francisco filed a civil complaint to forfeit about 69,370 bitcoin [1][3]. The complaint says a hacker it calls Individual X broke into Silk Road, the darknet market, took the coins, and that they sat at one address from 2013 [1].

It says Individual X signed an agreement on 3 November 2020 consenting to the forfeiture, and that the United States took custody of the coins from that address the same day [1]. The Justice Department called it the largest seizure of cryptocurrency in its history [3].

## What the chain shows

On {{leg1.date}} the address made two payments to the same address: {{leg1.amount}} at {{leg1.time}}, then {{leg2.amount}} at {{leg2.time}}, about {{leg2.usdThen}} at the time. A complete read of the address's history finds these two spends that day and no others [m1].

Before them, the complaint says, the address had last sent coins in April 2015, when it paid 101 bitcoin to the BTC-e exchange [1].

## Why it matters

The chain shows the coins leaving; only the complaint says who moved them and why [1]. Both payments that day went to one address, which fits the custody the complaint describes, but no document this page could read prints that address, so it stays unnamed here.

The complaint prints the address without its final character in its caption and in two paragraphs, and in full only once, in paragraph 17 [1].

## What happened next

Elliptic, an analytics firm, spotted the move within a day, before the complaint was public [2]. Silk Road's founder, prosecuted in 2015, was pardoned on 21 January 2025, according to the Justice Department's list of clemency grants [3][4].
