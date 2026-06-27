import {
  MarketDataError,
  type MarketCandle,
  type MarketQuote,
  type MarketSearchResult,
  type MarketTimeframe,
} from '../types/marketTypes';
import {
  normalizeBrapiCandles,
  normalizeBrapiQuote,
  normalizeBrapiSearchResult,
} from '../utils/normalizeMarketData';

const BRAPI_BASE_URL = 'https://brapi.dev/api';
const DEFAULT_INTERVAL = '1d';

type BrapiQuote = {
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
  historicalDataPrice?: Array<{
    date: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>;
};

type BrapiQuoteResponse = {
  results?: BrapiQuote[];
};

const knownBrazilianAssets: MarketSearchResult[] = [
  {
    symbol: 'PETR4',
    displaySymbol: 'PETR4',
    name: 'Petrobras PN',
    type: 'brazilian_stock',
    currency: 'BRL',
    exchange: 'B3',
  },
  {
    symbol: 'VALE3',
    displaySymbol: 'VALE3',
    name: 'Vale ON',
    type: 'brazilian_stock',
    currency: 'BRL',
    exchange: 'B3',
  },
  {
    symbol: 'ITUB4',
    displaySymbol: 'ITUB4',
    name: 'Itau Unibanco PN',
    type: 'brazilian_stock',
    currency: 'BRL',
    exchange: 'B3',
  },
  {
    symbol: 'BBAS3',
    displaySymbol: 'BBAS3',
    name: 'Banco do Brasil ON',
    type: 'brazilian_stock',
    currency: 'BRL',
    exchange: 'B3',
  },
];

export async function searchBrazilianAssets(
  query: string
): Promise<MarketSearchResult[]> {
  const normalizedQuery = normalizeTicker(query);

  if (!normalizedQuery) {
    return [];
  }

  const localMatches = knownBrazilianAssets.filter((asset) =>
    asset.symbol.includes(normalizedQuery)
  );

  if (localMatches.length > 0 && normalizedQuery.length < 5) {
    return localMatches;
  }

  const quote = await getBrapiAsset(normalizedQuery);
  return [normalizeBrapiSearchResult(quote, normalizedQuery)];
}

export async function getBrapiQuote(symbol: string): Promise<MarketQuote> {
  const ticker = normalizeTicker(symbol);
  const quote = await getBrapiAsset(ticker);
  return normalizeBrapiQuote(quote, ticker);
}

export async function getBrapiCandles(
  symbol: string,
  timeframe: MarketTimeframe
): Promise<MarketCandle[]> {
  const ticker = normalizeTicker(symbol);
  const quote = await getBrapiAsset(ticker, getBrapiRange(timeframe));
  return normalizeBrapiCandles(quote.historicalDataPrice);
}

async function getBrapiAsset(symbol: string, range?: string) {
  if (!symbol) {
    throw new MarketDataError('Informe um ticker valido.', 400);
  }

  const response = await fetchBrapi<BrapiQuoteResponse>(
    `/quote/${symbol}`,
    range
      ? {
          interval: DEFAULT_INTERVAL,
          range,
        }
      : undefined
  );

  const quote = response.results?.[0];

  if (!quote) {
    throw new MarketDataError('Ticker nao encontrado na brapi.dev.', 404);
  }

  return quote;
}

async function fetchBrapi<T>(
  path: string,
  params?: Record<string, string | number>
): Promise<T> {
  const url = new URL(`${BRAPI_BASE_URL}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: HeadersInit = {};

  if (process.env.BRAPI_TOKEN) {
    headers.Authorization = `Bearer ${process.env.BRAPI_TOKEN}`;
  }

  let response: Response;

  try {
    response = await fetch(url, {
      headers,
    });
  } catch {
    throw new MarketDataError('Nao foi possivel conectar a brapi.dev.');
  }

  if (!response.ok) {
    throw new MarketDataError(
      `brapi.dev respondeu com erro ${response.status}.`,
      response.status
    );
  }

  return (await response.json()) as T;
}

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function getBrapiRange(timeframe: MarketTimeframe) {
  const ranges: Record<MarketTimeframe, string> = {
    '1D': '2y',
    '7D': '1mo',
    '1W': '5y',
    '1M': '1mo',
    '3M': '3mo',
    '6M': '6mo',
    '1Y': '1y',
    '2Y': '2y',
    MAX: 'max',
  };

  return ranges[timeframe];
}
