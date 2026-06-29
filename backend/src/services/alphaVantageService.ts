import {
  loadCandleCache,
  saveCandleCache,
  type CandleCacheData,
} from '../cache/candleCache';
import {
  MarketDataError,
  type MarketCandle,
  type MarketQuote,
  type MarketSearchResult,
  type MarketTimeframe,
} from '../types/marketTypes';

const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';
const USD_MARKET = 'USD';

type CryptoAsset = {
  name: string;
  symbol: string;
};

type AlphaVantageCandleResult = {
  candles: MarketCandle[];
  stale: boolean;
};

type RequiredCandleRange = {
  firstTime: number;
  lastTime: number;
};

type AlphaVantageExchangeRateResponse = AlphaVantageApiEnvelope & {
  'Realtime Currency Exchange Rate'?: {
    '1. From_Currency Code'?: string;
    '2. From_Currency Name'?: string;
    '3. To_Currency Code'?: string;
    '4. To_Currency Name'?: string;
    '5. Exchange Rate'?: string;
    '6. Last Refreshed'?: string;
    '8. Bid Price'?: string;
    '9. Ask Price'?: string;
  };
};

type AlphaVantageDailyResponse = AlphaVantageApiEnvelope & {
  'Time Series (Digital Currency Daily)'?: Record<
    string,
    Record<string, string>
  >;
};

type AlphaVantageApiEnvelope = {
  'Error Message'?: string;
  Information?: string;
  Note?: string;
};

const knownCryptoAssets: CryptoAsset[] = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'DOT', name: 'Polkadot' },
];

const cryptoAliases: Record<string, string> = {
  ada: 'ADA',
  avalanche: 'AVAX',
  'avalanche-2': 'AVAX',
  avax: 'AVAX',
  bitcoin: 'BTC',
  binancecoin: 'BNB',
  bnb: 'BNB',
  btc: 'BTC',
  cardano: 'ADA',
  chainlink: 'LINK',
  doge: 'DOGE',
  dogecoin: 'DOGE',
  dot: 'DOT',
  eth: 'ETH',
  ethereum: 'ETH',
  link: 'LINK',
  polkadot: 'DOT',
  ripple: 'XRP',
  sol: 'SOL',
  solana: 'SOL',
  xrp: 'XRP',
};

export function searchAlphaVantageCrypto(query: string): MarketSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return knownCryptoAssets
    .filter((asset) =>
      [asset.symbol, asset.name].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      )
    )
    .map(toSearchResult);
}

export async function getAlphaVantageQuote(
  symbol: string
): Promise<MarketQuote> {
  const asset = resolveAlphaVantageAsset(symbol);
  const response = await fetchAlphaVantage<AlphaVantageExchangeRateResponse>({
    from_currency: asset.symbol,
    function: 'CURRENCY_EXCHANGE_RATE',
    to_currency: USD_MARKET,
  });

  assertAlphaVantageSuccess(response);

  const exchangeRate = response['Realtime Currency Exchange Rate'];
  const price = toFiniteNumber(exchangeRate?.['5. Exchange Rate']);

  if (price === null) {
    throw new MarketDataError('Cotacao indisponivel na Alpha Vantage.', 502);
  }

  return {
    symbol: asset.symbol,
    name: asset.name,
    type: 'crypto',
    currency: 'USD',
    price,
    updatedAt: parseAlphaVantageDateTime(exchangeRate?.['6. Last Refreshed']),
  };
}

export async function getAlphaVantageCandles(
  symbol: string,
  timeframe: MarketTimeframe
): Promise<AlphaVantageCandleResult> {
  const asset = resolveAlphaVantageAsset(symbol);
  const cacheKey = buildCandleCacheKey(asset.symbol, timeframe);
  const requiredRange = getRequiredRangeForTimeframe(timeframe);
  const cachedData = await loadCandleCache(cacheKey);
  const cachedCandles = cachedData?.candles ?? [];
  const cachedRangeCandles = filterCandlesForRange(cachedCandles, requiredRange);
  const cacheHit =
    cachedRangeCandles.length > 0 &&
    isCacheFresh(cachedData?.updatedAt, timeframe);

  if (cacheHit) {
    logAlphaVantageCandles({
      cacheHit: true,
      fetchedCandlesCount: 0,
      returnedCandlesCount: cachedRangeCandles.length,
      symbol: asset.symbol,
      timeframe,
    });

    return {
      candles: cachedRangeCandles,
      stale: false,
    };
  }

  try {
    const fetchedCandles = await fetchAlphaVantageDailyCandles(asset.symbol);
    const normalizedCandles = dedupeCandlesByTime(fetchedCandles);
    const returnedCandles = filterCandlesForRange(
      normalizedCandles,
      requiredRange
    );

    if (returnedCandles.length === 0) {
      throw new MarketDataError(
        'Alpha Vantage nao retornou historico suficiente para esta cripto.',
        502
      );
    }

    await saveCandleCache(
      cacheKey,
      createCandleCacheData(asset.symbol, timeframe, normalizedCandles)
    );

    logAlphaVantageCandles({
      cacheHit: false,
      fetchedCandlesCount: normalizedCandles.length,
      returnedCandlesCount: returnedCandles.length,
      symbol: asset.symbol,
      timeframe,
    });

    return {
      candles: returnedCandles,
      stale: false,
    };
  } catch (error) {
    if (cachedRangeCandles.length > 0) {
      logAlphaVantageCandles({
        cacheHit: false,
        fetchedCandlesCount: 0,
        returnedCandlesCount: cachedRangeCandles.length,
        stale: true,
        symbol: asset.symbol,
        timeframe,
      });

      return {
        candles: cachedRangeCandles,
        stale: true,
      };
    }

    throw error;
  }
}

