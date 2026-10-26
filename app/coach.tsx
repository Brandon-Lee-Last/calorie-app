import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { unwrap } from '../src/api/client';
import { coachProblem, helplinesIn, MAX_MESSAGE, SUGGESTIONS, telUrl, type CoachMessage } from '../src/data/coach';
import { useData } from '../src/data/DataProvider';
import { usePlanDiet } from '../src/data/hooks';
import { MyPango } from '../src/pango/MyPango';
import { useTheme } from '../src/theme/theme';
import { fontFamily, radius, spacing } from '../src/theme/tokens';
import { Button, Chip, Icon, IconButton, Text } from '../src/ui';

/** Ask Pango: a chat with the coach. Replies are shown as plain text, never as links or markup. */
export default function Coach() {
  const { colors } = useTheme();
  const { api } = useData();
  const [planStyle] = usePlanDiet();
  const [messages, setMessages] = useState<CoachMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ReturnType<typeof coachProblem> | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let alive = true;
    unwrap(api.GET('/v1/coach/messages'))
      .then((h) => alive && setMessages(h.items))
      .catch((e) => {
        if (!alive) return;
        setMessages([]);
        setProblem(coachProblem(e));
      });
    return () => {
      alive = false;
    };
  }, [api]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setProblem(null);
    setDraft('');
    try {
      const out = await unwrap(api.POST('/v1/coach/messages', { body: { message, planStyle: planStyle ?? null } }));
      setMessages((m) => [...(m ?? []), out.message, out.reply]);
    } catch (e) {
      setDraft(message); // nothing is lost
      setProblem(coachProblem(e));
    } finally {
      setBusy(false);
    }
  };

  const startOver = () =>
    Alert.alert('Start over?', 'This deletes your conversation with Pango.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start over',
        style: 'destructive',
        onPress: () =>
          unwrap(api.DELETE('/v1/coach/messages'))
            .then(() => setMessages([]))
            .catch((e) => setProblem(coachProblem(e))),
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: spacing.sm }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <Text variant="h2" style={{ flex: 1 }} accessibilityRole="header">
          Ask Pango
        </Text>
        {messages?.length ? <Button title="Start over" variant="ghost" size="md" onPress={startOver} /> : null}
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        <Text variant="caption" tone="muted" align="center">
          Pango gives general tips about food, training and motivation, not medical advice.
        </Text>
        {messages?.length === 0 ? (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
            <MyPango pose="wave" size={110} />
            <Text variant="body" tone="muted" align="center">
              Ask me anything about eating well, training or staying on track. I know your goals and what you have logged.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
              {SUGGESTIONS.map((s) => (
                <Chip key={s} label={s} onPress={() => send(s)} />
              ))}
              <Chip label="Meals from my groceries" icon="list" onPress={() => router.push('/pantry')} />
            </View>
          </View>
        ) : null}
        {(messages ?? []).map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {busy ? (
          <Text variant="small" tone="muted" accessibilityLiveRegion="polite">
            Pango is thinking…
          </Text>
        ) : null}
        {problem ? (
          <View accessibilityLiveRegion="polite" style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.raised }}>
            <Text variant="bodyStrong">{problem.title}</Text>
            <Text variant="small" tone="muted">
              {problem.body}
            </Text>
            {problem.plus ? <Button title="See Plus" size="md" onPress={() => router.push('/plus')} /> : null}
          </View>
        ) : null}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, paddingBottom: insets.bottom + spacing.md, borderTopWidth: 1, borderColor: colors.line }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask Pango…"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Message to Pango"
          multiline
          maxLength={MAX_MESSAGE}
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 120,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            color: colors.text,
            fontFamily: fontFamily[500],
            fontSize: 16,
          }}
        />
        <IconButton icon="chevron" label="Send" tone="accent" onPress={() => send(draft)} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: CoachMessage }) {
  const { colors } = useTheme();
  const mine = message.role === 'user';
  const crisis = message.kind === 'crisis';
  return (
    <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', gap: spacing.sm }}>
      {!mine ? (
        <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <MyPango crop="face" size={24} motion={false} />
        </View>
      ) : null}
      <View
        style={{
          maxWidth: '80%',
          gap: spacing.sm,
          padding: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: mine ? colors.accent : colors.surface,
          borderWidth: crisis ? 2 : 1,
          borderColor: crisis ? colors.warn : mine ? colors.accent : colors.line,
        }}
      >
        <Text variant="body" tone={mine ? 'onAccent' : 'default'} selectable>
          {message.content}
        </Text>
        {helplinesIn(message).map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`Call ${n}`}
            onPress={() => Linking.openURL(telUrl(n)).catch(() => {})}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Icon name="bolt" size={14} color={colors.warn} />
            <Text variant="bodyStrong">Call {n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
