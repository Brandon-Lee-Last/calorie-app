import type { ReactNode } from 'react';
import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme/theme';
import { fontFamily, typeScale, type Palette, type TypeVariant } from '../theme/tokens';

type Tone = 'default' | 'muted' | 'subtle' | 'accent' | 'good' | 'bad' | 'onAccent' | keyof Pick<Palette, 'protein' | 'carbs' | 'fat'>;

export type AppTextProps = Omit<TextProps, 'style'> & {
  variant?: TypeVariant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
};

/** Text in the app's type scale. Weight comes from the font face, not fontWeight, so Android renders it properly. */
export function Text({ variant = 'body', tone = 'default', align, style, children, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const t = typeScale[variant] as (typeof typeScale)[TypeVariant] & { tracking?: number; upper?: boolean };
  const color = {
    default: colors.text,
    muted: colors.muted,
    subtle: colors.subtle,
    accent: colors.accentText,
    good: colors.goodText,
    bad: colors.bad,
    onAccent: colors.onAccent,
    protein: colors.protein,
    carbs: colors.carbs,
    fat: colors.fat,
  }[tone];
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: fontFamily[t.weight],
          fontSize: t.size,
          lineHeight: t.lineHeight ? Math.round(t.size * t.lineHeight) : undefined,
          letterSpacing: t.tracking ? t.tracking * t.size : undefined,
          textTransform: t.upper ? 'uppercase' : undefined,
          color,
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
