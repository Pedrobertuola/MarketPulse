export type AssetType = 'stock' | 'crypto';

export type PriceQuote = {
  price: number;
  change: number;
  changePercent: number;
  currency: 'BRL' | 'USD';
  updatedAt: string;
  volume?: number;
};

export type Asset = {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  exchange?: string;
  coingeckoId?: string;
  imageUrl?: string;
  quote: PriceQuote;
};

export type Candle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type BrazilianStockSearchResult = {
  ticker: string;
  name: string;
  imageUrl?: string;
  type: 'stock';
};

export type ChartPoint = {
  timestamp: string;
  price: number;
  marketCap?: number;
  volume?: number;
};

export type CryptoSearchResult = {
  id: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  marketCapRank?: number;
  type: 'crypto';
};
