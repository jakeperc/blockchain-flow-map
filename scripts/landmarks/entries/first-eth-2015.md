```json
{
  "id": "first-eth-2015",
  "list": "all-time",
  "category": "milestone",
  "label": "Ethereum's opener",
  "title": "The transaction that opened Ethereum's ledger",
  "dek": "The first transaction on Ethereum sent {{leg1.amount}} and paid {{leg1.fee}} in fees [m1]. It came within a few blocks of the first block whose gas limit could hold a transaction at all [m1].",
  "criterion": "The first transaction on Ethereum, proven by a complete read of every earlier block [m1].",
  "priority": 8,
  "legs": [
    {
      "id": "leg1",
      "chain": "Ethereum",
      "txid": "0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060",
      "idSource": "m1",
      "basis": "tx-value",
      "asset": "ETH",
      "from": {"role": "an account funded in the genesis block"},
      "to": {"role": "the receiver"},
      "todayApplicable": false,
      "todayReason": "The amount is a tiny fraction of a cent at any price this page reads, far below its dollar scale."
    }
  ],
  "matches": [
    {"id": "m1", "source": 1, "type": "evm-first-tx", "chain": "Ethereum", "through": 46147}
  ],
  "balances": [
    {"id": "b1", "chain": "Ethereum", "address": "0xa1e4380a3b1f749673e270229993ee55f35663b4", "asset": "ETH", "blocks": [0, 46147]}
  ],
  "status": {"asOf": "2026-10-02", "text": "A completed historical transaction; nothing about it is pending."},
  "sources": [
    {
      "n": 1, "kind": "reporting", "publisher": "GoldRush", "title": "Build a Multi-Chain Block Explorer in 20 Minutes", "date": "2025-03-03",
      "url": "https://goldrush.dev/guides/building-block-explorers-part-1-multi-chain-block-transaction-explorer/",
      "archive": "https://web.archive.org/web/20260611231842/https://goldrush.dev/guides/building-block-explorers-part-1-multi-chain-block-transaction-explorer/",
      "read": "2026-10-02",
      "quote": "the first ever transaction that happened on the Ethereum chain was at block 46147"
    }
  ]
}
```

## What happened

When Ethereum launched, its blocks could not hold a single transaction. The genesis block set a gas limit of {{m1.genesisGas}}, and the smallest transfer needs 21,000 [m1].

The limit crept up block by block and first reached that mark at block {{m1.firstAtGas}}; the first transaction followed in block {{m1.lastBlock}} [m1]. GoldRush, a blockchain data provider, describes finding the same thing: thousands of empty blocks, then this one [1].

## What the chain shows

Block {{leg1.block}}, mined at {{leg1.time}} on {{leg1.date}}, holds exactly one transaction. It sent {{leg1.amount}} from an account that had held {{b1.at0}} since the genesis block, and paid a fee of {{leg1.fee}}.

Every earlier block is empty. No block could hold a transfer at all before block {{m1.firstAtGas}}, and none did until this one [m1].

## Why it matters

Ethereum did not open with a switch. It opened with a ceiling that rose block by block until a transaction could fit, and the first one went through almost as soon as one could [m1].

The payment itself was a token amount: the fee was worth vastly more than the ether it moved.

## What happened next

The sending account kept nearly all of its genesis allocation: it held {{b1.at1}} at block {{b1.block1}}, after the payment and its fee.
