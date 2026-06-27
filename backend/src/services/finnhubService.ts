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

const cryptoAssets: MarketSearchResult[] = [
  {
    symbol: 'BINANCE:BTCUSDT',
    displaySymbol: 'BTC',
    name: 'Bitcoin',
    type: 'crypto',
    currency: 'USD',
    exchange: 'Finnhub',
  },
  {
    symbol: 'BINANCE:ETHUSDT',
    displaySymbol: 'ETH',
    name: 'Ethereum',
    type: 'crypto',
    currency: 'USD',
    exchange: 'Finnhub',
  },
  {
    symbol: 'BINANCE:SOLUSDT',
    displaySymbol: 'SOL',
    name: 'Solana',
    type: 'crypto',
    currency: 'USD',
    exchange: 'Finnhub',
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

  const response = await fetchFinnhub<FinnhubCandleResponse>(
    type === 'crypto' ? '/crypto/candle' : '/stock/candle',
    {
      symbol: resolvedAsset.symbol,
      resolution: range.resolution,
      from: range.from,
      to: range.to,
    }
  );
  const candles = normalizeFinnhubCandles(response);

  if (type === 'crypto' && candles.length === 0) {
    throw new MarketDataError(
      'Finnhub nao retornou candles suficientes para esta cripto no plano atual.',
      422
    );
  }

  return candles;
}

export function resolveFinnhubAsset(symbol: string, type: MarketAssetType) {
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
    if (path === '/crypto/candle' && response.status === 403) {
      throw new MarketDataError(
        'Finnhub nao liberou candles de cripto para esta chave/plano. Configure um plano com acesso a crypto candles ou desative o grafico historico de cripto.',
        403
      );
    }

    throw new MarketDataError(
      `Finnhub respondeu com erro ${response.status}.`,
      response.status
    );
  }

  return (await response.json()) as T;
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
