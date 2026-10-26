import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { SUGGESTIONS } from '../data/coach';
import { MyPango } from '../pango/MyPango';
import { useTheme } from '../theme/theme';
import { radius, spacing } from '../theme/tokens';
import { Button, Chip, Icon, Text } from '../ui';

/** On Today: looks like the start of a chat, so it is plain there is someone to ask. Also the way into meals from groceries. */
export function AskPangoCard() {
  const { colors } = useTheme();
  const ask = (question?: string) => router.push(question ? { pathname: '/coach', params: { ask: question } } : '/coach');
  return (
    <View style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.accent }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        <MyPango pose="wave" size={76} />
        <View style={{ flex: 1, gap: 2, padding: spacing.md, marginBottom: spacing.sm, borderRadius: radius.md, borderBottomLeftRadius: 4, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}>
          <Text variant="bodyStrong">Ask Pango</Text>
          <Text variant="small" tone="muted">
            Hi! Ask me anything about food, training or staying on track.
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask Pango"
        accessibilityHint="Opens the chat with Pango"
        onPress={() => ask()}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 48, paddingLeft: spacing.lg, paddingRight: 4, borderRadius: 24, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.bg, opacity: pressed ? 0.8 : 1 })}
      >
        <Text variant="body" tone="muted" style={{ flex: 1 }}>
          Ask Pango anything…
        </Text>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="send" size={18} color={colors.onAccent} />
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {SUGGESTIONS.slice(0, 2).map((q) => (
          <Chip key={q} label={q} icon="chat" onPress={() => ask(q)} />
        ))}
      </View>
      <Button title="Meals from my groceries" icon="list" variant="secondary" size="md" onPress={() => router.push('/pantry')} />
    </View>
  );
}
