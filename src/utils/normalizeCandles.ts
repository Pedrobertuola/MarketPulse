import type { Candle } from '../types';

export type NormalizedCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type PricePointSource = {
  timestamp: string;
  price: number;
};

export function normalizeCandles(candles: Candle[]): NormalizedCandle[] {
  return candles
    .map((candle) => {
      const time = toUnixTimestamp(candle.timestamp);
      const open = toFiniteNumber(candle.open);
      const close = toFiniteNumber(candle.close);
      const rawHigh = toFiniteNumber(candle.high);
      const rawLow = toFiniteNumber(candle.low);

      if (
        time === null ||
        open === null ||
        close === null ||
        rawHigh === null ||
        rawLow === null
      ) {
        return null;
      }

      return {
        time,
        open,
        // Keep OHLC internally consistent without inferring direction from
        // previous candles. Color must remain a pure close-versus-open result.
        high: Math.max(rawHigh, rawLow, open, close),
        low: Math.min(rawHigh, rawLow, open, close),
        close,
      };
    })
    .filter((candle): candle is NormalizedCandle => candle !== null)
    .sort((left, right) => left.time - right.time);
}

export function normalizePriceCandles(
  points: PricePointSource[],
  getBucketKey: (point: PricePointSource) => string
): NormalizedCandle[] {
  const buckets = new Map<string, NormalizedCandle>();

  [...points]
    .sort(
      (left, right) =>
        new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
    )
    .forEach((point) => {
      const time = toUnixTimestamp(point.timestamp);
      const price = toFiniteNumber(point.price);

      if (time === null || price === null) {
        return;
      }

      const key = getBucketKey(point);
      const current = buckets.get(key);

      if (!current) {
        buckets.set(key, {
          time,
          open: price,
          high: price,
          low: price,
          close: price,
        });
        return;
      }

      // For APIs that only return prices, each candle is built from the real
      // first, last, maximum and minimum prices inside the selected interval.
      buckets.set(key, {
        time: current.time,
        open: current.open,
        high: Math.max(current.high, price),
        low: Math.min(current.low, price),
        close: price,
      });
    });

  return Array.from(buckets.values()).sort(
    (left, right) => left.time - right.time
  );
}

function toUnixTimestamp(timestamp: string) {
  const value = Math.floor(new Date(timestamp).getTime() / 1000);
  return Number.isFinite(value) ? value : null;
}

function toFiniteNumber(value: number) {
  return Number.isFinite(value) ? value : null;
}
