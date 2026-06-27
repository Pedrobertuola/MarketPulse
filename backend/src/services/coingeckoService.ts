import {
  MarketDataError,
  type MarketCandle,
  type MarketQuote,
  type MarketSearchResult,
  type MarketTimeframe,
} from '../types/marketTypes';
import {
  loadCandleCache,
  saveCandleCache,
  type CandleCacheData,
} from '../cache/candleCache';

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const USD_CURRENCY = 'usd';

type CryptoAsset = {
  id: string;
  symbol: string;
  name: string;
};

type CoinGeckoSimplePriceResponse = Record<
  string,
  {
    usd?: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
    usd_24h_change?: number;
    last_updated_at?: number;
  }
>;

type CoinGeckoMarketChartResponse = {
  prices?: CoinGeckoPoint[];
  total_volumes?: CoinGeckoPoint[];
};

type CoinGeckoSearchResponse = {
  coins?: Array<{
    id?: string;
    name?: string;
    symbol?: string;
    market_cap_rank?: number;
  }>;
};

type CoinGeckoPoint = [number, number];

type CoinGeckoCandleResult = {
  candles: MarketCandle[];
  stale: boolean;
};

type RequiredCandleRange = {
  from: number;
  to: number;
  firstTime: number;
  lastTime: number;
  bucketSizeSeconds: number;
};

type MissingCandleRange = {
  from: number;
  to: number;
};

const knownCryptoAssets: CryptoAsset[] = [
  { symbol: 'BTC', id: 'bitcoin', name: 'Bitcoin' },
  { symbol: 'ETH', id: 'ethereum', name: 'Ethereum' },
  { symbol: 'SOL', id: 'solana', name: 'Solana' },
  { symbol: 'BNB', id: 'binancecoin', name: 'BNB' },
  { symbol: 'XRP', id: 'ripple', name: 'XRP' },
  { symbol: 'ADA', id: 'cardano', name: 'Cardano' },
  { symbol: 'DOGE', id: 'dogecoin', name: 'Dogecoin' },
  { symbol: 'AVAX', id: 'avalanche-2', name: 'Avalanche' },
  { symbol: 'LINK', id: 'chainlink', name: 'Chainlink' },
  { symbol: 'DOT', id: 'polkadot', name: 'Polkadot' },
];

const symbolAliases = new Map<string, CryptoAsset>();

for (const asset of knownCryptoAssets) {
  symbolAliases.set(asset.symbol.toLowerCase(), asset);
  symbolAliases.set(asset.id.toLowerCase(), asset);
  symbolAliases.set(asset.name.toLowerCase(), asset);
}

export async function searchCoinGeckoCrypto(
  query: string
): Promise<MarketSearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const localMatches = knownCryptoAssets
    .filter((asset) =>
      [asset.symbol, asset.id, asset.name].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      )
    )
    .map(toSearchResult);

  try {
    const response = await fetchCoinGecko<CoinGeckoSearchResponse>('/search', {
      query: normalizedQuery,
    });

    const remoteMatches = (response.coins ?? [])
      .filter(
        (coin) =>
          typeof coin.id === 'string' &&
          typeof coin.name === 'string' &&
          typeof coin.symbol === 'string'
      )
      .slice(0, 10)
      .map((coin) =>
        toSearchResult({
          id: coin.id as string,
          name: coin.name as string,
          symbol: (coin.symbol as string).toUpperCase(),
        })
      );

    return mergeSearchResults([...localMatches, ...remoteMatches]).slice(0, 10);
  } catch (error) {
    if (localMatches.length > 0) {
      return localMatches;
    }

    throw error;
  }
}

export async function getCoinGeckoQuote(symbol: string): Promise<MarketQuote> {
  const asset = resolveCoinGeckoAsset(symbol);
  const response = await fetchCoinGecko<CoinGeckoSimplePriceResponse>(
    '/simple/price',
    {
      ids: asset.id,
      vs_currencies: USD_CURRENCY,
      include_market_cap: 'true',
      include_24hr_vol: 'true',
      include_24hr_change: 'true',
      include_last_updated_at: 'true',
    }
  );

  const quote = response[asset.id];
  const price = toFiniteNumber(quote?.usd);

  if (price === null) {
    throw new MarketDataError('Cotacao indisponivel no CoinGecko.', 502);
  }

  const changePercent = toFiniteNumber(quote?.usd_24h_change);

  return {
    symbol: asset.symbol,
    name: asset.name,
    type: 'crypto',
    currency: 'USD',
    price,
    change: getAbsoluteChange(price, changePercent),
    changePercent: changePercent ?? undefined,
    updatedAt:
      typeof quote?.last_updated_at === 'number'
        ? new Date(quote.last_updated_at * 1000).toISOString()
        : new Date().toISOString(),
    volume: toFiniteNumber(quote?.usd_24h_vol) ?? undefined,
    marketCap: toFiniteNumber(quote?.usd_market_cap) ?? undefined,
  };
}

