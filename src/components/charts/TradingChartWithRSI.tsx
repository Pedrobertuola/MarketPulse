import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, useWindowDimensions, View } from 'react-native';
import type {
  CandlestickData,
  IChartApi,
  ISeriesApi,
  LineData,
  MouseEventParams,
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
  showRSI?: boolean;
};

type CandleSeriesApi = ISeriesApi<'Candlestick', Time>;
type LineSeriesApi = ISeriesApi<'Line', Time>;
type LineSeriesPoint = LineData<Time> | WhitespaceData<Time>;

const defaultHeight = 620;
const panelGap = 8;

export function TradingChartWithRSI({
  candles,
  currency,
  height = defaultHeight,
  overlays = [],
  rsiPeriod,
  showRSI = true,
}: TradingChartWithRSIProps) {
  const candleContainerRef = useRef<HTMLElement | null>(null);
  const rsiContainerRef = useRef<HTMLElement | null>(null);
  const [useNativeFallback, setUseNativeFallback] = useState(
    Platform.OS !== 'web'
  );
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(320, windowWidth - 48);
  const rsiHeight = showRSI
    ? Math.min(180, Math.max(140, Math.round(height * 0.28)))
    : 0;
  const candleHeight = showRSI
    ? Math.max(320, height - rsiHeight - panelGap)
    : Math.max(420, height);

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
    () => buildRSIData(normalizedCandles, rsiPeriod),
    [normalizedCandles, rsiPeriod]
  );
  const rsiMovingAverageData = useMemo(
    () => buildMovingAverageData(rsiData, rsiPeriod),
    [rsiData, rsiPeriod]
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

    let candleChart: IChartApi | null = null;
    let rsiChart: IChartApi | null = null;
    let candleSeries: CandleSeriesApi | null = null;
    let rsiSeries: LineSeriesApi | null = null;
    let isDisposed = false;
    let isSyncingRange = false;
    let isSyncingCrosshair = false;
    const rsiByTime = new Map(
      rsiData
        .filter((point): point is LineData<Time> => 'value' in point)
        .map((point) => [Number(point.time), point.value])
    );
    const closeByTime = new Map(
      candleData.map((point) => [Number(point.time), point.close])
    );

    const setupCharts = async () => {
      const candleElement = candleContainerRef.current;
      const rsiElement = rsiContainerRef.current;

      if (
        !candleElement ||
        typeof candleElement.appendChild !== 'function' ||
        (showRSI &&
          (!rsiElement || typeof rsiElement.appendChild !== 'function'))
      ) {
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

      clearElement(candleElement);

      if (showRSI && rsiElement) {
        clearElement(rsiElement);
      }

      candleChart = createChart(candleElement, {
        ...createBaseChartOptions(width, candleHeight),
        timeScale: {
          borderColor: '#263348',
          rightOffset: 8,
          secondsVisible: false,
          timeVisible: true,
          visible: false,
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
        localization: {
          priceFormatter: (price: number) => formatPrice(price, currency),
        },
      });

      if (showRSI && rsiElement) {
        rsiChart = createChart(rsiElement, {
          ...createBaseChartOptions(width, rsiHeight),
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
          localization: {
            priceFormatter: (price: number) => price.toFixed(2),
          },
        });
      }

      candleSeries = candleChart.addSeries(CandlestickSeries, {
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
      candleSeries.setData(candleData as CandlestickData<Time>[]);

      overlayData.forEach((overlay) => {
        if (overlay.values.length === 0 || !candleChart) {
          return;
        }

        const lineSeries = candleChart.addSeries(LineSeries, {
          color: overlay.color,
          lastValueVisible: false,
          lineWidth: 2,
          priceLineVisible: false,
        });

        lineSeries.setData(overlay.values);
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

      if (rsiChart) {
        rsiSeries = rsiChart.addSeries(LineSeries, {
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
        });
        rsiSeries.setData(rsiData);
        const rsiMovingAverageSeries = rsiChart.addSeries(LineSeries, {
          color: '#FACC15',
          lastValueVisible: true,
          lineWidth: 2,
          priceFormat: {
            minMove: 0.01,
            precision: 2,
            type: 'price',
          },
          priceLineVisible: false,
        });
        rsiMovingAverageSeries.setData(rsiMovingAverageData);
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
      }

      const syncFromCandles = (range: { from: number; to: number } | null) => {
        if (!range || !rsiChart || isSyncingRange) {
          return;
        }

        isSyncingRange = true;
        rsiChart.timeScale().setVisibleLogicalRange(range);
        requestAnimationFrame(() => {
          isSyncingRange = false;
        });
      };
      const syncFromRSI = (range: { from: number; to: number } | null) => {
        if (!range || !candleChart || isSyncingRange) {
          return;
        }

        isSyncingRange = true;
        candleChart.timeScale().setVisibleLogicalRange(range);
        requestAnimationFrame(() => {
          isSyncingRange = false;
        });
      };
      const syncCrosshairFromCandles = (param: MouseEventParams<Time>) => {
        if (
          !param.time ||
          !rsiChart ||
          !rsiSeries ||
          isSyncingCrosshair
        ) {
          rsiChart?.clearCrosshairPosition();
          return;
        }

        const value = rsiByTime.get(Number(param.time));

        if (typeof value !== 'number') {
          rsiChart.clearCrosshairPosition();
          return;
        }

        isSyncingCrosshair = true;
        rsiChart.setCrosshairPosition(value, param.time, rsiSeries);
        requestAnimationFrame(() => {
          isSyncingCrosshair = false;
        });
      };
      const syncCrosshairFromRSI = (param: MouseEventParams<Time>) => {
        if (
          !param.time ||
          !candleChart ||
          !candleSeries ||
          isSyncingCrosshair
        ) {
          candleChart?.clearCrosshairPosition();
          return;
        }

        const value = closeByTime.get(Number(param.time));

        if (typeof value !== 'number') {
          candleChart.clearCrosshairPosition();
          return;
        }

        isSyncingCrosshair = true;
        candleChart.setCrosshairPosition(value, param.time, candleSeries);
        requestAnimationFrame(() => {
          isSyncingCrosshair = false;
        });
      };

      candleChart
        .timeScale()
        .subscribeVisibleLogicalRangeChange(syncFromCandles);
      rsiChart?.timeScale().subscribeVisibleLogicalRangeChange(syncFromRSI);
      candleChart.subscribeCrosshairMove(syncCrosshairFromCandles);
      rsiChart?.subscribeCrosshairMove(syncCrosshairFromRSI);

      const visibleCandles = Math.min(90, candleData.length);
      const visibleRange = {
        from: Math.max(candleData.length - visibleCandles, 0),
        to: candleData.length + 6,
      };

      candleChart.timeScale().setVisibleLogicalRange(visibleRange);
      rsiChart?.timeScale().setVisibleLogicalRange(visibleRange);
    };

    void setupCharts();

    return () => {
      isDisposed = true;
      candleChart?.remove();
      rsiChart?.remove();
    };
  }, [
    candleData,
    candleHeight,
    currency,
    overlayData,
    rsiData,
    rsiHeight,
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
          <NativeRSIFallback candles={candles} rsiPeriod={rsiPeriod} />
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
          height,
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
    <View style={{ gap: panelGap }}>
      <View
        ref={(node) => {
          candleContainerRef.current = node as unknown as HTMLElement | null;
        }}
        style={{
          backgroundColor: '#070B12',
          borderColor: theme.colors.border,
          borderTopLeftRadius: theme.radius.card,
          borderTopRightRadius: theme.radius.card,
          borderWidth: 1,
          height: candleHeight,
          overflow: 'hidden',
          width,
        }}
      />
      {showRSI ? (
        <View style={{ height: rsiHeight, position: 'relative', width }}>
          <View
            ref={(node) => {
              rsiContainerRef.current = node as unknown as HTMLElement | null;
            }}
            style={{
              backgroundColor: '#070B12',
              borderBottomLeftRadius: theme.radius.card,
              borderBottomRightRadius: theme.radius.card,
              borderColor: theme.colors.border,
              borderWidth: 1,
              height: rsiHeight,
              overflow: 'hidden',
              width,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              left: 14,
              position: 'absolute',
              right: 14,
              top: 10,
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
        </View>
      ) : null}
    </View>
  );
}

function buildRSIData(candles: NormalizedCandle[], period: number) {
  const closes = candles.map((candle) => candle.close);
  const rsiValues = calculateRSI(closes, period);

  return rsiValues.map((value, index) => {
    const time = candles[index].time as Time;

    if (typeof value !== 'number') {
      return { time };
    }

    return { time, value };
  });
}

function buildMovingAverageData(points: LineSeriesPoint[], period: number) {
  const averages = calculateNullableSMA(
    points.map((point) => ('value' in point ? point.value : null)),
    period
  );

  return averages.map((value, index) => {
    const time = points[index].time;

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
      background: { color: '#070B12' },
      textColor: '#94A3B8',
    },
    grid: {
      horzLines: { color: 'rgba(148, 163, 184, 0.11)' },
      vertLines: { color: 'rgba(148, 163, 184, 0.09)' },
    },
    rightPriceScale: {
      borderColor: '#263348',
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

function clearElement(element: HTMLElement) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function NativeRSIFallback({
  candles,
  rsiPeriod,
}: {
  candles: Candle[];
  rsiPeriod: number;
}) {
  const values = calculateRSI(
    normalizeCandles(candles).map((candle) => candle.close),
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
