import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { unwrap } from '../src/api/client';
import { useData } from '../src/data/DataProvider';
import { useCachedApi } from '../src/data/hooks';
import { codeProblem, inviteMessage, REASON_LABEL, towardsMonth } from '../src/data/rewards';
import { MyPango } from '../src/pango/MyPango';
import { useTheme } from '../src/theme/theme';
import { radius, spacing } from '../src/theme/tokens';
import { Button, Card, Icon, IconButton, ProgressBar, Screen, Text } from '../src/ui';
import { Field } from '../src/ui/Field';

const fmt = (n: number) => Math.round(n).toLocaleString('en-ZA');
const day = (at: number) => new Date(at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });

/** Pango Points: the balance towards a free month of Plus, the invite code, a friend's or gym's code, and the history. */
export default function RewardsScreen() {
  const { colors } = useTheme();
  const { api } = useData();
  const rewards = useCachedApi('rewards', async (a) => unwrap(a.GET('/v1/rewards')), []);
  const r = rewards.data;
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();
  const [codeDone, setCodeDone] = useState<string>();
  const [busy, setBusy] = useState(false);

  const applyCode = async () => {
    if (code.trim().length < 3) return setCodeError('Enter the code.');
    setBusy(true);
    setCodeError(undefined);
    try {
      const out = await unwrap(api.POST('/v1/rewards/code', { body: { code } }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCodeDone(
        out.kind === 'partner'
          ? `Welcome from ${out.name}!${out.points ? ` You got ${fmt(out.points)} points.` : ''}`
          : `Code added. You both get points once you have logged food on ${r?.rules.referralDays ?? 3} different days.`,
      );
      setCode('');
      rewards.reload();
    } catch (e) {
      setCodeError(codeProblem(e));
    } finally {
      setBusy(false);
    }
  };

  const redeem = () =>
    Alert.alert('A month of Plus?', `This spends ${fmt(r!.monthCost)} points on ${r!.monthDays} days of Plus.`, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Get Plus',
        onPress: async () => {
          setBusy(true);
          try {
            const out = await unwrap(api.POST('/v1/rewards/redeem'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            Alert.alert('Plus is on', `Enjoy Plus until ${new Date(out.plusUntil).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })}.`);
            rewards.reload();
          } catch (e) {
            Alert.alert('Could not get Plus', codeProblem(e).replace('That did not work. Try again.', 'Try again in a moment.'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  const share = () => Share.share({ message: inviteMessage(r!.inviteCode) }).catch(() => {});

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <IconButton icon="back" label="Back" onPress={() => router.back()} />
      <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">
        Pango Points
      </Text>
    </View>
  );
  if (!r)
    return (
      <Screen>
        {header}
        <Text variant="body" tone="muted">
          {rewards.error ? 'Pango Points need a connection. Try again when you are online.' : 'Loading…'}
        </Text>
        {rewards.error ? <Button title="Try again" variant="secondary" onPress={rewards.reload} /> : null}
      </Screen>
    );

  const enough = r.points >= r.monthCost;
  return (
    <Screen gap={spacing.md} keyboardShouldPersistTaps="handled">
      {header}

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <MyPango pose={enough ? 'cheer' : 'idle'} size={72} />
          <View style={{ flex: 1 }}>
            <Text variant="number" accessibilityLabel={`${fmt(r.points)} points`}>
              {fmt(r.points)}
            </Text>
            <Text variant="small" tone="muted">
              points · {fmt(r.monthCost)} gets a free month of Plus
            </Text>
          </View>
        </View>
        <ProgressBar value={towardsMonth(r)} color={colors.accent} label={`${fmt(Math.min(r.points, r.monthCost))} of ${fmt(r.monthCost)} points towards a month of Plus`} />
        {enough ? <Button title="Get a month of Plus" icon="bolt" loading={busy} onPress={redeem} /> : null}
        {r.plusFromPointsUntil ? (
          <Text variant="small" tone="good">
            Plus from points until {new Date(r.plusFromPointsUntil).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })}.
          </Text>
        ) : null}
      </Card>

      <Text variant="h3">Earn points</Text>
      <Card style={{ gap: spacing.md }}>
        <Way icon="barcode" title={`Add a food: +${r.rules.foodWithBarcode} with its barcode, +${r.rules.food} without`} body={`Up to ${r.rules.foodsPerDay} foods a day. Copy the numbers from the pack, so everyone scanning it gets them right.`} />
        <Button title="Add a food" icon="plus" size="md" variant="secondary" onPress={() => router.push('/newfood')} />
        <Way icon="chat" title={`Invite a friend: +${fmt(r.rules.invitedFriend)} for you, +${fmt(r.rules.joinedWithInvite)} for them`} body={`Once they have logged food on ${r.rules.referralDays} different days.`} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.raised }}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="muted">
              Your invite code
            </Text>
            <Text variant="h2" selectable accessibilityLabel={`Your invite code: ${r.inviteCode.split('').join(' ')}`} style={{ letterSpacing: 2 }}>
              {r.inviteCode}
            </Text>
          </View>
          <Button title="Share" icon="share" size="md" onPress={share} />
        </View>
        {r.invites.joined ? (
          <Text variant="small" tone="muted">
            {r.invites.joined} {r.invites.joined === 1 ? 'friend' : 'friends'} joined with your code, {r.invites.rewarded} earned you points so far.
          </Text>
        ) : null}
      </Card>

      {r.codeEntry.open ? (
        <>
          <Text variant="h3">Have a code?</Text>
          <Card style={{ gap: spacing.sm }}>
            <Field
              label="A friend’s invite code or your gym’s code"
              value={code}
              onChangeText={(t) => {
                setCode(t);
                setCodeError(undefined);
              }}
              autoCapitalize="characters"
              placeholder="e.g. FITHUB"
              error={codeError}
            />
            <Button title="Use code" size="md" loading={busy} onPress={applyCode} />
            <Text variant="caption" tone="muted">
              Codes work in your first 30 days, until {day(r.codeEntry.until)}. One friend’s code and one gym’s code each.
            </Text>
          </Card>
        </>
      ) : null}
      {codeDone ? (
        <Text variant="small" tone="good" accessibilityLiveRegion="polite">
          {codeDone}
        </Text>
      ) : null}
      {r.codeEntry.partner ? (
        <Text variant="small" tone="muted">
          You joined with {r.codeEntry.partner.name}.
        </Text>
      ) : null}

      {r.history.length ? (
        <>
          <Text variant="h3">History</Text>
          <Card padding={0}>
            {r.history.map((h, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: i ? 1 : 0, borderColor: colors.line }}>
                <View style={{ flex: 1 }}>
                  <Text variant="small">{REASON_LABEL[h.reason] ?? h.reason}</Text>
                  <Text variant="caption" tone="muted">
                    {day(h.at)}
                  </Text>
                </View>
                <Text variant="bodyStrong" tone={h.amount < 0 ? 'muted' : 'good'}>
                  {h.amount > 0 ? '+' : ''}
                  {fmt(h.amount)}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function Way({ icon, title, body }: { icon: 'barcode' | 'chat'; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Icon name={icon} size={20} color={colors.accentText} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" tone="muted">
          {body}
        </Text>
      </View>
    </View>
  );
}
