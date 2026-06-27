import type {
  MarketCandle,
  MarketQuote,
  MarketSearchResult,
} from '../types/marketTypes';

type BrapiQuoteLike = {
  currency?: string;
  shortName?: string;
  longName?: string;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: string;
  regularMarketPrice?: number;
  regularMarketVolume?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  trailingAnnualDividendYield?: number;
  dividendsYield?: number;
  symbol?: string;
  logourl?: string;
  marketCap?: number;
};

type BrapiHistoricalPrice = {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export function normalizeBrapiSearchResult(
  quote: BrapiQuoteLike,
  fallbackSymbol: string
): MarketSearchResult {
  const symbol = (quote.symbol ?? fallbackSymbol).toUpperCase();

  return {
    symbol,
    displaySymbol: symbol,
    name: quote.longName ?? quote.shortName ?? symbol,
    type: 'brazilian_stock',
    currency: 'BRL',
    exchange: 'B3',
  };
}

export function normalizeBrapiQuote(
  quote: BrapiQuoteLike,
  fallbackSymbol: string
): MarketQuote {
  const price = toFiniteNumber(quote.regularMarketPrice);
  const symbol = (quote.symbol ?? fallbackSymbol).toUpperCase();

  if (price === null) {
    throw new Error('Cotacao indisponivel para este ticker.');
  }

  return {
    symbol,
    name: quote.longName ?? quote.shortName ?? symbol,
    type: 'brazilian_stock',
    currency: quote.currency === 'USD' ? 'USD' : 'BRL',
    price,
    change: quote.regularMarketChange,
    changePercent: quote.regularMarketChangePercent,
    updatedAt: quote.regularMarketTime ?? new Date().toISOString(),
    volume: quote.regularMarketVolume,
    marketCap: quote.marketCap,
    dayHigh: quote.regularMarketDayHigh,
    dayLow: quote.regularMarketDayLow,
    dividendYield: quote.dividendsYield ?? quote.trailingAnnualDividendYield,
    financialVolume:
      typeof quote.regularMarketVolume === 'number'
        ? quote.regularMarketVolume * price
        : undefined,
  };
}

export function normalizeBrapiCandles(
  items: BrapiHistoricalPrice[] = []
): MarketCandle[] {
  return items
    .map((item) => ({
      time: item.date,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }))
    .filter(isValidCandle)
    .sort((left, right) => left.time - right.time);
}

function isValidCandle(candle: MarketCandle) {
  return (
    Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close)
  );
}

function toFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
