import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import { useWatchlist } from './src/hooks';
import { SearchScreen, WatchlistScreen } from './src/screens';
import { mockWatchlistAssets } from './src/utils';

type TabKey = 'watchlist' | 'search';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('watchlist');
  const { watchlist, isLoading, error, addAsset, removeAsset } =
    useWatchlist(mockWatchlistAssets);

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <StatusBar style="dark" />
      <View
        style={{
          backgroundColor: '#F8FAFC',
          flexDirection: 'row',
          gap: 12,
          paddingHorizontal: 24,
          paddingTop: 56,
          paddingBottom: 12,
        }}
      >
        {[
          { key: 'watchlist', label: 'Watchlist' },
          { key: 'search', label: 'Buscar cripto' },
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
                  ? '#0F172A'
                  : pressed
                    ? '#E2E8F0'
                    : '#FFFFFF',
                borderColor: '#CBD5E1',
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 16,
                paddingVertical: 10,
              })}
            >
              <Text
                selectable
                style={{
                  color: isActive ? '#FFFFFF' : '#334155',
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
          onRemoveAsset={removeAsset}
          watchlist={watchlist}
        />
      ) : (
        <SearchScreen onAddAsset={addAsset} watchlist={watchlist} />
      )}
    </View>
  );
}
