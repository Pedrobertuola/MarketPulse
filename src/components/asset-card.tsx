import { Pressable, Text, View } from 'react-native';

import type { Asset } from '../types';

type AssetCardProps = {
  asset: Asset;
  onRemove?: (assetId: string) => void;
};

export function AssetCard({ asset, onRemove }: AssetCardProps) {
  const isPositive = asset.quote.change >= 0;
  const changeColor = isPositive ? '#15803D' : '#B91C1C';
  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: asset.quote.currency,
  }).format(asset.quote.price);

  const formattedChange = `${isPositive ? '+' : ''}${asset.quote.changePercent.toFixed(2)}%`;

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 20,
        borderWidth: 1,
        gap: 14,
        padding: 18,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            selectable
            style={{
              color: '#0F172A',
              fontSize: 18,
              fontWeight: '700',
            }}
          >
            {asset.symbol}
          </Text>
          <Text
            selectable
            style={{
              color: '#64748B',
              fontSize: 14,
            }}
          >
            {asset.name}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: asset.type === 'crypto' ? '#FEF3C7' : '#DBEAFE',
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text
            selectable
            style={{
              color: '#334155',
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
        }}
      >
        <View style={{ gap: 4 }}>
          <Text
            selectable
            style={{
              color: '#0F172A',
              fontSize: 22,
              fontVariant: ['tabular-nums'],
              fontWeight: '700',
            }}
          >
            {formattedPrice}
          </Text>
          <Text
            selectable
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
            onPress={() => onRemove(asset.id)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#FEE2E2' : '#FFF1F2',
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 10,
            })}
          >
            <Text
              selectable
              style={{
                color: '#B91C1C',
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              Remover
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
