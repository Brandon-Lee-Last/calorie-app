import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { unwrap } from '../src/api/client';
import { useData } from '../src/data/DataProvider';
import { isPlus } from '../src/data/entitlement';
import { useCachedApi, useEntitlement } from '../src/data/hooks';
import { useTheme } from '../src/theme/theme';
import { radius, spacing } from '../src/theme/tokens';
import { Button, EmptyState, Icon, IconButton, Screen, Text } from '../src/ui';

/** A server program: what it is, its schedule, joining or leaving it, and starting a day's workout. */
export default function Program() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { api } = useData();
  const { colors } = useTheme();
  const plus = isPlus(useEntitlement());
  const program = useCachedApi(`program:${slug}`, (a) => unwrap(a.GET('/v1/programs/{slug}', { params: { path: { slug } } })), [slug]);
  const current = useCachedApi('programs/current', async (a) => (await unwrap(a.GET('/v1/programs/current'))).enrollment, [slug]);
  const [busy, setBusy] = useState(false);
  const p = program.data;
  const enrolled = current.data?.status === 'active' && current.data.program.slug === slug;

  const join = async () => {
    setBusy(true);
    try {
      if (enrolled) await unwrap(api.DELETE('/v1/programs/{slug}/enroll', { params: { path: { slug } } }));
      else await unwrap(api.POST('/v1/programs/{slug}/enroll', { params: { path: { slug } } }));
      current.reload();
    } catch (e) {
      Alert.alert(enrolled ? 'Could not leave the program' : 'Could not join the program', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!p)
    return (
      <Screen>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        {program.loading ? <EmptyState pose="roll" title="Loading the program" /> : <EmptyState pose="sleep" title="This program needs a connection" body="Open it again when you are online." />}
      </Screen>
    );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <Text variant="h2" style={{ flex: 1 }} accessibilityRole="header">
          {p.title}
        </Text>
      </View>
      <Text variant="body" tone="muted">
        {p.summary}
      </Text>
      <Text variant="small" tone="muted">
        {p.level[0].toUpperCase() + p.level.slice(1)}, {p.weeks} weeks, {p.daysPerWeek} workouts a week{p.author ? `, by ${p.author}` : ''}
      </Text>
      {p.locked && !plus ? (
        <Button title="Unlock with Plus" onPress={() => router.push('/plus')} />
      ) : (
        <Button title={enrolled ? 'Leave this program' : 'Start this program'} variant={enrolled ? 'secondary' : 'primary'} onPress={join} loading={busy} />
      )}
      {p.schedule.map((week) => (
        <View key={week.week} style={{ gap: spacing.sm }}>
          <Text variant="h3">Week {week.week}</Text>
          {week.days.flatMap((d) =>
            d.workouts.map((w) => (
              <Pressable
                key={w.id}
                accessibilityRole="button"
                accessibilityLabel={`Day ${d.day}: ${w.title}${w.locked ? ', Plus' : ''}`}
                onPress={() => (w.locked && !plus ? router.push('/plus') : router.push({ pathname: '/workout', params: { id: w.id, program: p.id } }))}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">
                    Day {d.day}: {w.title}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {w.estMinutes ? `${w.estMinutes} min, ` : ''}
                    {w.exerciseCount} exercises
                  </Text>
                </View>
                <Icon name={w.locked && !plus ? 'lock' : 'play'} size={18} color={colors.muted} />
              </Pressable>
            )),
          )}
        </View>
      ))}
    </Screen>
  );
}
