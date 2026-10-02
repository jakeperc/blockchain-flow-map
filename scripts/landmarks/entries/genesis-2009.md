```json
{
  "id": "genesis-2009",
  "list": "all-time",
  "category": "milestone",
  "label": "Genesis block",
  "title": "The block that started the ledger",
  "dek": "The ledger begins with a single reward of {{leg1.amount}} and a newspaper headline written into the block itself [m1]. The software never lets that reward move [1][2].",
  "criterion": "Block {{m1.firstBlock}}, the start of the chain every later block links back to [m1].",
  "priority": 10,
  "legs": [
    {
      "id": "leg1",
      "chain": "Bitcoin",
      "txid": "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
      "idSource": "m1",
      "basis": "coinbase",
      "asset": "BTC",
      "from": {"role": "newly issued coins: a block reward has no sender"},
      "to": {"role": "the key that received the reward"},
      "todayApplicable": false,
      "todayReason": "The reference software skips this block's transactions when it records spendable coins, so the reward can never move [1][2]."
    }
  ],
  "matches": [
    {"id": "m1", "source": 1, "type": "btc-coinbase", "height": 0}
  ],
  "status": {"asOf": "2026-10-02", "text": "A fixed part of the protocol; nothing about it can change."},
  "sources": [
    {
      "n": 1, "kind": "data", "publisher": "Bitcoin Core (GitHub)", "title": "src/validation.cpp",
      "url": "https://github.com/bitcoin/bitcoin/blob/master/src/validation.cpp",
      "archive": "https://web.archive.org/web/20260919215721/https://github.com/bitcoin/bitcoin/blob/master/src/validation.cpp",
      "read": "2026-10-02",
      "quote": "its coinbase is unspendable"
    },
    {
      "n": 2, "kind": "reporting", "publisher": "Bitcoin Wiki", "title": "Genesis block",
      "url": "https://en.bitcoin.it/wiki/Genesis_block",
      "archive": "https://web.archive.org/web/20260918171336/https://en.bitcoin.it/wiki/Genesis_block",
      "read": "2026-10-02",
      "quote": "probably intended as proof that the block was created on or after"
    }
  ]
}
```

## What happened

On {{leg1.date}} the Bitcoin ledger began with block {{leg1.block}}. Its only transaction created {{leg1.amount}} from nothing: a block reward, of the kind every later block has also paid to whoever produced it.

Whoever made the block also wrote a line of text into it, where a miner may put any data. The line is a newspaper headline: "{{leg1.coinbaseText}}".

## What the chain shows

The transaction spends no earlier coins. It is a coinbase, the way new bitcoin enters the ledger, and it pays {{leg1.amount}} to a public key rather than to an address.

The Bitcoin Wiki reads the headline as probably meant to prove that the block was made on or after that day [2].

## Why it matters

Every block since links back, one by one, to this block, so every later bitcoin transaction is recorded on a chain that starts here. It fixes the ledger's starting point.

## What happened next

The reward never moved and never can: the reference software skips the block's transactions when it records which coins are spendable [1], and the Bitcoin Wiki notes that the genesis block's subsidy is unspendable [2]. Its value at today's price is therefore not shown.
