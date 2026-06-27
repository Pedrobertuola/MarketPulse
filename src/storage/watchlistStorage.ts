import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Asset } from '../types';

const WATCHLIST_STORAGE_KEY = '@marketpulse/watchlist';

const legacyCryptoSymbols: Record<string, string> = {
  bitcoin: 'BINANCE:BTCUSDT',
  btc: 'BINANCE:BTCUSDT',
  BTC: 'BINANCE:BTCUSDT',
  ethereum: 'BINANCE:ETHUSDT',
  eth: 'BINANCE:ETHUSDT',
  ETH: 'BINANCE:ETHUSDT',
  solana: 'BINANCE:SOLUSDT',
  sol: 'BINANCE:SOLUSDT',
  SOL: 'BINANCE:SOLUSDT',
};

function normalizeAssetKey(asset: Asset): string {
  if (asset.type !== 'crypto') {
    return (asset.marketSymbol ?? asset.symbol ?? asset.id).toUpperCase();
  }

  const rawSymbol = asset.marketSymbol ?? asset.coingeckoId ?? asset.symbol ?? asset.id;

  return (
    legacyCryptoSymbols[rawSymbol] ??
    legacyCryptoSymbols[rawSymbol.toLowerCase()] ??
    rawSymbol.toUpperCase()
  );
}

function normalizeAsset(asset: Asset): Asset {
  if (asset.type !== 'crypto') {
    return {
      ...asset,
      id: asset.id,
      marketSymbol: (asset.marketSymbol ?? asset.symbol).toUpperCase(),
      type: asset.type === 'stock' ? 'brazilian_stock' : asset.type,
    };
  }

  const marketSymbol = normalizeAssetKey(asset);

  return {
    ...asset,
    exchange: 'Finnhub',
    marketSymbol,
  };
}

export async function getWatchlist(): Promise<Asset[]> {
  const storedValue = await AsyncStorage.getItem(WATCHLIST_STORAGE_KEY);

  if (!storedValue) {
    return [];
  }

  try {
    return (JSON.parse(storedValue) as Asset[]).map(normalizeAsset);
  } catch {
    return [];
  }
}

export async function saveWatchlist(assets: Asset[]): Promise<void> {
  await AsyncStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(assets));
}

export async function addAssetToWatchlist(asset: Asset): Promise<Asset[]> {
  const currentWatchlist = await getWatchlist();
  const normalizedAsset = normalizeAsset(asset);
  const alreadyExists = currentWatchlist.some(
    (currentAsset) => normalizeAssetKey(currentAsset) === normalizeAssetKey(normalizedAsset)
  );

  if (alreadyExists) {
    return currentWatchlist;
  }

  const updatedWatchlist = [...currentWatchlist, normalizedAsset];
  await saveWatchlist(updatedWatchlist);
  return updatedWatchlist;
}

export async function removeAssetFromWatchlist(assetId: string): Promise<Asset[]> {
  const currentWatchlist = await getWatchlist();
  const updatedWatchlist = currentWatchlist.filter((asset) => asset.id !== assetId);

  await saveWatchlist(updatedWatchlist);
  return updatedWatchlist;
}

export async function moveAssetInWatchlist(
  assetId: string,
  direction: 'up' | 'down'
): Promise<Asset[]> {
  const currentWatchlist = await getWatchlist();
  const currentIndex = currentWatchlist.findIndex((asset) => asset.id === assetId);

  if (currentIndex === -1) {
    return currentWatchlist;
  }

  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (nextIndex < 0 || nextIndex >= currentWatchlist.length) {
    return currentWatchlist;
  }

  const updatedWatchlist = [...currentWatchlist];
  const [movedAsset] = updatedWatchlist.splice(currentIndex, 1);
  updatedWatchlist.splice(nextIndex, 0, movedAsset);

  await saveWatchlist(updatedWatchlist);
  return updatedWatchlist;
}

export async function isAssetInWatchlist(assetId: string): Promise<boolean> {
  const currentWatchlist = await getWatchlist();
  return currentWatchlist.some((asset) => normalizeAssetKey(asset) === assetId);
}
