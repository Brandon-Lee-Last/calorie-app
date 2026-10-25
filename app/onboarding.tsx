import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';

import { useData } from '../src/data/DataProvider';
import { recommendGoals, type ActivityLevel, type GoalType } from '../src/data/goals';
import { ACTIVITY, GOALS, RATES, defaultRate, paceText, parseAbout, type About, type AboutErrors, type AboutForm } from '../src/data/onboarding';
import { ONBOARDED_KEY, deviceLocale, deviceTimezone, saveProfile, type ProfilePatch } from '../src/data/profile';
import { Pango } from '../src/pango/Pango';
import type { Pose } from '../src/pango/types';
import { useTheme } from '../src/theme/theme';
import { radius, spacing } from '../src/theme/tokens';
import { Button, IconButton, Screen, Segmented, Text } from '../src/ui';
import { Choice } from '../src/ui/Choice';
import { Field } from '../src/ui/Field';

const STEPS = 4;
const SEXES = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'unsaid', label: 'Skip' },
] as const;
const fmt = (n: number) => n.toLocaleString('en-ZA');

/** First run: the goal, a few facts, activity, then the plan. Works offline; the profile syncs when it can. */
export default function Onboarding() {
  const { repo } = useData();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<GoalType>('lose');
  const [about, setAbout] = useState<AboutForm>({ sex: 'unsaid', birthYear: '', heightCm: '', weightKg: '' });
  const [aboutErrors, setAboutErrors] = useState<AboutErrors>({});
  const [facts, setFacts] = useState<About | null>(null);
  const [activity, setActivity] = useState<ActivityLevel>('light');
  const [rate, setRate] = useState(defaultRate('lose'));
  const [saving, setSaving] = useState(false);

  const pickGoal = (g: GoalType) => {
    setGoal(g);
    setRate(defaultRate(g));
  };

  const next = () => {
    if (step === 1) {
      const parsed = parseAbout(about);
      if (!parsed.ok) return setAboutErrors(parsed.errors);
      setFacts(parsed.value);
    }
    setStep((s) => Math.min(STEPS - 1, s + 1));
  };

  const finish = async (patch: ProfilePatch, weightKg?: number) => {
    setSaving(true);
    try {
      await saveProfile(repo, { ...patch, timezone: deviceTimezone(), locale: deviceLocale(), onboarded: true });
      if (weightKg) await repo.addWeight(weightKg);
      await repo.setMeta(ONBOARDED_KEY, true);
      router.replace('/');
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    }
  };

  const start = () => {
    if (!facts) return;
    finish({ goal, goalRateKgPerWeek: goal === 'maintain' ? 0 : goal === 'lose' ? -rate : rate, activityLevel: activity, ...facts }, facts.weightKg);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen keyboardShouldPersistTaps="handled" style={{ flexGrow: 1 }} gap={spacing.xl}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
          <View style={{ width: 44 }}>{step > 0 ? <IconButton icon="back" label="Back" onPress={() => setStep((s) => s - 1)} /> : null}</View>
          <Dots step={step} />
          <View style={{ width: 44 }} />
        </View>

        {step === 0 ? (
          <>
            <Hero pose="cheer" />
            <Heading title="Hi, I am Pango." body="Snap your plate and I do the counting. First, what are we working towards?" />
            <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
              {GOALS.map((g) => (
                <Choice key={g.value} title={g.title} hint={g.hint} selected={goal === g.value} onPress={() => pickGoal(g.value)} />
              ))}
            </View>
          </>
        ) : step === 1 ? (
          <>
            <Heading pose="think" title="A little about you" body="Pango uses this to work out how much energy you need. It stays private." />
            <View style={{ gap: 6 }}>
              <Text variant="label" tone="muted">
                Sex (the energy formula uses it)
              </Text>
              <Segmented options={SEXES} value={about.sex} onChange={(sex) => setAbout((a) => ({ ...a, sex }))} stretch />
            </View>
            <Field label="Year you were born" value={about.birthYear} onChangeText={(birthYear) => setAbout((a) => ({ ...a, birthYear }))} keyboardType="number-pad" maxLength={4} placeholder="1995" error={aboutErrors.birthYear} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Field label="Height" value={about.heightCm} onChangeText={(heightCm) => setAbout((a) => ({ ...a, heightCm }))} keyboardType="decimal-pad" suffix="cm" error={aboutErrors.heightCm} style={{ flex: 1 }} />
              <Field label="Weight" value={about.weightKg} onChangeText={(weightKg) => setAbout((a) => ({ ...a, weightKg }))} keyboardType="decimal-pad" suffix="kg" error={aboutErrors.weightKg} style={{ flex: 1 }} />
            </View>
          </>
        ) : step === 2 ? (
          <>
            <Heading pose="wave" title="How active are you?" body="Think of a normal week, not your best one." />
            <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
              {ACTIVITY.map((a) => (
                <Choice key={a.value} title={a.title} hint={a.hint} selected={activity === a.value} onPress={() => setActivity(a.value)} />
              ))}
            </View>
          </>
        ) : facts ? (
          <Plan goal={goal} rate={rate} setRate={setRate} activity={activity} facts={facts} />
        ) : null}

        <View style={{ flexGrow: 1 }} />
        <View style={{ gap: spacing.sm }}>
          {step < STEPS - 1 ? <Button title={step === 0 ? 'Let us go' : 'Next'} onPress={next} /> : <Button title="Start with this plan" icon="check" onPress={start} loading={saving} />}
          {step === 0 ? <Button title="Skip for now" variant="ghost" onPress={() => finish({})} disabled={saving} /> : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Plan({ goal, rate, setRate, activity, facts }: { goal: GoalType; rate: number; setRate: (r: number) => void; activity: ActivityLevel; facts: About }) {
  const { colors } = useTheme();
  const rec = useMemo(
    () => recommendGoals({ ...facts, activityLevel: activity, goal, rateKgPerWeek: goal === 'lose' ? -rate : rate }, Date.now()),
    [facts, activity, goal, rate],
  );
  const rates = RATES[goal];
  const macros = [
    { label: 'Protein', value: rec.proteinG, color: colors.protein },
    { label: 'Carbs', value: rec.carbG, color: colors.carbs },
    { label: 'Fat', value: rec.fatG, color: colors.fat },
  ];
  return (
    <>
      <Hero pose="cheer" height={190} size={150} />
      <View style={{ gap: 4 }}>
        <Text variant="label" tone="muted">
          Your daily plan
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }} accessible accessibilityLabel={`${rec.calories} calories a day`}>
          <Text variant="numberXL">{fmt(rec.calories)}</Text>
          <Text variant="h3" tone="muted">
            kcal a day
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {macros.map((m) => (
          <View key={m.label} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.raised }}>
            <Text variant="h3" style={{ color: m.color }}>
              {m.value} g
            </Text>
            <Text variant="caption" tone="muted">
              {m.label}
            </Text>
          </View>
        ))}
      </View>
      {rates.length ? (
        <View style={{ gap: 6 }}>
          <Text variant="label" tone="muted">
            Pace, per week
          </Text>
          <Segmented options={rates.map((r) => ({ value: String(r.value), label: r.label }))} value={String(rate)} onChange={(v) => setRate(Number(v))} stretch />
        </View>
      ) : null}
      <Text variant="small" tone="muted">
        Your body uses about {fmt(rec.tdee)} kcal a day. Eating {fmt(rec.calories)} should help you {paceText(goal, rate)}.
        {rec.floorApplied ? ` Pango will not go below ${fmt(rec.calories)} kcal, so this is slower than the pace you picked.` : ''} It is a starting point from a standard
        formula, not medical advice; you can change it any time.
      </Text>
    </>
  );
}

function Dots({ step }: { step: number }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`Step ${step + 1} of ${STEPS}`} style={{ flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
      {Array.from({ length: STEPS }, (_, i) => (
        <View key={i} style={{ width: i === step ? 28 : 6, height: 6, borderRadius: 3, backgroundColor: i <= step ? colors.accent : colors.line }} />
      ))}
    </View>
  );
}

function Hero({ pose, height = 250, size = 200 }: { pose: Pose; height?: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height, borderRadius: 36, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
      <Pango pose={pose} size={size} />
    </View>
  );
}

function Heading({ title, body, pose }: { title: string; body: string; pose?: Pose }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      {pose ? (
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <Pango pose={pose} crop="face" size={46} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Text variant={pose ? 'title' : 'display'} accessibilityRole="header">
          {title}
        </Text>
        <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
          {body}
        </Text>
      </View>
    </View>
  );
}
