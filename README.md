# MarketPulse

> A mobile-first market monitoring app for cryptocurrencies and Brazilian stocks, built with React Native, Expo, TypeScript, and a dedicated Node.js backend.

<!-- Banner asset: replace `docs/assets/marketpulse-banner.png` with a final branded image if needed. -->

![MarketPulse Banner](docs/assets/marketpulse-banner.png)

![React Native](https://img.shields.io/badge/React%20Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![REST API](https://img.shields.io/badge/REST%20API-02569B?style=for-the-badge)

## About

MarketPulse is a mobile application designed for investors and traders who want to monitor cryptocurrencies and Brazilian stocks through a unified interface.

The project focuses on fast market monitoring, technical analysis, a mobile-first experience, and a clean architecture that separates the frontend from external market data providers.

## Features

| Feature | Description |
| --- | --- |
| Cryptocurrency monitoring | Track major crypto assets priced in USD. |
| Brazilian stocks | Monitor B3 assets through brapi.dev. |
| Interactive candlestick charts | Visualize OHLC price action with technical overlays. |
| RSI indicator | Analyze momentum with RSI 14 in a dedicated chart pane. |
| Watchlist | Save and monitor selected assets locally. |
| Drag & Drop watchlist | Reorder tracked assets with a smooth mobile interaction. |
| Multiple timeframes | Switch between supported market views. |
| Backend caching | Reduce external API calls and improve response consistency. |
| Responsive Web version | Run the app in a browser through Expo Web. |
| Android application | Built with Android support in mind through Expo. |

## Architecture

```text
Frontend (React Native + Expo)
        |
        v
Node.js Backend (Express REST API)
        |
        +--> Coinbase API (Crypto)
        |
        +--> brapi.dev (Brazilian Stocks)
```

MarketPulse uses a backend layer instead of calling external APIs directly from the mobile application.

This approach improves:

- **API security**: provider credentials and integration details remain outside the client bundle.
- **Caching**: repeated market data requests can be served from memory or local backend cache.
- **Provider abstraction**: the frontend consumes one internal API contract regardless of the upstream provider.
- **Future migration**: data providers can be replaced without rewriting application screens.

## Technologies

### Frontend

| Technology | Purpose |
| --- | --- |
| React Native | Cross-platform mobile UI. |
| Expo | Development workflow, Web support, and Android build path. |
| TypeScript | Static typing across the application. |
| AsyncStorage | Local watchlist persistence. |
| Lightweight Charts | Candlestick charts and technical indicator panes. |
| React Navigation | Mobile navigation architecture. |

### Backend

| Technology | Purpose |
| --- | --- |
| Node.js | Backend runtime. |
| Express | REST API server. |
| TypeScript | Typed backend services and API contracts. |
| REST API | Internal API consumed by the app. |
| Environment Variables | Runtime configuration and provider tokens. |
| Cache Layer | Memory and file-based caching for market data. |

## Technical Indicators

Technical indicators are calculated inside the application instead of relying on third-party indicator services. This keeps the charting experience consistent and avoids coupling UI behavior to external APIs.

Supported indicators include:

- **RSI 14**
- **SMA**
- **Bollinger Bands**

## Screenshots

| Screen | Preview |
| --- | --- |
| Home | `docs/screenshots/home.png` |
| Watchlist | `docs/screenshots/watchlist.png` |
| Candlestick Chart | `docs/screenshots/candlestick-chart.png` |
| RSI | `docs/screenshots/rsi.png` |
| Search | `docs/screenshots/search.png` |

## Running Locally

### Prerequisites

- Node.js
- npm
- Expo CLI workflow

### Environment Variables

Create a frontend `.env` file:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3333
```

Create a backend `backend/.env` file:

```bash
BRAPI_TOKEN=
PORT=3333
```

### Install Dependencies

```bash
npm install
npm run backend:install
```

### Start the Backend

```bash
npm run backend:dev
```

### Start the Frontend

```bash
npm start
```

### Run Web Version

```bash
npm run web
```

## Future Improvements

- Push notifications
- Price alerts
- MACD indicator
- EMA indicator
- Portfolio tracking
- Market news feed
- Multi-language support
- Dark and light themes

## Why I Built This

I built MarketPulse to create a real-world financial application that demonstrates clean architecture, API integration, data visualization, caching strategies, and mobile development skills in a single product-focused project.

## License

This project is licensed under the MIT License.
