import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { ASK_PANGO_CLEARANCE } from '../../src/coach/AskPangoFab';
import { API_URL } from '../../src/config';
import { deleteAccount, exportData, exportFileName } from '../../src/data/account';
import { useData } from '../../src/data/DataProvider';
import { shareJson } from '../../src/data/exportFile';
import { isPlus } from '../../src/data/entitlement';
import { useEntitlement, useProfile, useRepoQuery, useSession, useSettings, useStats, useSyncStatus, useToday } from '../../src/data/hooks';
import { DEFAULT_GOALS } from '../../src/data/settings';
import { MyPango } from '../../src/pango/MyPango';
import { SEEN_KEY, earnedIds } from '../../src/pango/wardrobe';
import { describeSync } from '../../src/data/syncText';
import { deleteAllPhotos } from '../../src/scan/photos';
import { useTheme } from '../../src/theme/theme';
import { radius, spacing } from '../../src/theme/tokens';
import { Button, Card, Icon, Screen, Segmented, Text, type IconName } from '../../src/ui';

function Row({ icon, title, body, onPress, badge }: { icon: IconName; title: string; body: string; onPress: () => void; badge?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}
    >
      <Icon name={icon} size={22} color={colors.accentText} />
      <View style={{ flex: 1, paddingVertical: spacing.md }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="muted">
          {body}
        </Text>
      </View>
      {badge ? (
        <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 12, justifyContent: 'center', backgroundColor: colors.accent }}>
          <Text variant="caption" tone="onAccent">
            {badge}
          </Text>
        </View>
      ) : null}
      <Icon name="chevron" size={20} color={colors.muted} />
    </Pressable>
  );
}

function Plan() {
  const { colors } = useTheme();
  const goals = useProfile()?.goals;
  const g = goals ?? { ...DEFAULT_GOALS, custom: false };
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text variant="h3">Your daily plan</Text>
          <Text variant="caption" tone="muted">
            {g.custom ? 'Set by hand' : 'Worked out from your profile'}
          </Text>
        </View>
        <Button title="Change" size="md" variant="secondary" onPress={() => router.push('/goals')} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {[
          { v: g.calories.toLocaleString('en-ZA'), l: 'kcal', c: colors.text },
          { v: `${g.proteinG} g`, l: 'protein', c: colors.protein },
          { v: `${g.carbG} g`, l: 'carbs', c: colors.carbs },
          { v: `${g.fatG} g`, l: 'fat', c: colors.fat },
        ].map((x) => (
          <View key={x.l} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.raised }}>
            <Text variant="bodyStrong" style={{ color: x.c }}>
              {x.v}
            </Text>
            <Text variant="caption" tone="muted">
              {x.l}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const WATER_GOALS = [
  { value: '2000', label: '2 L' },
  { value: '2500', label: '2.5 L' },
  { value: '3000', label: '3 L' },
  { value: '3500', label: '3.5 L' },
] as const;
const GLASSES = [
  { value: '200', label: '200 ml' },
  { value: '250', label: '250 ml' },
  { value: '330', label: '330 ml' },
  { value: '500', label: '500 ml' },
] as const;

function Backup() {
  const { sync } = useData();
  const status = useSyncStatus();
  const session = useSession();
  const line = describeSync(status);
  const last = status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="h3">Account and backup</Text>
      <View style={{ gap: 4 }}>
        <Text variant="body">{session ? (session.isAnonymous ? 'Anonymous account, made for this phone' : 'Signed in') : 'No account yet: made on the first backup'}</Text>
        <Text variant="small" tone={line.tone}>
          {line.text}
        </Text>
        {last ? (
          <Text variant="caption" tone="muted">
            Last backed up at {last}
          </Text>
        ) : null}
      </View>
      <Button title="Back up now" variant="secondary" size="md" loading={status.state === 'syncing'} onPress={() => sync.syncNow().catch(() => {})} />
      <Text variant="caption" tone="muted">
        Server: {API_URL}. Signing in with Google or email, to keep your diary on a new phone, comes later.
      </Text>
    </Card>
  );
}

/** Download everything, or delete the account. Google Play requires the delete option inside the app. */
function YourData() {
  const stack = useData();
  const today = useToday();
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);

  const download = async () => {
    setBusy('export');
    try {
      await shareJson(exportFileName(today), await exportData(stack));
    } catch (e) {
      Alert.alert('Could not download your data', `${e instanceof Error ? e.message : String(e)}. Your data needs a backup first, so try again when you are online.`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('delete');
    try {
      const { subscriptionNote } = await deleteAccount(stack);
      deleteAllPhotos();
      if (subscriptionNote) Alert.alert('Your account is deleted', subscriptionNote);
      router.replace('/onboarding');
    } catch {
      setBusy(null);
      Alert.alert('Nothing was deleted', "Pango's server could not be reached, so your account is still there. Try again when you are online.");
    }
  };

  const confirm = () =>
    Alert.alert(
      'Delete your account?',
      "This erases your diary, weight, water, workouts and photos, on this phone and on Pango's server. There is no undo. A Google Play subscription must be cancelled in the Play Store.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: remove },
      ],
    );

  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="h3">Your data</Text>
      <Text variant="small" tone="muted">
        A copy of everything Pango keeps about you, as a file you can save or send.
      </Text>
      <Button title="Download my data" icon="share" variant="secondary" size="md" loading={busy === 'export'} disabled={busy !== null} onPress={download} />
      <Button title="Delete my account" icon="trash" variant="ghost" size="md" loading={busy === 'delete'} disabled={busy !== null} onPress={confirm} />
    </Card>
  );
}

