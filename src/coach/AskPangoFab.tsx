import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { COACH_SEEN_KEY } from '../data/coach';
import { useRepoQuery } from '../data/hooks';
import { MyPango } from '../pango/MyPango';
import { useTheme } from '../theme/theme';
import { spacing } from '../theme/tokens';
import { Icon, Text } from '../ui';

const SIZE = 60;
/** Room to leave under a tab's content so its last card can scroll clear of the button. */
export const ASK_PANGO_CLEARANCE = 56;

/**
 * Floats above the tab bar on every tab: Pango's face with a chat badge, the way into Ask Pango. Until the person has
 * opened the chat once, a speech bubble says what it is.
 */
export function AskPangoFab() {
  const { colors } = useTheme();
  const seen = useRepoQuery(['meta'], (r) => r.getMeta<boolean>(COACH_SEEN_KEY), []);
  const open = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/coach');
  };
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: spacing.lg, bottom: '100%', marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      {seen === null ? (
        <Pressable
          onPress={open}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 16, borderBottomRightRadius: 4, backgroundColor: colors.accent }}
        >
          <Text variant="label" style={{ color: colors.onAccent }}>
            Ask me anything!
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask Pango"
        accessibilityHint="Chat with Pango about food, training or motivation"
        onPress={open}
        style={({ pressed }) => ({
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          backgroundColor: colors.surface,
          borderWidth: 3,
          borderColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <View style={{ width: SIZE - 6, height: SIZE - 6, borderRadius: (SIZE - 6) / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <MyPango crop="face" size={42} motion={false} />
        </View>
        <View style={{ position: 'absolute', top: -4, right: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chat" size={13} color={colors.onAccent} strokeWidth={2.6} />
        </View>
      </Pressable>
    </View>
  );
}
