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

const COINBASE_BASE_URL = 'https://api.exchange.coinbase.com';
const USD_PRODUCT_SUFFIX = 'USD';
const maxCandlesPerRequest = 300;

type CryptoAsset = {
  name: string;
  productId: string;
  symbol: string;
};

type CoinbaseCandleResult = {
  candles: MarketCandle[];
  stale: boolean;
};

type CoinbaseTickerResponse = {
  ask?: string;
  bid?: string;
  price?: string;
  time?: string;
  volume?: string;
};

type CoinbaseCandle = [
  time: number,
  low: number,
  high: number,
  open: number,
  close: number,
  volume: number,
];

type RequiredCandleRange = {
  from: number;
  to: number;
  firstTime: number;
  lastTime: number;
  granularity: number;
};

type MissingCandleRange = {
  from: number;
  to: number;
};

const knownCryptoAssets: CryptoAsset[] = [
  { symbol: 'BTC', productId: 'BTC-USD', name: 'Bitcoin' },
  { symbol: 'ETH', productId: 'ETH-USD', name: 'Ethereum' },
  { symbol: 'SOL', productId: 'SOL-USD', name: 'Solana' },
  { symbol: 'XRP', productId: 'XRP-USD', name: 'XRP' },
  { symbol: 'ADA', productId: 'ADA-USD', name: 'Cardano' },
  { symbol: 'DOGE', productId: 'DOGE-USD', name: 'Dogecoin' },
  { symbol: 'AVAX', productId: 'AVAX-USD', name: 'Avalanche' },
  { symbol: 'LINK', productId: 'LINK-USD', name: 'Chainlink' },
  { symbol: 'DOT', productId: 'DOT-USD', name: 'Polkadot' },
];

