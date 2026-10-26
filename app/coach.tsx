import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, Linking, Pressable, ScrollView, TextInput, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSAnimationKeyframes } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { unwrap } from '../src/api/client';
import { coachProblem, helplinesIn, MAX_MESSAGE, SUGGESTIONS, telUrl, typedAt, type CoachMessage } from '../src/data/coach';
import { useData } from '../src/data/DataProvider';
import { usePlanDiet } from '../src/data/hooks';
import { MyPango } from '../src/pango/MyPango';
import { useTheme } from '../src/theme/theme';
import { fontFamily, radius, spacing } from '../src/theme/tokens';
import { Button, Chip, Icon, IconButton, Text } from '../src/ui';
import { useKeyboardLift } from '../src/ui/keyboard';

/**
 * Ask Pango: a chat with the coach. Replies are shown as plain text, never as links or markup, and type out on screen
 * (crisis replies appear at once, so the helplines never wait). Opened with `?ask=` it sends that question straight away.
 */
export default function Coach() {
  const { colors } = useTheme();
  const { api } = useData();
  const [planStyle] = usePlanDiet();
  const { ask } = useLocalSearchParams<{ ask?: string }>();
  const [messages, setMessages] = useState<CoachMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  /** The question on its way, shown straight away while Pango thinks. */
  const [pending, setPending] = useState<string | null>(null);
  /** The reply typing out now, if any. */
  const [typingId, setTypingId] = useState<string | null>(null);
  const [problem, setProblem] = useState<ReturnType<typeof coachProblem> | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  /** The scroll view's visible height, and where to hold the scroll instead of the end (the top of a long reply). */
  const viewport = useRef(0);
  const holdAt = useRef<number | null>(null);
  const asked = useRef(false);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardLift(insets.bottom);
  const busy = pending !== null;

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

  useEffect(() => {
    if (keyboard.open) scroll.current?.scrollToEnd({ animated: true });
  }, [keyboard.open, keyboard.lift]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setPending(message);
    setTypingId(null); // a reply still typing finishes at once
    holdAt.current = null;
    setProblem(null);
    setDraft('');
    try {
      const out = await unwrap(api.POST('/v1/coach/messages', { body: { message, planStyle: planStyle ?? null } }));
      setMessages((m) => [...(m ?? []), out.message, out.reply]);
      setTypingId(out.reply.kind === 'crisis' ? null : out.reply.id);
    } catch (e) {
      setDraft(message); // nothing is lost
      setProblem(coachProblem(e));
    } finally {
      setPending(null);
    }
  };

  useEffect(() => {
    if (messages && ask && !asked.current) {
      asked.current = true;
      void send(ask);
    }
  }, [messages, ask]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const canSend = draft.trim().length > 0 && !busy;
  return (
    <View testID="coach-screen" onLayout={keyboard.onLayout} style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: keyboard.lift }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderColor: colors.line }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <MyPango crop="face" size={30} motion={false} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h3" accessibilityRole="header">
            Ask Pango
          </Text>
          <Text variant="caption" tone="muted">
            {busy ? 'Thinking…' : 'Your food and fitness coach'}
          </Text>
        </View>
        {messages?.length ? <Button title="Start over" variant="ghost" size="md" onPress={startOver} /> : null}
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        onLayout={(e) => (viewport.current = e.nativeEvent.layout.height)}
        onContentSizeChange={() => (holdAt.current === null ? scroll.current?.scrollToEnd({ animated: true }) : scroll.current?.scrollTo({ y: holdAt.current, animated: true }))}
      >
        <Text variant="caption" tone="muted" align="center">
          Pango gives general tips about food, training and motivation, not medical advice.
        </Text>
        {messages?.length === 0 && !busy ? (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
            <MyPango pose="wave" size={110} />
            <Text variant="body" tone="muted" align="center">
              Ask me anything about eating well, training or staying on track. I know your goals and what you have logged.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
              {SUGGESTIONS.map((s) => (
                <Chip key={s} label={s} onPress={() => void send(s)} />
              ))}
              <Chip label="Meals from my groceries" icon="list" onPress={() => router.push('/pantry')} />
            </View>
          </View>
        ) : null}
        {(messages ?? []).map((m) => (
          <Bubble
            key={m.id}
            message={m}
            typing={m.id === typingId}
            onTyped={() => setTypingId((t) => (t === m.id ? null : t))}
            onLayout={
              m.id === typingId
                ? (e) => {
                    // A reply taller than the screen is read from its top as it types, not from its (still blank) end.
                    const { y, height } = e.nativeEvent.layout;
                    if (height <= viewport.current - spacing.xxl) return;
                    holdAt.current = Math.max(0, y - spacing.md);
                    scroll.current?.scrollTo({ y: holdAt.current, animated: true });
                  }
                : undefined
            }
          />
        ))}
        {pending !== null ? <Bubble message={{ id: 'pending', role: 'user', content: pending, kind: 'chat', createdAt: 0 }} /> : null}
        {busy ? <Thinking /> : null}
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: keyboard.open ? spacing.md : insets.bottom + spacing.md,
          borderTopWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.bg,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask Pango anything…"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Message to Pango"
          multiline
          maxLength={MAX_MESSAGE}
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 120,
            paddingHorizontal: spacing.lg,
            paddingTop: 11,
            paddingBottom: 11,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.surface,
            color: colors.text,
            fontFamily: fontFamily[500],
            fontSize: 16,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !canSend }}
          onPress={() => void send(draft)}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', opacity: canSend ? (pressed ? 0.8 : 1) : 0.4 })}
        >
          <Icon name="send" size={20} color={colors.onAccent} />
        </Pressable>
      </View>
    </View>
  );
}