export async function getCoinGeckoCandles(
  symbol: string,
  timeframe: MarketTimeframe
): Promise<CoinGeckoCandleResult> {
  const asset = resolveCoinGeckoAsset(symbol);
  const cacheKey = buildCandleCacheKey(asset.id, timeframe);
  const requiredRange = getRequiredRangeForTimeframe(timeframe);
  const cachedData = await loadMergedCandleCache(asset.id, timeframe, cacheKey);
  const cachedCandles = cachedData?.candles ?? [];
  const missingRanges = getMissingRanges(requiredRange, cachedCandles);
  const cacheHit = cachedCandles.length > 0 && missingRanges.length === 0;

  if (cacheHit) {
    const returnedCandles = filterCandlesForRange(cachedCandles, requiredRange);

    logCoinGeckoCandles({
      cacheHit: true,
      fetchedCandlesCount: 0,
      missingRanges,
      returnedCandlesCount: returnedCandles.length,
      symbol: asset.symbol,
      timeframe,
    });

    return {
      candles: returnedCandles,
      stale: false,
    };
  }

  try {
    const fetchedCandles: MarketCandle[] = [];

    for (const missingRange of missingRanges) {
      fetchedCandles.push(
        ...(await fetchCoinGeckoCandlesRange(
          asset.id,
          missingRange.from,
          missingRange.to,
          timeframe
        ))
      );
    }

    const mergedCandles = mergeCandles(cachedCandles, fetchedCandles);
    const returnedCandles = filterCandlesForRange(mergedCandles, requiredRange);

    if (returnedCandles.length === 0) {
      throw new MarketDataError('CoinGecko nao retornou historico suficiente.', 502);
    }

    await saveCandleCache(
      cacheKey,
      createCandleCacheData(asset.id, timeframe, mergedCandles)
    );

    logCoinGeckoCandles({
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
    const returnedCandles = filterCandlesForRange(cachedCandles, requiredRange);

    if (returnedCandles.length > 0) {
      logCoinGeckoCandles({
        cacheHit: false,
        fetchedCandlesCount: 0,
        missingRanges,
        returnedCandlesCount: returnedCandles.length,
        stale: true,
        symbol: asset.symbol,
        timeframe,
      });

      return {
        candles: returnedCandles,
        stale: true,
      };
    }

    throw error;
  }
}

export function resolveCoinGeckoAsset(symbol: string): CryptoAsset {
  const rawSymbol = symbol.trim().replace(/^crypto:/i, '');
  const normalizedSymbol = rawSymbol.toLowerCase();
  const compactSymbol = normalizedSymbol.replace(/[^a-z0-9]/g, '');
  const exactMatch =
    symbolAliases.get(normalizedSymbol) ?? symbolAliases.get(compactSymbol);

  if (exactMatch) {
    return exactMatch;
  }

  const embeddedMatch = isLegacyPairSymbol(compactSymbol)
    ? knownCryptoAssets.find((asset) =>
        compactSymbol.includes(asset.symbol.toLowerCase())
      )
    : undefined;

  if (embeddedMatch) {
    return embeddedMatch;
  }

  if (!normalizedSymbol) {
    throw new MarketDataError('Informe uma criptomoeda valida.', 400);
  }

  return {
    id: normalizedSymbol,
    symbol: rawSymbol.toUpperCase(),
    name: toDisplayName(normalizedSymbol),
  };
}

function isLegacyPairSymbol(symbol: string) {
  return /(usd|usdt|brl|eur)$/.test(symbol);
}

export function getRequiredRangeForTimeframe(
  timeframe: MarketTimeframe
): RequiredCandleRange {
  const now = Math.floor(Date.now() / 1000);
  const bucketSizeSeconds = getBucketSizeSeconds(timeframe);
  const rangeSeconds = getRangeSeconds(timeframe);
  const firstTime = getBucketTimeFromSeconds(now - rangeSeconds, bucketSizeSeconds);
  const lastTime = getBucketTimeFromSeconds(now, bucketSizeSeconds);

  return {
    from: firstTime,
    to: now,
    firstTime,
    lastTime,
    bucketSizeSeconds,
  };
}

export function getMissingRanges(
  requiredRange: RequiredCandleRange,
  cachedCandles: MarketCandle[]
): MissingCandleRange[] {
  const normalizedCandles = dedupeCandlesByTime(cachedCandles);

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
      to: firstCachedTime - 1,
    });
  }

  if (lastCachedTime < requiredRange.lastTime) {
    ranges.push({
      from: lastCachedTime,
      to: requiredRange.to,
    });
  }

  return ranges.filter((range) => range.to > range.from);
}

