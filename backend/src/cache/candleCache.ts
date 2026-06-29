import { promises as fs } from 'fs';
import path from 'path';

import type { MarketCandle, MarketTimeframe } from '../types/marketTypes';

export type CandleCacheData = {
  provider: 'alphavantage';
  type: 'crypto';
  symbol: string;
  timeframe: MarketTimeframe;
  candles: MarketCandle[];
  firstTime: number;
  lastTime: number;
  updatedAt: number;
};

const candleCacheFilePath = path.resolve(__dirname, '../../.cache/candles.json');
const candleCacheEntries = new Map<string, CandleCacheData>();

let hasLoadedFileCache = false;

export async function loadCandleCache(
  cacheKey: string
): Promise<CandleCacheData | null> {
  await ensureFileCacheLoaded();

  const cached = candleCacheEntries.get(cacheKey);
  return cached ? cloneCandleCacheData(cached) : null;
}

export async function saveCandleCache(
  cacheKey: string,
  data: CandleCacheData
): Promise<void> {
  await ensureFileCacheLoaded();

  candleCacheEntries.set(cacheKey, cloneCandleCacheData(data));
  await persistFileCache();
}

async function ensureFileCacheLoaded() {
  if (hasLoadedFileCache) {
    return;
  }

  hasLoadedFileCache = true;

  try {
    const rawCache = await fs.readFile(candleCacheFilePath, 'utf8');
    const parsedCache = JSON.parse(rawCache) as Record<string, unknown>;

    for (const [cacheKey, value] of Object.entries(parsedCache)) {
      if (isCandleCacheData(value)) {
        candleCacheEntries.set(cacheKey, cloneCandleCacheData(value));
      }
    }
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }

    console.warn('[candle-cache] ignoring invalid local cache file');
  }
}

async function persistFileCache() {
  await fs.mkdir(path.dirname(candleCacheFilePath), {
    recursive: true,
  });

  await fs.writeFile(
    candleCacheFilePath,
    JSON.stringify(Object.fromEntries(candleCacheEntries), null, 2)
  );
}

function cloneCandleCacheData(data: CandleCacheData): CandleCacheData {
  return {
    ...data,
    candles: data.candles.map((candle) => ({ ...candle })),
  };
}

function isCandleCacheData(value: unknown): value is CandleCacheData {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.provider === 'alphavantage' &&
    value.type === 'crypto' &&
    typeof value.symbol === 'string' &&
    typeof value.timeframe === 'string' &&
    typeof value.firstTime === 'number' &&
    typeof value.lastTime === 'number' &&
    typeof value.updatedAt === 'number' &&
    Array.isArray(value.candles) &&
    value.candles.every(isMarketCandle)
  );
}

function isMarketCandle(value: unknown): value is MarketCandle {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.time === 'number' &&
    typeof value.open === 'number' &&
    typeof value.high === 'number' &&
    typeof value.low === 'number' &&
    typeof value.close === 'number' &&
    (typeof value.volume === 'undefined' || typeof value.volume === 'number')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMissingFileError(error: unknown) {
  return isRecord(error) && error.code === 'ENOENT';
}
