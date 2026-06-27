# MarketPulse

MarketPulse e um app Expo com TypeScript para acompanhar acoes brasileiras e criptoativos em uma watchlist local. A arquitetura agora usa um backend proprio entre o app e as APIs externas:

```text
App MarketPulse -> Backend MarketPulse -> Finnhub / brapi.dev
```

Essa separacao evita expor tokens no frontend, centraliza normalizacao de dados e reduz chamadas externas com cache simples.

## Tecnologias

- Frontend: Expo SDK 56, React Native, TypeScript, AsyncStorage
- Backend: Node.js, Express, TypeScript
- Graficos: lightweight-charts no web e fallback nativo
- Dados externos: Finnhub e brapi.dev

## APIs Usadas

- Finnhub: cotacoes e candles de criptomoedas, forex e ativos globais. Criptomoedas sao exibidas em USD.
- brapi.dev: acoes brasileiras, FIIs, ETFs e BDRs. Ativos B3 sao exibidos em BRL.

Exemplos de cripto via Finnhub:

- `BINANCE:BTCUSDT`
- `BINANCE:ETHUSDT`
- `BINANCE:SOLUSDT`

Exemplos B3 via brapi.dev:

- `PETR4`
- `VALE3`
- `ITUB4`
- `BBAS3`

## Backend

O backend fica em `backend/` e expoe:

- `GET /api/search?query=BTC&type=crypto`
- `GET /api/quote?symbol=BINANCE:BTCUSDT&type=crypto`
- `GET /api/candles?symbol=BINANCE:BTCUSDT&type=crypto&timeframe=1D`
- `GET /api/quote?symbol=PETR4&type=brazilian_stock`
- `GET /api/candles?symbol=PETR4&type=brazilian_stock&timeframe=1D`

Formato de candle:

```json
{
  "time": 1719446400,
  "open": 60000,
  "high": 61000,
  "low": 59000,
  "close": 60500,
  "volume": 12345
}
```

Formato de quote:

```json
{
  "symbol": "BINANCE:BTCUSDT",
  "name": "Bitcoin",
  "type": "crypto",
  "currency": "USD",
  "price": 60500,
  "changePercent": 1.2,
  "updatedAt": "2026-06-27T12:00:00.000Z"
}
```

## Cache

O backend usa cache em memoria para reduzir chamadas externas:

- Quotes: 30 segundos
- Candles: 5 minutos
- Busca: 5 minutos

A chave segue o padrao `endpoint + symbol + type + timeframe`.

## Variaveis de Ambiente

Backend: copie `backend/.env.example` para `backend/.env`.

```bash
FINNHUB_API_KEY=
BRAPI_TOKEN=
PORT=3333
```

Frontend: copie `.env.example` para `.env`.

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3333
```

Nao coloque tokens reais no codigo. Tokens ficam apenas no backend.

## Como Rodar

Instale as dependencias do frontend:

```bash
npm install
```

Instale as dependencias do backend:

```bash
npm run backend:install
```

Rode o backend:

```bash
npm run backend:dev
```

Rode o frontend em outro terminal:

```bash
npm start
```

Para web:

```bash
npm run web
```

## Funcionalidades

- Watchlist local persistida no dispositivo
- Busca de criptomoedas via backend/Finnhub
- Busca de ativos brasileiros via backend/brapi.dev
- Tela de detalhe por ativo
- Grafico candlestick
- RSI 14, SMA 20, SMA 50 e Bandas de Bollinger
- Alertas locais para preco e RSI
- Cache no backend para reduzir consumo das APIs externas

## Decisoes Tecnicas

### Por que backend proprio

O backend esconde chaves, reduz chamadas repetidas, normaliza formatos diferentes de APIs externas e deixa o frontend com um contrato unico.

### Por que Finnhub para cripto

Finnhub permite consultar simbolos globais padronizados, como `BINANCE:BTCUSDT`, e deixa cripto em USD de forma consistente.

### Por que brapi.dev para B3

brapi.dev e focada no mercado brasileiro e cobre tickers como PETR4, VALE3, ITUB4 e BBAS3.

### Por que manter indicadores no app

RSI, SMA e Bandas de Bollinger sao calculos deterministas sobre candles normalizados. Manter no app preserva responsividade e evita depender de indicadores externos.

## Seguranca

- O frontend nao chama Finnhub nem brapi.dev diretamente.
- `FINNHUB_API_KEY` e `BRAPI_TOKEN` ficam apenas no backend.
- `.env` nao deve ser versionado.
