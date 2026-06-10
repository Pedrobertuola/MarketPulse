import { Text, View } from 'react-native';

type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 20,
        borderWidth: 1,
        gap: 8,
        padding: 24,
      }}
    >
      <Text
        selectable
        style={{
          color: '#0F172A',
          fontSize: 18,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        selectable
        style={{
          color: '#64748B',
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
