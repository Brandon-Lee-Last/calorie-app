import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';
import { spacing } from '../theme/tokens';

/** A full screen on the app background, padded clear of the notch and the tab bar. */
export function Screen({
  children,
  scroll = true,
  bottomInset = 0,
  gap = spacing.lg,
  style,
  keyboardShouldPersistTaps,
}: {
  children: ReactNode;
  scroll?: boolean;
  bottomInset?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  /** For forms: 'handled' lets a tap on a button go through while the keyboard is up. */
  keyboardShouldPersistTaps?: 'handled' | 'always' | 'never';
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const content: ViewStyle = {
    paddingTop: insets.top + spacing.lg,
    paddingBottom: insets.bottom + spacing.xxl + bottomInset,
    paddingHorizontal: spacing.xl,
    gap,
  };
  return scroll ? (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[content, style]} keyboardShouldPersistTaps={keyboardShouldPersistTaps}>
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, backgroundColor: colors.bg }, content, style]}>{children}</View>
  );
}
