/**
 * Ethereum addresses with public evidence of the operating entity that controls them. Pure data.
 * Keys are lowercase 0x addresses. `entity` is a key of ENTITIES in known-entities.ts; `label` is the
 * exact Etherscan public name tag read from the address's own page; `checked` is the date that page
 * was read. Rules and the exclusion list live in known-entities.ts; read them before adding a line.
 * Generated from research notes (see live-lite/README.md); append by hand following the same shape.
 */
export interface AddressRecord {entity:string;label:string;checked:string;note?:string;}
const a=(entity:string,label:string,checked:string,note?:string):AddressRecord=>note?{entity,label,checked,note}:{entity,label,checked};
export const ADDRESSES:Record<string,AddressRecord>={
 // binance
 '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be':a('binance','Binance','2026-09-18'),
 '0xd551234ae421e3bcba99a0da6d736074f22192ff':a('binance','Binance 2','2026-09-18'),
 '0xf977814e90da44bfa03b6295a0616a897441acec':a('binance','Binance: Hot Wallet 20','2026-09-18','One of the largest and most active exchange wallets on Ethereum.'),
 '0x28c6c06298d514db089934071355e5743bf21d60':a('binance','Binance 14','2026-09-18'),
 // coinbase
 '0x71660c4005ba85c37ccec55d0c4493e66fe775d3':a('coinbase','Coinbase 1','2026-09-18'),
 '0x503828976d22510aad0201ac7ec88293211d23da':a('coinbase','Coinbase 12','2026-09-18'),
 // kraken
 '0xf30ba13e4b04ce5dc4d254ae5fa95477800f0eb0':a('kraken','Kraken: Hot Wallet 2','2026-09-18'),
 '0x05ff6964d21e5dae3b1010d5ae0465b3c450f381':a('kraken','Kraken: Hot Wallet 4','2026-09-18'),
 // okx
 '0x4b4e14a3773ee558b6597070797fd51eb48606e5':a('okx','OKX: Hot Wallet','2026-09-18'),
 '0x4e7b110335511f662fdbb01bf958a7844118c0d4':a('okx','OKX: Hot Wallet 2','2026-09-18'),
 // bitfinex
 '0x1151314c646ce4e0efd76d1af4760ae66a9fe30f':a('bitfinex','Bitfinex 1','2026-09-18'),
 '0x1b29dd8ff0eb3240238bf97cafd6edea05d5ba82':a('bitfinex','Bitfinex 6','2026-09-18'),
 // upbit
 '0xba826fec90cefdf6706858e5fbafcb27a290fbe0':a('upbit','Upbit 2','2026-09-18'),
 '0x5e032243d507c743b061ef021e2ec7fcc6d3ab89':a('upbit','Upbit 3','2026-09-18'),
 // bithumb
 '0x17e5545b11b468072283cee1f066a059fb0dbf24':a('bithumb','Bithumb: Hot Wallet','2026-09-18'),
 // gemini
 '0xd24400ae8bfebb18ca49be86258a3c749cf46853':a('gemini','Gemini','2026-09-18'),
 // coindcx
 '0x2407b9b9662d970ece2224a0403d3b15c7e4d1fe':a('coindcx','CoinDCX 2','2026-09-18'),
 // bitflyer
 '0xa9264494a92ced04747ac84fc9ca5a0b9549b491':a('bitflyer','bitFlyer 3','2026-09-18'),
 '0xb01cb49fe0d6d6e47edf3a072d15dfe73155331c':a('bitflyer','bitFlyer 2','2026-09-18'),
 // coincheck
 '0xd52814615dc129e1eea3520e7e7f8d44dbfc6c5b':a('coincheck','Coincheck 2','2026-09-18','Etherscan discloses this tag came from a public researcher compilation rather than a first-party submission.'),
 // wintermute
 '0x0000006daea1723962647b7e189d311d757fb793':a('wintermute','Wintermute 1','2026-09-18','The firm\'s verified trading contract rather than an EOA.'),
 '0x000002cba8dfb0a86a47a415592835e17fac080a':a('wintermute','Wintermute 2','2026-09-18'),
 '0x5cddebd8a7b3bc60156550187bf5465b1c3290f5':a('wintermute','Wintermute 3','2026-09-18'),
 '0xf8191d98ae98d2f7abdfb63a9b0b812b93c873aa':a('wintermute','Wintermute 4','2026-09-18'),
 '0xce84449a8ebec019ac110a4b6662e55d0fd9f228':a('wintermute','Wintermute 5','2026-09-18'),
 // bitvavo
 '0x04a6b67fac93e507d2642f129f5cb8ad474f9823':a('bitvavo','Bitvavo 1','2026-09-18','Etherscan-applied tag sourced from a public compilation.'),
 '0x75f594083de65ff173eb7ce505aa26332fe389f5':a('bitvavo','Bitvavo 2','2026-09-18','Etherscan-applied tag sourced from a public compilation.'),
 '0x2f1752e8b49c6e7391dc6e55934ceedc7abf18f7':a('bitvavo','Bitvavo 3','2026-09-18','Etherscan-applied tag sourced from a public compilation.'),
 '0x2586db422ec15d5999b50c43be219756c46bb0bd':a('bitvavo','Bitvavo 5','2026-09-18','Etherscan-applied tag sourced from a public compilation.'),
 '0x87eab4f119113e0e5920288936ad94c307b4849a':a('bitvavo','Bitvavo 9','2026-09-18','Etherscan-applied tag sourced from a public compilation.'),
 '0x079a892628ebf28d0ed8f00151cff225a093dc63':a('bitvavo','Bitvavo: Hot 1','2026-09-18','Etherscan-applied tag sourced from a public compilation.'),
 // bitcoinsuisse
 '0x7b4576d06d0ce1f83f9a9b76bf8077bffd34fcb1':a('bitcoinsuisse','Bitcoin Suisse 1','2026-09-18','Etherscan-applied tag sourced from a public compilation.'),
 '0x3f262579e4332e1be2722684eaa1c1b111f7a8d8':a('bitcoinsuisse','Bitcoin Suisse 2','2026-09-18','Etherscan-applied tag sourced from a public compilation.'),
 '0x31dff0cf605f9719b9171f6049150595cc1240f1':a('bitcoinsuisse','Bitcoin Suisse 3','2026-09-18','Inactive for about three years.'),
 // paribu
 '0xbd8ef191caa1571e8ad4619ae894e07a75de0c35':a('paribu','Paribu 1','2026-09-18'),
 '0x2bb97b6cf6ffe53576032c11711d59bd056830ee':a('paribu','Paribu 2','2026-09-18','Dormant for several years.'),
 '0xfb90501083a3b6af766c8da35d3dde01eb0d2a68':a('paribu','Paribu 3','2026-09-18'),
 '0xabc74170f3cb8ab352820c39cc1d1e05ce9e41d3':a('paribu','Paribu 4','2026-09-18'),
 '0x9acbb72cf67103a30333a32cd203459c6a9c3311':a('paribu','Paribu 5','2026-09-18'),
 // btcturk
 '0x832f166799a407275500430b61b622f0058f15d6':a('btcturk','BTC Turk: Main Wallet','2026-09-18'),
 '0x2ee555c9006a9dc4674f01e0d4dfc58e013708f0':a('btcturk','BtcTurk 2','2026-09-18','Last active December 2023.'),
 '0x1c17622cfa9b6fd2043a76dfc39a5b5a109aa708':a('btcturk','BtcTurk 3','2026-09-18'),
 '0x628a6fe299589b4b5a67d4b43ccdcb4821b3d80c':a('btcturk','BtcTurk 5','2026-09-18'),
 '0x8c54ebdd960056d2cff5998df5695daca1fc0190':a('btcturk','BtcTurk 7','2026-09-18'),
 '0x16769e533352798deb664ba570230a758346ca1a':a('btcturk','BtcTurk 9','2026-09-18'),
 '0x46f80018211d5cbbc988e853a8683501fca4ee9b':a('btcturk','BtcTurk: Cold 1','2026-09-18'),
 // coinmetro
 '0xa270f3ad1a7a82e6a3157f12a900f1e25bc4fbfd':a('coinmetro','CoinMetro 1','2026-09-18'),
 '0x4cf2220105995f006813923019f02be1ccca8132':a('coinmetro','Coinmetro 2','2026-09-18','Verified multisig hot-wallet contract operated by the exchange.'),
 '0x706ee6cf36a4bf95ec7fe5d468571b9e9e63fbb6':a('coinmetro','Coinmetro 3','2026-09-18'),
 '0x46a189c7f37953b91e5bd75d0e608efdafefaf1c':a('coinmetro','Coinmetro 4','2026-09-18','Verified multisig hot-wallet contract operated by the exchange.'),
 '0x1e7b450322e42b53d55abc795913537fd680fe0c':a('coinmetro','Coinmetro 5','2026-09-18','Verified multisig hot-wallet contract operated by the exchange.'),
 '0x0bc7b31bf8ffac8213e496102167fe73fc30937a':a('coinmetro','Coinmetro 6','2026-09-18','Verified multisig hot-wallet contract operated by the exchange.'),
 '0x7c1c73bf60feb40cbcf0f12324200238ee23bb54':a('coinmetro','CoinMetro: MultiSig Cold Wallet','2026-09-18','Multisig cold-wallet contract.'),
 // copper
 '0x7c6782476e29fb26e1556fba058eb7eced93d327':a('copper','Copper 1','2026-09-18'),
 '0xcfbba243c567738c2d3d958026b1bf6ad894a19e':a('copper','Copper 2','2026-09-18'),
 '0xaf64555ddd61fcf7d094824dd9b4ebea165afc5b':a('copper','Copper 3','2026-09-18'),
 '0x0349923ae2b35ff4f0099869aeea99d1f3fd12a9':a('copper','Copper 4','2026-09-18'),
 '0xa205fd7344656c72fdc645b72faf5a3de0b3e825':a('copper','Copper 5','2026-09-18'),
 '0xa5995359b9941e060e366b4ee3ebb6a9f47649be':a('copper','Copper 6','2026-09-18'),
 // coinspot
 '0xf35a6bd6e0459a4b53a27862c51a2a7292b383d1':a('coinspot','CoinSpot 1','2026-09-18'),
 '0xe4b3dd9839ed1780351dc5412925cf05f07a1939':a('coinspot','CoinSpot 2','2026-09-18'),
 '0x32143a02fb6484d18c79fa0401c9bf760dd3de68':a('coinspot','CoinSpot 3','2026-09-18'),
 '0x56de1961fda5454e6f8e6d0e3124ff648fd69400':a('coinspot','CoinSpot 4','2026-09-18'),
 '0x867bfa133d64fad734c89f886d2a169b6504ab2b':a('coinspot','CoinSpot 5','2026-09-18'),
 '0x09363887a4096b142f3f6b58a7eed2f1a0ff7343':a('coinspot','CoinSpot 6','2026-09-18'),
 '0x916ed5586bb328e0ec1a428af060dc3d10919d84':a('coinspot','CoinSpot 7','2026-09-18'),
 '0xa89a1278ac85367f38bdf6746658ce2b9875526e':a('coinspot','CoinSpot 9','2026-09-18'),
 '0xdb6fdc30ab61c7cca742d4c13d1b035f3f82019a':a('coinspot','CoinSpot 10','2026-09-18'),
 '0xeed86b90448c371eab47b7f16e294297c27e4f51':a('coinspot','CoinSpot 11','2026-09-18'),
 '0x19184ab45c40c2920b0e0e31413b9434abd243ed':a('coinspot','CoinSpot 13','2026-09-18'),
 '0x32e567e8b527d3194c60ea3c6a5c009d58a0b36d':a('coinspot','CoinSpot 14','2026-09-18'),
 '0x9239df3e9996c776d539eb9f01a8ae8e7957b3c3':a('coinspot','CoinSpot 15','2026-09-18'),
 '0x33a64dcdfa041befebc9161a3e0c6180cd94fa89':a('coinspot','CoinSpot 16','2026-09-18'),
 '0x4207837d4cd914467eb76bf88c4d6e7ba11ccdf9':a('coinspot','CoinSpot 17','2026-09-18'),
 '0x91a0a3043f68986043d7083c4d85b558b21f0a7b':a('coinspot','CoinSpot 18','2026-09-18'),
 '0xdf1553a2130cbafa70a35e68efc6ccf67f0a278c':a('coinspot','CoinSpot 20','2026-09-18'),
 '0xa9bd318a4ca1747e6068d100e18711b529386e29':a('coinspot','CoinSpot 21','2026-09-18'),
 // coinjar
 '0x0363bfc09b48616190d15ddee5987ae2d05da6f4':a('coinjar','Coinjar 1','2026-09-18'),
 '0xc1c88785e9b5c9c85b3f6c99255c3bef9e3b14a7':a('coinjar','Coinjar 2','2026-09-18'),
 '0xd6a062cae6123c158768a5c444ca0896cc60d6b1':a('coinjar','Coinjar 3','2026-09-18','Exchange wallet contract (proxy) deployed by the exchange.'),
 // digitalsurge
 '0xfb75b231c307738ce506c242babad2fd2e77b0bf':a('digitalsurge','Digital Surge 1','2026-09-18','Inactive for over a year.'),
 // btcmarkets
 '0xc55eddadeeb47fcde0b3b6f25bd47d745ba7e7fa':a('btcmarkets','BTC Markets 2','2026-09-18'),
 // coinsquare
 '0x02fdc44bf226e49dceca4775afaef3360e9c4ee9':a('coinsquare','Coinsquare 1','2026-09-18'),
 '0x0fcff154753e337983613889b69dd85fe8a1a145':a('coinsquare','Coinsquare 2','2026-09-18'),
 '0x14aa1ad09664c33679ae5689d93085b8f7c84bd3':a('coinsquare','Coinsquare 3','2026-09-18'),
 '0x3858a27eecb5f1144473e35a293cb1b2bda6dff4':a('coinsquare','Coinsquare 4','2026-09-18'),
 '0x476b067cbff8acb805038e9daef5d51c7612d593':a('coinsquare','Coinsquare 5','2026-09-18'),
 '0x48a0b5f7de8789a3962918c6df4a766c0c8857b0':a('coinsquare','Coinsquare 6','2026-09-18'),
 '0x4b36c488fcb66962159133b703870ad6cf44d3bf':a('coinsquare','Coinsquare 7','2026-09-18'),
 '0xe9bdb4219706914441178bc8357e8551b53d8cbf':a('coinsquare','Bitbuy MultiSig 1','2026-09-18','Bitbuy is a trade name of Coinsquare Capital Markets Ltd.; multisig exchange wallet contract, largely dormant.'),
 // shakepay
 '0x912fd21d7a69678227fe6d08c64222db41477ba0':a('shakepay','Shakepay 1','2026-09-18'),
 '0x4d846da8257bb0ebd164eff513dff0f0c2c3c0ba':a('shakepay','Shakepay 3','2026-09-18'),
 '0x3b794929566e3ba0f25e4263e1987828b5c87161':a('shakepay','Shakepay 4','2026-09-18'),
 '0xbbd0d4d067d5af2065b1b6fd936d93237ae1c56c':a('shakepay','Shakepay 6','2026-09-18'),
 '0x389044f3ac7472060a0618116e3624a5f0f20f28':a('shakepay','Shakepay 7','2026-09-18'),
 '0x7dbb4bdcfe614398d1a68ecc219f15280d0959e0':a('shakepay','Shakepay 8','2026-09-18'),
 '0x88dcdd4a0a58b7e2208805d547043c37dca2b6dc':a('shakepay','Shakepay 9','2026-09-18'),
 '0x94b18793b93b524b110fead408b955422b982fa4':a('shakepay','Shakepay 10','2026-09-18','Multisig custody contract that funds Shakepay 6.'),
 // newton
 '0x2db1d8cdf1abe8c70b531a790cdf2ff38aecf652':a('newton','Newton','2026-09-18'),
 // wealthsimple
 '0xa21a16ec22a940990922220e4ab5bf4c2310f556':a('wealthsimple','Wealthsimple 1','2026-09-18','Possibly retired; last activity April 2025.'),
 // bitso
 '0x58b704065b7aff3ed351052f8560019e05925023':a('bitso','Bitso 1','2026-09-18'),
 // mercadobitcoin
 '0xb8ba36e591facee901ffd3d5d82df491551ad7ef':a('mercadobitcoin','Mercado Bitcoin 1','2026-09-18'),
 // valr
 '0x05cdb1526f6e224e02919a4c018d9784ea25eb3d':a('valr','VALR: Hot Wallet','2026-09-18')
};
