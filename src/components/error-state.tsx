import { Text, View } from 'react-native';

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
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
        borderRadius: 20,
        borderWidth: 1,
        gap: 8,
        padding: 20,
      }}
    >
      <Text
        selectable
        style={{
          color: '#991B1B',
          fontSize: 17,
          fontWeight: '700',
        }}
      >
        {title}
      </Text>
      <Text
        selectable
        style={{
          color: '#B91C1C',
          fontSize: 14,
          lineHeight: 21,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
