```json
{
  "id": "bitfinex-refill-2020",
  "list": "all-time",
  "category": "record",
  "label": "Bitfinex refill",
  "title": "The billion-dollar transfer that was mostly change",
  "dek": "Reporting in April 2020 described a transaction moving more than $1.1 billion for a fee of under a dollar [2]. The chain shows {{leg1.amount}} paid out and {{leg1.changeBack}} sent straight back to the sender, as Bitfinex said at the time [1].",
  "criterion": "A transfer reported by its total input that the chain and the sender's own statement show was mostly change [1][2].",
  "priority": 7,
  "legs": [
    {
      "id": "leg1",
      "chain": "Bitcoin",
      "txid": "b36bced99cc459506ad2b3af6990920b12f6dc84f9c7ed0dd2c3703f94a4b692",
      "idSource": 2,
      "basis": "btc-output",
      "output": 0,
      "asset": "BTC",
      "from": {"role": "the exchange's reserve address", "label": "Bitfinex", "evidence": {"kind": "document", "source": 1, "identifies": "tx"}},
      "to": {"role": "the exchange's hot wallet", "label": "Bitfinex hot wallet", "evidence": {"kind": "document", "source": 1, "identifies": "tx"}},
      "todayApplicable": true
    }
  ],
  "status": {"asOf": "2026-10-02", "text": "A completed transfer between an exchange's own wallets; nothing about it is pending."},
  "sources": [
    {
      "n": 1, "kind": "document", "docType": "party", "publisher": "Twitter", "author": "Paolo Ardoino, Bitfinex", "title": "Paolo Ardoino on Twitter", "date": "2020-04-10",
      "url": "https://twitter.com/paoloardoino/status/1248702664650772480",
      "archive": "https://web.archive.org/web/20200410200342/https://twitter.com/paoloardoino/status/1248702664650772480",
      "read": "2026-10-02",
      "quote": "Yep, we refilled hot wallet with 15k, rest went back to original address",
      "txids": ["b36bced99cc459506ad2b3af6990920b12f6dc84f9c7ed0dd2c3703f94a4b692"]
    },
    {
      "n": 2, "kind": "reporting", "publisher": "Decrypt", "author": "Andrew Hayward", "title": "Bitfinex moves $1.1 billion in Bitcoin for less than a dollar", "date": "2020-04-12",
      "url": "https://decrypt.co/25307/largest-bitcoin-transaction-to-date",
      "archive": "https://web.archive.org/web/20260519103415/https://decrypt.co/25307/largest-bitcoin-transaction-to-date",
      "read": "2026-10-02",
      "quote": "A transaction for 161,500 Bitcoin on Friday—worth more than $1.1 billion—cost just $0.70",
      "txids": ["b36bced99cc459506ad2b3af6990920b12f6dc84f9c7ed0dd2c3703f94a4b692"]
    }
  ]
}
```

## What happened

On 10 April 2020 a single bitcoin transaction was spotted on Twitter for its size and its tiny fee [2]. Bitfinex's chief technology officer replied there that the exchange had refilled its hot wallet with 15,000 BTC, and that the rest went back to the original address [1][2].

## What the chain shows

The transaction in block {{leg1.block}}, at {{leg1.time}} on {{leg1.date}}, spent {{leg1.inputTotal}} held at one address. It paid {{leg1.amount}} to a second address and returned {{leg1.changeBack}} to the sending address, for a fee of {{leg1.fee}}, about {{leg1.feeUsd}} at the time.

## Why it matters

A transaction's inputs are not its payments. Bitcoin spends whole earlier outputs, so a wallet paying out part of a large balance sends the remainder back to itself as change, and the total can look like a transfer of everything.

Read by its outputs, this was an exchange moving part of its reserve into its own hot wallet; read by its inputs, it became a billion-dollar headline [1][2].

## What happened next

Two days later Decrypt quoted the statement, yet still described a transaction for 161,500 bitcoin worth more than $1.1 billion, the largest to date in dollars [2]. This page counts only the payment output as moved.