export function resolveAlphaVantageAsset(symbol: string): CryptoAsset {
  const rawSymbol = symbol.trim().replace(/^crypto:/i, '');
  const normalizedSymbol = rawSymbol.toLowerCase();
  const compactSymbol = normalizedSymbol.replace(/[^a-z0-9]/g, '');
  const resolvedSymbol =
    cryptoAliases[normalizedSymbol] ?? cryptoAliases[compactSymbol];

  if (resolvedSymbol) {
    return getKnownAsset(resolvedSymbol);
  }

  const embeddedSymbol = isLegacyPairSymbol(compactSymbol)
    ? Object.entries(cryptoAliases).find(([alias]) =>
        compactSymbol.includes(alias)
      )?.[1]
    : undefined;

  if (embeddedSymbol) {
    return getKnownAsset(embeddedSymbol);
  }

  if (!compactSymbol) {
    throw new MarketDataError('Informe uma criptomoeda valida.', 400);
  }

  return getKnownAsset(compactSymbol.toUpperCase());
}

async function fetchAlphaVantageDailyCandles(
  symbol: string
): Promise<MarketCandle[]> {
  const response = await fetchAlphaVantage<AlphaVantageDailyResponse>({
    function: 'DIGITAL_CURRENCY_DAILY',
    market: USD_MARKET,
    outputsize: 'full',
    symbol,
  });

  assertAlphaVantageSuccess(response);

  const timeSeries = response['Time Series (Digital Currency Daily)'];

  if (!timeSeries) {
    throw new MarketDataError(
      'Historico de cripto indisponivel na Alpha Vantage.',
      502
    );
  }

  return Object.entries(timeSeries)
    .map(([date, values]) => parseDailyCandle(date, values))
    .filter((candle): candle is MarketCandle => candle !== null)
    .sort((left, right) => left.time - right.time);
}

async function fetchAlphaVantage<T>(
  params: Record<string, string>
): Promise<T> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    throw new MarketDataError('ALPHA_VANTAGE_API_KEY nao configurada.', 500);
  }

  const url = new URL(ALPHA_VANTAGE_BASE_URL);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set('apikey', apiKey);

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new MarketDataError('Nao foi possivel conectar a Alpha Vantage.');
  }

  if (!response.ok) {
    throw new MarketDataError(
      `Alpha Vantage respondeu com erro ${response.status}.`,
      response.status
    );
  }

  return (await response.json()) as T;
}

function parseDailyCandle(
  date: string,
  values: Record<string, string>
): MarketCandle | null {
  const time = Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / 1000);
  const open = getAlphaNumber(values, ['1. open', '1a. open']);
  const high = getAlphaNumber(values, ['2. high', '2a. high']);
  const low = getAlphaNumber(values, ['3. low', '3a. low']);
  const close = getAlphaNumber(values, ['4. close', '4a. close']);
  const volume = getAlphaNumber(values, ['5. volume']);

  if (
    !Number.isFinite(time) ||
    open === null ||
    high === null ||
    low === null ||
    close === null
  ) {
    return null;
  }

  return {
    time,
    open,
    high,
    low,
    close,
    volume: volume ?? undefined,
  };
}

function getAlphaNumber(
  values: Record<string, string>,
  fieldPrefixes: string[]
) {
  for (const [key, value] of Object.entries(values)) {
    if (fieldPrefixes.some((prefix) => key.startsWith(prefix))) {
      return toFiniteNumber(value);
    }
  }

  return null;
}

