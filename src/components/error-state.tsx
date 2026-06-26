import { Text, View } from 'react-native';

import { theme } from '../utils';

type ErrorStateProps = {
  title?: string;
  message: string;
};

export function ErrorState({
  title = 'Algo deu errado',
  message,
}: ErrorStateProps) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.dangerSoft,
        borderColor: '#7F1D1D',
        borderRadius: theme.radius.card,
        borderWidth: 1,
        gap: 8,
        padding: 20,
      }}
    >
      <Text
        selectable
        style={{
          color: theme.colors.danger,
          fontSize: 17,
          fontWeight: '800',
        }}
      >
        {title}
      </Text>
      <Text
        selectable
        style={{
          color: '#FECACA',
          fontSize: 14,
          lineHeight: 21,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
