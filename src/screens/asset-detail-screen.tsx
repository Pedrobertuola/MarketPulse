import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PriceChart,
  SectionTitle,
} from '../components';
import {
  getBrazilianStockHistory,
  getBrazilianStockQuote,
  getCryptoMarketChart,
  getCryptoQuote,
} from '../services';
import {
  addAlertRule,
  getAlertRulesByAsset,
  removeAlertRule,
} from '../storage';
import type { AlertRule, AlertRuleType, Asset, ChartPoint } from '../types';
import {
  calculateBollingerBands,
  calculateRSI,
  calculateSMA,
  type BollingerBandPoint,
} from '../utils';

type Timeframe = '1D' | '7D' | '1M' | '3M' | '1Y';

type AssetDetailScreenProps = {
  asset: Asset;
  onBack: () => void;
};

const timeframes: Timeframe[] = ['1D', '7D', '1M', '3M', '1Y'];
const alertRuleOptions: Array<{ type: AlertRuleType; label: string }> = [
  { type: 'price_above', label: 'Preco acima' },
  { type: 'price_below', label: 'Preco abaixo' },
  { type: 'rsi_below_30', label: 'RSI abaixo de 30' },
  { type: 'rsi_above_70', label: 'RSI acima de 70' },
];

const cryptoDaysByTimeframe: Record<Timeframe, 1 | 7 | 30 | 90 | 365> = {
  '1D': 1,
  '7D': 7,
  '1M': 30,
  '3M': 90,
  '1Y': 365,
};

const stockRangeByTimeframe: Record<
  Timeframe,
  '1d' | '5d' | '1mo' | '3mo' | '1y'
> = {
  '1D': '1d',
  '7D': '5d',
  '1M': '1mo',
  '3M': '3mo',
  '1Y': '1y',
};

function formatCurrency(value: number, currency: Asset['quote']['currency']) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value);
}

function formatVolume(volume?: number) {
  if (typeof volume !== 'number') {
    return null;
  }

  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
  }).format(volume);
}

function formatIndicatorValue(value?: number | null) {
  if (typeof value !== 'number') {
    return 'Dados insuficientes';
  }

  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function getLatestValue<T>(values: Array<T | null>) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null) {
      return values[index];
    }
  }

  return null;
}

function getRSIInterpretation(rsi: number | null) {
  if (typeof rsi !== 'number') {
    return 'RSI indisponivel para este periodo.';
  }

  if (rsi < 30) {
    return 'Possivel sobrevenda.';
  }

  if (rsi > 70) {
    return 'Possivel sobrecompra.';
  }

  return 'Zona neutra.';
}

function getAlertRuleLabel(alertRule: AlertRule, currency: Asset['quote']['currency']) {
  if (alertRule.type === 'price_above') {
    return `Preco acima de ${formatCurrency(alertRule.targetValue, currency)}`;
  }

  if (alertRule.type === 'price_below') {
    return `Preco abaixo de ${formatCurrency(alertRule.targetValue, currency)}`;
  }

  if (alertRule.type === 'rsi_below_30') {
    return 'RSI abaixo de 30';
  }

  return 'RSI acima de 70';
}

function isAlertRuleActive(
  alertRule: AlertRule,
  price: number,
  rsi: number | null
) {
  if (alertRule.type === 'price_above') {
    return price > alertRule.targetValue;
  }

  if (alertRule.type === 'price_below') {
    return price < alertRule.targetValue;
  }

  if (alertRule.type === 'rsi_below_30') {
    return typeof rsi === 'number' && rsi < 30;
  }

  return typeof rsi === 'number' && rsi > 70;
}

