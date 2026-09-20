/** Pure EVM constants shared by the server connectors and the browser-side live client. No server imports here. */
import type {Asset} from './model';
export interface TokenSpec {asset:Asset;decimals:number}
/**
 * Allowlisted stablecoin contracts per chain, keyed by address (lowercased on EVM chains; base58 as-is on
 * Tron and Solana). `decimals` is declared per token rather than assumed: every entry here happens to be
 * six, but an 18-decimal token added without a declared scale would silently misstate value by 10^12.
 */
export const CONTRACTS:Record<string,Record<string,TokenSpec>>={
 Ethereum:{'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48':{asset:'USDC',decimals:6},'0xdac17f958d2ee523a2206206994597c13d831ec7':{asset:'USDT',decimals:6}},
 Base:{'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913':{asset:'USDC',decimals:6}},
 Arbitrum:{'0xaf88d065e77c8cc2239327c5edb3a432268e5831':{asset:'USDC',decimals:6},'0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9':{asset:'USDT',decimals:6}},
 Tron:{'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t':{asset:'USDT',decimals:6}},
 Solana:{'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v':{asset:'USDC',decimals:6},'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB':{asset:'USDT',decimals:6}}
};
// ERC20 Transfer(address,address,uint256) event signature.
export const ERC20_TRANSFER_TOPIC='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export interface EvmLog {address:string;transactionHash:string;logIndex:string;blockNumber:string;blockHash:string;data:string;topics:string[];removed?:boolean;}
