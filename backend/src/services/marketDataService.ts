import { memoryCache } from '../cache/memoryCache';
import {
  MarketDataError,
  type MarketAssetType,
  type MarketCandle,
  type MarketQuote,
  type MarketSearchResult,
  type MarketTimeframe,
} from '../types/marketTypes';
import {
  getBrapiCandles,
  getBrapiQuote,
  searchBrazilianAssets,
} from './brapiService';
import {
  getAlphaVantageCandles,
  getAlphaVantageQuote,
  resolveAlphaVantageAsset,
  searchAlphaVantageCrypto,
} from './alphaVantageService';

type CachedResult<T> = {
  value: T;
  stale: boolean;
};

const quoteCacheTtlMs = 60 * 1000;
const searchCacheTtlMs = 5 * 60 * 1000;
const shortCandlesCacheTtlMs = 5 * 60 * 1000;
const longCandlesCacheTtlMs = 6 * 60 * 60 * 1000;

export async function searchAssets(
  query: string,
  type: MarketAssetType
): Promise<MarketSearchResult[]> {
  return memoryCache.getOrSet(
    buildCacheKey('search', query, type),
    searchCacheTtlMs,
    async () => {
      if (type === 'crypto') {
        return searchAlphaVantageCrypto(query);
      }

      if (type === 'brazilian_stock') {
        return searchBrazilianAssets(query);
      }

      throw new MarketDataError('Busca ainda nao suportada para este tipo.', 400);
    }
  );
}

export async function getQuote(
  symbol: string,
  type: MarketAssetType
): Promise<CachedResult<MarketQuote>> {
  if (type === 'crypto') {
    const resolvedAsset = resolveAlphaVantageAsset(symbol);

    return getCachedMarketData({
      endpoint: 'quote',
      key: buildCacheKey('quote', resolvedAsset.symbol, type),
      provider: 'alphavantage',
      symbol: resolvedAsset.symbol,
      type,
      ttlMs: quoteCacheTtlMs,
      factory: () => getAlphaVantageQuote(resolvedAsset.symbol),
    });
  }

  if (type === 'brazilian_stock') {
    return getCachedMarketData({
      endpoint: 'quote',
      key: buildCacheKey('quote', symbol, type),
      provider: 'brapi.dev',
      symbol,
      type,
      ttlMs: quoteCacheTtlMs,
      factory: () => getBrapiQuote(symbol),
    });
  }

  throw new MarketDataError('Tipo de ativo nao suportado.', 400);
}

export async function getCandles(
  symbol: string,
  type: MarketAssetType,
  timeframe: MarketTimeframe
): Promise<CachedResult<MarketCandle[]>> {
  if (type === 'crypto') {
    const resolvedAsset = resolveAlphaVantageAsset(symbol);
    const result = await getAlphaVantageCandles(
      resolvedAsset.symbol,
      timeframe
    );

    return {
      value: result.candles,
      stale: result.stale,
    };
  }

  if (type === 'brazilian_stock') {
    return getCachedMarketData({
      endpoint: 'candles',
      key: buildCacheKey('candles', symbol, type, timeframe),
      provider: 'brapi.dev',
      symbol,
      timeframe,
      type,
      ttlMs: getCandlesCacheTtlMs(timeframe),
      factory: () => getBrapiCandles(symbol, timeframe),
    });
  }

  throw new MarketDataError('Tipo de ativo nao suportado.', 400);
}

async function getCachedMarketData<T>(params: {
  endpoint: 'quote' | 'candles';
  factory: () => Promise<T>;
  key: string;
  provider: 'alphavantage' | 'brapi.dev';
  symbol: string;
  timeframe?: MarketTimeframe;
  ttlMs: number;
  type: MarketAssetType;
}): Promise<CachedResult<T>> {
  const cachedEntry = memoryCache.getEntry<T>(params.key);

  if (cachedEntry && !cachedEntry.stale) {
    logMarketProvider({
      ...params,
      cacheHit: true,
    });

    return {
      value: cachedEntry.value,
      stale: false,
    };
  }

  logMarketProvider({
    ...params,
    cacheHit: false,
  });

  try {
    const value = await params.factory();
    memoryCache.set(params.key, value, params.ttlMs);

    return {
      value,
      stale: false,
    };
  } catch (error) {
    if (cachedEntry) {
      console.warn('[market-data] returning stale cache', {
        endpoint: params.endpoint,
        provider: params.provider,
        symbol: params.symbol,
        timeframe: params.timeframe,
        type: params.type,
      });

      return {
        value: cachedEntry.value,
        stale: true,
      };
    }

    throw error;
  }
}

function getCandlesCacheTtlMs(timeframe: MarketTimeframe) {
  if (timeframe === '1D' || timeframe === '7D' || timeframe === '1W') {
    return shortCandlesCacheTtlMs;
  }

  return longCandlesCacheTtlMs;
}

function logMarketProvider(params: {
  cacheHit: boolean;
  endpoint: 'quote' | 'candles';
  provider: 'alphavantage' | 'brapi.dev';
  symbol: string;
  type: MarketAssetType;
  timeframe?: MarketTimeframe;
}) {
  console.log(
    [
      '[market-data]',
      `provider=${params.provider}`,
      `endpoint=${params.endpoint}`,
      `type=${params.type}`,
      `symbol=${params.symbol}`,
      `timeframe=${params.timeframe ?? ''}`,
      `cacheHit=${params.cacheHit}`,
    ].join(' ')
  );
}

function buildCacheKey(
  endpoint: string,
  symbol: string,
  type: MarketAssetType,
  timeframe?: MarketTimeframe
) {
  return [endpoint, symbol.trim().toLowerCase(), type, timeframe ?? '']
    .filter(Boolean)
    .join(':');
}
