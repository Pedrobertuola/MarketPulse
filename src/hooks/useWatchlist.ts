import { useEffect, useState } from 'react';

import {
  addAssetToWatchlist,
  getWatchlist,
  isAssetInWatchlist,
  moveAssetInWatchlist,
  removeAssetFromWatchlist,
  saveWatchlist,
} from '../storage/watchlistStorage';
import type { Asset } from '../types';

type UseWatchlistResult = {
  watchlist: Asset[];
  isLoading: boolean;
  error: string | null;
  addAsset: (asset: Asset) => Promise<void>;
  removeAsset: (assetId: string) => Promise<void>;
  moveAsset: (assetId: string, direction: 'up' | 'down') => Promise<void>;
  reorderAssets: (assets: Asset[]) => Promise<void>;
  containsAsset: (assetId: string) => Promise<boolean>;
  reloadWatchlist: () => Promise<void>;
};

export function useWatchlist(initialAssets: Asset[] = []): UseWatchlistResult {
  const [watchlist, setWatchlist] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWatchlist = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const storedAssets = await getWatchlist();

      if (storedAssets.length === 0 && initialAssets.length > 0) {
        await saveWatchlist(initialAssets);
        setWatchlist(initialAssets);
      } else {
        setWatchlist(storedAssets);
      }
    } catch {
      setError('Nao foi possivel carregar a watchlist local.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWatchlist();
  }, []);

  const addAsset = async (asset: Asset) => {
    setError(null);

    try {
      const updatedWatchlist = await addAssetToWatchlist(asset);
      setWatchlist(updatedWatchlist);
    } catch {
      setError('Nao foi possivel salvar o ativo na watchlist.');
    }
  };

  const removeAsset = async (assetId: string) => {
    setError(null);

    try {
      const updatedWatchlist = await removeAssetFromWatchlist(assetId);
      setWatchlist(updatedWatchlist);
    } catch {
      setError('Nao foi possivel remover o ativo da watchlist.');
    }
  };

  const moveAsset = async (assetId: string, direction: 'up' | 'down') => {
    setError(null);

    try {
      const updatedWatchlist = await moveAssetInWatchlist(assetId, direction);
      setWatchlist(updatedWatchlist);
    } catch {
      setError('Nao foi possivel reordenar a watchlist.');
    }
  };

  const reorderAssets = async (assets: Asset[]) => {
    setError(null);

    try {
      await saveWatchlist(assets);
      setWatchlist(assets);
    } catch {
      setError('Nao foi possivel reordenar a watchlist.');
    }
  };

  const containsAsset = async (assetId: string) => {
    return isAssetInWatchlist(assetId);
  };

  return {
    watchlist,
    isLoading,
    error,
    addAsset,
    removeAsset,
    moveAsset,
    reorderAssets,
    containsAsset,
    reloadWatchlist: loadWatchlist,
  };
}
