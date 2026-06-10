import type { Candle, ChartPoint, CryptoSearchResult, PriceQuote } from '../types';

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const DEFAULT_VS_CURRENCY = 'brl';

type MarketChartDays = 1 | 7 | 14 | 30 | 90 | 180 | 365 | 'max';

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

function mapQuote(price: number, changePercent: number, lastUpdatedAt?: number): PriceQuote {
  const normalizedChangePercent = Number.isFinite(changePercent) ? changePercent : 0;
  const previousPriceFactor = 1 + normalizedChangePercent / 100;
  const previousPrice =
    previousPriceFactor !== 0 ? price / previousPriceFactor : price;
  const change = Number.isFinite(previousPrice) ? price - previousPrice : 0;

  return {
    price,
    change,
    changePercent: normalizedChangePercent,
    currency: 'BRL',
    updatedAt: lastUpdatedAt
      ? new Date(lastUpdatedAt * 1000).toISOString()
      : new Date().toISOString(),
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
    include_last_updated_at: true,
    precision: 'full',
  });

  const cryptoData = response[id];

  if (!cryptoData || typeof cryptoData.brl !== 'number') {
    throw new CoinGeckoError('Cotacao nao encontrada para a criptomoeda.');
  }

  return mapQuote(
    cryptoData.brl,
    cryptoData.brl_24h_change ?? 0,
    cryptoData.last_updated_at
  );
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
