```json
{
  "id": "liquid-2026",
  "list": "recent",
  "category": "theft",
  "label": "Liquid reserve",
  "title": "A validation bug drains Liquid's bitcoin reserve",
  "dek": "A bug let an attacker create Liquid bitcoin with nothing behind it and redeem it for real bitcoin [1]. The federation released {{leg1.amount}} to a peg-out service, which passed it to the attacker in the same block; {{leg3.amount}} came back the next day.",
  "criterion": "A theft from a Bitcoin sidechain's reserve, documented transaction by transaction by the company that builds its software [1].",
  "priority": 8,
  "legs": [
    {
      "id": "leg1",
      "chain": "Bitcoin",
      "txid": "8db751a650ae2f12006b7e8c69a75e4df360e8afd6b9e05ae0b9fa6458a7b140",
      "idSource": 1,
      "basis": "btc-output",
      "output": 0,
      "asset": "BTC",
      "from": {"role": "the federation's reserve address", "label": "Liquid Federation", "evidence": {"kind": "document", "source": 1, "identifies": "tx"}},
      "to": {"role": "the peg-out service that requested the release", "label": "SideSwap", "evidence": {"kind": "document", "source": 1, "identifies": "tx"}},
      "todayApplicable": true
    },
    {
      "id": "leg2",
      "chain": "Bitcoin",
      "txid": "85d2ca15bea33a592e73ed40c6a5da887feecf1e77f58ec7f580e00841645043",
      "idSource": 1,
      "basis": "btc-output",
      "output": 0,
      "asset": "BTC",
      "follows": "leg1",
      "from": {"role": "the peg-out service, paying out its customer's order", "label": "SideSwap", "evidence": {"kind": "document", "source": 1, "identifies": "tx"}},
      "to": {"role": "the attacker's address"},
      "todayApplicable": true
    },
    {
      "id": "leg3",
      "chain": "Bitcoin",
      "txid": "a6d697a25266ce3c78774fd1d75f896b7af522ada209b0f6228ea497bc49a46d",
      "idSource": 1,
      "basis": "btc-output",
      "output": 1,
      "asset": "BTC",
      "follows": "leg1",
      "from": {"role": "the attacker's address"},
      "to": {"role": "the federation's reserve address", "label": "Liquid Federation", "evidence": {"kind": "document", "source": 1, "identifies": "tx"}},
      "todayApplicable": true
    }
  ],
  "status": {"asOf": "2026-10-02", "text": "Blockstream's report of 23 September 2026 counts about 602 BTC still outstanding, with recovery under way and peg operations not yet resumed [1]. No primary document this page could read names the attacker."},
  "returned": {"text": "{{leg3.amount}} of the {{leg1.amount}} released came back to the reserve the next day, in a transaction this page reads. Blockstream counts about 602 BTC still outstanding [1]."},
  "sources": [
    {
      "n": 1, "kind": "document", "docType": "party", "publisher": "Blockstream", "title": "Liquid Network Security Incident Assessment", "date": "2026-09-23",
      "url": "https://blog.blockstream.com/liquid-network-security-incident-assessment/",
      "archive": "https://web.archive.org/web/20260924011910/https://blog.blockstream.com/liquid-network-security-incident-assessment/",
      "read": "2026-10-02",
      "quote": "Approximately 602 BTC remain outstanding.",
      "txids": ["8db751a650ae2f12006b7e8c69a75e4df360e8afd6b9e05ae0b9fa6458a7b140", "85d2ca15bea33a592e73ed40c6a5da887feecf1e77f58ec7f580e00841645043", "a6d697a25266ce3c78774fd1d75f896b7af522ada209b0f6228ea497bc49a46d"]
    }
  ]
}
```

## What happened

On 6 September 2026 an attacker used a bug in Elements, the software Liquid runs on, to create about 4,000 Liquid bitcoin with nothing behind them [1]. Liquid is a Bitcoin sidechain run by a federation of members, and each of its bitcoin tokens is meant to be backed by a bitcoin the federation holds [1].

The attacker then deposited the tokens with SideSwap, a federation member whose service exchanges them for bitcoin from the reserve [1]. Within hours the attacker posted an on-chain message calling themselves whitehats, and after negotiations returned most of the bitcoin the next day [1].

## What the chain shows

The release in block {{leg1.block}}, at {{leg1.time}} on {{leg1.date}}, paid {{leg1.amount}} out of the reserve, about {{leg1.usdThen}} at the time. It combined {{leg1.inputs}} separate amounts held at the reserve's address into one payment.

In the same block, SideSwap's address passed {{leg2.amount}} on to another address: the one the coins came back from. The next day, in block {{leg3.block}}, that address sent exactly {{leg3.amount}} back to the reserve's address and kept the rest.

## Why it matters

Two safeguards failed in turn, by Blockstream's account [1]. The bug came from a fix: an earlier flaw was reported and patched in August, and the patch combined the fields of a validation cache key in a way a forged proof could match byte for byte [1].

The second safeguard was delay. The federation's rules expect a member's receiving wallet to be kept offline, so that released bitcoin waits for a manual step; the report cites SideSwap's own statement that its key was online and payouts were forwarded automatically [1]. The chain shows that directly: the release and the forward share a block.

Amounts on Liquid itself are hidden by design, so the forged tokens cannot be read from that chain; this page reads the bitcoin side [1].

## What happened next

Blockstream halted Liquid's bridge nodes that evening, deployed an emergency patch overnight and published a fixed release within days [1]. Block production resumed on 9 September on a corrected chain that leaves out the forged tokens and everything built on them [1].
