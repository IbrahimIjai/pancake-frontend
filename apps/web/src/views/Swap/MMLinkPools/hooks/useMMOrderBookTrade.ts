import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount, Pair, TradeType } from '@pancakeswap/sdk'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import useActiveWeb3React from 'hooks/useActiveWeb3React'
import { useMemo } from 'react'
import { Field } from 'state/swap/actions'
import { useCurrencyBalances } from 'state/wallet/hooks'
import useSWR from 'swr'
import { isAddress } from 'utils'

import { getMMOrderBook } from '../apis'
import { useIsMMQuotingPair } from './useIsMMQuotingPair'
import { OrderBookRequest, OrderBookResponse, TradeWithMM } from '../types'
import { parseMMParameter, parseMMTrade } from '../utils/exchange'

// TODO: update
const BAD_RECIPIENT_ADDRESSES: string[] = [
  '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // v2 factory
  '0xf164fC0Ec4E93095b804a4795bBe1e041497b92a', // v2 router 01
  '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // v2 router 02
]

function involvesAddress(trade: TradeWithMM<Currency, Currency, TradeType>, checksummedAddress: string): boolean {
  return (
    trade.route.path.some((token) => token.isToken && token.address === checksummedAddress) ||
    trade.route.pairs.some((pair) => (pair as Pair)?.liquidityToken?.address === checksummedAddress)
  )
}

export const useOrderBookQuote = (request: OrderBookRequest | null): OrderBookResponse => {
  const { data } = useSWR(
    request &&
      request.trader &&
      (request.makerSideTokenAmount || request.takerSideTokenAmount) &&
      request.makerSideTokenAmount !== '0' &&
      request.takerSideTokenAmount !== '0' && [
        `orderBook/${request.networkId}/${request.makerSideToken}/${request.takerSideToken}/${request.makerSideTokenAmount}/${request.takerSideTokenAmount}/`,
      ],
    () => {
      return getMMOrderBook(request)
    },
    { refreshInterval: 5000 },
  )
  return data
}

export const useMMTrade = (
  independentField: Field,
  typedValue: string,
  inputCurrency: Currency | undefined,
  outputCurrency: Currency | undefined,
): {
  currencies: { [field in Field]?: Currency }
  currencyBalances: { [field in Field]?: CurrencyAmount<Currency> }
  parsedAmount: CurrencyAmount<Currency> | undefined
  trade?: TradeWithMM<Currency, Currency, TradeType> | null
  inputError?: string
  mmParam: OrderBookRequest
} | null => {
  const isMMQuotingPair = useIsMMQuotingPair(inputCurrency, outputCurrency)
  const { account, chainId } = useActiveWeb3React()
  const mmParam = useMemo(
    () =>
      isMMQuotingPair
        ? parseMMParameter(chainId, inputCurrency, outputCurrency, independentField, typedValue, account)
        : null,
    [chainId, inputCurrency, outputCurrency, independentField, typedValue, account, isMMQuotingPair],
  )
  const mmQoute = useOrderBookQuote(mmParam)
  const { t } = useTranslation()
  const to: string | null = account ?? null

  const relevantTokenBalances = useCurrencyBalances(account ?? undefined, [
    inputCurrency ?? undefined,
    outputCurrency ?? undefined,
  ])
  const isExactIn: boolean = independentField === Field.INPUT
  const independentCurrency = isExactIn ? inputCurrency : outputCurrency
  const parsedAmount = tryParseAmount(typedValue, independentCurrency ?? undefined)
  let bestTradeWithMM = null

  if (!inputCurrency || !outputCurrency || !mmQoute || !mmQoute?.message?.takerSideTokenAmount) bestTradeWithMM = null
  else {
    const { takerSideTokenAmount, makerSideTokenAmount } = mmQoute?.message
    bestTradeWithMM = parseMMTrade(isExactIn, inputCurrency, outputCurrency, takerSideTokenAmount, makerSideTokenAmount)
  }

  const currencyBalances = {
    [Field.INPUT]: relevantTokenBalances[0],
    [Field.OUTPUT]: relevantTokenBalances[1],
  }
  const currencies: { [field in Field]?: Currency } = {
    [Field.INPUT]: inputCurrency ?? undefined,
    [Field.OUTPUT]: outputCurrency ?? undefined,
  }

  let inputError: string | undefined
  if (!account) {
    inputError = t('Connect Wallet')
  }

  if (!parsedAmount) {
    inputError = inputError ?? t('Enter an amount')
  }

  if (!currencies[Field.INPUT] || !currencies[Field.OUTPUT]) {
    inputError = inputError ?? t('Select a token')
  }

  const formattedTo = isAddress(to)
  if (!to || !formattedTo) {
    inputError = inputError ?? t('Enter a recipient')
  } else if (
    BAD_RECIPIENT_ADDRESSES.indexOf(formattedTo) !== -1 ||
    (bestTradeWithMM && involvesAddress(bestTradeWithMM, formattedTo))
  ) {
    inputError = inputError ?? t('Invalid recipient')
  }

  const slippageAdjustedAmounts = bestTradeWithMM && {
    [Field.INPUT]: bestTradeWithMM.inputAmount,
    [Field.OUTPUT]: bestTradeWithMM.outputAmount,
  }

  // compare input balance to max input based on version
  const [balanceIn, amountIn] = [
    currencyBalances[Field.INPUT],
    slippageAdjustedAmounts ? slippageAdjustedAmounts[Field.INPUT] : null,
  ]

  if (balanceIn && amountIn && balanceIn.lessThan(amountIn)) {
    inputError = t('Insufficient %symbol% balance', { symbol: amountIn.currency.symbol })
  }
  if (mmQoute?.message?.error) {
    inputError = mmQoute?.message?.error
  }
  return {
    trade: bestTradeWithMM,
    parsedAmount,
    currencyBalances,
    currencies,
    inputError,
    mmParam,
  }
}
