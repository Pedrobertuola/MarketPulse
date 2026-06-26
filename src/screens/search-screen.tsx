import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { EmptyState, ErrorState, LoadingState, SectionTitle } from '../components';
import {
  getBrazilianStockQuote,
  getCryptoQuote,
  searchBrazilianStock,
  searchCrypto,
} from '../services';
import type { Asset, BrazilianStockSearchResult, CryptoSearchResult } from '../types';
import { theme } from '../utils';

type SearchScreenProps = {
  watchlist: Asset[];
  onAddAsset: (asset: Asset) => Promise<void>;
};

type SearchMode = 'crypto' | 'stock';

export function SearchScreen({ watchlist, onAddAsset }: SearchScreenProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('crypto');
  const [results, setResults] = useState<CryptoSearchResult[]>([]);
  const [stockResults, setStockResults] = useState<BrazilianStockSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingAssetId, setAddingAssetId] = useState<string | null>(null);

  const watchlistCryptoIds = new Set(
    watchlist
      .filter((asset) => asset.type === 'crypto')
      .map((asset) => asset.coingeckoId ?? asset.id)
  );

  const watchlistStockTickers = new Set(
    watchlist
      .filter((asset) => asset.type === 'stock')
      .map((asset) => asset.symbol.toUpperCase())
  );

  const handleSearch = async () => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      setResults([]);
      setStockResults([]);
      setError(
        mode === 'crypto'
          ? 'Digite o nome ou simbolo de uma criptomoeda para buscar.'
          : 'Digite um ticker da B3 para buscar.'
      );
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      if (mode === 'crypto') {
        const nextResults = await searchCrypto(normalizedQuery);
        setResults(nextResults);
        setStockResults([]);
      } else {
        const nextResults = await searchBrazilianStock(normalizedQuery);
        setStockResults(nextResults);
        setResults([]);
      }
    } catch {
      setError(
        mode === 'crypto'
          ? 'Nao foi possivel buscar criptomoedas agora.'
          : 'Nao foi possivel buscar esse ticker na brapi.dev.'
      );
      setResults([]);
      setStockResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAsset = async (result: CryptoSearchResult) => {
    setAddingAssetId(result.id);
    setError(null);

    try {
      const quote = await getCryptoQuote(result.id);

      await onAddAsset({
        id: result.id,
        coingeckoId: result.id,
        symbol: result.symbol,
        name: result.name,
        type: 'crypto',
        exchange: 'CoinGecko',
        imageUrl: result.imageUrl,
        quote,
      });
    } catch {
      setError('Nao foi possivel adicionar essa criptomoeda a watchlist.');
    } finally {
      setAddingAssetId(null);
    }
  };

  const handleAddStock = async (result: BrazilianStockSearchResult) => {
    setAddingAssetId(result.ticker);
    setError(null);

    try {
      const quote = await getBrazilianStockQuote(result.ticker);

      await onAddAsset({
        id: result.ticker.toLowerCase(),
        symbol: result.ticker,
        name: result.name,
        type: 'stock',
        exchange: 'B3',
        imageUrl: result.imageUrl,
        quote,
      });
    } catch {
      setError('Nao foi possivel adicionar essa acao a watchlist.');
    } finally {
      setAddingAssetId(null);
    }
  };

  const visibleResultsCount =
    mode === 'crypto' ? results.length : stockResults.length;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        backgroundColor: theme.colors.background,
        flexGrow: 1,
        gap: 20,
        padding: 24,
      }}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <SectionTitle
        title="Buscar ativos"
        subtitle="Procure criptomoedas no CoinGecko ou acoes brasileiras por ticker na brapi.dev."
      />

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { key: 'crypto', label: 'Criptos' },
            { key: 'stock', label: 'Acoes B3' },
          ].map((item) => {
            const isActive = mode === item.key;

            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  setMode(item.key as SearchMode);
                  setResults([]);
                  setStockResults([]);
                  setError(null);
                  setHasSearched(false);
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
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                })}
              >
                <Text
                  selectable
                  style={{
                    color: isActive ? '#03121D' : theme.colors.textMuted,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          onSubmitEditing={() => {
            void handleSearch();
          }}
          placeholder={
            mode === 'crypto'
              ? 'Ex.: bitcoin, ethereum, solana'
              : 'Ex.: PETR4, VALE3, ITUB4, BBAS3'
          }
          placeholderTextColor="#94A3B8"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 18,
            borderWidth: 1,
            color: theme.colors.text,
            fontSize: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
          value={query}
        />

        <Pressable
          onPress={() => {
            void handleSearch();
          }}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.primary,
            borderRadius: 18,
            paddingVertical: 14,
          })}
        >
          <Text
            selectable
            style={{ color: '#03121D', fontSize: 15, fontWeight: '800' }}
          >
            {mode === 'crypto' ? 'Buscar no CoinGecko' : 'Buscar na brapi.dev'}
          </Text>
        </Pressable>
      </View>

      {error ? <ErrorState message={error} /> : null}

      {isLoading ? (
        <LoadingState
          message={
            mode === 'crypto' ? 'Buscando criptomoedas...' : 'Buscando acoes...'
          }
        />
      ) : visibleResultsCount > 0 ? (
        <View style={{ gap: 12 }}>
          {mode === 'crypto' ? results.map((result) => {
            const isAdded = watchlistCryptoIds.has(result.id);
            const isAdding = addingAssetId === result.id;

            return (
              <View
                key={result.id}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: 20,
                  borderWidth: 1,
                  gap: 12,
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
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      selectable
                      style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}
                    >
                      {result.symbol}
                    </Text>
                    <Text selectable style={{ color: theme.colors.textMuted, fontSize: 14 }}>
                      {result.name}
                    </Text>
                    <Text selectable style={{ color: theme.colors.textSubtle, fontSize: 13 }}>
                      {result.marketCapRank
                        ? `Ranking de mercado #${result.marketCapRank}`
                        : 'Sem ranking disponivel'}
                    </Text>
                  </View>

                  <Pressable
                    disabled={isAdded || isAdding}
                    onPress={() => {
                      void handleAddAsset(result);
                    }}
                    style={({ pressed }) => ({
                      backgroundColor: isAdded
                        ? theme.colors.successSoft
                        : pressed
                          ? theme.colors.primarySoft
                          : theme.colors.surfaceElevated,
                      borderRadius: 999,
                      opacity: isAdding ? 0.7 : 1,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                    })}
                  >
                    <Text
                      selectable
                      style={{
                        color: isAdded ? theme.colors.success : theme.colors.primary,
                        fontSize: 13,
                        fontWeight: '700',
                      }}
                    >
                      {isAdded ? 'Adicionado' : isAdding ? 'Salvando...' : 'Adicionar'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          }) : stockResults.map((result) => {
            const isAdded = watchlistStockTickers.has(result.ticker);
            const isAdding = addingAssetId === result.ticker;

            return (
              <View
                key={result.ticker}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: 20,
                  borderWidth: 1,
                  gap: 12,
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
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      selectable
                      style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}
                    >
                      {result.ticker}
                    </Text>
                    <Text selectable style={{ color: theme.colors.textMuted, fontSize: 14 }}>
                      {result.name}
                    </Text>
                    <Text selectable style={{ color: theme.colors.textSubtle, fontSize: 13 }}>
                      B3
                    </Text>
                  </View>

                  <Pressable
                    disabled={isAdded || isAdding}
                    onPress={() => {
                      void handleAddStock(result);
                    }}
                    style={({ pressed }) => ({
                      backgroundColor: isAdded
                        ? theme.colors.successSoft
                        : pressed
                          ? theme.colors.primarySoft
                          : theme.colors.surfaceElevated,
                      borderRadius: 999,
                      opacity: isAdding ? 0.7 : 1,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                    })}
                  >
                    <Text
                      selectable
                      style={{
                        color: isAdded ? theme.colors.success : theme.colors.primary,
                        fontSize: 13,
                        fontWeight: '700',
                      }}
                    >
                      {isAdded ? 'Adicionado' : isAdding ? 'Salvando...' : 'Adicionar'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : hasSearched ? (
        <EmptyState
          title="Nenhum resultado encontrado"
          message={
            mode === 'crypto'
              ? 'Tente buscar por outro nome ou simbolo para encontrar a criptomoeda desejada.'
              : 'Digite um ticker valido da B3, como PETR4, VALE3, ITUB4 ou BBAS3.'
          }
        />
      ) : (
        <EmptyState
          title={mode === 'crypto' ? 'Busque uma criptomoeda' : 'Busque uma acao'}
          message={
            mode === 'crypto'
              ? 'Os resultados do CoinGecko vao aparecer aqui quando voce fizer sua primeira busca.'
              : 'Digite um ticker da B3 para consultar a brapi.dev.'
          }
        />
      )}
    </ScrollView>
  );
}
