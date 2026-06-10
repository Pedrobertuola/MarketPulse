import { useEffect, useState } from 'react';

import {
  addAssetToWatchlist,
  getWatchlist,
  isAssetInWatchlist,
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

  const containsAsset = async (assetId: string) => {
    return isAssetInWatchlist(assetId);
  };

  return {
    watchlist,
    isLoading,
    error,
    addAsset,
    removeAsset,
    containsAsset,
    reloadWatchlist: loadWatchlist,
  };
}