function WaterSettings() {
  const [settings, update] = useSettings();
  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="h3">Water</Text>
      <View style={{ gap: 6 }}>
        <Text variant="label" tone="muted">
          Daily goal
        </Text>
        <Segmented options={WATER_GOALS} value={String(settings.waterGoalMl) as (typeof WATER_GOALS)[number]['value']} onChange={(v) => update({ waterGoalMl: Number(v) })} stretch />
      </View>
      <View style={{ gap: 6 }}>
        <Text variant="label" tone="muted">
          One glass
        </Text>
        <Segmented options={GLASSES} value={String(settings.glassMl) as (typeof GLASSES)[number]['value']} onChange={(v) => update({ glassMl: Number(v) })} stretch />
      </View>
    </Card>
  );
}

export default function Me() {
  const today = useToday();
  const stats = useStats(today);
  const seen = useRepoQuery(['meta'], (r) => r.getMeta<string[]>(SEEN_KEY), []);
  const fresh = stats && seen !== undefined ? earnedIds(stats).filter((id) => !(seen ?? []).includes(id)).length : 0;
  const plus = isPlus(useEntitlement());
  return (
    <Screen bottomInset={ASK_PANGO_CLEARANCE}>
      <Text variant="title">Me</Text>
      <Card raised style={{ alignItems: 'center', gap: spacing.sm }}>
        <MyPango pose="wave" size={150} />
        <Text variant="h3">{stats?.daysLogged ? `${stats.daysLogged} ${stats.daysLogged === 1 ? 'day' : 'days'} logged, best streak ${stats.bestStreak}` : 'Pango says hi'}</Text>
        <Text variant="small" tone="muted" align="center">
          Earn new looks for Pango by logging, scanning and training.
        </Text>
      </Card>
      <Row icon="sparkle" title="Pango's wardrobe" body="Looks you have earned, and how to earn the rest" badge={fresh ? `${fresh} new` : undefined} onPress={() => router.push('/wardrobe')} />
      <Plan />
      <Row icon="bolt" title={plus ? 'Pango Plus is on' : 'Pango Plus'} body={plus ? 'Thank you. Manage your subscription' : 'Every training program and a year of trends'} onPress={() => router.push('/plus')} />
      <Backup />
      <WaterSettings />
      <YourData />
      <Row icon="sparkle" title="Pango studio" body="Every pose and outfit, live" onPress={() => router.push('/studio')} />
      <Row icon="scan" title="Model lab" body="Self-test and raw estimates from the on-phone model" onPress={() => router.push('/lab')} />
      <Text variant="caption" tone="muted" align="center">
        Version {Constants.expoConfig?.version ?? '?'}. Light or dark follows your phone.
      </Text>
    </Screen>
  );
}
