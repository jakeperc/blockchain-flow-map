```json
{
  "id": "ronin-2022",
  "list": "all-time",
  "category": "theft",
  "label": "Ronin bridge",
  "title": "The Ronin bridge drained in two withdrawals",
  "dek": "Attackers who held five of the bridge's nine validator keys signed their own withdrawals [1]. Two transactions drained {{leg1.amount}} and {{leg2.amount}} from it.",
  "criterion": "A bridge theft that its operator documented transaction by transaction [1], with the receiving address later listed by the US Treasury [2].",
  "priority": 8,
  "legs": [
    {
      "id": "leg1",
      "chain": "Ethereum",
      "txid": "0xc28fad5e8d5e0ce6a2eaf67b6687be5d58113e16be590824d6cfa1a94467d0b7",
      "idSource": 1,
      "basis": "trace",
      "trace": {"from": "0x1a2a1c938ce3ec39b6d47113c7955baa9dd454f2", "to": "0x098b716b8aaf21512996dc57eb0615e2383e2f96"},
      "check": {"logAmount": 66},
      "asset": "ETH",
      "from": {"role": "the bridge contract", "evidence": {"kind": "tag", "host": "etherscan.io", "tag": "Axie Infinity: Ronin Bridge", "read": "2026-10-02", "alerts": ["To deposit assets into the Ronin sidechain, users need to interact with the Ronin smart contract. Simply transferring assets to the contract address will result in permanent loss of funds."]}},
      "to": {"role": "the address that received the funds", "label": "Address listed under Lazarus Group by OFAC", "evidence": {"kind": "document", "source": 2, "identifies": "address"}},
      "todayApplicable": true
    },
    {
      "id": "leg2",
      "chain": "Ethereum",
      "txid": "0xed2c72ef1a552ddaec6dd1f5cddf0b59a8f37f82bdda5257d9c7c37db7bb9b08",
      "idSource": 1,
      "basis": "erc20-log",
      "logIndex": 29,
      "asset": "USDC",
      "from": {"role": "the bridge contract", "evidence": {"kind": "tag", "host": "etherscan.io", "tag": "Axie Infinity: Ronin Bridge", "read": "2026-10-02", "alerts": ["To deposit assets into the Ronin sidechain, users need to interact with the Ronin smart contract. Simply transferring assets to the contract address will result in permanent loss of funds."]}},
      "to": {"role": "the address that received the funds", "label": "Address listed under Lazarus Group by OFAC", "evidence": {"kind": "document", "source": 2, "identifies": "address"}},
      "todayApplicable": true
    }
  ],
  "status": {"asOf": "2026-10-02", "text": "This page follows the two withdrawals only, not where the funds went afterwards."},
  "sources": [
    {
      "n": 1, "kind": "document", "docType": "party", "publisher": "Ronin (Sky Mavis)", "title": "Community Alert: Ronin Validators Compromised", "date": "2022-03-29",
      "url": "https://roninblockchain.substack.com/p/community-alert-ronin-validators",
      "archive": "https://web.archive.org/web/20220330231034/https://roninblockchain.substack.com/p/community-alert-ronin-validators",
      "read": "2026-10-02",
      "quote": "Most of the hacked funds are still in the hacker's wallet",
      "txids": ["0xc28fad5e8d5e0ce6a2eaf67b6687be5d58113e16be590824d6cfa1a94467d0b7", "0xed2c72ef1a552ddaec6dd1f5cddf0b59a8f37f82bdda5257d9c7c37db7bb9b08"],
      "addresses": ["0x098b716b8aaf21512996dc57eb0615e2383e2f96"]
    },
    {
      "n": 2, "kind": "document", "docType": "government", "publisher": "US Treasury, Office of Foreign Assets Control", "title": "North Korea Designation Update", "date": "2022-04-14",
      "url": "https://ofac.treasury.gov/recent-actions/20220414",
      "archive": "https://web.archive.org/web/20260921191029/https://ofac.treasury.gov/recent-actions/20220414",
      "read": "2026-10-02",
      "quote": "ETH 0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
      "addresses": ["0x098b716b8aaf21512996dc57eb0615e2383e2f96"]
    }
  ]
}
```

## What happened

On 29 March 2022 Ronin, a network run by Sky Mavis, announced that its bridge to Ethereum had been drained six days earlier [1].

Ronin wrote that a withdrawal needed five of its nine validator signatures, and that the attacker had gained control of four validators run by Sky Mavis and one run by the Axie DAO [1]. With five keys, Ronin wrote, the attacker could forge withdrawals [1].

## What the chain shows

Two transactions, in blocks {{leg1.block}} and {{leg2.block}}, sent {{leg1.amount}} and {{leg2.amount}} from the bridge contract to the same address. At the time that was about {{leg1.usdThen}} and {{leg2.usdThen}}.

The ETH moved inside a contract call: the bridge unwrapped its wrapped ether and passed the proceeds on in the same transaction. The amount is read from the transaction's trace and checked against the unwrap event in its receipt, which every endpoint returned identically.

The USDC moved as an ordinary token transfer, worth {{leg2.share}} of all USDC on Ethereum at that block.

## Why it matters

The bridge's security rested on a signature threshold, and the threshold was the attack surface. Ronin's own post says the five-of-nine threshold was set low because some validator nodes kept falling behind the chain [1].

The theft was only noticed when a user could not withdraw from the bridge, days after the funds had gone [1].

## What happened next

Ronin raised the threshold to eight of nine and paused the bridge [1]. On 14 April 2022 the US Treasury listed the receiving address under Lazarus Group in its sanctions update [2].
