import { Pressable, Text, View } from 'react-native';

import type { Asset } from '../../types';
import { theme } from '../../utils';

type AssetCardProps = {
  asset: Asset;
  isDragging?: boolean;
  onLongPress?: () => void;
  onRemove?: (assetId: string) => void;
  onPress?: (asset: Asset) => void;
};

export function AssetCard({
  asset,
  isDragging = false,
  onLongPress,
  onRemove,
  onPress,
}: AssetCardProps) {
  const isPositive = asset.quote.change >= 0;
  const changeColor = isPositive ? theme.colors.success : theme.colors.danger;
  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: asset.quote.currency,
  }).format(asset.quote.price);
  const formattedChange = `${isPositive ? '+' : ''}${asset.quote.changePercent.toFixed(2)}%`;

  return (
    <Pressable
      delayLongPress={220}
      onLongPress={onLongPress}
      onPress={() => onPress?.(asset)}
      style={({ pressed }) => ({
        backgroundColor: isDragging
          ? theme.colors.surfaceElevated
          : theme.colors.surface,
        borderColor: isDragging ? theme.colors.primary : theme.colors.border,
        borderRadius: theme.radius.card,
        borderWidth: 1,
        gap: 14,
        opacity: pressed && !isDragging ? 0.9 : isDragging ? 0.92 : 1,
        padding: 18,
        transform: [{ scale: isDragging ? 1.02 : 1 }],
        boxShadow: isDragging
          ? '0 16px 36px rgba(56, 189, 248, 0.18)'
          : '0 8px 24px rgba(0, 0, 0, 0.12)',
      })}
    >
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            selectable={false}
            style={{
              color: theme.colors.text,
              fontSize: 18,
              fontWeight: '700',
            }}
          >
            {asset.symbol}
          </Text>
          <Text
            selectable={false}
            style={{
              color: theme.colors.textMuted,
              fontSize: 14,
            }}
          >
            {asset.name}
          </Text>
        </View>

        <View
          style={{
            backgroundColor:
              asset.type === 'crypto'
                ? theme.colors.warningSoft
                : theme.colors.primarySoft,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text
            selectable={false}
            style={{
              color:
                asset.type === 'crypto'
                  ? theme.colors.warning
                  : theme.colors.primary,
              fontSize: 12,
              fontWeight: '600',
              textTransform: 'uppercase',
            }}
          >
            {asset.type}
          </Text>
        </View>
      </View>

      <View
        style={{
          alignItems: 'flex-end',
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            selectable={false}
            style={{
              color: theme.colors.text,
              fontSize: 22,
              fontVariant: ['tabular-nums'],
              fontWeight: '700',
            }}
          >
            {formattedPrice}
          </Text>
          <Text
            selectable={false}
            style={{
              color: changeColor,
              fontSize: 15,
              fontVariant: ['tabular-nums'],
              fontWeight: '700',
            }}
          >
            {formattedChange}
          </Text>
        </View>

        {onRemove ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onRemove(asset.id);
            }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#7F1D1D' : theme.colors.dangerSoft,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 10,
            })}
          >
            <Text
              selectable={false}
              style={{
                color: theme.colors.danger,
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              Remover
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}
