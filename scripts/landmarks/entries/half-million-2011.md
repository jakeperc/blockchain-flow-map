```json
{
  "id": "half-million-2011",
  "list": "all-time",
  "category": "record",
  "label": "Half-million transfer",
  "title": "Over half a million bitcoin in one transaction",
  "dek": "One transaction on {{leg1.date}} moved {{leg1.txAmount}}, {{leg1.txShare}} of all the bitcoin the issuance schedule had allowed by then. No primary document says whose coins they were.",
  "criterion": "A single transaction that moved a large share of all the bitcoin issued by then, measured here against supply rather than dollars.",
  "priority": 8,
  "legs": [
    {
      "id": "leg1",
      "chain": "Bitcoin",
      "txid": "29a3efd3ef04f9153d47a990bd7b048a4b2d213daaa5fb8ed670fb85f13bdbcf",
      "idSource": 1,
      "basis": "btc-output",
      "output": 1,
      "asset": "BTC",
      "from": {"role": "the sending addresses"},
      "to": {"role": "the address that received the larger payment"},
      "todayApplicable": true
    },
    {
      "id": "leg2",
      "chain": "Bitcoin",
      "txid": "29a3efd3ef04f9153d47a990bd7b048a4b2d213daaa5fb8ed670fb85f13bdbcf",
      "idSource": 1,
      "basis": "btc-output",
      "output": 0,
      "asset": "BTC",
      "from": {"role": "the sending addresses"},
      "to": {"role": "the address that received the smaller payment"},
      "todayApplicable": true
    }
  ],
  "status": {"asOf": "2026-10-02", "text": "A completed historical transaction; nothing about it is pending."},
  "sources": [
    {
      "n": 1, "kind": "reporting", "publisher": "Monerama", "title": "The Bitcoin Origins (3) - 2011",
      "url": "https://www.monerama.com/a/the-bitcoin-origins-part-3",
      "archive": "https://web.archive.org/web/20201123212602/https://www.monerama.com/a/the-bitcoin-origins-part-3",
      "read": "2026-10-02",
      "quote": "The biggest bitcoin transaction 500,000 BTC and 50,000 BTC",
      "txids": ["29a3efd3ef04f9153d47a990bd7b048a4b2d213daaa5fb8ed670fb85f13bdbcf"]
    },
    {
      "n": 2, "kind": "reporting", "publisher": "Decrypt", "author": "Andrew Hayward", "title": "Bitfinex moves $1.1 billion in Bitcoin for less than a dollar", "date": "2020-04-12",
      "url": "https://decrypt.co/25307/largest-bitcoin-transaction-to-date",
      "archive": "https://web.archive.org/web/20260519103415/https://decrypt.co/25307/largest-bitcoin-transaction-to-date",
      "read": "2026-10-02",
      "quote": "much larger, at 500,000 BTC. That transaction, which took place in November 2011"
    }
  ]
}
```

## What happened

On {{leg1.date}} one transaction gathered {{leg1.inputs}} earlier payments and paid them out to two addresses. Reporting since has called it the biggest bitcoin transaction [1], and given its size as 500,000 BTC [2].

No primary document this page could find says whose coins they were, so the addresses stay unnamed here.

## What the chain shows

The transaction in block {{leg1.block}}, at {{leg1.time}} on {{leg1.date}}, paid {{leg1.amount}} to one address and {{leg2.amount}} to another, for a fee of {{leg1.fee}}. Together that was {{leg1.txShare}} of all the bitcoin the issuance schedule had allowed by that block.

Decrypt gives its size as 500,000 BTC [2], which matches the larger payment; the transaction moved {{leg1.txAmount}} in all.

## Why it matters

Dollar figures flatter recent transfers, because the price has risen so far. Measured against supply instead, this one transaction moved {{leg1.txShare}} of all the bitcoin the schedule had allowed by then; the share chart further down compares it with the other entries.

## What happened next

This page does not follow the coins further. With no primary document saying whose they were, later moves cannot be read as anyone's.
