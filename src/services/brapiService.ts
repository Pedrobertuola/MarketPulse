import type { BrazilianStockSearchResult, Candle, PriceQuote } from '../types';

const BRAPI_BASE_URL = 'https://brapi.dev/api';
const DEFAULT_INTERVAL = '1d';
const KNOWN_BRAZILIAN_STOCKS: BrazilianStockSearchResult[] = [
  { ticker: 'PETR4', name: 'Petrobras PN', type: 'stock' },
  { ticker: 'VALE3', name: 'Vale ON', type: 'stock' },
  { ticker: 'ITUB4', name: 'Itau Unibanco PN', type: 'stock' },
  { ticker: 'BBAS3', name: 'Banco do Brasil ON', type: 'stock' },
];

type BrazilianStockHistoryRange =
  | '1d'
  | '5d'
  | '1mo'
  | '3mo'
  | '6mo'
  | '1y'
  | '2y'
  | '5y'
  | '10y'
  | 'ytd'
  | 'max';

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
  historicalDataPrice?: Array<{
    date: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    adjustedClose?: number;
  }>;
};

type BrapiQuoteResponse = {
  results?: BrapiQuote[];
};

class BrapiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'BrapiError';
  }
}

const brapiToken =
  typeof process !== 'undefined' ? process.env.BRAPI_TOKEN : undefined;

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function getBrapiHeaders(): HeadersInit | undefined {
  if (!brapiToken) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${brapiToken}`,
  };
}

async function fetchBrapi<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const url = new URL(`${BRAPI_BASE_URL}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      headers: getBrapiHeaders(),
    });
  } catch {
    throw new BrapiError('Nao foi possivel conectar a brapi.dev.');
  }

  if (!response.ok) {
    throw new BrapiError(`brapi.dev respondeu com erro ${response.status}.`, response.status);
  }

  return (await response.json()) as T;
}

function mapQuote(quote: BrapiQuote): PriceQuote {
  if (typeof quote.regularMarketPrice !== 'number') {
    throw new BrapiError('Cotacao nao encontrada para o ticker informado.');
  }

  return {
    price: quote.regularMarketPrice,
    change: quote.regularMarketChange ?? 0,
    changePercent: quote.regularMarketChangePercent ?? 0,
    currency: quote.currency === 'USD' ? 'USD' : 'BRL',
    updatedAt: quote.regularMarketTime ?? new Date().toISOString(),
    volume: quote.regularMarketVolume,
    dayHigh: quote.regularMarketDayHigh,
    dayLow: quote.regularMarketDayLow,
    dividendYield: quote.dividendsYield ?? quote.trailingAnnualDividendYield,
    financialVolume:
      typeof quote.regularMarketVolume === 'number'
        ? quote.regularMarketVolume * quote.regularMarketPrice
        : undefined,
  };
}

async function getBrazilianStock(ticker: string, range?: BrazilianStockHistoryRange) {
  const normalizedTicker = normalizeTicker(ticker);

  if (!normalizedTicker) {
    throw new BrapiError('Informe um ticker valido.');
  }

  const response = await fetchBrapi<BrapiQuoteResponse>(
    `/quote/${normalizedTicker}`,
    range
      ? {
          range,
          interval: DEFAULT_INTERVAL,
        }
      : undefined
  );

  const stock = response.results?.[0];

  if (!stock) {
    throw new BrapiError('Ticker nao encontrado na brapi.dev.');
  }

  return stock;
}

export async function searchBrazilianStock(
  query: string
): Promise<BrazilianStockSearchResult[]> {
  const normalizedQuery = normalizeTicker(query);

  if (!normalizedQuery) {
    return [];
  }

  const localMatches = KNOWN_BRAZILIAN_STOCKS.filter((stock) =>
    stock.ticker.includes(normalizedQuery)
  );

  if (localMatches.length > 0 && normalizedQuery.length < 5) {
    return localMatches;
  }

  const stock = await getBrazilianStock(normalizedQuery);

  return [
    {
      ticker: stock.symbol ?? normalizedQuery,
      name: stock.longName ?? stock.shortName ?? normalizedQuery,
      imageUrl: stock.logourl,
      type: 'stock',
    },
  ];
}

export async function getBrazilianStockQuote(ticker: string): Promise<PriceQuote> {
  const stock = await getBrazilianStock(ticker);
  return mapQuote(stock);
}

export async function getBrazilianStockHistory(
  ticker: string,
  range: BrazilianStockHistoryRange
): Promise<Candle[]> {
  const stock = await getBrazilianStock(ticker, range);

  return (stock.historicalDataPrice ?? []).map((item) => ({
    timestamp: new Date(item.date * 1000).toISOString(),
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    volume: item.volume,
  }));
}
