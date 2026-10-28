import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSAnimationKeyframes } from 'react-native-reanimated';

import { useData } from '../data/DataProvider';
import { shiftDate } from '../data/dates';
import { useBurned, useRepoQuery, useSettings, useSteps, useToday } from '../data/hooks';
import { celebrationFor, goalStreak, type Celebration } from '../data/steps';
import { MyPango } from '../pango/MyPango';
import { useTheme } from '../theme/theme';
import { radius, spacing } from '../theme/tokens';
import { Button, Text } from '../ui';

/** Meta key: the celebrations already shown (by key), so each is shown once. */
export const CELEBRATED_KEY = 'celebrated';
const PIECES = 36;

/** Confetti falling once across the screen. Left out when the phone asks for reduced motion. */
function Confetti() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const palette = [colors.accent, colors.good, colors.carbs, colors.protein, colors.fat, colors.warn];
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => {
        // Spread evenly with a fixed jitter, so it looks random but renders the same every time.
        const x = ((i * 97) % 100) / 100;
        const drift = (((i * 53) % 21) - 10) * 6;
        const fall: CSSAnimationKeyframes = {
          from: { transform: [{ translateY: -40 }, { translateX: 0 }, { rotate: '0deg' }] },
          to: { transform: [{ translateY: height + 60 }, { translateX: drift }, { rotate: `${360 + ((i * 37) % 360)}deg` }] },
        };
        return { key: i, left: x * width, color: palette[i % palette.length], fall, duration: 2.2 + ((i * 7) % 12) / 10, delay: ((i * 13) % 8) / 10, wide: i % 3 === 0 };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height],
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => (
        <Animated.View
          key={p.key}
          style={[
            { position: 'absolute', top: 0, left: p.left, width: p.wide ? 12 : 7, height: p.wide ? 7 : 13, borderRadius: 2, backgroundColor: p.color },
            // Reanimated reads the CSS animation keys from the style of an Animated component.
            { animationName: p.fall, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`, animationTimingFunction: 'ease-in', animationFillMode: 'both' } as ViewStyle,
          ]}
        />
      ))}
    </View>
  );
}

/** Pango cheering over falling confetti, with what was achieved. */
export function CelebrationModal({ celebration, onClose }: { celebration: Celebration; onClose: () => void }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        {reduced ? null : <Confetti />}
        <View accessibilityViewIsModal accessibilityLiveRegion="assertive" style={{ width: '100%', maxWidth: 380, alignItems: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
          <MyPango pose="cheer" size={150} />
          <Text variant="h2" align="center" accessibilityRole="header">
            {celebration.title}
          </Text>
          {celebration.lines.map((line) => (
            <Text key={line} variant="body" tone="muted" align="center">
              {line}
            </Text>
          ))}
          <Button title="Nice!" style={{ alignSelf: 'stretch' }} onPress={onClose} />
          <Button
            title="See my activity"
            variant="ghost"
            onPress={() => {
              onClose();
              router.push('/activity');
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

/**
 * Watches today's steps and energy burned and celebrates reaching a goal, a new best day and streak milestones. Each is
 * shown once (remembered on this phone) and several at once come as one. Lives on the tab screens.
 */
export function CelebrationHost() {
  const { repo } = useData();
  const today = useToday();
  const [{ stepGoal, burnGoal }] = useSettings();
  const steps = useSteps(today);
  const { total } = useBurned(today);
  const since = shiftDate(today, -400);
  const history = useRepoQuery(['activity'], (r) => r.stepsByDay(since), [since]);
  const best = useRepoQuery(['activity'], (r) => r.bestStepDay(today), [today]);
  const shown = useRepoQuery(['meta'], (r) => r.getMeta<string[]>(CELEBRATED_KEY), []);
  const [open, setOpen] = useState<Celebration | null>(null);
  // Also remembered here, in case it is closed before the saved list has been read back.
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (open || steps === undefined || history === undefined || best === undefined || shown === undefined) return;
    const due = celebrationFor({ today, steps: steps.steps, stepGoal, burned: total, burnGoal, streak: goalStreak(history, stepGoal, today), best: best?.steps ?? null, shown: new Set([...(shown ?? []), ...seen.current]) });
    if (!due) return;
    due.key.split('|').forEach((k) => seen.current.add(k));
    setOpen(due);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Remembered as soon as it shows, so closing the app does not bring it back. The last 60 are plenty.
    repo.setMeta(CELEBRATED_KEY, [...(shown ?? []), ...due.key.split('|')].slice(-60)).catch(() => {});
  }, [open, steps, history, best, shown, today, stepGoal, burnGoal, total, repo]);

  return open ? <CelebrationModal celebration={open} onClose={() => setOpen(null)} /> : null;
}
