import { Text, View } from 'react-native';

import { theme } from '../utils';

type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.card,
        borderWidth: 1,
        gap: 8,
        padding: 24,
      }}
    >
      <Text
        selectable
        style={{
          color: theme.colors.text,
          fontSize: 18,
          fontWeight: '800',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        selectable
        style={{
          color: theme.colors.textMuted,
          fontSize: 14,
          lineHeight: 21,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </View>
  );
}
