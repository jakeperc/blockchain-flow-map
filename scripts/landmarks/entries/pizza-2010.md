```json
{
  "id": "pizza-2010",
  "list": "all-time",
  "category": "milestone",
  "label": "Pizza purchase",
  "title": "{{leg1.amount}} for two pizzas",
  "dek": "A forum user offered bitcoin for pizza and reported the trade four days later [1]. Two payments of exactly that size went through that day, and his posts cannot say which was his [m1].",
  "criterion": "A purchase of goods described by the buyer himself [1], and the transaction that reporting identifies as its payment [2].",
  "priority": 9,
  "legs": [
    {
      "id": "leg1",
      "chain": "Bitcoin",
      "txid": "a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d",
      "idSource": 2,
      "basis": "btc-output",
      "output": 0,
      "asset": "BTC",
      "from": {"role": "the paying coins, all from one address"},
      "to": {"role": "the receiving address"},
      "todayApplicable": true
    }
  ],
  "matches": [
    {"id": "m1", "source": 1, "type": "btc-output-value", "window": {"from": "2010-05-17T12:00:00Z", "to": "2010-05-23T12:00:00Z"}, "value": "10000"}
  ],
  "status": {"asOf": "2026-10-02", "text": "A completed historical trade; nothing about it is pending."},
  "sources": [
    {
      "n": 1, "kind": "document", "docType": "party", "publisher": "Bitcoin Forum", "author": "laszlo", "title": "Pizza for bitcoins?", "date": "2010-05-18",
      "url": "https://bitcointalk.org/index.php?topic=137.0",
      "archive": "https://web.archive.org/web/20260919023719/https://bitcointalk.org/index.php?topic=137.0",
      "read": "2026-10-02",
      "quote": "I just want to report that I successfully traded 10,000 bitcoins for pizza."
    },
    {
      "n": 2, "kind": "reporting", "publisher": "Learn Me a Bitcoin", "title": "TXID",
      "url": "https://learnmeabitcoin.com/technical/transaction/input/txid/",
      "archive": "https://web.archive.org/web/20260519185716/https://learnmeabitcoin.com/technical/transaction/input/txid/",
      "read": "2026-10-02",
      "quote": "Pizza transaction for 10,000 BTC in 2010",
      "txids": ["a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d"]
    }
  ]
}
```

## What happened

On 18 May 2010 a Bitcoin Forum user named laszlo offered 10,000 bitcoins for a couple of large pizzas, to be delivered by anyone who would take the coins [1].

On 22 May 2010 he reported in the same thread that he had traded 10,000 bitcoins for pizza, and thanked another forum user [1].

## What the chain shows

One transaction in block {{leg1.block}}, on {{leg1.date}}, paid exactly {{leg1.amount}} to a single address. It gathered {{leg1.inputs}} earlier payments, all held at one address, into that output and paid a fee of {{leg1.fee}}.

It was not the only payment of that size. A complete read of every transaction from {{m1.from}} to {{m1.to}}, {{m1.txs}} of them, found two that paid exactly {{leg1.amount}} on the same day [m1]. The forum posts give no transaction id, so they cannot say which one bought the pizzas. Reporting identifies this one [2], and that is the only basis for showing it here; the paying address is therefore not named.

## Why it matters

It is a price set by a trade rather than by a market. No exchange series this page can read reaches back to that week, so the trade itself is the only price this page can show for it.

Read against today's price, shown beside this story, it measures how far the asset has travelled since a forum user could trade it for dinner.

## What happened next

laszlo kept the offer open for a while, then withdrew it in August 2010, writing that he could no longer generate thousands of coins a day [1].
