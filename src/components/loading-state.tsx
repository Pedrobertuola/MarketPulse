import { ActivityIndicator, Text, View } from 'react-native';

type LoadingStateProps = {
  message?: string;
};

export function LoadingState({
  message = 'Carregando informacoes do mercado...',
}: LoadingStateProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 20,
        borderWidth: 1,
        gap: 12,
        padding: 24,
      }}
    >
      <ActivityIndicator color="#0F172A" />
      <Text
        selectable
        style={{
          color: '#475569',
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </View>
  );
}
