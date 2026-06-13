import type { Asset } from '../types';

export const mockWatchlistAssets: Asset[] = [
  {
    id: 'petr4',
    symbol: 'PETR4',
    name: 'Petrobras PN',
    type: 'stock',
    exchange: 'B3',
    quote: {
      price: 38.42,
      change: 0.81,
      changePercent: 2.15,
      currency: 'BRL',
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: 'vale3',
    symbol: 'VALE3',
    name: 'Vale ON',
    type: 'stock',
    exchange: 'B3',
    quote: {
      price: 56.18,
      change: -0.34,
      changePercent: -0.6,
      currency: 'BRL',
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: 'bitcoin',
    coingeckoId: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    type: 'crypto',
    exchange: 'CoinGecko',
    quote: {
      price: 612345.78,
      change: -5421.33,
      changePercent: -0.88,
      currency: 'BRL',
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: 'ethereum',
    coingeckoId: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    type: 'crypto',
    exchange: 'CoinGecko',
    quote: {
      price: 18345.21,
      change: 215.77,
      changePercent: 1.19,
      currency: 'BRL',
      updatedAt: new Date().toISOString(),
    },
  },
];
