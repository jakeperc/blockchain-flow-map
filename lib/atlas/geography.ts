export const COUNTRIES:Record<string,{name:string;numeric:string;anchor:[number,number]}>= {
 US:{name:'United States',numeric:'840',anchor:[-98,38]},CA:{name:'Canada',numeric:'124',anchor:[-105,56]},MX:{name:'Mexico',numeric:'484',anchor:[-102,24]},BR:{name:'Brazil',numeric:'076',anchor:[-52,-12]},AR:{name:'Argentina',numeric:'032',anchor:[-64,-35]},CO:{name:'Colombia',numeric:'170',anchor:[-74,4]},
 GB:{name:'United Kingdom',numeric:'826',anchor:[-2,54]},DE:{name:'Germany',numeric:'276',anchor:[10,51]},FR:{name:'France',numeric:'250',anchor:[2,47]},CH:{name:'Switzerland',numeric:'756',anchor:[8.1,46.8]},AE:{name:'United Arab Emirates',numeric:'784',anchor:[54,24]},TR:{name:'Türkiye',numeric:'792',anchor:[35,39]},NG:{name:'Nigeria',numeric:'566',anchor:[8,9]},ZA:{name:'South Africa',numeric:'710',anchor:[25,-29]},KE:{name:'Kenya',numeric:'404',anchor:[38,0]},
 IN:{name:'India',numeric:'356',anchor:[79,23]},SG:{name:'Singapore',numeric:'702',anchor:[103.82,1.35]},HK:{name:'Hong Kong',numeric:'344',anchor:[114.17,22.32]},JP:{name:'Japan',numeric:'392',anchor:[138,36]},KR:{name:'South Korea',numeric:'410',anchor:[128,36]},PH:{name:'Philippines',numeric:'608',anchor:[122,12]},ID:{name:'Indonesia',numeric:'360',anchor:[113,-1]},AU:{name:'Australia',numeric:'036',anchor:[134,-25]},
 // Offshore financial centres where several large exchanges are legally domiciled. Too small for the 110m atlas outline; represented by their anchor only.
 KY:{name:'Cayman Islands',numeric:'136',anchor:[-81.2,19.3]},SC:{name:'Seychelles',numeric:'690',anchor:[55.5,-4.6]},VG:{name:'British Virgin Islands',numeric:'092',anchor:[-64.6,18.4]}
};
export const nameOf=(code:string)=>COUNTRIES[code]?.name??code;
export const CHAIN_COLORS:Record<string,string>={Ethereum:'#92a9e7',Tron:'#de967d',Solana:'#b7a0d9',Base:'#5c9ddd',Arbitrum:'#81bfb3'};
export const ASSET_COLORS:Record<string,string>={USDC:'#81b9d1',USDT:'#9bc9a7'};
export const CONFIDENCE_COLORS:Record<string,string>={VERIFIED:'#b2d4c6',HIGH:'#d3bd80',MEDIUM:'#cd947a',UNKNOWN:'#697579'};
export type ColorMode='CHAIN'|'ASSET'|'CONFIDENCE';
