import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { Candle } from '../types';
import { theme } from '../utils';

type OverlaySeries = {
  color: string;
  values: Array<number | null>;
};

type CandlestickChartProps = {
  candles: Candle[];
  currency: 'BRL' | 'USD';
  overlays?: OverlaySeries[];
};

const chartHeight = 360;
const minVisibleCandles = 12;
const maxVisibleCandles = 90;

export function CandlestickChart({
  candles,
  currency,
  overlays = [],
}: CandlestickChartProps) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(300, windowWidth - 48);
  const [visibleCount, setVisibleCount] = useState(46);
  const [offsetFromEnd, setOffsetFromEnd] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const gestureStart = useRef({ offsetFromEnd: 0, visibleCount: 46, distance: 0 });

  useEffect(() => {
    setOffsetFromEnd(0);
    setSelectedIndex(null);
    setVisibleCount((currentVisibleCount) =>
      clamp(
        currentVisibleCount,
        minVisibleCandles,
        Math.min(maxVisibleCandles, candles.length || maxVisibleCandles)
      )
    );
  }, [candles.length]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          gestureStart.current = {
            offsetFromEnd,
            visibleCount,
            distance: getTouchDistance(event.nativeEvent.touches),
          };
        },
        onPanResponderMove: (event, gestureState) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            const distance = getTouchDistance(touches);
            const startDistance = gestureStart.current.distance || distance;
            const zoomRatio = startDistance / Math.max(distance, 1);
            const nextVisibleCount = clamp(
              Math.round(gestureStart.current.visibleCount * zoomRatio),
              minVisibleCandles,
              Math.min(maxVisibleCandles, candles.length || maxVisibleCandles)
            );

            setVisibleCount(nextVisibleCount);
            return;
          }

          const candleWidth = width / Math.max(visibleCount, 1);
          const nextOffset = clamp(
            gestureStart.current.offsetFromEnd +
              Math.round(-gestureState.dx / Math.max(candleWidth, 1)),
            0,
            Math.max(candles.length - visibleCount, 0)
          );

          setOffsetFromEnd(nextOffset);
          setSelectedIndex(getIndexFromX(event.nativeEvent.locationX));
        },
        onPanResponderRelease: (event) => {
          setSelectedIndex(getIndexFromX(event.nativeEvent.locationX));
        },
      }),
    [candles.length, offsetFromEnd, visibleCount, width]
  );

  const visibleRange = useMemo(() => {
    const end = Math.max(candles.length - offsetFromEnd, 0);
    const start = Math.max(end - visibleCount, 0);
    return { start, end };
  }, [candles.length, offsetFromEnd, visibleCount]);

  const visibleCandles = useMemo(
    () => candles.slice(visibleRange.start, visibleRange.end),
    [candles, visibleRange.end, visibleRange.start]
  );

  const priceRange = useMemo(() => {
    const values = visibleCandles.flatMap((candle) => [candle.high, candle.low]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min || 1) * 0.08;

    return {
      min: min - padding,
      max: max + padding,
    };
  }, [visibleCandles]);

  function getIndexFromX(x: number) {
    if (visibleCandles.length === 0) {
      return null;
    }

    const localIndex = clamp(
      Math.floor((x / width) * visibleCandles.length),
      0,
      visibleCandles.length - 1
    );

    return visibleRange.start + localIndex;
  }

  function priceToY(price: number) {
    const range = priceRange.max - priceRange.min || 1;
    return ((priceRange.max - price) / range) * chartHeight;
  }

  const candleSlot = width / Math.max(visibleCandles.length, 1);
  const candleBodyWidth = Math.max(4, Math.min(candleSlot * 0.62, 14));
  const selectedCandle =
    selectedIndex !== null ? candles[selectedIndex] ?? null : null;
  const currentPrice = candles[candles.length - 1]?.close;
  const currentPriceY =
    typeof currentPrice === 'number' ? priceToY(currentPrice) : null;

  if (candles.length === 0) {
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
      style={{
        backgroundColor: '#070B12',
        borderColor: theme.colors.border,
        borderRadius: theme.radius.card,
        borderWidth: 1,
        overflow: 'hidden',
      }}
      {...panResponder.panHandlers}
    >
      <Svg height={chartHeight} width={width}>
        {[0.2, 0.4, 0.6, 0.8].map((position) => {
          const y = chartHeight * position;

          return (
            <Line
              key={position}
              stroke="#172033"
              strokeDasharray="3 8"
              strokeWidth={1}
              x1={0}
              x2={width}
              y1={y}
              y2={y}
            />
          );
        })}

        {overlays.map((overlay, index) => {
          const path = buildOverlayPath(
            overlay.values.slice(visibleRange.start, visibleRange.end),
            priceToY,
            candleSlot
          );

          return path ? (
            <Path
              key={`${overlay.color}-${index}`}
              d={path}
              fill="none"
              opacity={0.92}
              stroke={overlay.color}
              strokeLinecap="round"
              strokeWidth={1.5}
            />
          ) : null;
        })}

        {visibleCandles.map((candle, index) => {
          const x = index * candleSlot + candleSlot / 2;
          const openY = priceToY(candle.open);
          const closeY = priceToY(candle.close);
          const highY = priceToY(candle.high);
          const lowY = priceToY(candle.low);
          const isUp = candle.close >= candle.open;
          const color = isUp ? '#22C55E' : '#F43F5E';
          const bodyY = Math.min(openY, closeY);
          const bodyHeight = Math.max(Math.abs(closeY - openY), 2);

          return (
            <Fragment key={`${candle.timestamp}-${index}`}>
              <Line
                stroke={color}
                strokeWidth={1.4}
                x1={x}
                x2={x}
                y1={highY}
                y2={lowY}
              />
              <Rect
                fill={color}
                height={bodyHeight}
                rx={1.5}
                width={candleBodyWidth}
                x={x - candleBodyWidth / 2}
                y={bodyY}
              />
            </Fragment>
          );
        })}

        {currentPriceY !== null ? (
          <>
            <Line
              stroke={theme.colors.primary}
              strokeDasharray="4 6"
              strokeWidth={1}
              x1={0}
              x2={width}
              y1={currentPriceY}
              y2={currentPriceY}
            />
            <Rect
              fill={theme.colors.primary}
              height={24}
              rx={4}
              width={78}
              x={Math.max(width - 82, 0)}
              y={clamp(currentPriceY - 12, 2, chartHeight - 26)}
            />
            <SvgText
              fill="#03121D"
              fontSize={11}
              fontWeight="700"
              textAnchor="middle"
              x={Math.max(width - 43, 39)}
              y={clamp(currentPriceY + 4, 18, chartHeight - 10)}
            >
              {formatPrice(currentPrice, currency)}
            </SvgText>
          </>
        ) : null}

        {selectedIndex !== null && selectedIndex >= visibleRange.start ? (
          <Crosshair
            candleSlot={candleSlot}
            index={selectedIndex - visibleRange.start}
            y={selectedCandle ? priceToY(selectedCandle.close) : chartHeight / 2}
          />
        ) : null}
      </Svg>

      {selectedCandle ? (
        <View
          style={{
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            gap: 6,
            padding: 12,
          }}
        >
          <Text selectable style={{ color: theme.colors.text, fontWeight: '800' }}>
            {new Date(selectedCandle.timestamp).toLocaleString('pt-BR')}
          </Text>
          <Text selectable style={{ color: theme.colors.textMuted, fontSize: 12 }}>
            A {formatPrice(selectedCandle.open, currency)}  M{' '}
            {formatPrice(selectedCandle.high, currency)}  m{' '}
            {formatPrice(selectedCandle.low, currency)}  F{' '}
            {formatPrice(selectedCandle.close, currency)}
          </Text>
          <Text selectable style={{ color: theme.colors.textSubtle, fontSize: 12 }}>
            Volume {formatCompact(selectedCandle.volume)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Crosshair({
  candleSlot,
  index,
  y,
}: {
  candleSlot: number;
  index: number;
  y: number;
}) {
  const x = index * candleSlot + candleSlot / 2;

  return (
    <>
      <Line
        stroke="#CBD5E1"
        strokeDasharray="3 6"
        strokeWidth={1}
        x1={x}
        x2={x}
        y1={0}
        y2={chartHeight}
      />
      <Line
        stroke="#CBD5E1"
        strokeDasharray="3 6"
        strokeWidth={1}
        x1={0}
        x2={9999}
        y1={y}
        y2={y}
      />
    </>
  );
}

function buildOverlayPath(
  values: Array<number | null>,
  priceToY: (price: number) => number,
  candleSlot: number
) {
  const commands: string[] = [];

  values.forEach((value, index) => {
    if (typeof value !== 'number') {
      return;
    }

    const x = index * candleSlot + candleSlot / 2;
    const y = priceToY(value);
    commands.push(`${commands.length === 0 ? 'M' : 'L'} ${x} ${y}`);
  });

  return commands.join(' ');
}

function getTouchDistance(touches: ArrayLike<{ pageX: number; pageY: number }>) {
  if (touches.length < 2) {
    return 0;
  }

  const first = touches[0];
  const second = touches[1];
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatPrice(value: number, currency: 'BRL' | 'USD') {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'pt-BR', {
    currency,
    maximumFractionDigits: currency === 'USD' ? 2 : 2,
    style: 'currency',
  }).format(value);
}

function formatCompact(value?: number) {
  if (typeof value !== 'number') {
    return 'indisponivel';
  }

  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
    notation: 'compact',
  }).format(value);
}
