import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme';
import { TOUCH } from '../theme/tokens';
import { Text } from './Text';

export type SegmentedOption<T extends string> = { value: T; label: string };

/** A row of mutually exclusive options in one track. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  stretch,
  style,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  stretch?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      style={[{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: (TOUCH + 8) / 2, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 }, style]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={{
              height: TOUCH,
              paddingHorizontal: 14,
              borderRadius: TOUCH / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? colors.accent : 'transparent',
              flex: stretch ? 1 : undefined,
            }}
          >
            <Text variant="label" style={{ color: on ? colors.onAccent : colors.text }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
