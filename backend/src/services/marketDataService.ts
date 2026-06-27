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
  getFinnhubCandles,
  getFinnhubQuote,
  resolveFinnhubAsset,
  searchCrypto,
} from './finnhubService';

const quoteCacheTtlMs = 30 * 1000;
const candlesCacheTtlMs = 5 * 60 * 1000;
const searchCacheTtlMs = 5 * 60 * 1000;

export async function searchAssets(
  query: string,
  type: MarketAssetType
): Promise<MarketSearchResult[]> {
  return memoryCache.getOrSet(
    buildCacheKey('search', query, type),
    searchCacheTtlMs,
    async () => {
      if (type === 'crypto') {
        return searchCrypto(query);
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
): Promise<MarketQuote> {
  return memoryCache.getOrSet(
    buildCacheKey('quote', symbol, type),
    quoteCacheTtlMs,
    async () => {
      if (type === 'crypto' || type === 'forex' || type === 'global_stock') {
        logMarketProvider({
          endpoint: 'quote',
          provider: 'Finnhub',
          symbol: resolveFinnhubAsset(symbol, type).symbol,
          type,
        });
        return getFinnhubQuote(symbol, type);
      }

      if (type === 'brazilian_stock') {
        logMarketProvider({
          endpoint: 'quote',
          provider: 'brapi.dev',
          symbol,
          type,
        });
        return getBrapiQuote(symbol);
      }

      throw new MarketDataError('Tipo de ativo nao suportado.', 400);
    }
  );
}

export async function getCandles(
  symbol: string,
  type: MarketAssetType,
  timeframe: MarketTimeframe
): Promise<MarketCandle[]> {
  return memoryCache.getOrSet(
    buildCacheKey('candles', symbol, type, timeframe),
    candlesCacheTtlMs,
    async () => {
      if (type === 'crypto' || type === 'forex' || type === 'global_stock') {
        logMarketProvider({
          endpoint: 'candles',
          provider: 'Finnhub',
          symbol: resolveFinnhubAsset(symbol, type).symbol,
          timeframe,
          type,
        });
        return getFinnhubCandles(symbol, type, timeframe);
      }

      if (type === 'brazilian_stock') {
        logMarketProvider({
          endpoint: 'candles',
          provider: 'brapi.dev',
          symbol,
          timeframe,
          type,
        });
        return getBrapiCandles(symbol, timeframe);
      }

      throw new MarketDataError('Tipo de ativo nao suportado.', 400);
    }
  );
}

function logMarketProvider(params: {
  endpoint: 'quote' | 'candles';
  provider: 'Finnhub' | 'brapi.dev';
  symbol: string;
  type: MarketAssetType;
  timeframe?: MarketTimeframe;
}) {
  console.log('[market-data]', {
    endpoint: params.endpoint,
    provider: params.provider,
    symbol: params.symbol,
    timeframe: params.timeframe,
    type: params.type,
  });
}

function buildCacheKey(
  endpoint: string,
  symbol: string,
  type: MarketAssetType,
  timeframe?: MarketTimeframe
) {
  return [endpoint, symbol.trim().toUpperCase(), type, timeframe ?? '']
    .filter(Boolean)
    .join(':');
}
