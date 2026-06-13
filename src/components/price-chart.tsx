import { Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

export type PriceChartPoint = {
  timestamp: string;
  value: number;
};

type PriceChartProps = {
  data: PriceChartPoint[];
  color?: string;
};

export function PriceChart({ data, color = '#0F766E' }: PriceChartProps) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(220, Math.min(windowWidth - 76, 692));
  const height = 220;
  const padding = 18;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const validData = data.filter((point) => Number.isFinite(point.value));

  if (validData.length < 2) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderColor: '#E2E8F0',
          borderRadius: 20,
          borderWidth: 1,
          height,
          justifyContent: 'center',
          padding: 18,
        }}
      >
        <Text selectable style={{ color: '#64748B', fontSize: 14 }}>
          Dados insuficientes para montar o grafico.
        </Text>
      </View>
    );
  }

  const values = validData.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const coordinates = validData.map((point, index) => {
    const x = padding + (index / (validData.length - 1)) * chartWidth;
    const y =
      padding + chartHeight - ((point.value - minValue) / range) * chartHeight;

    return { x, y };
  });

  const path = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const firstPoint = coordinates[0];
  const lastPoint = coordinates[coordinates.length - 1];

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 20,
        borderWidth: 1,
        gap: 10,
        padding: 14,
      }}
    >
      <Svg height={height} width={width}>
        {[0.25, 0.5, 0.75].map((position) => {
          const y = padding + chartHeight * position;

          return (
            <Line
              key={position}
              stroke="#E2E8F0"
              strokeDasharray="4 8"
              strokeWidth={1}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
            />
          );
        })}
        <Path
          d={path}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={3}
        />
        <Circle cx={firstPoint.x} cy={firstPoint.y} fill={color} r={4} />
        <Circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          fill="#FFFFFF"
          r={5}
          stroke={color}
          strokeWidth={3}
        />
      </Svg>
    </View>
  );
}
