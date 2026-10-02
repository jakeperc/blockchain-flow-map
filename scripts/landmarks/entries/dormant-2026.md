```json
{
  "id": "dormant-2026",
  "list": "recent",
  "category": "dormant",
  "label": "Dormant holding",
  "title": "Bitcoin held untouched since {{leg1.oldestInput}} moves",
  "dek": "An address that had not spent a coin in eight years moved its holding in one transaction, CoinDesk reported [1]. The chain dates the coins it spent: they had sat still for {{leg1.coinAge}}.",
  "criterion": "A holding untouched through every rally and crash since late 2017, reported at the time [1], moved in one transaction whose coins the chain dates to the block.",
  "priority": 6,
  "legs": [
    {
      "id": "leg1",
      "chain": "Bitcoin",
      "txid": "16b1eb74bbd63c0651a0a0b49d5e148c4c1a21a5bd13589392fe00a5f9271cfc",
      "idSource": "m1",
      "basis": "btc-output",
      "output": 0,
      "asset": "BTC",
      "from": {"role": "the address that had held the coins"},
      "to": {"role": "the receiving address"},
      "todayApplicable": true
    }
  ],
  "matches": [
    {"id": "m1", "source": 1, "type": "btc-address-spend", "address": "138EMxwMtKuvCEUtm4qUfT2x344TSReyiT", "window": {"from": "2009-01-03T00:00:00Z", "to": "2026-10-01T23:59:59Z"}}
  ],
  "status": {"asOf": "2026-10-02", "text": "The receiving address had not spent any of the coins when this page last read the chain."},
  "sources": [
    {
      "n": 1, "kind": "reporting", "publisher": "CoinDesk", "author": "Shaurya Malwa", "title": "A bitcoin wallet dormant since the 2017 peak just moved $383 million", "date": "2026-07-16",
      "url": "https://www.coindesk.com/markets/2026/07/16/a-bitcoin-wallet-dormant-since-the-2017-peak-just-moved-usd383-million",
      "archive": "https://web.archive.org/web/20260716202325/https://www.coindesk.com/markets/2026/07/16/a-bitcoin-wallet-dormant-since-the-2017-peak-just-moved-usd383-million",
      "read": "2026-10-02",
      "quote": "had not spent a coin in eight years",
      "addresses": ["138EMxwMtKuvCEUtm4qUfT2x344TSReyiT"]
    }
  ]
}
```

## What happened

On 16 July 2026 CoinDesk reported that a bitcoin address that had not spent a coin in eight years had moved its holding, worth about $383 million [1]. It linked the address, and wrote that the coins went to a new address rather than to an exchange, so nothing showed a sale [1].

## What the chain shows

One transaction in block {{leg1.block}}, at {{leg1.time}} on {{leg1.date}}, moved {{leg1.amount}}, about {{leg1.usdThen}} at the time, for a fee of {{leg1.fee}}.

The coins it spent arrived in block {{leg1.oldestBlock}}, on {{leg1.oldestInput}}, and had not moved in the {{leg1.coinAge}} since. A complete read of the address's history finds no other spend from it, before or after [m1].

## Why it matters

The chain can prove how long coins sat still, to the block, without knowing who holds them. Here it shows a holding that CoinDesk describes as bought near the late-2017 peak, and that stayed put through the crashes and rallies that followed [1].

What the chain cannot show is who moved the coins or why. Moving to a new address can mean a change of custody as easily as a step toward a sale, as CoinDesk notes [1].

## What happened next

CoinDesk wrote that coins arriving at an exchange's deposit address would be the first real sign of a sale [1]. The status line below records whether the coins have moved since.