export async function fetchCoinGeckoCandlesRange(
  symbol: string,
  from: number,
  to: number,
  timeframe: MarketTimeframe
): Promise<MarketCandle[]> {
  const asset = resolveCoinGeckoAsset(symbol);
  const response = await fetchCoinGecko<CoinGeckoMarketChartResponse>(
    `/coins/${encodeURIComponent(asset.id)}/market_chart/range`,
    {
      vs_currency: USD_CURRENCY,
      from: String(from),
      to: String(to),
    }
  );

  return buildCandlesFromMarketChart(response, timeframe);
}

export function mergeCandles(
  existingCandles: MarketCandle[],
  newCandles: MarketCandle[]
): MarketCandle[] {
  return dedupeCandlesByTime([...existingCandles, ...newCandles]);
}

export function dedupeCandlesByTime(candles: MarketCandle[]): MarketCandle[] {
  const candlesByTime = new Map<number, MarketCandle>();

  for (const candle of candles) {
    if (!isValidCandle(candle)) {
      continue;
    }

    candlesByTime.set(candle.time, { ...candle });
  }

  return Array.from(candlesByTime.values()).sort(
    (left, right) => left.time - right.time
  );
}

function buildCandlesFromMarketChart(
  response: CoinGeckoMarketChartResponse,
  timeframe: MarketTimeframe
): MarketCandle[] {
  const bucketSize = getBucketSizeSeconds(timeframe);
  const buckets = new Map<number, MarketCandle>();

  for (const point of [...(response.prices ?? [])].sort(
    (left, right) => left[0] - right[0]
  )) {
    const [timestampMs, rawPrice] = point;
    const price = toFiniteNumber(rawPrice);

    if (price === null || !Number.isFinite(timestampMs)) {
      continue;
    }

    const bucketTime = getBucketTime(timestampMs, bucketSize);
    const current = buckets.get(bucketTime);

    if (!current) {
      buckets.set(bucketTime, {
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
      });
      continue;
    }

    current.high = Math.max(current.high, price);
    current.low = Math.min(current.low, price);
    current.close = price;
  }

  for (const point of response.total_volumes ?? []) {
    const [timestampMs, rawVolume] = point;
    const volume = toFiniteNumber(rawVolume);

    if (volume === null || !Number.isFinite(timestampMs)) {
      continue;
    }

    const bucketTime = getBucketTime(timestampMs, bucketSize);
    const current = buckets.get(bucketTime);

    if (current) {
      current.volume = volume;
    }
  }

  return Array.from(buckets.values()).sort((left, right) => left.time - right.time);
}

async function loadMergedCandleCache(
  symbol: string,
  timeframe: MarketTimeframe,
  cacheKey: string
): Promise<CandleCacheData | null> {
  const ownCache = await loadCandleCache(cacheKey);
  const compatibleCandles = await loadCompatibleCachedCandles(symbol, timeframe);
  const mergedCandles = mergeCandles(ownCache?.candles ?? [], compatibleCandles);

  if (mergedCandles.length === 0) {
    return null;
  }

  return {
    provider: 'coingecko',
    type: 'crypto',
    symbol,
    timeframe,
    candles: mergedCandles,
    firstTime: mergedCandles[0].time,
    lastTime: mergedCandles[mergedCandles.length - 1].time,
    updatedAt: ownCache?.updatedAt ?? Math.floor(Date.now() / 1000),
  };
}

