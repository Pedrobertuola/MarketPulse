import { Pressable, Text, View } from 'react-native';

import { theme } from '../utils';

export type IndicatorVisibility = {
  rsi: boolean;
  sma20: boolean;
  sma50: boolean;
  bollinger: boolean;
};

type IndicatorSelectorProps = {
  value: IndicatorVisibility;
  onChange: (value: IndicatorVisibility) => void;
};

const indicatorOptions: Array<{
  key: keyof IndicatorVisibility;
  label: string;
}> = [
  { key: 'rsi', label: 'RSI' },
  { key: 'sma20', label: 'SMA 20' },
  { key: 'sma50', label: 'SMA 50' },
  { key: 'bollinger', label: 'Bollinger' },
];

export function IndicatorSelector({ value, onChange }: IndicatorSelectorProps) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {indicatorOptions.map((option) => {
        const isActive = value[option.key];

        return (
          <Pressable
            key={option.key}
            onPress={() =>
              onChange({
                ...value,
                [option.key]: !isActive,
              })
            }
            style={({ pressed }) => ({
              backgroundColor: isActive
                ? theme.colors.primary
                : pressed
                  ? theme.colors.surfacePressed
                  : theme.colors.surface,
              borderColor: isActive ? theme.colors.primary : theme.colors.border,
              borderRadius: theme.radius.pill,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 8,
            })}
          >
            <Text
              selectable
              style={{
                color: isActive ? '#03121D' : theme.colors.textMuted,
                fontSize: 12,
                fontWeight: '800',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
