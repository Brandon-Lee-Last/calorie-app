import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { API_URL } from '../../src/config';
import { useData } from '../../src/data/DataProvider';
import { useSession, useSettings, useSyncStatus } from '../../src/data/hooks';
import { describeSync } from '../../src/data/syncText';
import { Pango } from '../../src/pango/Pango';
import { useTheme } from '../../src/theme/theme';
import { radius, spacing } from '../../src/theme/tokens';
import { Button, Card, Icon, Screen, Segmented, Text, type IconName } from '../../src/ui';

function Row({ icon, title, body, onPress }: { icon: IconName; title: string; body: string; onPress: () => void }) {
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
      <Icon name="chevron" size={20} color={colors.muted} />
    </Pressable>
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
  return (
    <Screen>
      <Text variant="title">Me</Text>
      <Card raised style={{ alignItems: 'center', gap: spacing.sm }}>
        <Pango pose="wave" size={150} />
        <Text variant="h3">Pango says hi</Text>
        <Text variant="small" tone="muted" align="center">
          Your profile, goals and Pango's wardrobe come with the next screens.
        </Text>
      </Card>
      <Backup />
      <WaterSettings />
      <Row icon="sparkle" title="Pango studio" body="Every pose and outfit, live" onPress={() => router.push('/studio')} />
      <Row icon="scan" title="Model lab" body="Self-test and raw estimates from the on-phone model" onPress={() => router.push('/lab')} />
      <Text variant="caption" tone="muted" align="center">
        Version {Constants.expoConfig?.version ?? '?'}. Light or dark follows your phone.
      </Text>
    </Screen>
  );
}
