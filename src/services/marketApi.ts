import type {
  Asset,
  BrazilianStockSearchResult,
  Candle,
  CryptoSearchResult,
  PriceQuote,
} from '../types';

type BackendAssetType = 'crypto' | 'brazilian_stock' | 'forex' | 'global_stock';

type BackendSearchResult = {
  symbol: string;
  displaySymbol: string;
  name: string;
  type: BackendAssetType;
  currency: 'USD' | 'BRL';
  exchange?: string;
};

type BackendQuote = {
  symbol: string;
  name: string;
  type: BackendAssetType;
  currency: 'USD' | 'BRL';
  price: number;
  change?: number;
  changePercent?: number;
  updatedAt: string;
  volume?: number;
  marketCap?: number;
  dayHigh?: number;
  dayLow?: number;
  dividendYield?: number;
  financialVolume?: number;
};

type BackendCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

const API_BASE_URL =
  (typeof process !== 'undefined'
    ? process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '')
    : undefined) ??
  'http://localhost:3333';

const cryptoSymbolAliases: Record<string, string> = {
  bitcoin: 'BINANCE:BTCUSDT',
  btc: 'BINANCE:BTCUSDT',
  BTC: 'BINANCE:BTCUSDT',
  ethereum: 'BINANCE:ETHUSDT',
  eth: 'BINANCE:ETHUSDT',
  ETH: 'BINANCE:ETHUSDT',
  solana: 'BINANCE:SOLUSDT',
  sol: 'BINANCE:SOLUSDT',
  SOL: 'BINANCE:SOLUSDT',
};

export async function searchCrypto(query: string): Promise<CryptoSearchResult[]> {
  const response = await apiGet<{ results: BackendSearchResult[] }>('/api/search', {
    query,
    type: 'crypto',
  });

  return response.results.map((result) => ({
    id: result.symbol,
    symbol: result.displaySymbol,
    name: result.name,
    imageUrl: undefined,
    marketCapRank: undefined,
    type: 'crypto',
  }));
}

export async function searchBrazilianStock(
  query: string
): Promise<BrazilianStockSearchResult[]> {
  const response = await apiGet<{ results: BackendSearchResult[] }>('/api/search', {
    query,
    type: 'brazilian_stock',
  });

  return response.results.map((result) => ({
    ticker: result.symbol,
    name: result.name,
    imageUrl: undefined,
    type: 'brazilian_stock',
  }));
}

export async function getCryptoQuote(symbol: string): Promise<PriceQuote> {
  return getMarketQuote(resolveCryptoMarketSymbol(symbol), 'crypto');
}

export async function getBrazilianStockQuote(symbol: string): Promise<PriceQuote> {
  return getMarketQuote(symbol, 'brazilian_stock');
}

export async function getCryptoDailyCandles(
  symbol: string,
  _days: 90 | 365 = 365
): Promise<Candle[]> {
  return getMarketCandles(resolveCryptoMarketSymbol(symbol), 'crypto', '1D');
}

export async function getBrazilianStockHistory(
  symbol: string,
  _range: string = '2y'
): Promise<Candle[]> {
  return getMarketCandles(symbol, 'brazilian_stock', '1D');
}

export async function getMarketQuote(
  symbol: string,
  type: BackendAssetType
): Promise<PriceQuote> {
  const response = await apiGet<{ quote: BackendQuote }>('/api/quote', {
    symbol,
    type,
  });

  return mapQuote(response.quote);
}

export async function getMarketCandles(
  symbol: string,
  type: BackendAssetType,
  timeframe: string
): Promise<Candle[]> {
  const response = await apiGet<{ candles: BackendCandle[] }>('/api/candles', {
    symbol,
    type,
    timeframe,
  });

  return response.candles.map((candle) => ({
    timestamp: new Date(candle.time * 1000).toISOString(),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  }));
}

export function resolveAssetMarketSymbol(asset: Asset) {
  if (asset.type === 'crypto') {
    return resolveCryptoMarketSymbol(
      asset.marketSymbol ?? asset.coingeckoId ?? asset.symbol ?? asset.id
    );
  }

  return (asset.marketSymbol ?? asset.symbol).toUpperCase();
}

export function resolveCryptoMarketSymbol(symbol: string) {
  const trimmedSymbol = symbol.trim();
  return cryptoSymbolAliases[trimmedSymbol] ?? cryptoSymbolAliases[trimmedSymbol.toLowerCase()] ?? trimmedSymbol.toUpperCase();
}

function mapQuote(quote: BackendQuote): PriceQuote {
  const changePercent = quote.changePercent ?? 0;
  const previousPriceFactor = 1 + changePercent / 100;
  const previousPrice =
    previousPriceFactor !== 0 ? quote.price / previousPriceFactor : quote.price;
  const inferredChange = Number.isFinite(previousPrice)
    ? quote.price - previousPrice
    : 0;

  return {
    price: quote.price,
    change: quote.change ?? inferredChange,
    changePercent,
    currency: quote.currency,
    updatedAt: quote.updatedAt,
    volume: quote.volume,
    marketCap: quote.marketCap,
    dayHigh: quote.dayHigh,
    dayLow: quote.dayLow,
    dividendYield: quote.dividendYield,
    financialVolume: quote.financialVolume,
  };
}

async function apiGet<T>(
  path: string,
  params: Record<string, string | number>
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  let response: Response;

  try {
    response = await fetch(url.toString());
  } catch {
    throw new Error('Nao foi possivel conectar ao backend MarketPulse.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      typeof body?.error?.message === 'string'
        ? body.error.message
        : `Backend respondeu com erro ${response.status}.`;

    throw new Error(message);
  }

  return (await response.json()) as T;
}
