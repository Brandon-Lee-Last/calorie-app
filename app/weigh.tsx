import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { useData } from '../src/data/DataProvider';
import { parseNumber } from '../src/data/entryForm';
import { useProfile } from '../src/data/hooks';
import { saveProfile } from '../src/data/profile';
import { MyPango } from '../src/pango/MyPango';
import { spacing } from '../src/theme/tokens';
import { Button, IconButton, Screen, Text } from '../src/ui';
import { Field } from '../src/ui/Field';

/** Log today's weight, or (with `mode=target`) set the goal weight. */
export default function Weigh() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const target = mode === 'target';
  const { repo } = useData();
  const profile = useProfile();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target && profile?.targetWeightKg) setText(String(profile.targetWeightKg));
    else if (!target) repo.weights('0000-01-01').then((w) => w.length && setText(String(w[w.length - 1].weightKg)));
  }, [target, profile?.targetWeightKg, repo]);

  const save = async () => {
    const kg = parseNumber(text);
    if (kg === null || Number.isNaN(kg) || kg < 30 || kg > 300) return setError('Enter kilograms, from 30 to 300.');
    setSaving(true);
    try {
      if (target) await saveProfile(repo, { targetWeightKg: Math.round(kg * 10) / 10 });
      else {
        await repo.addWeight(kg);
        // The server keeps the profile's weight (and goals worked out from it) in step; do the same on the phone.
        if (profile?.weightKg !== undefined) await saveProfile(repo, { weightKg: Math.round(kg * 10) / 10 });
      }
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    }
  };

  const clear = async () => {
    await saveProfile(repo, { targetWeightKg: null });
    router.back();
  };

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title" accessibilityRole="header">
          {target ? 'Goal weight' : 'Log my weight'}
        </Text>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </View>
      <View style={{ alignItems: 'center' }}>
        <MyPango pose={target ? 'think' : 'cheer'} size={140} />
      </View>
      <Field
        label={target ? 'Goal weight' : "Today's weight"}
        value={text}
        onChangeText={(t) => {
          setText(t);
          setError(null);
        }}
        keyboardType="decimal-pad"
        suffix="kg"
        autoFocus
        error={error}
      />
      <Text variant="small" tone="muted">
        {target
          ? 'Pango shows how far you have come towards it. Your daily calories come from your pace, not this number.'
          : 'Weigh at the same time of day for a fair trend; mornings before breakfast work well. Day-to-day jumps are mostly water.'}
      </Text>
      <View style={{ gap: spacing.sm }}>
        <Button title="Save" icon="check" onPress={save} loading={saving} />
        {target && profile?.targetWeightKg ? <Button title="Remove the goal weight" variant="ghost" onPress={clear} /> : null}
      </View>
    </Screen>
  );
}
