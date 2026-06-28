import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, useWindowDimensions, View } from 'react-native';
import type {
  CandlestickData,
  IChartApi,
  LineData,
  Time,
  WhitespaceData,
} from 'lightweight-charts';

import type { Candle } from '../../types';
import {
  calculateRSI,
  calculateSMA,
  normalizeCandles,
  type NormalizedCandle,
  theme,
} from '../../utils';
import { CandlestickChart } from '../candlestick-chart';

type OverlaySeries = {
  color: string;
  values: Array<number | null>;
};

type TradingChartWithRSIProps = {
  candles: Candle[];
  currency: 'BRL' | 'USD';
  height?: number;
  overlays?: OverlaySeries[];
  rsiPeriod: number;
  rsiValues?: Array<number | null>;
  rsiMovingAverageValues?: Array<number | null>;
  showRSI?: boolean;
};

type LineSeriesPoint = LineData<Time> | WhitespaceData<Time>;

const defaultHeight = 620;
const panelGap = 8;
const priceScaleMinimumWidth = 132;
const mainPaneIndex = 0;
const rsiPaneIndex = 1;

export function TradingChartWithRSI({
  candles,
  currency,
  height = defaultHeight,
  overlays = [],
  rsiPeriod,
  rsiValues,
  rsiMovingAverageValues,
  showRSI = true,
}: TradingChartWithRSIProps) {
  const chartContainerRef = useRef<HTMLElement | null>(null);
  const [useNativeFallback, setUseNativeFallback] = useState(
    Platform.OS !== 'web'
  );
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(320, windowWidth - 48);
  const chartHeight = showRSI ? Math.max(500, height) : Math.max(420, height);
  const paneAreaHeight = showRSI ? Math.max(420, chartHeight - 32) : chartHeight;
  const mainPaneHeight = showRSI
    ? Math.round(paneAreaHeight * 0.75)
    : chartHeight;
  const rsiPaneHeight = showRSI ? paneAreaHeight - mainPaneHeight : 0;

  const normalizedCandles = useMemo(
    () => normalizeCandles(candles),
    [candles]
  );
  const candleData = useMemo(
    () =>
      normalizedCandles.map((candle) => ({
        close: candle.close,
        high: candle.high,
        low: candle.low,
        open: candle.open,
        time: candle.time as Time,
      })),
    [normalizedCandles]
  );
  const rsiData = useMemo(
    () => buildRSIData(normalizedCandles, rsiPeriod, rsiValues),
    [normalizedCandles, rsiPeriod, rsiValues]
  );
  const rsiMovingAverageData = useMemo(
    () =>
      buildMovingAverageData(
        normalizedCandles,
        rsiData,
        rsiPeriod,
        rsiMovingAverageValues
      ),
    [normalizedCandles, rsiData, rsiMovingAverageValues, rsiPeriod]
  );
  const latestRSI = useMemo(() => {
    for (let index = rsiData.length - 1; index >= 0; index -= 1) {
      const point = rsiData[index];
      const value = point && 'value' in point ? point.value : undefined;

      if (typeof value === 'number') {
        return value;
      }
    }

    return null;
  }, [rsiData]);
  const latestRSIMovingAverage = useMemo(() => {
    for (
      let index = rsiMovingAverageData.length - 1;
      index >= 0;
      index -= 1
    ) {
      const point = rsiMovingAverageData[index];
      const value = point && 'value' in point ? point.value : undefined;

      if (typeof value === 'number') {
        return value;
      }
    }

    return null;
  }, [rsiMovingAverageData]);
  const overlayData = useMemo(
    () =>
      overlays.map((overlay) => ({
        color: overlay.color,
        values: overlay.values
          .map((value, index) => {
            const time = candleData[index]?.time;

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
    [candleData, overlays]
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || useNativeFallback) {
      return;
    }

    let chart: IChartApi | null = null;
    let isDisposed = false;

    const setupCharts = async () => {
      const chartElement = chartContainerRef.current;

      if (!chartElement || typeof chartElement.appendChild !== 'function') {
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

      clearElement(chartElement);

      chart = createChart(chartElement, {
        ...createBaseChartOptions(width, chartHeight),
        timeScale: {
          borderColor: '#263348',
          rightOffset: 8,
          secondsVisible: false,
          timeVisible: true,
          visible: true,
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
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        borderDownColor: '#F43F5E',
        borderUpColor: '#22C55E',
        downColor: '#F43F5E',
        priceFormat: {
          formatter: (price: number) => formatPrice(price, currency),
          minMove: 0.01,
          type: 'custom',
        },
        upColor: '#22C55E',
        wickDownColor: '#F43F5E',
        wickUpColor: '#22C55E',
      }, mainPaneIndex);
      candleSeries.setData(candleData as CandlestickData<Time>[]);
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
        }, mainPaneIndex);

        lineSeries.setData(overlay.values);
        lineSeries.setSeriesOrder(index + 1);
      });

      const latestClose = candleData[candleData.length - 1]?.close;

      if (typeof latestClose === 'number') {
        candleSeries.createPriceLine({
          color: theme.colors.primary,
          lineStyle: 2,
          lineWidth: 1,
          price: latestClose,
          title: formatPrice(latestClose, currency),
        });
      }

      if (showRSI) {
        const rsiSeries = chart.addSeries(LineSeries, {
          autoscaleInfoProvider: () => ({
            priceRange: {
              minValue: 0,
              maxValue: 100,
            },
          }),
          color: '#A78BFA',
          lastValueVisible: true,
          lineWidth: 2,
          priceFormat: {
            minMove: 0.01,
            precision: 2,
            type: 'price',
          },
          priceLineVisible: false,
        }, rsiPaneIndex);
        rsiSeries.setData(rsiData);
        rsiSeries.setSeriesOrder(0);
        const rsiMovingAverageSeries = chart.addSeries(LineSeries, {
          color: '#FACC15',
          lastValueVisible: true,
          lineWidth: 2,
          priceFormat: {
            minMove: 0.01,
            precision: 2,
            type: 'price',
          },
          priceLineVisible: false,
        }, rsiPaneIndex);
        rsiMovingAverageSeries.setData(rsiMovingAverageData);
        rsiMovingAverageSeries.setSeriesOrder(1);
        rsiSeries.createPriceLine({
          axisLabelVisible: true,
          color: '#94A3B8',
          lineStyle: 2,
          lineWidth: 1,
          price: 70,
          title: '70',
        });
        rsiSeries.createPriceLine({
          axisLabelVisible: true,
          color: '#94A3B8',
          lineStyle: 2,
          lineWidth: 1,
          price: 30,
          title: '30',
        });
        setPaneHeights(chart, mainPaneHeight, rsiPaneHeight);
      }

      const visibleCandles = Math.min(90, candleData.length);
      const fromIndex = Math.max(candleData.length - visibleCandles, 0);
      const visibleTimeRange =
        candleData[fromIndex] && candleData[candleData.length - 1]
          ? {
              from: candleData[fromIndex].time,
              to: candleData[candleData.length - 1].time,
            }
          : null;

      if (visibleTimeRange) {
        chart.timeScale().setVisibleRange(visibleTimeRange);
      }
    };

    void setupCharts();

    return () => {
      isDisposed = true;
      chart?.remove();
    };
  }, [
    candleData,
    chartHeight,
    currency,
    mainPaneHeight,
    overlayData,
    rsiData,
    rsiPaneHeight,
    rsiMovingAverageData,
    showRSI,
    useNativeFallback,
    width,
  ]);

  if (useNativeFallback) {
    return (
      <View style={{ gap: panelGap }}>
        <CandlestickChart
          candles={candles}
          currency={currency}
          overlays={overlays}
        />
        {showRSI ? (
          <NativeRSIFallback
            candles={candles}
            rsiPeriod={rsiPeriod}
            rsiValues={rsiValues}
          />
        ) : null}
      </View>
    );
  }

  if (candleData.length === 0) {
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
    <View style={{ height: chartHeight, position: 'relative', width }}>
      <View
        ref={(node) => {
          chartContainerRef.current = node as unknown as HTMLElement | null;
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
      {showRSI ? (
        <View
          pointerEvents="none"
          style={{
            left: 14,
            position: 'absolute',
            right: 14,
            top: mainPaneHeight + 10,
          }}
        >
          <Text
            selectable
            style={{
              color: theme.colors.text,
              fontSize: 12,
              fontWeight: '900',
            }}
          >
            RSI {rsiPeriod}
            {typeof latestRSI === 'number'
              ? ` ${latestRSI.toFixed(2)}`
              : ' --'}
            {'  '}
            MA {rsiPeriod}
            {typeof latestRSIMovingAverage === 'number'
              ? ` ${latestRSIMovingAverage.toFixed(2)}`
              : ' --'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function buildRSIData(
  candles: NormalizedCandle[],
  period: number,
  values?: Array<number | null>
) {
  const closes = candles.map((candle) => candle.close);
  const nextValues =
    values?.length === candles.length ? values : calculateRSI(closes, period);

  return buildLineData(candles, nextValues);
}

function buildMovingAverageData(
  candles: NormalizedCandle[],
  points: LineSeriesPoint[],
  period: number,
  values?: Array<number | null>
) {
  if (values?.length === candles.length) {
    return buildLineData(candles, values);
  }

  const averages = calculateNullableSMA(
    points.map((point) => ('value' in point ? point.value : null)),
    period
  );

  return buildLineData(candles, averages);
}

function buildLineData(candles: NormalizedCandle[], values: Array<number | null>) {
  return values.map((value, index) => {
    const time = candles[index].time as Time;

    if (typeof value !== 'number') {
      return { time };
    }

    return { time, value };
  });
}

function calculateNullableSMA(values: Array<number | null>, period: number) {
  const result: Array<number | null> = values.map(() => null);
  const windowValues: number[] = [];

  values.forEach((value, index) => {
    if (typeof value === 'number') {
      windowValues.push(value);
    }

    if (windowValues.length > period) {
      windowValues.shift();
    }

    if (windowValues.length === period) {
      result[index] =
        windowValues.reduce((sum, item) => sum + item, 0) / period;
    }
  });

  return result;
}

function createBaseChartOptions(width: number, height: number) {
  return {
    autoSize: false,
    height,
    width,
    layout: {
      attributionLogo: false,
      background: { color: '#070B12' },
      panes: {
        enableResize: true,
        separatorColor: '#263348',
        separatorHoverColor: 'rgba(56, 189, 248, 0.18)',
      },
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
  };
}

function setPaneHeights(
  chart: IChartApi,
  mainPaneHeight: number,
  rsiPaneHeight: number
) {
  requestAnimationFrame(() => {
    const panes = chart.panes();
    const mainPane = panes[mainPaneIndex];
    const rsiPane = panes[rsiPaneIndex];

    mainPane?.setHeight(mainPaneHeight);
    rsiPane?.setHeight(rsiPaneHeight);
  });
}

function clearElement(element: HTMLElement) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function NativeRSIFallback({
  candles,
  rsiPeriod,
  rsiValues,
}: {
  candles: Candle[];
  rsiPeriod: number;
  rsiValues?: Array<number | null>;
}) {
  const normalizedCandles = normalizeCandles(candles);
  const values =
    rsiValues?.length === normalizedCandles.length
      ? rsiValues
      : calculateRSI(
          normalizedCandles.map((candle) => candle.close),
          rsiPeriod
        );
  const latest = [...values]
    .reverse()
    .find((value): value is number => typeof value === 'number');

  return (
    <View
      style={{
        backgroundColor: '#070B12',
        borderColor: theme.colors.border,
        borderRadius: theme.radius.card,
        borderWidth: 1,
        padding: 14,
      }}
    >
      <Text selectable style={{ color: theme.colors.text, fontWeight: '900' }}>
        RSI {rsiPeriod}
      </Text>
      <Text selectable style={{ color: theme.colors.textMuted, marginTop: 6 }}>
        {typeof latest === 'number'
          ? latest.toFixed(2)
          : 'Dados insuficientes'}
      </Text>
    </View>
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
