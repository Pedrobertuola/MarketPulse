import { Response, Router } from 'express';

import {
  getCandles,
  getQuote,
  searchAssets,
} from '../services/marketDataService';
import {
  MarketDataError,
  type MarketAssetType,
  type MarketTimeframe,
} from '../types/marketTypes';

export const marketRoutes = Router();

marketRoutes.get('/search', async (request, response) => {
  try {
    const query = getRequiredString(request.query.query, 'query');
    const type = parseAssetType(request.query.type);
    const results = await searchAssets(query, type);

    response.json({ results });
  } catch (error) {
    sendError(response, error);
  }
});

marketRoutes.get('/quote', async (request, response) => {
  try {
    const symbol = getRequiredString(request.query.symbol, 'symbol');
    const type = parseAssetType(request.query.type);
    const { value: quote, stale } = await getQuote(symbol, type);

    response.json({ quote: stale ? { ...quote, stale } : quote, stale });
  } catch (error) {
    sendError(response, error);
  }
});

marketRoutes.get('/candles', async (request, response) => {
  try {
    const symbol = getRequiredString(request.query.symbol, 'symbol');
    const type = parseAssetType(request.query.type);
    const timeframe = parseTimeframe(request.query.timeframe);
    const { value: candles, stale } = await getCandles(symbol, type, timeframe);

    response.json({ candles, stale });
  } catch (error) {
    sendError(response, error);
  }
});

function getRequiredString(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MarketDataError(`Parametro obrigatorio ausente: ${fieldName}.`, 400);
  }

  return value.trim();
}

function parseAssetType(value: unknown): MarketAssetType {
  if (
    value === 'crypto' ||
    value === 'brazilian_stock' ||
    value === 'forex' ||
    value === 'global_stock'
  ) {
    return value;
  }

  throw new MarketDataError('Tipo de ativo invalido.', 400);
}

function parseTimeframe(value: unknown): MarketTimeframe {
  if (
    value === '1D' ||
    value === '7D' ||
    value === '1W' ||
    value === '1M' ||
    value === '3M' ||
    value === '6M' ||
    value === '1Y' ||
    value === '2Y' ||
    value === 'MAX'
  ) {
    return value;
  }

  return '1D';
}

function sendError(response: Response, error: unknown) {
  if (error instanceof MarketDataError) {
    response.status(error.status).json({
      error: {
        message: error.message,
      },
    });
    return;
  }

  response.status(500).json({
    error: {
      message: 'Erro inesperado ao consultar dados de mercado.',
    },
  });
}
