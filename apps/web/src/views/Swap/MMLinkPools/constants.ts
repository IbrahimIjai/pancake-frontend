import { ChainId } from '@pancakeswap/sdk'
import contract from 'config/constants/contracts'
import { getAddress } from '@ethersproject/address'

export const NATIVE_CURRENCY_ADDRESS = getAddress('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE')

export const MM_SUPPORT_CHIAN = {
  1: true,
  5: true,
  56: false,
}

export const MM_SWAP_CONTRACT_ADDRESS = contract.mmLinkedPool

export const MM_STABLE_TOKENS_WHITE_LIST: Record<number, Record<string, string>> = {
  [ChainId.ETHEREUM]: {
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 'USDC',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'USDT',
    '0x6B175474E89094C44Da98b954EedeAC495271d0F': 'DAI',
    '0x4Fabb145d64652a948d72533023f6E7A623C7C53': 'BUSD',
  },
  [ChainId.GOERLI]: {},
}

export const MM_SIGNER = {
  [ChainId.ETHEREUM]: '0x945BCF562085De2D5875b9E2012ed5Fd5cfaB927',
  [ChainId.GOERLI]: '0x13414B047539298D5aeD429722211681eAAb43B7',
}

export const SAFE_MM_QUOTE_EXPIRY_SEC = 25