function Avatar() {
  const { colors } = useTheme();
  return (
    <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
      <MyPango crop="face" size={24} motion={false} />
    </View>
  );
}

/**
 * One message. A reply that is `typing` plays out letter by letter, a tap shows it all. The bubble is laid out with the
 * whole reply from the start (the part still to come is there but invisible), so it never resizes or reflows as it types.
 */
function Bubble({ message, typing = false, onTyped, onLayout }: { message: CoachMessage; typing?: boolean; onTyped?: () => void; onLayout?: (e: LayoutChangeEvent) => void }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const mine = message.role === 'user';
  const crisis = message.kind === 'crisis';
  const text = message.content;
  const animate = typing && !reduced;
  const [shown, setShown] = useState(animate ? 0 : text.length);
  const skipped = useRef(false);
  const done = shown >= text.length;

  useEffect(() => {
    if (!animate || skipped.current) {
      setShown(text.length);
      return;
    }
    // Paced by the clock, a frame at a time, so it keeps a steady speed even when the phone is busy.
    const start = Date.now();
    let frame = requestAnimationFrame(function tick() {
      if (skipped.current) return;
      const next = typedAt(text.length, Date.now() - start);
      setShown(next);
      if (next < text.length) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [animate, text]);
  useEffect(() => {
    if (done && typing) onTyped?.();
  }, [done, typing]); // eslint-disable-line react-hooks/exhaustive-deps

  const style: ViewStyle = {
    maxWidth: '80%',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderBottomRightRadius: mine ? 6 : radius.lg,
    borderBottomLeftRadius: mine ? radius.lg : 6,
    backgroundColor: mine ? colors.accent : colors.surface,
    borderWidth: crisis ? 2 : 1,
    borderColor: crisis ? colors.warn : mine ? colors.accent : colors.line,
  };
  return (
    <View onLayout={onLayout} style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: mine ? 'flex-end' : 'flex-start', gap: spacing.sm }}>
      {!mine ? <Avatar /> : null}
      {done ? (
        <View style={style}>
          <Text variant="body" tone={mine ? 'onAccent' : 'default'} selectable>
            {text}
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
      ) : (
        // While it types, screen readers get the whole answer at once, and a tap shows it all.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text}
          accessibilityHint="Shows the whole answer"
          onPress={() => {
            skipped.current = true;
            setShown(text.length);
          }}
          style={style}
        >
          <Text variant="body">
            {text.slice(0, shown)}
            <Text variant="body" style={{ color: 'transparent' }}>
              {text.slice(shown)}
            </Text>
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const BOUNCE: CSSAnimationKeyframes = {
  '0%': { transform: [{ translateY: 0 }], opacity: 0.35 },
  '30%': { transform: [{ translateY: -5 }], opacity: 1 },
  '60%': { transform: [{ translateY: 0 }], opacity: 0.35 },
  '100%': { transform: [{ translateY: 0 }], opacity: 0.35 },
};

/** While a reply is on its way: Pango thinking it over, and three bouncing dots. */
function Thinking() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  return (
    <View accessible accessibilityLabel="Pango is thinking" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
      <MyPango pose="think" size={72} />
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 4, marginBottom: spacing.sm, borderRadius: radius.lg, borderBottomLeftRadius: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
        {[0, 0.18, 0.36].map((delay) => (
          <Animated.View
            key={delay}
            style={[
              { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.muted },
              // Reanimated reads the CSS animation keys from the style of an Animated component.
              reduced ? null : ({ animationName: BOUNCE, animationDuration: '1.1s', animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out', animationDelay: `${delay}s` } as ViewStyle),
            ]}
          />
        ))}
      </View>
    </View>
  );
}
