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
        return getFinnhubQuote(symbol, type);
      }

      if (type === 'brazilian_stock') {
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
        return getFinnhubCandles(symbol, type, timeframe);
      }

      if (type === 'brazilian_stock') {
        return getBrapiCandles(symbol, timeframe);
      }

      throw new MarketDataError('Tipo de ativo nao suportado.', 400);
    }
  );
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
