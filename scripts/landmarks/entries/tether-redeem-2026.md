```json
{
  "id": "tether-redeem-2026",
  "list": "recent",
  "category": "supply",
  "label": "USDT removals",
  "title": "Tether takes billions of USDT out of Ethereum's supply",
  "dek": "Four times in July and August, the multisig that owns the USDT contract took tokens out of the supply on Ethereum [m1]. The contract's code shows they were its own tokens, removed from its own balance [1].",
  "criterion": "Every removal of USDT supply on Ethereum in the recent window, found by a complete read of the contract's events [m1].",
  "priority": 7,
  "legs": [
    {
      "id": "leg1",
      "chain": "Ethereum",
      "txid": "0xc7ad979c685d83a9adb8819e5ed36011c146b3171efcb9065eae0fd9ad70c1ff",
      "idSource": "m1",
      "basis": "token-event",
      "event": "0x702d5967f45f6513a38ffc42d6ba9bf230bd40e8f53b16363c7eb4fd2deb9a44",
      "logIndex": 1287,
      "asset": "USDT",
      "from": {"role": "the multisig that owns the USDT contract", "evidence": {"kind": "tag", "host": "etherscan.io", "tag": "Tether: Multisig", "read": "2026-10-02"}},
      "to": {"role": "no receiver: the tokens leave the supply"},
      "todayApplicable": false,
      "todayReason": "Removed tokens no longer exist, so they have no value at today's price."
    },
    {
      "id": "leg2",
      "chain": "Ethereum",
      "txid": "0xcbbfda11256dfb723fc50f2d0c77c3142b2c53dde84081c28b76231003273334",
      "idSource": "m1",
      "basis": "token-event",
      "event": "0x702d5967f45f6513a38ffc42d6ba9bf230bd40e8f53b16363c7eb4fd2deb9a44",
      "logIndex": 39,
      "asset": "USDT",
      "from": {"role": "the multisig that owns the USDT contract", "evidence": {"kind": "tag", "host": "etherscan.io", "tag": "Tether: Multisig", "read": "2026-10-02"}},
      "to": {"role": "no receiver: the tokens leave the supply"},
      "todayApplicable": false,
      "todayReason": "Removed tokens no longer exist, so they have no value at today's price."
    },
    {
      "id": "leg3",
      "chain": "Ethereum",
      "txid": "0x4eb5420ecf4a5aa4599e54cb5ef12467bf8d357e37c7ea51a4ef5ec75512eb0e",
      "idSource": "m1",
      "basis": "token-event",
      "event": "0x702d5967f45f6513a38ffc42d6ba9bf230bd40e8f53b16363c7eb4fd2deb9a44",
      "logIndex": 1063,
      "asset": "USDT",
      "from": {"role": "the multisig that owns the USDT contract", "evidence": {"kind": "tag", "host": "etherscan.io", "tag": "Tether: Multisig", "read": "2026-10-02"}},
      "to": {"role": "no receiver: the tokens leave the supply"},
      "todayApplicable": false,
      "todayReason": "Removed tokens no longer exist, so they have no value at today's price."
    },
    {
      "id": "leg4",
      "chain": "Ethereum",
      "txid": "0x6c54a4818ae437f8ea5a3ed6a2f8088bb481dd918353796881ec20676cefd66c",
      "idSource": "m1",
      "basis": "token-event",
      "event": "0x702d5967f45f6513a38ffc42d6ba9bf230bd40e8f53b16363c7eb4fd2deb9a44",
      "logIndex": 658,
      "asset": "USDT",
      "from": {"role": "the multisig that owns the USDT contract", "evidence": {"kind": "tag", "host": "etherscan.io", "tag": "Tether: Multisig", "read": "2026-10-02"}},
      "to": {"role": "no receiver: the tokens leave the supply"},
      "todayApplicable": false,
      "todayReason": "Removed tokens no longer exist, so they have no value at today's price."
    }
  ],
  "matches": [
    {"id": "m1", "type": "evm-event-scan", "chain": "Ethereum", "contract": "0xdac17f958d2ee523a2206206994597c13d831ec7", "topic": "0x702d5967f45f6513a38ffc42d6ba9bf230bd40e8f53b16363c7eb4fd2deb9a44", "event": "Redeem", "fromBlock": 25448271, "toBlock": 26100913, "window": {"from": "2026-07-03T00:00:00Z", "to": "2026-10-01T23:59:59Z"}},
    {"id": "m2", "type": "evm-event-scan", "chain": "Ethereum", "contract": "0xdac17f958d2ee523a2206206994597c13d831ec7", "topic": "0xcb8241adb0c3fdb35b70c24ce35c5eb0c17af7431c99f827d44a445ca624176a", "event": "Issue", "fromBlock": 25448271, "toBlock": 26100913, "window": {"from": "2026-07-03T00:00:00Z", "to": "2026-10-01T23:59:59Z"}}
  ],
  "status": {"asOf": "2026-10-02", "text": "Tether had published no statement on these removals that this page could find."},
  "sources": [
    {
      "n": 1, "kind": "data", "publisher": "Etherscan", "title": "Tether: USDT Stablecoin, verified contract source code",
      "url": "https://etherscan.io/address/0xdac17f958d2ee523a2206206994597c13d831ec7#code",
      "archive": "https://web.archive.org/web/20260917182827/https://etherscan.io/address/0xdac17f958d2ee523a2206206994597c13d831ec7",
      "read": "2026-10-02",
      "quote": "These tokens are withdrawn from the owner address"
    }
  ]
}
```

## What happened

On {{leg1.date}}, {{leg3.date}} and {{leg4.date}}, the multisig that owns the USDT contract called the contract's redeem function, four times in all [m1]. The contract's own code says what that does: only the owner can call it, the tokens come out of the owner's balance, and the total supply falls by the same amount [1].

Tether published no statement about these removals that this page could find, so this page does not say why they happened, or whether anything was issued elsewhere in their place.

## What the chain shows

The removals took {{leg1.amount}} and {{leg2.amount}} on {{leg1.date}}, {{leg3.amount}} on {{leg3.date}} and {{leg4.amount}} on {{leg4.date}}. The removal at {{leg1.time}} on {{leg1.date}} was by itself {{leg1.share}} of all USDT on Ethereum at its block.

A complete read of the contract's events over the whole window finds exactly these four removals [m1], and not one Issue, the event that adds supply [m2].

## Why it matters

The tokens removed were Tether's own: the code takes them from the owner's balance, so no other holder's tokens were cancelled [1]. The event is named Redeem, but nothing in it records a payment to anyone; it records only that the supply on Ethereum shrank.

A token's supply on one chain can fall because holders cash out, or because its issuer moves supply to another chain. The contract cannot tell these apart, and without a statement this page does not guess.

## What happened next

No new USDT was added on Ethereum for the rest of the window: the complete read finds no Issue event up to {{m2.to}} [m2].
