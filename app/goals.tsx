import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { useData } from '../src/data/DataProvider';
import { parseNumber } from '../src/data/entryForm';
import { useProfile } from '../src/data/hooks';
import { saveGoals } from '../src/data/profile';
import { parseGoals, type GoalErrors, type GoalForm } from '../src/data/goalForm';
import { DEFAULT_GOALS, type Goals } from '../src/data/settings';
import { spacing } from '../src/theme/tokens';
import { Button, IconButton, Screen, Text } from '../src/ui';
import { Field } from '../src/ui/Field';

/** Change the daily calorie and macro goals by hand, or go back to the worked-out plan. */
export default function GoalsScreen() {
  const { repo } = useData();
  const profile = useProfile();
  const g = profile?.goals ?? { ...DEFAULT_GOALS, custom: false };
  const [form, setForm] = useState<GoalForm>({ calories: String(g.calories), proteinG: String(g.proteinG), carbG: String(g.carbG), fatG: String(g.fatG) });
  const [errors, setErrors] = useState<GoalErrors>({});
  const set = (k: keyof Goals) => (t: string) => {
    setForm((f) => ({ ...f, [k]: t }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const fromMacros = Math.round(4 * (parseNumber(form.proteinG) || 0) + 4 * (parseNumber(form.carbG) || 0) + 9 * (parseNumber(form.fatG) || 0));

  const save = async () => {
    const parsed = parseGoals(form);
    if (!parsed.ok) return setErrors(parsed.errors);
    await saveGoals(repo, parsed.value).catch((e) => Alert.alert('Could not save', String(e)));
    router.back();
  };
  const recommended = async () => {
    await saveGoals(repo, 'recommended');
    router.back();
  };

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title" accessibilityRole="header">
          Daily goals
        </Text>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </View>
      <Text variant="small" tone="muted">
        {g.custom ? 'You set these by hand.' : 'Worked out from your profile. Change them if a coach or dietitian gave you numbers.'}
      </Text>
      <Field label="Calories" value={form.calories} onChangeText={set('calories')} keyboardType="number-pad" suffix="kcal" error={errors.calories} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Field label="Protein" value={form.proteinG} onChangeText={set('proteinG')} keyboardType="number-pad" suffix="g" error={errors.proteinG} style={{ flex: 1 }} />
        <Field label="Carbs" value={form.carbG} onChangeText={set('carbG')} keyboardType="number-pad" suffix="g" error={errors.carbG} style={{ flex: 1 }} />
        <Field label="Fat" value={form.fatG} onChangeText={set('fatG')} keyboardType="number-pad" suffix="g" error={errors.fatG} style={{ flex: 1 }} />
      </View>
      <Text variant="caption" tone="muted">
        These macros add up to about {fromMacros.toLocaleString('en-ZA')} kcal.
      </Text>
      <Button title="Save goals" icon="check" onPress={save} />
      {g.custom ? <Button title="Use the recommended plan again" variant="ghost" onPress={recommended} /> : null}
    </Screen>
  );
}
