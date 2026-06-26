import { Text, View } from 'react-native';

import { theme } from '../utils';

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
          color: theme.colors.text,
          fontSize: 28,
          fontWeight: '800',
          letterSpacing: 0,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          selectable
          style={{
            color: theme.colors.textMuted,
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