const cryptoAliases: Record<string, string> = {
  ada: 'ADA',
  avalanche: 'AVAX',
  'avalanche-2': 'AVAX',
  avax: 'AVAX',
  bitcoin: 'BTC',
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

export function searchCoinbaseCrypto(query: string): MarketSearchResult[] {
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

export async function getCoinbaseQuote(symbol: string): Promise<MarketQuote> {
  const asset = resolveCoinbaseAsset(symbol);
  const ticker = await fetchCoinbase<CoinbaseTickerResponse>(
    `/products/${asset.productId}/ticker`
  );
  const price = toFiniteNumber(ticker.price);

  if (price === null) {
    throw new MarketDataError('Cotacao indisponivel na Coinbase.', 502);
  }

  return {
    symbol: asset.symbol,
    name: asset.name,
    type: 'crypto',
    currency: 'USD',
    price,
    updatedAt: parseCoinbaseDateTime(ticker.time),
    volume: toFiniteNumber(ticker.volume) ?? undefined,
  };
}

export async function getCoinbaseCandles(
  symbol: string,
  timeframe: MarketTimeframe
): Promise<CoinbaseCandleResult> {
  const asset = resolveCoinbaseAsset(symbol);
  const cacheKey = buildCandleCacheKey(asset.symbol, timeframe);
  const requiredRange = getRequiredRangeForTimeframe(timeframe);
  const cachedData = await loadCandleCache(cacheKey);
  const cachedCandles = cachedData?.candles ?? [];
  const missingRanges = getMissingRanges(requiredRange, cachedCandles);
  const cachedRangeCandles = filterCandlesForRange(
    cachedCandles,
    requiredRange
  );
  const cacheHit =
    cachedRangeCandles.length > 0 &&
    missingRanges.length === 0 &&
    isCacheFresh(cachedData?.updatedAt, timeframe);

  if (cacheHit) {
    logCoinbaseCandles({
      cacheHit: true,
      fetchedCandlesCount: 0,
      missingRanges,
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
    const fetchedCandles: MarketCandle[] = [];

    for (const missingRange of missingRanges) {
      fetchedCandles.push(
        ...(await fetchCoinbaseCandlesRange(
          asset.productId,
          missingRange.from,
          missingRange.to,
          requiredRange.granularity
        ))
      );
    }

    const mergedCandles = dedupeCandlesByTime([
      ...cachedCandles,
      ...fetchedCandles,
    ]);
    const returnedCandles = filterCandlesForRange(mergedCandles, requiredRange);

    if (returnedCandles.length === 0) {
      throw new MarketDataError(
        'Coinbase nao retornou candles suficientes para esta cripto.',
        502
      );
    }

    await saveCandleCache(
      cacheKey,
      createCandleCacheData(asset.symbol, timeframe, mergedCandles)
    );

    logCoinbaseCandles({
      cacheHit: false,
      fetchedCandlesCount: fetchedCandles.length,
      missingRanges,
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
      logCoinbaseCandles({
        cacheHit: false,
        fetchedCandlesCount: 0,
        missingRanges,
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

export function resolveCoinbaseAsset(symbol: string): CryptoAsset {
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

async function fetchCoinbaseCandlesRange(
  productId: string,
  from: number,
  to: number,
  granularity: number
): Promise<MarketCandle[]> {
  const candles: MarketCandle[] = [];
  const maxChunkSeconds = granularity * (maxCandlesPerRequest - 1);
  let chunkFrom = from;

  while (chunkFrom < to) {
    const chunkTo = Math.min(chunkFrom + maxChunkSeconds, to);
    const response = await fetchCoinbase<CoinbaseCandle[]>(
      `/products/${productId}/candles`,
      {
        end: new Date(chunkTo * 1000).toISOString(),
        granularity: String(granularity),
        start: new Date(chunkFrom * 1000).toISOString(),
      }
    );

    candles.push(...response.map(parseCoinbaseCandle).filter(isMarketCandle));
    chunkFrom = chunkTo + granularity;
  }

  return dedupeCandlesByTime(candles);
}

async function fetchCoinbase<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${COINBASE_BASE_URL}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new MarketDataError('Nao foi possivel conectar a Coinbase.');
  }

  if (!response.ok) {
    throw new MarketDataError(
      `Coinbase respondeu com erro ${response.status}.`,
      response.status
    );
  }

  return (await response.json()) as T;
}

function getMissingRanges(
  requiredRange: RequiredCandleRange,
  cachedCandles: MarketCandle[]
): MissingCandleRange[] {
  const normalizedCandles = filterCandlesForRange(cachedCandles, requiredRange);

  if (normalizedCandles.length === 0) {
    return [
      {
        from: requiredRange.from,
        to: requiredRange.to,
      },
    ];
  }

  const ranges: MissingCandleRange[] = [];
  const firstCachedTime = normalizedCandles[0].time;
  const lastCachedTime = normalizedCandles[normalizedCandles.length - 1].time;

  if (firstCachedTime > requiredRange.firstTime) {
    ranges.push({
      from: requiredRange.from,
      to: firstCachedTime - requiredRange.granularity,
    });
  }

  if (lastCachedTime < requiredRange.lastTime) {
    ranges.push({
      from: lastCachedTime + requiredRange.granularity,
      to: requiredRange.to,
    });
  }

  return ranges.filter((range) => range.to >= range.from);
}

function getRequiredRangeForTimeframe(
  timeframe: MarketTimeframe
): RequiredCandleRange {
  const now = Math.floor(Date.now() / 1000);
  const granularity = getCoinbaseGranularity(timeframe);
  const rangeSeconds = getRangeSeconds(timeframe);
  const firstTime = getBucketTime(now - rangeSeconds, granularity);
  const lastTime = getBucketTime(now, granularity);

  return {
    from: firstTime,
    to: now,
    firstTime,
    lastTime,
    granularity,
  };
}

function parseCoinbaseCandle(candle: CoinbaseCandle): MarketCandle {
  const [time, low, high, open, close, volume] = candle;

  return {
    time,
    open,
    high,
    low,
    close,
    volume,
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
    if (isMarketCandle(candle)) {
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
    provider: 'coinbase',
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
    'coinbase',
    'type',
    'crypto',
    'symbol',
    symbol.trim().toUpperCase(),
    'timeframe',
    timeframe,
  ].join(':');
}

function getCoinbaseGranularity(timeframe: MarketTimeframe) {
  const hour = 60 * 60;
  const day = 24 * hour;

  const granularitiesByTimeframe: Record<MarketTimeframe, number> = {
    '1D': hour,
    '7D': 6 * hour,
    '1W': 6 * hour,
    '1M': day,
    '3M': day,
    '6M': day,
    '1Y': day,
    '2Y': day,
    MAX: day,
  };

  return granularitiesByTimeframe[timeframe];
}

function getRangeSeconds(timeframe: MarketTimeframe) {
  const day = 24 * 60 * 60;

  const rangesByTimeframe: Record<MarketTimeframe, number> = {
    '1D': day,
    '7D': 7 * day,
    '1W': 7 * day,
    '1M': 30 * day,
    '3M': 90 * day,
    '6M': 180 * day,
    '1Y': 365 * day,
    '2Y': 730 * day,
    MAX: 3650 * day,
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

function getBucketTime(timestampSeconds: number, granularity: number) {
  return Math.floor(timestampSeconds / granularity) * granularity;
}

function parseCoinbaseDateTime(value: string | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  const parsedTime = new Date(value).getTime();
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

  return (
    knownAsset ?? {
      symbol: upperSymbol,
      productId: `${upperSymbol}-${USD_PRODUCT_SUFFIX}`,
      name: upperSymbol,
    }
  );
}

function toSearchResult(asset: CryptoAsset): MarketSearchResult {
  return {
    symbol: asset.symbol,
    displaySymbol: asset.symbol,
    name: asset.name,
    type: 'crypto',
    currency: 'USD',
    exchange: 'Coinbase',
  };
}

function logCoinbaseCandles(params: {
  cacheHit: boolean;
  fetchedCandlesCount: number;
  missingRanges: MissingCandleRange[];
  returnedCandlesCount: number;
  stale?: boolean;
  symbol: string;
  timeframe: MarketTimeframe;
}) {
  console.log(
    [
      '[market-data]',
      'provider=coinbase',
      'type=crypto',
      `symbol=${params.symbol}`,
      `timeframe=${params.timeframe}`,
      `cacheHit=${params.cacheHit}`,
      `missingRanges=${JSON.stringify(params.missingRanges)}`,
      `fetchedCandlesCount=${params.fetchedCandlesCount}`,
      `returnedCandlesCount=${params.returnedCandlesCount}`,
      `stale=${params.stale === true}`,
    ].join(' ')
  );
}

function isMarketCandle(candle: MarketCandle) {
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
