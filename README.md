# MarketPulse

MarketPulse e um app Expo com TypeScript para acompanhar acoes brasileiras e criptoativos em uma watchlist local. A arquitetura usa um backend proprio entre o app e as APIs externas:

```text
App MarketPulse -> Backend MarketPulse -> Alpha Vantage / brapi.dev
```

Essa separacao evita expor tokens no frontend, centraliza a normalizacao dos dados e reduz chamadas externas com cache em memoria.

## Tecnologias

- Frontend: Expo SDK 56, React Native, TypeScript, AsyncStorage
- Backend: Node.js, Express, TypeScript
- Graficos: lightweight-charts no web e fallback nativo
- Dados externos: Alpha Vantage e brapi.dev

## APIs Usadas

- Alpha Vantage: cotacoes e historico diario de criptomoedas em USD.
- brapi.dev: acoes brasileiras, FIIs, ETFs e BDRs em BRL.

Criptomoedas principais aceitas pelo backend:

- `BTC`
- `ETH`
- `SOL`
- `BNB`
- `XRP`
- `ADA`
- `DOGE`
- `AVAX`
- `LINK`
- `DOT`

Exemplos B3 via brapi.dev:

- `PETR4`
- `VALE3`
- `ITUB4`
- `BBAS3`

## Backend

O backend fica em `backend/` e expoe:

- `GET /api/search?query=BTC&type=crypto`
- `GET /api/quote?symbol=BTC&type=crypto`
- `GET /api/candles?symbol=BTC&type=crypto&timeframe=1M`
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
  "symbol": "BTC",
  "name": "Bitcoin",
  "type": "crypto",
  "currency": "USD",
  "price": 60500,
  "changePercent": 1.2,
  "updatedAt": "2026-06-27T12:00:00.000Z"
}
```

Se o provider externo falhar e houver cache anterior, o backend retorna o ultimo dado conhecido com `stale: true`.

## Cache

O backend usa cache em memoria para proteger os limites das APIs externas:

- Quotes: 60 segundos
- Candles `1D`, `7D` e `1W`: 5 minutos
- Candles `1M`, `3M`, `6M`, `1Y`, `2Y` e `MAX`: 6 horas
- Busca: 5 minutos

A chave segue o padrao `endpoint + symbol + type + timeframe`.
Candles de cripto tambem sao persistidos em `backend/.cache/candles.json` para reaproveitar historico ja buscado e proteger o limite de chamadas da Alpha Vantage.

## Variaveis de Ambiente

Backend: copie `backend/.env.example` para `backend/.env`.

```bash
ALPHA_VANTAGE_API_KEY=
BRAPI_TOKEN=
PORT=3333
```

Frontend: copie `.env.example` para `.env`.

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3333
```

Nao coloque tokens reais no codigo. Tokens ficam apenas no backend. Depois de alterar `.env`, reinicie o backend e o servidor Expo.

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
- Busca de criptomoedas via backend/Alpha Vantage
- Busca de ativos brasileiros via backend/brapi.dev
- Tela de detalhe por ativo
- Grafico candlestick
- RSI 14, SMA 20, SMA 50 e Bandas de Bollinger
- Alertas locais para preco e RSI
- Cache no backend para reduzir consumo das APIs externas

## Decisoes Tecnicas

### Por que backend proprio

O backend esconde chaves, reduz chamadas repetidas, normaliza formatos diferentes de APIs externas e deixa o frontend com um contrato unico.

### Por que Alpha Vantage para cripto

Alpha Vantage entrega preco atual e historico diario de criptomoedas em USD por uma API server-side, mantendo a chave fora do frontend.

### Por que brapi.dev para B3

brapi.dev e focada no mercado brasileiro e cobre tickers como PETR4, VALE3, ITUB4 e BBAS3.

### Por que manter indicadores no app

RSI, SMA e Bandas de Bollinger sao calculos deterministas sobre candles normalizados. Manter no app preserva responsividade e evita depender de indicadores externos.

## Seguranca

- O frontend chama apenas o backend MarketPulse.
- `ALPHA_VANTAGE_API_KEY` e `BRAPI_TOKEN` ficam apenas no backend.
- `.env` nao deve ser versionado.