async function loadCompatibleCachedCandles(
  symbol: string,
  timeframe: MarketTimeframe
): Promise<MarketCandle[]> {
  const compatibleTimeframes = getCompatibleTimeframes(timeframe);
  const candles: MarketCandle[] = [];

  for (const compatibleTimeframe of compatibleTimeframes) {
    const compatibleCache = await loadCandleCache(
      buildCandleCacheKey(symbol, compatibleTimeframe)
    );

    if (compatibleCache) {
      candles.push(...compatibleCache.candles);
    }
  }

  return candles;
}

function createCandleCacheData(
  symbol: string,
  timeframe: MarketTimeframe,
  candles: MarketCandle[]
): CandleCacheData {
  const normalizedCandles = dedupeCandlesByTime(candles);

  return {
    provider: 'coingecko',
    type: 'crypto',
    symbol,
    timeframe,
    candles: normalizedCandles,
    firstTime: normalizedCandles[0]?.time ?? 0,
    lastTime: normalizedCandles[normalizedCandles.length - 1]?.time ?? 0,
    updatedAt: Math.floor(Date.now() / 1000),
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

function buildCandleCacheKey(symbol: string, timeframe: MarketTimeframe) {
  return [
    'provider',
    'coingecko',
    'type',
    'crypto',
    'symbol',
    symbol.trim().toLowerCase(),
    'timeframe',
    timeframe,
  ].join(':');
}

function getCompatibleTimeframes(timeframe: MarketTimeframe): MarketTimeframe[] {
  const bucketSizeSeconds = getBucketSizeSeconds(timeframe);
  const timeframes: MarketTimeframe[] = [
    '1D',
    '7D',
    '1W',
    '1M',
    '3M',
    '6M',
    '1Y',
    '2Y',
    'MAX',
  ];

  return timeframes.filter(
    (candidate) =>
      candidate !== timeframe &&
      getBucketSizeSeconds(candidate) === bucketSizeSeconds
  );
}

async function fetchCoinGecko<T>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const url = new URL(`${COINGECKO_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new MarketDataError('Nao foi possivel conectar ao CoinGecko.');
  }

  if (!response.ok) {
    throw new MarketDataError(getCoinGeckoErrorMessage(response.status), response.status);
  }

  return (await response.json()) as T;
}

function getCoinGeckoErrorMessage(status: number) {
  if (status === 429) {
    return 'CoinGecko limitou as chamadas agora. Tente novamente em instantes.';
  }

  return `CoinGecko respondeu com erro ${status}.`;
}

function getBucketSizeSeconds(timeframe: MarketTimeframe) {
  const hour = 60 * 60;
  const day = 24 * hour;

  const bucketsByTimeframe: Record<MarketTimeframe, number> = {
    '1D': hour,
    '7D': 4 * hour,
    '1W': 4 * hour,
    '1M': day,
    '3M': day,
    '6M': day,
    '1Y': day,
    '2Y': day,
    MAX: 7 * day,
  };

  return bucketsByTimeframe[timeframe];
}

function getBucketTime(timestampMs: number, bucketSizeSeconds: number) {
  const timestampSeconds = Math.floor(timestampMs / 1000);
  return getBucketTimeFromSeconds(timestampSeconds, bucketSizeSeconds);
}

function getBucketTimeFromSeconds(
  timestampSeconds: number,
  bucketSizeSeconds: number
) {
  return Math.floor(timestampSeconds / bucketSizeSeconds) * bucketSizeSeconds;
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
    MAX: 10 * 365 * day,
  };

  return rangesByTimeframe[timeframe];
}

function logCoinGeckoCandles(params: {
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
      'provider=coingecko',
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

function isValidCandle(candle: MarketCandle) {
  return (
    Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close)
  );
}

function getAbsoluteChange(price: number, changePercent: number | null) {
  if (changePercent === null) {
    return undefined;
  }

  const previousPriceFactor = 1 + changePercent / 100;

  if (previousPriceFactor === 0) {
    return undefined;
  }

  const previousPrice = price / previousPriceFactor;
  return Number.isFinite(previousPrice) ? price - previousPrice : undefined;
}

function mergeSearchResults(results: MarketSearchResult[]) {
  const seen = new Set<string>();

  return results.filter((result) => {
    const key = result.symbol.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function toSearchResult(asset: CryptoAsset): MarketSearchResult {
  return {
    symbol: asset.id,
    displaySymbol: asset.symbol.toUpperCase(),
    name: asset.name,
    type: 'crypto',
    currency: 'USD',
    exchange: 'CoinGecko',
  };
}

function toDisplayName(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function toFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
