import type { Candle, ChartPoint, CryptoSearchResult, PriceQuote } from '../types';
import { normalizePriceCandles } from '../utils/normalizeCandles';

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const DEFAULT_VS_CURRENCY = 'usd';

type MarketChartDays = 1 | 7 | 14 | 30 | 90 | 180 | 365 | 'max';
type CryptoDailyCandleDays = 90 | 365;

type SearchResponse = {
  coins?: Array<{
    id: string;
    name: string;
    symbol: string;
    thumb?: string;
    large?: string;
    market_cap_rank?: number;
  }>;
};

type SimplePriceResponse = Record<
  string,
  {
    brl?: number;
    brl_24h_change?: number;
    brl_24h_vol?: number;
    brl_market_cap?: number;
    usd?: number;
    usd_24h_change?: number;
    usd_24h_vol?: number;
    usd_market_cap?: number;
    last_updated_at?: number;
  }
>;

type MarketChartResponse = {
  prices?: Array<[number, number]>;
  market_caps?: Array<[number, number]>;
  total_volumes?: Array<[number, number]>;
};

type OhlcResponse = Array<[number, number, number, number, number]>;

class CoinGeckoError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'CoinGeckoError';
  }
}

async function fetchCoinGecko<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const url = new URL(`${COINGECKO_BASE_URL}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  let response: Response;

  try {
    response = await fetch(url.toString());
  } catch {
    throw new CoinGeckoError('Nao foi possivel conectar ao CoinGecko.');
  }

  if (!response.ok) {
    throw new CoinGeckoError(
      `CoinGecko respondeu com erro ${response.status}.`,
      response.status
    );
  }

  return (await response.json()) as T;
}

function mapQuote(
  price: number,
  changePercent: number,
  lastUpdatedAt?: number,
  volume?: number
): PriceQuote {
  const normalizedChangePercent = Number.isFinite(changePercent) ? changePercent : 0;
  const previousPriceFactor = 1 + normalizedChangePercent / 100;
  const previousPrice =
    previousPriceFactor !== 0 ? price / previousPriceFactor : price;
  const change = Number.isFinite(previousPrice) ? price - previousPrice : 0;

  return {
    price,
    change,
    changePercent: normalizedChangePercent,
    currency: 'USD',
    updatedAt: lastUpdatedAt
      ? new Date(lastUpdatedAt * 1000).toISOString()
      : new Date().toISOString(),
    volume,
  };
}

export async function searchCrypto(query: string): Promise<CryptoSearchResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const response = await fetchCoinGecko<SearchResponse>('/search', {
    query: normalizedQuery,
  });

  return (response.coins ?? []).slice(0, 12).map((coin) => ({
    id: coin.id,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    imageUrl: coin.large ?? coin.thumb,
    marketCapRank: coin.market_cap_rank,
    type: 'crypto',
  }));
}

export async function getCryptoQuote(id: string): Promise<PriceQuote> {
  const response = await fetchCoinGecko<SimplePriceResponse>('/simple/price', {
    ids: id,
    vs_currencies: DEFAULT_VS_CURRENCY,
    include_24hr_change: true,
    include_24hr_vol: true,
    include_market_cap: true,
    include_last_updated_at: true,
    precision: 'full',
  });

  const cryptoData = response[id];

  if (!cryptoData || typeof cryptoData.usd !== 'number') {
    throw new CoinGeckoError('Cotacao nao encontrada para a criptomoeda.');
  }

  return {
    ...mapQuote(
      cryptoData.usd,
      cryptoData.usd_24h_change ?? 0,
      cryptoData.last_updated_at,
      cryptoData.usd_24h_vol
    ),
    marketCap: cryptoData.usd_market_cap,
  };
}

export async function getCryptoMarketChart(
  id: string,
  days: MarketChartDays
): Promise<ChartPoint[]> {
  const response = await fetchCoinGecko<MarketChartResponse>(
    `/coins/${id}/market_chart`,
    {
      vs_currency: DEFAULT_VS_CURRENCY,
      days,
    }
  );

  return (response.prices ?? []).map(([timestamp, price], index) => ({
    timestamp: new Date(timestamp).toISOString(),
    price,
    marketCap: response.market_caps?.[index]?.[1],
    volume: response.total_volumes?.[index]?.[1],
  }));
}

export async function getCryptoOHLC(
  id: string,
  days: MarketChartDays
): Promise<Candle[]> {
  const response = await fetchCoinGecko<OhlcResponse>(`/coins/${id}/ohlc`, {
    vs_currency: DEFAULT_VS_CURRENCY,
    days,
    precision: 'full',
  });

  return response.map(([timestamp, open, high, low, close]) => ({
    timestamp: new Date(timestamp).toISOString(),
    open,
    high,
    low,
    close,
  }));
}

export async function getCryptoDailyCandles(
  id: string,
  days: CryptoDailyCandleDays
): Promise<Candle[]> {
  try {
    const ohlcCandles = await getCryptoOHLC(id, days);

    if (ohlcCandles.length > 0) {
      return ohlcCandles;
    }
  } catch {
    // If OHLC is unavailable, fall back to price buckets below. CoinGecko's
    // OHLC endpoint is preferred because it gives real open/high/low/close.
  }

  const points = await getCryptoMarketChart(id, days);
  const sortedPoints = [...points].sort(
    (left, right) =>
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  );
  const volumeByBucket = new Map<string, number>();

  sortedPoints.forEach((point) => {
    if (typeof point.volume === 'number') {
      volumeByBucket.set(getDailyBucketKey(point.timestamp), point.volume);
    }
  });

  return normalizePriceCandles(sortedPoints, (point) =>
    getDailyBucketKey(point.timestamp)
  ).map((candle) => {
    const timestamp = new Date(candle.time * 1000).toISOString();

    return {
      timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: volumeByBucket.get(getDailyBucketKey(timestamp)),
    };
  });
}

function getDailyBucketKey(timestamp: string) {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}
