import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  DraggableAssetList,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionTitle,
} from '../components';
import {
  getBrazilianStockQuote,
  getCryptoQuote,
  resolveAssetMarketSymbol,
} from '../services';
import type { Asset } from '../types';
import { theme } from '../utils';

type WatchlistScreenProps = {
  watchlist: Asset[];
  isLoading: boolean;
  error: string | null;
  onReorderAssets: (assets: Asset[]) => Promise<void>;
  onRemoveAsset: (assetId: string) => Promise<void>;
  onSelectAsset: (asset: Asset) => void;
};

function getErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error && error.message ? error.message : fallbackMessage;
}

export function WatchlistScreen({
  watchlist,
  isLoading,
  error,
  onReorderAssets,
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
      const stockAssets = watchlist.filter((asset) => asset.type !== 'crypto');

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
              quote: await getCryptoQuote(resolveAssetMarketSymbol(asset)),
            };
          }

          return {
            assetId: asset.id,
            quote: await getBrazilianStockQuote(resolveAssetMarketSymbol(asset)),
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

      const rejectedQuote = quoteResults.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );

      if (rejectedQuote) {
        setRefreshError(
          getErrorMessage(
            rejectedQuote.reason,
            'Nem todas as cotacoes puderam ser atualizadas agora.'
          )
        );
      }
    };

    void refreshQuotes();

    return () => {
      isMounted = false;
    };
  }, [watchlist]);

  const header = (
    <View style={{ gap: 24 }}>
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
            gap: 12,
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              selectable
              style={{
                color: theme.colors.text,
                fontSize: 16,
                fontWeight: '600',
              }}
            >
              Minha watchlist
            </Text>
            <Text
              selectable
              style={{ color: theme.colors.textSubtle, fontSize: 12 }}
            >
              Toque para abrir detalhes. Segure um card e arraste para ordenar.
            </Text>
          </View>

          {isRefreshingQuotes ? (
            <Text selectable style={{ color: theme.colors.primary, fontSize: 13 }}>
              Atualizando precos...
            </Text>
          ) : null}
        </View>

        {refreshError ? <ErrorState message={refreshError} /> : null}
      </View>
    </View>
  );

  if (isLoading || error || displayAssets.length === 0) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          backgroundColor: theme.colors.background,
          flexGrow: 1,
          gap: 24,
          padding: 24,
        }}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        {header}
        {isLoading ? (
          <LoadingState message="Carregando sua watchlist local..." />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <EmptyState
            title="Nenhum ativo ainda"
            message="Sua watchlist local esta vazia. Os proximos ativos salvos vao aparecer aqui."
          />
        )}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <DraggableAssetList
        assets={displayAssets}
        listHeader={header}
        onRemoveAsset={(assetId) => {
          void onRemoveAsset(assetId);
        }}
        onReorderAssets={async (assets) => {
          setDisplayAssets(assets);
          await onReorderAssets(assets);
        }}
        onSelectAsset={onSelectAsset}
      />
    </View>
  );
}
