import { Text, View } from 'react-native';

type SectionTitleProps = {
  title: string;
  subtitle?: string;
};

export function SectionTitle({ title, subtitle }: SectionTitleProps) {
  return (
    <View style={{ gap: 4 }}>
      <Text
        selectable
        style={{
          color: '#0F172A',
          fontSize: 24,
          fontWeight: '700',
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          selectable
          style={{
            color: '#475569',
            fontSize: 15,
            lineHeight: 22,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