export function AssetDetailScreen({ asset, onBack }: AssetDetailScreenProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('7D');
  const [quote, setQuote] = useState(asset.quote);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [selectedAlertType, setSelectedAlertType] =
    useState<AlertRuleType>('price_above');
  const [alertTargetValue, setAlertTargetValue] = useState('');
  const [alertError, setAlertError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadAssetDetails = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (asset.type === 'crypto') {
          const [nextQuote, marketChart] = await Promise.all([
            getCryptoQuote(asset.coingeckoId ?? asset.id),
            getCryptoMarketChart(
              asset.coingeckoId ?? asset.id,
              cryptoDaysByTimeframe[selectedTimeframe]
            ),
          ]);

          if (!isMounted) {
            return;
          }

          setQuote(nextQuote);
          setChartData(marketChart);
        } else {
          const [nextQuote, history] = await Promise.all([
            getBrazilianStockQuote(asset.symbol),
            getBrazilianStockHistory(
              asset.symbol,
              stockRangeByTimeframe[selectedTimeframe]
            ),
          ]);

          if (!isMounted) {
            return;
          }

          setQuote(nextQuote);
          setChartData(
            history.map((candle) => ({
              timestamp: candle.timestamp,
              price: candle.close,
              volume: candle.volume,
            }))
          );
        }
      } catch {
        if (isMounted) {
          setError('Nao foi possivel carregar os detalhes desse ativo.');
          setChartData([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadAssetDetails();

    return () => {
      isMounted = false;
    };
  }, [asset, selectedTimeframe]);

  useEffect(() => {
    let isMounted = true;

    const loadAlertRules = async () => {
      const nextAlertRules = await getAlertRulesByAsset(asset.id);

      if (isMounted) {
        setAlertRules(nextAlertRules);
      }
    };

    void loadAlertRules();

    return () => {
      isMounted = false;
    };
  }, [asset.id]);

  const isPositive = quote.changePercent >= 0;
  const changeColor = isPositive ? '#15803D' : '#B91C1C';
  const formattedVolume = formatVolume(
    quote.volume ?? chartData[chartData.length - 1]?.volume
  );
  const closePrices = chartData.map((point) => point.price);
  const latestRSI = getLatestValue(calculateRSI(closePrices, 14));
  const latestSMA20 = getLatestValue(calculateSMA(closePrices, 20));
  const latestSMA50 = getLatestValue(calculateSMA(closePrices, 50));
  const latestBollingerBands = getLatestValue(
    calculateBollingerBands(closePrices, 20, 2)
  );
  const isPriceAlert = selectedAlertType === 'price_above' || selectedAlertType === 'price_below';

  const handleCreateAlertRule = async () => {
    setAlertError(null);

    const targetValue =
      selectedAlertType === 'rsi_below_30'
        ? 30
        : selectedAlertType === 'rsi_above_70'
          ? 70
          : Number(alertTargetValue.replace(',', '.'));

    if (!Number.isFinite(targetValue)) {
      setAlertError('Informe um valor valido para o alerta de preco.');
      return;
    }

    const updatedAlertRules = await addAlertRule({
      assetId: asset.id,
      assetName: asset.name,
      assetSymbol: asset.symbol,
      targetValue,
      type: selectedAlertType,
    });

    setAlertRules(
      updatedAlertRules.filter((alertRule) => alertRule.assetId === asset.id)
    );
    setAlertTargetValue('');
  };

  const handleRemoveAlertRule = async (alertRuleId: string) => {
    const updatedAlertRules = await removeAlertRule(alertRuleId);

    setAlertRules(
      updatedAlertRules.filter((alertRule) => alertRule.assetId === asset.id)
    );
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        backgroundColor: '#F8FAFC',
        flexGrow: 1,
        gap: 20,
        padding: 24,
      }}
      style={{ flex: 1, backgroundColor: '#F8FAFC' }}
    >
      <Pressable
        onPress={onBack}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          backgroundColor: pressed ? '#E2E8F0' : '#FFFFFF',
          borderColor: '#CBD5E1',
          borderRadius: 999,
          borderWidth: 1,
          paddingHorizontal: 14,
          paddingVertical: 9,
        })}
      >
        <Text
          selectable
          style={{ color: '#334155', fontSize: 13, fontWeight: '700' }}
        >
          Voltar
        </Text>
      </Pressable>

      <SectionTitle
        title={asset.name}
        subtitle={`${asset.symbol} - ${asset.exchange ?? asset.type}`}
      />

      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#E2E8F0',
          borderRadius: 20,
          borderWidth: 1,
          gap: 12,
          padding: 18,
        }}
      >
        <Text
          selectable
          style={{
            color: '#0F172A',
            fontSize: 30,
            fontVariant: ['tabular-nums'],
            fontWeight: '800',
          }}
        >
          {formatCurrency(quote.price, quote.currency)}
        </Text>
        <Text
          selectable
          style={{
            color: changeColor,
            fontSize: 17,
            fontVariant: ['tabular-nums'],
            fontWeight: '700',
          }}
        >
          {isPositive ? '+' : ''}
          {quote.changePercent.toFixed(2)}%
        </Text>
        {formattedVolume ? (
          <Text selectable style={{ color: '#475569', fontSize: 14 }}>
            Volume: {formattedVolume}
          </Text>
        ) : (
          <Text selectable style={{ color: '#64748B', fontSize: 14 }}>
            Volume indisponivel
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {timeframes.map((timeframe) => {
          const isSelected = selectedTimeframe === timeframe;

          return (
            <Pressable
              key={timeframe}
              onPress={() => setSelectedTimeframe(timeframe)}
              style={({ pressed }) => ({
                backgroundColor: isSelected
                  ? '#0F172A'
                  : pressed
                    ? '#E2E8F0'
                    : '#FFFFFF',
                borderColor: '#CBD5E1',
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 14,
                paddingVertical: 9,
              })}
            >
              <Text
                selectable
                style={{
                  color: isSelected ? '#FFFFFF' : '#334155',
                  fontSize: 13,
                  fontWeight: '700',
                }}
              >
                {timeframe}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <LoadingState message="Carregando historico do ativo..." />
      ) : error ? (
        <ErrorState message={error} />
      ) : chartData.length > 1 ? (
        <>
          <PriceChart
            color={isPositive ? '#15803D' : '#B91C1C'}
            data={chartData.map((point) => ({
              timestamp: point.timestamp,
              value: point.price,
            }))}
          />
          <TechnicalIndicatorsSummary
            bollingerBands={latestBollingerBands}
            currency={quote.currency}
            rsi={latestRSI}
            sma20={latestSMA20}
            sma50={latestSMA50}
          />
        </>
      ) : (
        <EmptyState
          title="Sem historico disponivel"
          message="Nao encontramos dados suficientes para desenhar o grafico neste periodo."
        />
      )}

      <AlertRulesPanel
        alertError={alertError}
        alertRules={alertRules}
        currency={quote.currency}
        isPriceAlert={isPriceAlert}
        onCreateAlertRule={handleCreateAlertRule}
        onRemoveAlertRule={handleRemoveAlertRule}
        onSelectAlertType={setSelectedAlertType}
        onTargetValueChange={setAlertTargetValue}
        price={quote.price}
        rsi={latestRSI}
        selectedAlertType={selectedAlertType}
        targetValue={alertTargetValue}
      />
    </ScrollView>
  );
}

type AlertRulesPanelProps = {
  alertRules: AlertRule[];
  selectedAlertType: AlertRuleType;
  targetValue: string;
  isPriceAlert: boolean;
  alertError: string | null;
  price: number;
  rsi: number | null;
  currency: Asset['quote']['currency'];
  onSelectAlertType: (alertRuleType: AlertRuleType) => void;
  onTargetValueChange: (value: string) => void;
  onCreateAlertRule: () => Promise<void>;
  onRemoveAlertRule: (alertRuleId: string) => Promise<void>;
};

function AlertRulesPanel({
  alertRules,
  selectedAlertType,
  targetValue,
  isPriceAlert,
  alertError,
  price,
  rsi,
  currency,
  onSelectAlertType,
  onTargetValueChange,
  onCreateAlertRule,
  onRemoveAlertRule,
}: AlertRulesPanelProps) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 20,
        borderWidth: 1,
        gap: 16,
        padding: 18,
      }}
    >
      <Text
        selectable
        style={{ color: '#0F172A', fontSize: 17, fontWeight: '800' }}
      >
        Alertas locais
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {alertRuleOptions.map((option) => {
          const isSelected = selectedAlertType === option.type;

          return (
            <Pressable
              key={option.type}
              onPress={() => onSelectAlertType(option.type)}
              style={({ pressed }) => ({
                backgroundColor: isSelected
                  ? '#0F172A'
                  : pressed
                    ? '#E2E8F0'
                    : '#FFFFFF',
                borderColor: '#CBD5E1',
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 8,
              })}
            >
              <Text
                selectable
                style={{
                  color: isSelected ? '#FFFFFF' : '#334155',
                  fontSize: 13,
                  fontWeight: '700',
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isPriceAlert ? (
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={onTargetValueChange}
          placeholder="Valor do preco"
          placeholderTextColor="#94A3B8"
          style={{
            backgroundColor: '#F8FAFC',
            borderColor: '#CBD5E1',
            borderRadius: 16,
            borderWidth: 1,
            color: '#0F172A',
            fontSize: 15,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
          value={targetValue}
        />
      ) : (
        <Text selectable style={{ color: '#475569', fontSize: 14 }}>
          O limite deste alerta e fixo pelo RSI selecionado.
        </Text>
      )}

      {alertError ? <ErrorState message={alertError} /> : null}

      <Pressable
        onPress={() => {
          void onCreateAlertRule();
        }}
        style={({ pressed }) => ({
          alignItems: 'center',
          backgroundColor: pressed ? '#0F172A' : '#1E293B',
          borderRadius: 16,
          paddingVertical: 12,
        })}
      >
        <Text selectable style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>
          Criar alerta
        </Text>
      </Pressable>

      {alertRules.length > 0 ? (
        <View style={{ gap: 10 }}>
          {alertRules.map((alertRule) => {
            const isActive = isAlertRuleActive(alertRule, price, rsi);

            return (
              <View
                key={alertRule.id}
                style={{
                  backgroundColor: isActive ? '#F0FDF4' : '#F8FAFC',
                  borderColor: isActive ? '#BBF7D0' : '#E2E8F0',
                  borderRadius: 16,
                  borderWidth: 1,
                  gap: 10,
                  padding: 14,
                }}
              >
                <View
                  style={{
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      selectable
                      style={{
                        color: '#0F172A',
                        fontSize: 14,
                        fontWeight: '800',
                      }}
                    >
                      {getAlertRuleLabel(alertRule, currency)}
                    </Text>
                    <Text
                      selectable
                      style={{
                        color: isActive ? '#15803D' : '#64748B',
                        fontSize: 13,
                        fontWeight: '700',
                      }}
                    >
                      {isActive ? 'Condicao ativa' : 'Condicao inativa'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      void onRemoveAlertRule(alertRule.id);
                    }}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? '#FEE2E2' : '#FFF1F2',
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    })}
                  >
                    <Text
                      selectable
                      style={{
                        color: '#B91C1C',
                        fontSize: 12,
                        fontWeight: '800',
                      }}
                    >
                      Remover
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState
          title="Nenhum alerta local"
          message="Crie regras simples para acompanhar preco e RSI deste ativo."
        />
      )}
    </View>
  );
}

type TechnicalIndicatorsSummaryProps = {
  rsi: number | null;
  sma20: number | null;
  sma50: number | null;
  bollingerBands: BollingerBandPoint | null;
  currency: Asset['quote']['currency'];
};

function TechnicalIndicatorsSummary({
  rsi,
  sma20,
  sma50,
  bollingerBands,
  currency,
}: TechnicalIndicatorsSummaryProps) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 20,
        borderWidth: 1,
        gap: 14,
        padding: 18,
      }}
    >
      <Text
        selectable
        style={{ color: '#0F172A', fontSize: 17, fontWeight: '800' }}
      >
        Indicadores tecnicos
      </Text>

      <View style={{ gap: 10 }}>
        <IndicatorRow label="RSI 14" value={formatIndicatorValue(rsi)} />
        <Text selectable style={{ color: '#475569', fontSize: 14 }}>
          {getRSIInterpretation(rsi)}
        </Text>
        <IndicatorRow
          label="SMA 20"
          value={
            typeof sma20 === 'number'
              ? formatCurrency(sma20, currency)
              : 'Dados insuficientes'
          }
        />
        <IndicatorRow
          label="SMA 50"
          value={
            typeof sma50 === 'number'
              ? formatCurrency(sma50, currency)
              : 'Dados insuficientes'
          }
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text
          selectable
          style={{ color: '#334155', fontSize: 14, fontWeight: '700' }}
        >
          Bandas de Bollinger
        </Text>
        <IndicatorRow
          label="Superior"
          value={
            bollingerBands
              ? formatCurrency(bollingerBands.upper, currency)
              : 'Dados insuficientes'
          }
        />
        <IndicatorRow
          label="Media"
          value={
            bollingerBands
              ? formatCurrency(bollingerBands.middle, currency)
              : 'Dados insuficientes'
          }
        />
        <IndicatorRow
          label="Inferior"
          value={
            bollingerBands
              ? formatCurrency(bollingerBands.lower, currency)
              : 'Dados insuficientes'
          }
        />
      </View>
    </View>
  );
}

type IndicatorRowProps = {
  label: string;
  value: string;
};

function IndicatorRow({ label, value }: IndicatorRowProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <Text selectable style={{ color: '#64748B', fontSize: 14 }}>
        {label}
      </Text>
      <Text
        selectable
        style={{
          color: '#0F172A',
          flexShrink: 1,
          fontSize: 14,
          fontVariant: ['tabular-nums'],
          fontWeight: '700',
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}
