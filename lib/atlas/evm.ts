/** Pure EVM constants shared by the server connectors and the browser-side live client. No server imports here. */
import type {Asset} from './model';
export const CONTRACTS:Record<string,Record<string,Asset>>={
 Ethereum:{'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48':'USDC','0xdac17f958d2ee523a2206206994597c13d831ec7':'USDT'},
 Base:{'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913':'USDC'},
 Arbitrum:{'0xaf88d065e77c8cc2239327c5edb3a432268e5831':'USDC'},
 Tron:{'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t':'USDT'},
 Solana:{'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v':'USDC','Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB':'USDT'}
};
// ERC20 Transfer(address,address,uint256) event signature.
export const ERC20_TRANSFER_TOPIC='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export interface EvmLog {address:string;transactionHash:string;logIndex:string;blockNumber:string;blockHash:string;data:string;topics:string[];removed?:boolean;}
