import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Asset } from '../types';

const WATCHLIST_STORAGE_KEY = '@marketpulse/watchlist';

const legacyCryptoSymbols: Record<string, string> = {
  ada: 'cardano',
  avalanche: 'avalanche-2',
  avax: 'avalanche-2',
  bitcoin: 'bitcoin',
  bnb: 'binancecoin',
  btc: 'bitcoin',
  cardano: 'cardano',
  chainlink: 'chainlink',
  doge: 'dogecoin',
  dogecoin: 'dogecoin',
  dot: 'polkadot',
  eth: 'ethereum',
  ethereum: 'ethereum',
  link: 'chainlink',
  polkadot: 'polkadot',
  ripple: 'ripple',
  sol: 'solana',
  solana: 'solana',
  xrp: 'ripple',
};

function normalizeAssetKey(asset: Asset): string {
  if (asset.type !== 'crypto') {
    return (asset.marketSymbol ?? asset.symbol ?? asset.id).toUpperCase();
  }

  const rawSymbol = asset.marketSymbol ?? asset.coingeckoId ?? asset.symbol ?? asset.id;
  const normalizedSymbol = rawSymbol.trim().replace(/^crypto:/i, '').toLowerCase();
  const compactSymbol = normalizedSymbol.replace(/[^a-z0-9]/g, '');
  const directMatch =
    legacyCryptoSymbols[normalizedSymbol] ?? legacyCryptoSymbols[compactSymbol];

  if (directMatch) {
    return directMatch;
  }

  const embeddedMatch = isLegacyPairSymbol(compactSymbol)
    ? Object.keys(legacyCryptoSymbols).find((alias) =>
        compactSymbol.includes(alias)
      )
    : undefined;

  return embeddedMatch
    ? legacyCryptoSymbols[embeddedMatch]
    : normalizedSymbol;
}

function isLegacyPairSymbol(symbol: string) {
  return /(usd|usdt|brl|eur)$/.test(symbol);
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
    coingeckoId: marketSymbol,
    exchange: 'CoinGecko',
    id: `crypto:${marketSymbol}`,
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
