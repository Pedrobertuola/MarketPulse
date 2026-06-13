export type BollingerBandPoint = {
  middle: number;
  upper: number;
  lower: number;
};

export function calculateSMA(values: number[], period: number): Array<number | null> {
  if (period <= 0) {
    return values.map(() => null);
  }

  const result: Array<number | null> = values.map(() => null);
  let rollingSum = 0;

  for (let index = 0; index < values.length; index += 1) {
    rollingSum += values[index];

    if (index >= period) {
      rollingSum -= values[index - period];
    }

    // SMA is the arithmetic mean of the latest "period" closing prices.
    if (index >= period - 1) {
      result[index] = rollingSum / period;
    }
  }

  return result;
}

export function calculateRSI(
  values: number[],
  period = 14
): Array<number | null> {
  if (period <= 0 || values.length <= period) {
    return values.map(() => null);
  }

  const result: Array<number | null> = values.map(() => null);
  let averageGain = 0;
  let averageLoss = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];

    if (change >= 0) {
      averageGain += change;
    } else {
      averageLoss += Math.abs(change);
    }
  }

  averageGain /= period;
  averageLoss /= period;

  // RSI compares average gains and losses. After the first window, Wilder's
  // smoothing keeps the indicator aligned with each closing price.
  result[period] = calculateRSIValue(averageGain, averageLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;

    result[index] = calculateRSIValue(averageGain, averageLoss);
  }

  return result;
}

export function calculateBollingerBands(
  values: number[],
  period = 20,
  multiplier = 2
): Array<BollingerBandPoint | null> {
  if (period <= 0) {
    return values.map(() => null);
  }

  const result: Array<BollingerBandPoint | null> = values.map(() => null);

  for (let index = period - 1; index < values.length; index += 1) {
    const windowValues = values.slice(index - period + 1, index + 1);
    const middle =
      windowValues.reduce((sum, value) => sum + value, 0) / period;

    // Bollinger Bands place upper/lower bands around the SMA using standard
    // deviation, which expands during volatility and tightens during calm moves.
    const variance =
      windowValues.reduce((sum, value) => sum + (value - middle) ** 2, 0) /
      period;
    const standardDeviation = Math.sqrt(variance);

    result[index] = {
      middle,
      upper: middle + multiplier * standardDeviation,
      lower: middle - multiplier * standardDeviation,
    };
  }

  return result;
}

function calculateRSIValue(averageGain: number, averageLoss: number) {
  if (averageLoss === 0) {
    return 100;
  }

  if (averageGain === 0) {
    return 0;
  }

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}
