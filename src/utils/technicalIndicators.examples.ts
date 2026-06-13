import {
  calculateBollingerBands,
  calculateRSI,
  calculateSMA,
} from './technicalIndicators';

const closingPrices = [
  10, 10.5, 10.2, 10.8, 11.1, 10.9, 11.4, 11.8, 11.6, 12, 12.4, 12.1, 12.8,
  13.2, 13, 13.4, 13.8, 13.5, 14, 14.3, 14.1,
];

export const technicalIndicatorExamples = {
  sma5: calculateSMA(closingPrices, 5),
  rsi14: calculateRSI(closingPrices, 14),
  bollinger20: calculateBollingerBands(closingPrices, 20, 2),
};

export const insufficientDataExamples = {
  sma20: calculateSMA([10, 11, 12], 20),
  rsi14: calculateRSI([10, 11, 12], 14),
  bollinger20: calculateBollingerBands([10, 11, 12], 20, 2),
};
