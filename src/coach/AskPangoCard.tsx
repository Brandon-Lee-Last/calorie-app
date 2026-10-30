import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { SUGGESTIONS } from '../data/coach';
import { MyPango } from '../pango/MyPango';
import { useTheme } from '../theme/theme';
import { radius, spacing } from '../theme/tokens';
import { Chip, Icon, Text } from '../ui';

/**
 * On Today: a compact way into Ask Pango that still reads as a chat (Pango's face and a message box), with quick
 * questions that send at once and the way into meals from groceries.
 */
export function AskPangoCard() {
  const { colors } = useTheme();
  const ask = (question?: string) => router.push(question ? { pathname: '/coach', params: { ask: question } } : '/coach');
  return (
    <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.accent }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}>
          <MyPango crop="face" size={34} motion={false} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ask Pango"
          accessibilityHint="Opens the chat with Pango"
          onPress={() => ask()}
          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 44, paddingLeft: spacing.md, paddingRight: 3, borderRadius: 22, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.bg, opacity: pressed ? 0.8 : 1 })}
        >
          <Text variant="body" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
            Ask Pango anything…
          </Text>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send" size={17} color={colors.onAccent} />
          </View>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label="Meals from my groceries" icon="list" onPress={() => router.push('/pantry')} />
        {SUGGESTIONS.slice(0, 2).map((q) => (
          <Chip key={q} label={q} icon="chat" onPress={() => ask(q)} />
        ))}
      </ScrollView>
    </View>
  );
}