function assertAlphaVantageSuccess(response: AlphaVantageApiEnvelope) {
  if (response['Error Message']) {
    throw new MarketDataError(response['Error Message'], 502);
  }

  if (response.Note || response.Information) {
    throw new MarketDataError(
      response.Note ?? response.Information ?? 'Alpha Vantage limitou a chamada.',
      429
    );
  }
}

function getRequiredRangeForTimeframe(
  timeframe: MarketTimeframe
): RequiredCandleRange {
  const day = 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const firstTime = getDailyBucketTime(now - getRangeDays(timeframe) * day);
  const lastTime = getDailyBucketTime(now);

  return {
    firstTime,
    lastTime,
  };
}

function filterCandlesForRange(
  candles: MarketCandle[],
  requiredRange: RequiredCandleRange
) {
  return dedupeCandlesByTime(candles).filter(
    (candle) =>
      candle.time >= requiredRange.firstTime &&
      candle.time <= requiredRange.lastTime
  );
}

function dedupeCandlesByTime(candles: MarketCandle[]) {
  const candlesByTime = new Map<number, MarketCandle>();

  for (const candle of candles) {
    if (isValidCandle(candle)) {
      candlesByTime.set(candle.time, { ...candle });
    }
  }

  return Array.from(candlesByTime.values()).sort(
    (left, right) => left.time - right.time
  );
}

function createCandleCacheData(
  symbol: string,
  timeframe: MarketTimeframe,
  candles: MarketCandle[]
): CandleCacheData {
  const normalizedCandles = dedupeCandlesByTime(candles);

  return {
    provider: 'alphavantage',
    type: 'crypto',
    symbol,
    timeframe,
    candles: normalizedCandles,
    firstTime: normalizedCandles[0]?.time ?? 0,
    lastTime: normalizedCandles[normalizedCandles.length - 1]?.time ?? 0,
    updatedAt: Math.floor(Date.now() / 1000),
  };
}

function buildCandleCacheKey(symbol: string, timeframe: MarketTimeframe) {
  return [
    'provider',
    'alphavantage',
    'type',
    'crypto',
    'symbol',
    symbol.trim().toUpperCase(),
    'timeframe',
    timeframe,
  ].join(':');
}

function getRangeDays(timeframe: MarketTimeframe) {
  const rangesByTimeframe: Record<MarketTimeframe, number> = {
    '1D': 1,
    '7D': 7,
    '1W': 7,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '2Y': 730,
    MAX: 3650,
  };

  return rangesByTimeframe[timeframe];
}

function getCandlesCacheTtlMs(timeframe: MarketTimeframe) {
  if (timeframe === '1D' || timeframe === '7D' || timeframe === '1W') {
    return 5 * 60 * 1000;
  }

  return 6 * 60 * 60 * 1000;
}

function isCacheFresh(updatedAt: number | undefined, timeframe: MarketTimeframe) {
  if (!updatedAt) {
    return false;
  }

  return Date.now() - updatedAt * 1000 < getCandlesCacheTtlMs(timeframe);
}

function getDailyBucketTime(timestampSeconds: number) {
  const date = new Date(timestampSeconds * 1000);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

function parseAlphaVantageDateTime(value: string | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  const parsedTime = new Date(`${value.replace(' ', 'T')}Z`).getTime();
  return Number.isFinite(parsedTime)
    ? new Date(parsedTime).toISOString()
    : new Date().toISOString();
}

function isLegacyPairSymbol(symbol: string) {
  return /(usd|usdt|brl|eur)$/.test(symbol);
}

function getKnownAsset(symbol: string): CryptoAsset {
  const upperSymbol = symbol.toUpperCase();
  const knownAsset = knownCryptoAssets.find(
    (asset) => asset.symbol === upperSymbol
  );

  return knownAsset ?? { symbol: upperSymbol, name: upperSymbol };
}

function toSearchResult(asset: CryptoAsset): MarketSearchResult {
  return {
    symbol: asset.symbol,
    displaySymbol: asset.symbol,
    name: asset.name,
    type: 'crypto',
    currency: 'USD',
    exchange: 'Alpha Vantage',
  };
}

function logAlphaVantageCandles(params: {
  cacheHit: boolean;
  fetchedCandlesCount: number;
  returnedCandlesCount: number;
  stale?: boolean;
  symbol: string;
  timeframe: MarketTimeframe;
}) {
  console.log(
    [
      '[market-data]',
      'provider=alphavantage',
      'type=crypto',
      `symbol=${params.symbol}`,
      `timeframe=${params.timeframe}`,
      `cacheHit=${params.cacheHit}`,
      `fetchedCandlesCount=${params.fetchedCandlesCount}`,
      `returnedCandlesCount=${params.returnedCandlesCount}`,
      `stale=${params.stale === true}`,
    ].join(' ')
  );
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
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseFloat(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}
