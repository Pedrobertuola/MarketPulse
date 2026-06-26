# MarketPulse

MarketPulse e um app Expo com TypeScript para acompanhar acoes brasileiras e criptomoedas em uma watchlist local. O projeto combina cotacoes, historico de precos, indicadores tecnicos e alertas locais simples em uma interface mobile-first com tema escuro.

## Objetivo

Criar uma base de aplicativo financeiro clara, organizada e evolutiva para monitorar ativos da B3 e criptoativos sem depender de backend proprio nesta etapa.

## Tecnologias usadas

- Expo SDK 56
- React Native
- TypeScript
- AsyncStorage
- react-native-svg
- Fetch API

## APIs usadas

- CoinGecko: busca, cotacao e historico de criptomoedas.
- brapi.dev: cotacao e historico de acoes brasileiras.

## Funcionalidades

- Watchlist local persistida no dispositivo.
- Busca de criptomoedas via CoinGecko.
- Busca de acoes brasileiras por ticker via brapi.dev.
- Tela de detalhe por ativo.
- Grafico de linha com historico de precos.
- Timeframes: 1D, 7D, 1M, 3M e 1Y.
- Indicadores tecnicos calculados no app: RSI 14, SMA 20, SMA 50 e Bandas de Bollinger.
- Interpretacao simples do RSI.
- Alertas locais para preco e RSI, sem notificacoes push ainda.
- Tema escuro com cards e estados visuais consistentes.

## Screenshots

> Placeholders para imagens do app.

| Watchlist | Busca | Detalhes |
| --- | --- | --- |
| `docs/screenshots/watchlist.png` | `docs/screenshots/search.png` | `docs/screenshots/details.png` |

## Como rodar

1. Instale as dependencias:

```bash
npm install
```

2. Configure variaveis de ambiente, se for usar tickers que exigem token da brapi:

```bash
cp .env.example .env
```

3. Preencha `BRAPI_TOKEN` no arquivo `.env`, se tiver uma chave da brapi.

4. Inicie o projeto:

```bash
npm start
```

5. Abra no Expo Go, emulador, simulador ou web:

```bash
npm run web
```

## Decisoes tecnicas

### Por que React Native + Expo

Expo acelera o desenvolvimento mobile com uma base React Native pronta, boa experiencia de desenvolvimento e compatibilidade com iOS, Android e web. Para um app de portfolio, isso permite demonstrar arquitetura, UI e integracoes reais sem gastar a maior parte do tempo com configuracao nativa.

### Por que CoinGecko

CoinGecko oferece endpoints publicos para busca, cotacao e historico de criptomoedas sem exigir chave para o fluxo basico. Isso facilita validar a experiencia de criptoativos rapidamente e manter o app simples.

### Por que brapi.dev

brapi.dev e focada no mercado brasileiro e fornece dados de acoes da B3, incluindo tickers como PETR4, VALE3, ITUB4 e BBAS3. A integracao tambem permite evoluir para uso autenticado com `BRAPI_TOKEN` sem expor token real no codigo.

### Por que os indicadores sao calculados no app

RSI, SMA e Bandas de Bollinger sao calculos deterministas sobre precos de fechamento. Calcular no app reduz dependencias externas, permite reutilizar o mesmo historico ja carregado e deixa a logica transparente para testes, ajustes e evolucao futura.

## Proximos passos

- Adicionar notificacoes locais para alertas ativos.
- Persistir snapshots de cotacoes para uso offline.
- Melhorar o grafico com tooltip e linhas dos indicadores.
- Criar testes automatizados para storage, servicos e indicadores.
- Adicionar autenticacao opcional para configuracoes pessoais.
- Criar screenshots reais para substituir os placeholders.

## Seguranca

O projeto nao inclui tokens reais. O arquivo `.env.example` documenta `BRAPI_TOKEN`, e `.env` fica ignorado pelo Git.
