import { ActivityIndicator, Text, View } from 'react-native';

import { theme } from '../utils';

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
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.card,
        borderWidth: 1,
        gap: 12,
        padding: 24,
      }}
    >
      <ActivityIndicator color={theme.colors.primary} />
      <Text
        selectable
        style={{
          color: theme.colors.textMuted,
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </View>
  );
}
