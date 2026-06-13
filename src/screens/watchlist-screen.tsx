import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  AssetCard,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionTitle,
} from '../components';
import { getBrazilianStockQuote, getCryptoQuote } from '../services';
import type { Asset } from '../types';

type WatchlistScreenProps = {
  watchlist: Asset[];
  isLoading: boolean;
  error: string | null;
  onRemoveAsset: (assetId: string) => Promise<void>;
  onSelectAsset: (asset: Asset) => void;
};

export function WatchlistScreen({
  watchlist,
  isLoading,
  error,
  onRemoveAsset,
  onSelectAsset,
}: WatchlistScreenProps) {
  const [displayAssets, setDisplayAssets] = useState<Asset[]>(watchlist);
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const refreshQuotes = async () => {
      setDisplayAssets(watchlist);

      const cryptoAssets = watchlist.filter((asset) => asset.type === 'crypto');
      const stockAssets = watchlist.filter((asset) => asset.type === 'stock');

      if (cryptoAssets.length === 0 && stockAssets.length === 0) {
        setRefreshError(null);
        setIsRefreshingQuotes(false);
        return;
      }

      setIsRefreshingQuotes(true);
      setRefreshError(null);

      const quoteResults = await Promise.allSettled(
        watchlist.map(async (asset) => {
          if (asset.type === 'crypto') {
            return {
              assetId: asset.id,
              quote: await getCryptoQuote(asset.coingeckoId ?? asset.id),
            };
          }

          return {
            assetId: asset.id,
            quote: await getBrazilianStockQuote(asset.symbol),
          };
        })
      );

      if (!isMounted) {
        return;
      }

      const successfulQuotes = new Map(
        quoteResults
          .filter((result): result is PromiseFulfilledResult<{
            assetId: string;
            quote: Asset['quote'];
          }> => result.status === 'fulfilled')
          .map((result) => [result.value.assetId, result.value.quote])
      );

      const updatedAssets = watchlist.map((asset) => ({
        ...asset,
        quote: successfulQuotes.get(asset.id) ?? asset.quote,
      }));

      setDisplayAssets(updatedAssets);
      setIsRefreshingQuotes(false);

      if (quoteResults.some((result) => result.status === 'rejected')) {
        setRefreshError(
          'Nem todas as cotacoes puderam ser atualizadas agora.'
        );
      }
    };

    void refreshQuotes();

    return () => {
      isMounted = false;
    };
  }, [watchlist]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        backgroundColor: '#F8FAFC',
        flexGrow: 1,
        gap: 24,
        padding: 24,
      }}
      style={{ flex: 1, backgroundColor: '#F8FAFC' }}
    >
      <SectionTitle
        title="MarketPulse"
        subtitle="Acompanhe sua watchlist de acoes brasileiras e criptomoedas em um so lugar."
      />

      <View style={{ gap: 12 }}>
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text
            selectable
            style={{
              color: '#0F172A',
              fontSize: 16,
              fontWeight: '600',
            }}
          >
            Minha watchlist
          </Text>

          {isRefreshingQuotes ? (
            <Text selectable style={{ color: '#475569', fontSize: 13 }}>
              Atualizando precos...
            </Text>
          ) : null}
        </View>

        {refreshError ? <ErrorState message={refreshError} /> : null}

        {isLoading ? (
          <LoadingState message="Carregando sua watchlist local..." />
        ) : error ? (
          <ErrorState message={error} />
        ) : displayAssets.length > 0 ? (
          displayAssets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onRemove={(assetId) => {
                void onRemoveAsset(assetId);
              }}
              onPress={onSelectAsset}
            />
          ))
        ) : (
          <EmptyState
            title="Nenhum ativo ainda"
            message="Sua watchlist local esta vazia. Os proximos ativos salvos vao aparecer aqui."
          />
        )}
      </View>
    </ScrollView>
  );
}
