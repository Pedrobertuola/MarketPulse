import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Asset } from '../types';

const WATCHLIST_STORAGE_KEY = '@marketpulse/watchlist';

function normalizeCryptoId(asset: Asset): string {
  if (asset.type !== 'crypto') {
    return asset.id;
  }

  if (asset.coingeckoId) {
    return asset.coingeckoId;
  }

  if (asset.symbol === 'BTC' || asset.id === 'btc') {
    return 'bitcoin';
  }

  if (asset.symbol === 'ETH' || asset.id === 'eth') {
    return 'ethereum';
  }

  return asset.id;
}

function normalizeAsset(asset: Asset): Asset {
  if (asset.type !== 'crypto') {
    return asset;
  }

  return {
    ...asset,
    coingeckoId: normalizeCryptoId(asset),
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
    (currentAsset) => normalizeCryptoId(currentAsset) === normalizeCryptoId(normalizedAsset)
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
  return currentWatchlist.some((asset) => normalizeCryptoId(asset) === assetId);
}
