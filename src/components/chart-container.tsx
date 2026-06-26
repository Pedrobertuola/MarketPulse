import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Candle } from '../types';
import {
  calculateBollingerBands,
  calculateSMA,
  normalizeCandles,
  theme,
} from '../utils';
import {
  IndicatorSelector,
  type IndicatorVisibility,
} from './indicator-selector';
import { TradingChartWithRSI } from './charts/TradingChartWithRSI';

type Timeframe = '1D' | '7D';

type ChartContainerProps = {
  candles: Candle[];
  currency: 'BRL' | 'USD';
  timeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
};

const timeframeOptions: Array<{ label: string; value: Timeframe }> = [
  { label: '1D', value: '1D' },
  { label: '7D', value: '7D' },
];

const defaultIndicators: IndicatorVisibility = {
  bollinger: true,
  rsi: true,
  sma20: true,
  sma50: false,
};

export function ChartContainer({
  candles,
  currency,
  timeframe,
  onTimeframeChange,
}: ChartContainerProps) {
  const [indicatorVisibility, setIndicatorVisibility] =
    useState(defaultIndicators);
  const displayCandles = useMemo(
    () => getDisplayCandles(candles, timeframe),
    [candles, timeframe]
  );
  const closePrices = useMemo(
    () => displayCandles.map((candle) => candle.close),
    [displayCandles]
  );
  const sma20 = useMemo(() => calculateSMA(closePrices, 20), [closePrices]);
  const sma50 = useMemo(() => calculateSMA(closePrices, 50), [closePrices]);
  const bollingerBands = useMemo(
    () => calculateBollingerBands(closePrices, 20, 2),
    [closePrices]
  );
  const overlays = useMemo(() => {
    const nextOverlays: Array<{ color: string; values: Array<number | null> }> =
      [];

    if (indicatorVisibility.sma20 && !indicatorVisibility.bollinger) {
      nextOverlays.push({ color: '#3B82F6', values: sma20 });
    }

    if (indicatorVisibility.sma50) {
      nextOverlays.push({ color: '#F59E0B', values: sma50 });
    }

    if (indicatorVisibility.bollinger) {
      nextOverlays.push({
        color: '#EF4444',
        values: bollingerBands.map((point) => point?.upper ?? null),
      });
      nextOverlays.push({
        color: '#3B82F6',
        values: bollingerBands.map((point) => point?.middle ?? null),
      });
      nextOverlays.push({
        color: '#14B8A6',
        values: bollingerBands.map((point) => point?.lower ?? null),
      });
    }

    return nextOverlays;
  }, [
    bollingerBands,
    indicatorVisibility.bollinger,
    indicatorVisibility.sma20,
    indicatorVisibility.sma50,
    sma20,
    sma50,
  ]);

  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {timeframeOptions.map((option) => {
            const isSelected = timeframe === option.value;

            return (
              <Pressable
                key={option.value}
                onPress={() => onTimeframeChange(option.value)}
                style={({ pressed }) => ({
                  backgroundColor: isSelected
                    ? theme.colors.text
                    : pressed
                      ? theme.colors.surfacePressed
                      : theme.colors.surface,
                  borderColor: isSelected
                    ? theme.colors.text
                    : theme.colors.border,
                  borderRadius: theme.radius.pill,
                  borderWidth: 1,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                })}
              >
                <Text
                  selectable
                  style={{
                    color: isSelected ? '#03121D' : theme.colors.textMuted,
                    fontSize: 12,
                    fontWeight: '900',
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text selectable style={{ color: theme.colors.textSubtle, fontSize: 12 }}>
          Arraste ou pince para navegar
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <Text
          selectable
          style={{ color: theme.colors.text, fontSize: 16, fontWeight: '900' }}
        >
          Grafico
        </Text>
        <IndicatorSelector
          onChange={setIndicatorVisibility}
          value={indicatorVisibility}
        />
      </View>

      <TradingChartWithRSI
        candles={displayCandles}
        currency={currency}
        height={620}
        overlays={overlays}
        rsiPeriod={14}
        showRSI={indicatorVisibility.rsi}
      />
    </View>
  );
}

function getDisplayCandles(candles: Candle[], timeframe: Timeframe) {
  const sortedCandles = normalizeCandles(candles).map((candle) => ({
    timestamp: new Date(candle.time * 1000).toISOString(),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));

  if (timeframe === '7D') {
    return aggregateWeeklyCandles(sortedCandles);
  }

  return sortedCandles;
}

function aggregateWeeklyCandles(candles: Candle[]) {
  const buckets = new Map<string, Candle>();

  candles.forEach((candle) => {
    const key = getWeekBucketKey(candle.timestamp);
    const current = buckets.get(key);

    if (!current) {
      buckets.set(key, candle);
      return;
    }

    buckets.set(key, {
      timestamp: current.timestamp,
      open: current.open,
      high: Math.max(current.high, candle.high),
      low: Math.min(current.low, candle.low),
      close: candle.close,
      volume:
        typeof candle.volume === 'number' && typeof current.volume === 'number'
          ? current.volume + candle.volume
          : candle.volume ?? current.volume,
    });
  });

  return Array.from(buckets.values());
}

function getWeekBucketKey(timestamp: string) {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  date.setUTCDate(date.getUTCDate() + mondayOffset);
  date.setUTCHours(0, 0, 0, 0);

  return date.toISOString();
}
