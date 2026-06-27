import {
  MarketDataError,
  type MarketAssetType,
  type MarketCandle,
  type MarketQuote,
  type MarketSearchResult,
  type MarketTimeframe,
} from '../types/marketTypes';
import {
  normalizeFinnhubCandles,
  normalizeFinnhubQuote,
} from '../utils/normalizeMarketData';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const BINANCE_BASE_URL = 'https://api.binance.com/api/v3';

type FinnhubQuoteResponse = {
  c?: number;
  d?: number;
  dp?: number;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
  t?: number;
};

type FinnhubCandleResponse = {
  c?: number[];
  h?: number[];
  l?: number[];
  o?: number[];
  s?: string;
  t?: number[];
  v?: number[];
};

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

const cryptoAssets: MarketSearchResult[] = [
  {
    symbol: 'BINANCE:BTCUSDT',
    displaySymbol: 'BTC',
    name: 'Bitcoin',
    type: 'crypto',
    currency: 'USD',
    exchange: 'Binance',
  },
  {
    symbol: 'BINANCE:ETHUSDT',
    displaySymbol: 'ETH',
    name: 'Ethereum',
    type: 'crypto',
    currency: 'USD',
    exchange: 'Binance',
  },
  {
    symbol: 'BINANCE:SOLUSDT',
    displaySymbol: 'SOL',
    name: 'Solana',
    type: 'crypto',
    currency: 'USD',
    exchange: 'Binance',
  },
];

export function searchCrypto(query: string): MarketSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return cryptoAssets;
  }

  return cryptoAssets.filter((asset) => {
    return (
      asset.symbol.toLowerCase().includes(normalizedQuery) ||
      asset.displaySymbol.toLowerCase().includes(normalizedQuery) ||
      asset.name.toLowerCase().includes(normalizedQuery)
    );
  });
}

export async function getFinnhubQuote(
  symbol: string,
  type: MarketAssetType
): Promise<MarketQuote> {
  const resolvedAsset = resolveFinnhubAsset(symbol, type);
  const response = await fetchFinnhub<FinnhubQuoteResponse>('/quote', {
    symbol: resolvedAsset.symbol,
  });

  return normalizeFinnhubQuote({
    symbol: resolvedAsset.symbol,
    name: resolvedAsset.name,
    type,
    currency: resolvedAsset.currency,
    quote: response,
  });
}

export async function getFinnhubCandles(
  symbol: string,
  type: MarketAssetType,
  timeframe: MarketTimeframe
): Promise<MarketCandle[]> {
  const resolvedAsset = resolveFinnhubAsset(symbol, type);
  const range = getFinnhubRange(timeframe);

  try {
    const response = await fetchFinnhub<FinnhubCandleResponse>(
      type === 'crypto' ? '/crypto/candle' : '/stock/candle',
      {
        symbol: resolvedAsset.symbol,
        resolution: range.resolution,
        from: range.from,
        to: range.to,
      }
    );

    return normalizeFinnhubCandles(response);
  } catch (error) {
    if (type === 'crypto' && error instanceof MarketDataError && error.status === 403) {
      return getBinanceCryptoCandles(resolvedAsset.symbol, timeframe);
    }

    throw error;
  }
}

function resolveFinnhubAsset(symbol: string, type: MarketAssetType) {
  if (type === 'crypto') {
    const normalizedSymbol = normalizeCryptoSymbol(symbol);
    const knownAsset = cryptoAssets.find((asset) => asset.symbol === normalizedSymbol);

    return (
      knownAsset ?? {
        symbol: normalizedSymbol,
        displaySymbol: normalizedSymbol,
        name: normalizedSymbol,
        type,
        currency: 'USD' as const,
        exchange: 'Finnhub',
      }
    );
  }

  return {
    symbol: symbol.trim().toUpperCase(),
    displaySymbol: symbol.trim().toUpperCase(),
    name: symbol.trim().toUpperCase(),
    type,
    currency: 'USD' as const,
    exchange: 'Finnhub',
  };
}

export function normalizeCryptoSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  const aliases: Record<string, string> = {
    BTC: 'BINANCE:BTCUSDT',
    BITCOIN: 'BINANCE:BTCUSDT',
    ETH: 'BINANCE:ETHUSDT',
    ETHEREUM: 'BINANCE:ETHUSDT',
    SOL: 'BINANCE:SOLUSDT',
    SOLANA: 'BINANCE:SOLUSDT',
  };

  return aliases[normalized] ?? normalized;
}

async function fetchFinnhub<T>(
  path: string,
  params: Record<string, string | number>
): Promise<T> {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    throw new MarketDataError('FINNHUB_API_KEY nao configurada.', 500);
  }

  const url = new URL(`${FINNHUB_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  url.searchParams.set('token', apiKey);

  let response: Response;

  try {
    response = await fetch(url);
  } catch {
    throw new MarketDataError('Nao foi possivel conectar ao Finnhub.');
  }

  if (!response.ok) {
    throw new MarketDataError(
      `Finnhub respondeu com erro ${response.status}.`,
      response.status
    );
  }

  return (await response.json()) as T;
}

async function getBinanceCryptoCandles(
  finnhubSymbol: string,
  timeframe: MarketTimeframe
): Promise<MarketCandle[]> {
  const binanceSymbol = toBinanceSymbol(finnhubSymbol);
  const range = getBinanceRange(timeframe);
  const url = new URL(`${BINANCE_BASE_URL}/klines`);

  url.searchParams.set('symbol', binanceSymbol);
  url.searchParams.set('interval', range.interval);
  url.searchParams.set('limit', String(range.limit));

  let response: Response;

  try {
    response = await fetch(url);
  } catch {
    throw new MarketDataError('Nao foi possivel conectar a Binance para candles cripto.');
  }

  if (!response.ok) {
    throw new MarketDataError(
      `Binance respondeu com erro ${response.status}.`,
      response.status
    );
  }

  const klines = (await response.json()) as BinanceKline[];

  return klines
    .map((item) => ({
      time: Math.floor(item[0] / 1000),
      open: Number(item[1]),
      high: Number(item[2]),
      low: Number(item[3]),
      close: Number(item[4]),
      volume: Number(item[5]),
    }))
    .filter((candle) =>
      Number.isFinite(candle.time) &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close)
    )
    .sort((left, right) => left.time - right.time);
}

function toBinanceSymbol(finnhubSymbol: string) {
  return finnhubSymbol.replace(/^BINANCE:/, '').toUpperCase();
}

function getBinanceRange(timeframe: MarketTimeframe) {
  const ranges: Record<MarketTimeframe, { interval: string; limit: number }> = {
    '1D': { interval: '1d', limit: 365 },
    '1W': { interval: '1w', limit: 260 },
    '1M': { interval: '1d', limit: 31 },
    '3M': { interval: '1d', limit: 93 },
    '6M': { interval: '1d', limit: 186 },
    '1Y': { interval: '1d', limit: 365 },
    '2Y': { interval: '1d', limit: 730 },
  };

  return ranges[timeframe];
}

function getFinnhubRange(timeframe: MarketTimeframe) {
  const to = Math.floor(Date.now() / 1000);
  const daysByTimeframe: Record<MarketTimeframe, number> = {
    '1D': 365,
    '1W': 365 * 2,
    '1M': 31,
    '3M': 93,
    '6M': 186,
    '1Y': 365,
    '2Y': 365 * 2,
  };

  return {
    from: to - daysByTimeframe[timeframe] * 24 * 60 * 60,
    resolution: timeframe === '1W' ? 'W' : 'D',
    to,
  };
}
