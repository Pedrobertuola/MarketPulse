import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type {
  CandlestickData,
  IChartApi,
  LineData,
  Time,
} from 'lightweight-charts';

import type { Candle } from '../../types';
import { normalizeCandles, theme } from '../../utils';
import { CandlestickChart } from '../candlestick-chart';

type OverlaySeries = {
  color: string;
  values: Array<number | null>;
};

type TradingCandlestickChartProps = {
  candles: Candle[];
  currency: 'BRL' | 'USD';
  overlays?: OverlaySeries[];
};

const chartHeight = 420;
const priceScaleMinimumWidth = 132;

export function TradingCandlestickChart({
  candles,
  currency,
  overlays = [],
}: TradingCandlestickChartProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [useNativeFallback, setUseNativeFallback] = useState(
    Platform.OS !== 'web'
  );
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(320, windowWidth - 48);

  const chartData = useMemo(
    () =>
      normalizeCandles(candles).map((candle) => ({
        close: candle.close,
        high: candle.high,
        low: candle.low,
        open: candle.open,
        time: candle.time as Time,
      })),
    [candles]
  );

  const overlayData = useMemo(
    () =>
      overlays.map((overlay) => ({
        color: overlay.color,
        values: overlay.values
          .map((value, index) => {
            const time = chartData[index]?.time;

            if (typeof value !== 'number' || time === undefined) {
              return null;
            }

            return {
              time,
              value,
            };
          })
          .filter((point): point is LineData<Time> => point !== null),
      })),
    [chartData, overlays]
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || useNativeFallback) {
      return;
    }

    let chart: IChartApi | null = null;
    let isDisposed = false;

    const setupChart = async () => {
      const hostElement = containerRef.current;

      if (!hostElement || typeof hostElement.appendChild !== 'function') {
        setUseNativeFallback(true);
        return;
      }

      const {
        CandlestickSeries,
        CrosshairMode,
        LineSeries,
        createChart,
      } = await import('lightweight-charts');

      if (isDisposed) {
        return;
      }

      while (hostElement.firstChild) {
        hostElement.removeChild(hostElement.firstChild);
      }

      chart = createChart(hostElement, {
        autoSize: false,
        height: chartHeight,
        width,
        layout: {
          attributionLogo: false,
          background: { color: '#070B12' },
          textColor: '#94A3B8',
        },
        grid: {
          horzLines: { color: 'rgba(148, 163, 184, 0.11)' },
          vertLines: { color: 'rgba(148, 163, 184, 0.09)' },
        },
        rightPriceScale: {
          borderColor: '#263348',
          minimumWidth: priceScaleMinimumWidth,
          visible: true,
        },
        timeScale: {
          borderColor: '#263348',
          rightOffset: 8,
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          horzLine: {
            color: '#CBD5E1',
            labelBackgroundColor: '#111A2C',
          },
          vertLine: {
            color: '#CBD5E1',
            labelBackgroundColor: '#111A2C',
          },
        },
        handleScroll: {
          horzTouchDrag: true,
          mouseWheel: true,
          pressedMouseMove: true,
          vertTouchDrag: false,
        },
        handleScale: {
          axisDoubleClickReset: true,
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
        localization: {
          priceFormatter: (price: number) => formatPrice(price, currency),
        },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        borderDownColor: '#F43F5E',
        borderUpColor: '#22C55E',
        downColor: '#F43F5E',
        priceFormat: {
          minMove: 0.01,
          precision: 2,
          type: 'price',
        },
        upColor: '#22C55E',
        wickDownColor: '#F43F5E',
        wickUpColor: '#22C55E',
      });

      candleSeries.setData(chartData as CandlestickData<Time>[]);
      candleSeries.setSeriesOrder(0);

      overlayData.forEach((overlay, index) => {
        if (overlay.values.length === 0 || !chart) {
          return;
        }

        const lineSeries = chart.addSeries(LineSeries, {
          color: overlay.color,
          lastValueVisible: false,
          lineWidth: 2,
          priceLineVisible: false,
        });

        lineSeries.setData(overlay.values);
        lineSeries.setSeriesOrder(index + 1);
      });

      const latestClose = chartData[chartData.length - 1]?.close;

      if (typeof latestClose === 'number') {
        candleSeries.createPriceLine({
          color: theme.colors.primary,
          lineStyle: 2,
          lineWidth: 1,
          price: latestClose,
          title: formatPrice(latestClose, currency),
        });
      }

      const visibleCandles = Math.min(90, chartData.length);
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(chartData.length - visibleCandles, 0),
        to: chartData.length + 6,
      });
    };

    void setupChart();

    return () => {
      isDisposed = true;
      chart?.remove();
    };
  }, [chartData, currency, overlayData, useNativeFallback, width]);

  if (useNativeFallback) {
    return (
      <CandlestickChart
        candles={candles}
        currency={currency}
        overlays={overlays}
      />
    );
  }

  if (chartData.length === 0) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.card,
          borderWidth: 1,
          height: chartHeight,
          justifyContent: 'center',
          padding: theme.spacing.card,
        }}
      >
        <Text selectable style={{ color: theme.colors.textMuted }}>
          Sem candles para exibir.
        </Text>
      </View>
    );
  }

  return (
    <View
      ref={(node) => {
        containerRef.current = node as unknown as HTMLElement | null;
      }}
      style={{
        backgroundColor: '#070B12',
        borderColor: theme.colors.border,
        borderRadius: theme.radius.card,
        borderWidth: 1,
        height: chartHeight,
        overflow: 'hidden',
        width,
      }}
    />
  );
}

function formatPrice(value: number, currency: 'BRL' | 'USD') {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'pt-BR', {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}
