```json
{
  "id": "bybit-2025",
  "list": "all-time",
  "category": "theft",
  "label": "Bybit theft",
  "title": "Bybit loses its ether to a disguised transaction",
  "dek": "Bybit said more than 400,000 ETH and stETH, worth over $1.5 billion, left its ETH cold wallet for an unidentified address [1]. The chain shows one transaction carrying {{leg1.amount}} of it.",
  "criterion": "A theft documented by the exchange that lost the funds [1] and attributed by the FBI [2], with the transfer read from the chain's record of internal calls.",
  "priority": 10,
  "legs": [
    {
      "id": "leg1",
      "chain": "Ethereum",
      "txid": "0xb61413c495fdad6114a7aa863a00b2e3c28945979a10885b12b30316ea9f072c",
      "idSource": 3,
      "basis": "trace",
      "trace": {"from": "0x1db92e2eebc8e0c075a02bea49a2935bcd2dfcf4", "to": "0x47666fab8bd0ac7003bce3f5c3585383f09486e2"},
      "check": {"balanceDelta": "0x1db92e2eebc8e0c075a02bea49a2935bcd2dfcf4"},
      "asset": "ETH",
      "from": {"role": "the multisig wallet that was drained"},
      "to": {"role": "the receiving address"},
      "todayApplicable": true
    }
  ],
  "attributions": [
    {"claim": "The FBI said North Korea was responsible for the theft, in activity it calls TraderTraitor [2].", "source": 2, "date": "2025-02-26"}
  ],
  "status": {"asOf": "2026-10-02", "text": "This page follows the one transfer only. The FBI's notice lists addresses holding the proceeds, but not the receiving address shown here [2]."},
  "sources": [
    {
      "n": 1, "kind": "document", "docType": "party", "publisher": "Bybit", "title": "Incident Update: Unauthorized Activity Involving ETH Cold Wallet", "date": "2025-02-21",
      "url": "https://announcements.bybit.com/article/incident-update---eth-cold-wallet-incident-blt292c0454d26e9140/",
      "archive": "https://web.archive.org/web/20260117140100/https://announcements.bybit.com/article/incident-update---eth-cold-wallet-incident-blt292c0454d26e9140/",
      "read": "2026-10-02",
      "quote": "over 400,000 ETH and stETH worth more than $1.5 billion were transferred"
    },
    {
      "n": 2, "kind": "document", "docType": "government", "publisher": "FBI, Internet Crime Complaint Center", "title": "North Korea Responsible for $1.5 Billion Bybit Hack", "date": "2025-02-26",
      "url": "https://www.ic3.gov/psa/2025/psa250226",
      "archive": "https://web.archive.org/web/20260929150044/https://www.ic3.gov/psa/2025/psa250226",
      "read": "2026-10-02",
      "quote": "North Korea Responsible for $1.5 Billion Bybit Hack"
    },
    {
      "n": 3, "kind": "reporting", "publisher": "CertiK", "title": "Bybit Incident Technical Analysis", "date": "2025-02-23",
      "url": "https://www.certik.com/blog/bybit-incident-technical-analysis",
      "archive": "https://web.archive.org/web/20260607194500/https://www.certik.com/blog/bybit-incident-technical-analysis",
      "read": "2026-10-02",
      "quote": "Drained 401,346 ETH",
      "txids": ["0xb61413c495fdad6114a7aa863a00b2e3c28945979a10885b12b30316ea9f072c"]
    },
    {
      "n": 4, "kind": "document", "docType": "party", "publisher": "Safe Ecosystem Foundation", "title": "Statement by the Safe Ecosystem Foundation", "date": "2025-02-28",
      "url": "https://safefoundation.org/blog/safe-ecosystem-foundation-statement",
      "archive": "https://web.archive.org/web/20260726145315/https://safefoundation.org/blog/safe-ecosystem-foundation-statement",
      "read": "2026-10-02",
      "quote": "a compromised Safe{Wallet} developer machine"
    }
  ]
}
```

## What happened

On 21 February 2025 Bybit said that a scheduled move of ether from its multisig cold wallet to its hot wallet had been manipulated, and that more than 400,000 ETH and stETH went to an unidentified address [1]. Bybit wrote that the attack altered the wallet's smart contract logic and masked the signing interface [1].

The Safe Ecosystem Foundation, which promotes the multisig software the wallet ran on, published the Safe{Wallet} team's finding that the attack came through a compromised developer machine, which proposed a disguised malicious transaction [4].

## What the chain shows

One transaction in block {{leg1.block}}, at {{leg1.time}} on {{leg1.date}}, moved {{leg1.amount}}, about {{leg1.usdThen}} at the time. The ether moved inside a contract call, so the amount is read from the transaction's trace and checked against the wallet's balance before and after the block.

Bybit's notice gives about 12:30 UTC as the time it detected the activity, while the chain dates this transfer to {{leg1.time}}; the notice does not explain the gap [1].

## Why it matters

The signers never approved this transfer as such. According to CertiK, the attacker first obtained three valid signatures for an earlier transaction that swapped the wallet's code for a malicious contract, then used that contract to drain the wallet [3].

The Safe{Wallet} team's statement says outside reviewers found no flaw in the multisig's contracts [4]. The weakness was in what the signers were shown, which Bybit describes as a masked signing interface [1].

## What happened next

The FBI asked exchanges and other services to block transactions with the addresses the thieves were using to launder the funds, and listed dozens of them [2].
