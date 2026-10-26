import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { MyPango } from '../pango/MyPango';
import { useTheme } from '../theme/theme';
import { radius, spacing } from '../theme/tokens';
import { Button, Icon, Text } from '../ui';

/** On Today: the way into Ask Pango and meals from groceries. */
export function AskPangoCard() {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask Pango"
        accessibilityHint="Chat about food, training or motivation"
        onPress={() => router.push('/coach')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}>
          <MyPango crop="face" size={34} motion={false} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Ask Pango</Text>
          <Text variant="small" tone="muted">
            Questions about food, training or staying on track?
          </Text>
        </View>
        <Icon name="chevron" size={18} color={colors.muted} />
      </Pressable>
      <Button title="Meals from my groceries" icon="list" variant="secondary" size="md" onPress={() => router.push('/pantry')} />
    </View>
  );
}
