import { TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme';
import { fontFamily, radius, spacing } from '../theme/tokens';
import { Text } from './Text';

export type FieldProps = Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'keyboardType' | 'autoFocus' | 'maxLength' | 'returnKeyType' | 'onSubmitEditing' | 'autoCapitalize'> & {
  label: string;
  /** Unit shown inside the box, after the value. */
  suffix?: string;
  error?: string | null;
  style?: StyleProp<ViewStyle>;
};

/** A labelled text box. The label doubles as what screen readers say; an error replaces nothing, it is added below. */
export function Field({ label, suffix, error, style, ...input }: FieldProps) {
  const { colors } = useTheme();
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 52,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? colors.bad : colors.line,
          backgroundColor: colors.surface,
        }}
      >
        <TextInput
          {...input}
          accessibilityLabel={label}
          accessibilityHint={error ?? undefined}
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          style={{ flex: 1, minWidth: 0, minHeight: 50, color: colors.text, fontFamily: fontFamily[600], fontSize: 17 }}
        />
        {suffix ? (
          <Text variant="small" tone="muted">
            {suffix}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="bad">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
