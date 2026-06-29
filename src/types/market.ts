export type AssetType =
  | 'crypto'
  | 'brazilian_stock'
  | 'forex'
  | 'global_stock'
  | 'stock';

export type AlertRuleType =
  | 'price_above'
  | 'price_below'
  | 'rsi_below_30'
  | 'rsi_above_70';

export type PriceQuote = {
  price: number;
  change: number;
  changePercent: number;
  currency: 'BRL' | 'USD';
  updatedAt: string;
  volume?: number;
  marketCap?: number;
  dayHigh?: number;
  dayLow?: number;
  dividendYield?: number;
  financialVolume?: number;
  stale?: boolean;
};

export type Asset = {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  exchange?: string;
  marketSymbol?: string;
  imageUrl?: string;
  quote: PriceQuote;
};

export type AlertRule = {
  id: string;
  assetId: string;
  assetSymbol: string;
  assetName: string;
  type: AlertRuleType;
  targetValue: number;
  createdAt: string;
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
  type: 'brazilian_stock';
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
