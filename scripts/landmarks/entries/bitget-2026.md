```json
{
  "id": "bitget-2026",
  "list": "recent",
  "category": "theft",
  "label": "Bitget theft",
  "title": "Bitget's own wallets pay an attacker",
  "dek": "Bitget says assets worth about $387.5 million went to attacker-controlled addresses on several chains [2]. On Ethereum, one of its wallets sent {{leg1.amount}}, {{leg2.amount}}, {{leg3.amount}} and {{leg4.amount}} to the address it named.",
  "criterion": "A theft from an exchange's own wallets, documented by the exchange with the receiving address printed in its own notice [2].",
  "priority": 8,
  "legs": [
    {
      "id": "leg1",
      "chain": "Ethereum",
      "txid": "0xa3ae35a0006ff4299f8f18614c2c21750eb8e0f5c047df4a526e1cc6ae599ce5",
      "idSource": 3,
      "basis": "erc20-log",
      "logIndex": 195,
      "asset": "USDT",
      "from": {"role": "the exchange's wallet", "evidence": {"kind": "tag", "host": "etherscan.io", "tag": "Bitget 6", "read": "2026-10-02"}},
      "to": {"role": "the receiving address", "label": "Address Bitget lists as attacker-controlled", "evidence": {"kind": "document", "source": 2, "identifies": "address"}},
      "todayApplicable": true
    },
    {
      "id": "leg2",
      "chain": "Ethereum",
      "txid": "0x67a7ac52e0de05aa3e9a3901cbd6315d3317c8ec191e175067d49c709b48930c",
      "idSource": 3,
      "basis": "tx-value",
      "asset": "ETH",
      "from": {"role": "the exchange's wallet", "evidence": {"kind": "tag", "host": "etherscan.io", "tag": "Bitget 6", "read": "2026-10-02"}},
      "to": {"role": "the receiving address", "label": "Address Bitget lists as attacker-controlled", "evidence": {"kind": "document", "source": 2, "identifies": "address"}},
      "todayApplicable": true
    },
    {
      "id": "leg3",
      "chain": "Ethereum",
      "txid": "0xdd07e8803db0fe31c4935399737d389442228a1b2d595545a7cd0e41625af606",
      "idSource": 3,
      "basis": "tx-value",
      "asset": "ETH",
      "from": {"role": "the exchange's wallet", "evidence": {"kind": "tag", "host": "etherscan.io", "tag": "Bitget 6", "read": "2026-10-02"}},
      "to": {"role": "the receiving address", "label": "Address Bitget lists as attacker-controlled", "evidence": {"kind": "document", "source": 2, "identifies": "address"}},
      "todayApplicable": true
    },
    {
      "id": "leg4",
      "chain": "Ethereum",
      "txid": "0x230558293435e59d693438867995b6398a9b9cc8d30291d0c07d68f0ca449afb",
      "idSource": 3,
      "basis": "tx-value",
      "asset": "ETH",
      "from": {"role": "the exchange's wallet", "evidence": {"kind": "tag", "host": "etherscan.io", "tag": "Bitget 6", "read": "2026-10-02"}},
      "to": {"role": "the receiving address", "label": "Address Bitget lists as attacker-controlled", "evidence": {"kind": "document", "source": 2, "identifies": "address"}},
      "todayApplicable": true
    }
  ],
  "status": {"asOf": "2026-10-02", "text": "Bitget's update of 25 September 2026 says tracing and recovery continue and that some affected assets have been frozen [2]. No primary document this page could read attributes the theft."},
  "returned": {"text": "No figure yet. Bitget says some affected assets have been frozen [2], and that its User Protection Fund covers the loss [1]."},
  "sources": [
    {
      "n": 1, "kind": "document", "docType": "party", "publisher": "Bitget", "title": "[SECURITY NOTICE] Bitget exchange hot wallets Incident — September 24, 2026", "date": "2026-09-24",
      "url": "https://www.bitget.com/support/articles/12560603896024",
      "archive": "https://web.archive.org/web/20260928193120/https://www.bitget.com/support/articles/12560603896024",
      "read": "2026-10-02",
      "quote": "Estimated funds affected: approximately $351.6 million"
    },
    {
      "n": 2, "kind": "document", "docType": "party", "publisher": "Bitget", "title": "Bitget Security Latest Incident Update: Fund Tracing and Recovery Bounty Program", "date": "2026-09-25",
      "url": "https://www.bitget.com/support/articles/12560603896108",
      "archive": "https://web.archive.org/web/20261001103939/https://www.bitget.com/support/articles/12560603896108",
      "read": "2026-10-02",
      "quote": "approximately $387.5 million were transferred to attacker-controlled addresses",
      "addresses": ["0x770b10b273fc44fe9197d6bf20f145c2e98463ee"]
    },
    {
      "n": 3, "kind": "reporting", "publisher": "Hypernative", "title": "How Spoofed Requests Got Bitget's Own Wallets to Sign Away $387M", "date": "2026-09-27",
      "url": "https://www.hypernative.io/insights/blog/how-spoofed-requests-got-bitgets-own-wallets-to-sign-away-387m",
      "archive": "https://web.archive.org/web/20260928030905/https://www.hypernative.io/insights/blog/how-spoofed-requests-got-bitgets-own-wallets-to-sign-away-387m",
      "read": "2026-10-02",
      "quote": "Bitget's own hot and warm wallets sent ~$387M to an attacker",
      "txids": ["0xa3ae35a0006ff4299f8f18614c2c21750eb8e0f5c047df4a526e1cc6ae599ce5", "0x67a7ac52e0de05aa3e9a3901cbd6315d3317c8ec191e175067d49c709b48930c", "0xdd07e8803db0fe31c4935399737d389442228a1b2d595545a7cd0e41625af606", "0x230558293435e59d693438867995b6398a9b9cc8d30291d0c07d68f0ca449afb"]
    }
  ]
}
```

## What happened

Bitget wrote on 24 September 2026 that its security systems had detected unauthorised transfers from some of its hot wallets at 18:31 UTC [1]. It first put the loss at about $351.6 million, said its cold wallets were secure and paused withdrawals [1].

The next day it raised the figure to about $387.5 million, after counting assets on Zcash and Tron, and published the main receiving addresses it had identified [2]. Hypernative, a security firm, reports Bitget's account of the cause: the attacker compromised a backend system and used it to feed spoofed withdrawal requests into the exchange's own signing process [3].

## What the chain shows

On Ethereum, a wallet that Etherscan tags as Bitget's sent {{leg1.amount}} at {{leg1.time}}, then three ETH transfers between {{leg2.time}} and {{leg4.time}}, all to the address Bitget published. Each is an ordinary transfer signed by the wallet itself; nothing on chain marks it as theft except where it went.

Hypernative reports that the attacker's requests carried round gas limits, unlike the computed ones on Bitget's own withdrawals, and that this was the one detail that set them apart [3].

## Why it matters

No key was stolen, by Bitget's account as reported: the wallets signed what they were asked to sign [3]. Hypernative's conclusion is that a signer must check each transfer against an independent record of what should be paid, rather than trust the internal service that asks [3].

About a quarter of the haul was in stablecoins and other tokens whose issuers can freeze them, yet Hypernative found none frozen on the original transfers; the USDT was being sold for ETH less than two minutes after it arrived [3].

## What happened next

Bitget said its User Protection Fund would cover the loss [1], and launched a bounty paying a share of any funds frozen or recovered with help from outside [2]. Hypernative reports that withdrawals were to reopen in stages from 28 September [3].
