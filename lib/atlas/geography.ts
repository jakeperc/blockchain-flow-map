export const COUNTRIES:Record<string,{name:string;numeric:string;anchor:[number,number]}>= {
 US:{name:'United States',numeric:'840',anchor:[-98,38]},CA:{name:'Canada',numeric:'124',anchor:[-105,56]},MX:{name:'Mexico',numeric:'484',anchor:[-102,24]},BR:{name:'Brazil',numeric:'076',anchor:[-52,-12]},AR:{name:'Argentina',numeric:'032',anchor:[-64,-35]},CO:{name:'Colombia',numeric:'170',anchor:[-74,4]},
 GB:{name:'United Kingdom',numeric:'826',anchor:[-2,54]},DE:{name:'Germany',numeric:'276',anchor:[10,51]},FR:{name:'France',numeric:'250',anchor:[2,47]},CH:{name:'Switzerland',numeric:'756',anchor:[8.1,46.8]},AE:{name:'United Arab Emirates',numeric:'784',anchor:[54,24]},TR:{name:'Türkiye',numeric:'792',anchor:[35,39]},NG:{name:'Nigeria',numeric:'566',anchor:[8,9]},ZA:{name:'South Africa',numeric:'710',anchor:[25,-29]},KE:{name:'Kenya',numeric:'404',anchor:[38,0]},
 IN:{name:'India',numeric:'356',anchor:[79,23]},SG:{name:'Singapore',numeric:'702',anchor:[103.82,1.35]},HK:{name:'Hong Kong',numeric:'344',anchor:[114.17,22.32]},JP:{name:'Japan',numeric:'392',anchor:[138,36]},KR:{name:'South Korea',numeric:'410',anchor:[128,36]},PH:{name:'Philippines',numeric:'608',anchor:[122,12]},ID:{name:'Indonesia',numeric:'360',anchor:[113,-1]},AU:{name:'Australia',numeric:'036',anchor:[134,-25]},
 NL:{name:'Netherlands',numeric:'528',anchor:[5.3,52.2]},EE:{name:'Estonia',numeric:'233',anchor:[25,58.7]},TH:{name:'Thailand',numeric:'764',anchor:[101,15]},TW:{name:'Taiwan',numeric:'158',anchor:[121,23.7]},
 // Offshore financial centres where several large exchanges are legally domiciled. Too small for the 110m atlas outline; represented by their anchor only.
 KY:{name:'Cayman Islands',numeric:'136',anchor:[-81.2,19.3]},SC:{name:'Seychelles',numeric:'690',anchor:[55.5,-4.6]},VG:{name:'British Virgin Islands',numeric:'092',anchor:[-64.6,18.4]},GI:{name:'Gibraltar',numeric:'292',anchor:[-5.35,36.14]}
};
export const nameOf=(code:string)=>COUNTRIES[code]?.name??code;
export const CHAIN_COLORS:Record<string,string>={Ethereum:'#92a9e7',Tron:'#de967d',Solana:'#b7a0d9',Base:'#5c9ddd',Arbitrum:'#81bfb3'};
export const ASSET_COLORS:Record<string,string>={USDC:'#81b9d1',USDT:'#9bc9a7'};
export const CONFIDENCE_COLORS:Record<string,string>={VERIFIED:'#b2d4c6',HIGH:'#d3bd80',MEDIUM:'#cd947a',UNKNOWN:'#697579'};
export type ColorMode='CHAIN'|'ASSET'|'CONFIDENCE';
/** Map label placement. Entries without `auto` are always shown; `auto` entries (and any jurisdiction not listed) appear only while active. `mobile` keeps a label on narrow screens. Offsets are pixels from the anchor. */
export const MAP_LABELS:Record<string,{text?:string;dx?:number;dy?:number;mobile?:boolean;auto?:boolean}>={
 US:{text:'UNITED STATES',mobile:true},GB:{text:'UNITED KINGDOM',dy:-10,mobile:true},BR:{mobile:true},SG:{mobile:true},HK:{},AE:{text:'U.A.E.',dx:-40,dy:-12},JP:{},AU:{mobile:true},NG:{},IN:{dy:23},
 KR:{dy:-12,auto:true},KY:{dx:-84,dy:14,auto:true},VG:{dx:8,dy:-4,auto:true},SC:{dy:14,auto:true},CA:{auto:true},MX:{dx:-14,dy:16,auto:true},ZA:{auto:true},CH:{dy:-8,auto:true},DE:{dy:-10,auto:true},TR:{dy:14,auto:true},NL:{dx:-52,dy:-10,auto:true},EE:{dy:-8,auto:true},GI:{dx:-50,dy:14,auto:true},TH:{dx:-30,dy:16,auto:true},TW:{dx:8,dy:-6,auto:true},PH:{dy:14,auto:true},ID:{dy:16,auto:true}
};
