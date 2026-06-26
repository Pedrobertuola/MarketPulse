import type React from 'react';
import DraggableFlatList, {
  OpacityDecorator,
  ScaleDecorator,
  ShadowDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';

import type { Asset } from '../../types';
import { theme } from '../../utils';
import { AssetCard } from './AssetCard';

type DraggableAssetListProps = {
  assets: Asset[];
  listFooter?: React.ReactElement | null;
  listHeader?: React.ReactElement | null;
  onReorderAssets: (assets: Asset[]) => Promise<void>;
  onRemoveAsset: (assetId: string) => void;
  onSelectAsset: (asset: Asset) => void;
};

export function DraggableAssetList({
  assets,
  listFooter,
  listHeader,
  onReorderAssets,
  onRemoveAsset,
  onSelectAsset,
}: DraggableAssetListProps) {
  const renderItem = ({ drag, isActive, item }: RenderItemParams<Asset>) => (
    <ScaleDecorator activeScale={1.03}>
      <ShadowDecorator color="#38BDF8" opacity={0.18} radius={24}>
        <OpacityDecorator activeOpacity={0.88}>
          <AssetCard
            asset={item}
            isDragging={isActive}
            onLongPress={drag}
            onPress={onSelectAsset}
            onRemove={onRemoveAsset}
          />
        </OpacityDecorator>
      </ShadowDecorator>
    </ScaleDecorator>
  );

  return (
    <DraggableFlatList
      activationDistance={8}
      autoscrollSpeed={90}
      autoscrollThreshold={90}
      containerStyle={{ flex: 1, backgroundColor: theme.colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        backgroundColor: theme.colors.background,
        flexGrow: 1,
        gap: 12,
        paddingBottom: 32,
        paddingHorizontal: 24,
        paddingTop: 24,
      }}
      data={assets}
      keyExtractor={(item) => item.id}
      ListFooterComponent={listFooter}
      ListHeaderComponent={listHeader}
      onDragEnd={({ data }) => {
        void onReorderAssets(data);
      }}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    />
  );
}
