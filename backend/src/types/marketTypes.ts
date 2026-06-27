export type MarketAssetType =
  | 'crypto'
  | 'brazilian_stock'
  | 'forex'
  | 'global_stock';

export type MarketCurrency = 'USD' | 'BRL';

export type MarketTimeframe = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '2Y';

export type MarketSearchResult = {
  symbol: string;
  displaySymbol: string;
  name: string;
  type: MarketAssetType;
  currency: MarketCurrency;
  exchange?: string;
};

export type MarketQuote = {
  symbol: string;
  name: string;
  type: MarketAssetType;
  currency: MarketCurrency;
  price: number;
  change?: number;
  changePercent?: number;
  updatedAt: string;
  volume?: number;
  marketCap?: number;
  dayHigh?: number;
  dayLow?: number;
  dividendYield?: number;
  financialVolume?: number;
};

export type MarketCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export class MarketDataError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
    this.name = 'MarketDataError';
  }
}
