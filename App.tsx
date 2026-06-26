import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useWatchlist } from './src/hooks';
import { AssetDetailScreen, SearchScreen, WatchlistScreen } from './src/screens';
import type { Asset } from './src/types';
import { mockWatchlistAssets, theme } from './src/utils';

type TabKey = 'watchlist' | 'search';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('watchlist');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const {
    watchlist,
    isLoading,
    error,
    addAsset,
    removeAsset,
    reorderAssets,
  } =
    useWatchlist(mockWatchlistAssets);

  if (selectedAsset) {
    return (
      <GestureHandlerRootView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <StatusBar style="light" />
        <AssetDetailScreen
          asset={selectedAsset}
          onBack={() => setSelectedAsset(null)}
        />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <StatusBar style="light" />
      <View
        style={{
          backgroundColor: theme.colors.background,
          flexDirection: 'row',
          gap: 12,
          paddingHorizontal: 24,
          paddingTop: 56,
          paddingBottom: 12,
        }}
      >
        {[
          { key: 'watchlist', label: 'Watchlist' },
          { key: 'search', label: 'Buscar ativos' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setActiveTab(tab.key as TabKey);
              }}
              style={({ pressed }) => ({
                backgroundColor: isActive
                  ? theme.colors.primary
                  : pressed
                    ? theme.colors.surfacePressed
                    : theme.colors.surface,
                borderColor: isActive ? theme.colors.primary : theme.colors.border,
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 16,
                paddingVertical: 10,
              })}
            >
              <Text
                selectable
                style={{
                  color: isActive ? '#03121D' : theme.colors.textMuted,
                  fontSize: 14,
                  fontWeight: '700',
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'watchlist' ? (
        <WatchlistScreen
          error={error}
          isLoading={isLoading}
          onReorderAssets={reorderAssets}
          onRemoveAsset={removeAsset}
          onSelectAsset={setSelectedAsset}
          watchlist={watchlist}
        />
      ) : (
        <SearchScreen onAddAsset={addAsset} watchlist={watchlist} />
      )}
    </GestureHandlerRootView>
  );
}
