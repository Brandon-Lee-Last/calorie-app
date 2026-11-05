import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { unwrap } from '../src/api/client';
import { ApiError } from '../src/api/errors';
import { useData } from '../src/data/DataProvider';
import { addsUp, parseFoodForm, type FoodForm as Form, type FoodFormErrors as Errors } from '../src/data/rewards';
import { useTheme } from '../src/theme/theme';
import { radius, spacing } from '../src/theme/tokens';
import { Button, IconButton, Screen, Text } from '../src/ui';
import { Field } from '../src/ui/Field';

/** Add a food to the food list from its pack, for everyone, and earn Pango Points. Opened with `?barcode=` from a scan. */
export default function NewFood() {
  const { colors } = useTheme();
  const { api, repo } = useData();
  const params = useLocalSearchParams<{ barcode?: string; name?: string; meal?: string }>();
  const [form, setForm] = useState<Form>({ name: params.name ?? '', brand: '', barcode: params.barcode ?? '', calories: '', protein: '', carbs: '', fat: '', serving: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const set = (key: keyof Form) => (text: string) => {
    setForm((f) => ({ ...f, [key]: text }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const parsed = parseFoodForm(form);
  const checks = parsed.ok ? addsUp({ calories: parsed.value.calories100g, protein: parsed.value.protein100g, carbs: parsed.value.carb100g, fat: parsed.value.fat100g }) : null;

  const save = async () => {
    const p = parseFoodForm(form);
    if (!p.ok) return setErrors(p.errors);
    setSaving(true);
    const id = repo.newId();
    try {
      await unwrap(api.PUT('/v1/foods/{id}', { params: { path: { id } }, body: { ...p.value, servingLabel: null, clientUpdatedAt: Date.now() } }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace({ pathname: '/food', params: { id, ...(params.meal ? { meal: params.meal } : {}), added: checks ? (p.value.barcode ? '20' : '10') : '0' } });
    } catch (e) {
      setSaving(false);
      if (e instanceof ApiError && e.status === 409) return setErrors({ barcode: 'You already added a food with this barcode.' });
      Alert.alert('Could not save the food', e instanceof ApiError && e.status === 0 ? 'Adding a food needs a connection.' : e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen gap={spacing.md} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">
          Add a food
        </Text>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </View>
      <Text variant="small" tone="muted">
        Copy it from the pack&apos;s nutrition table, per 100 g. It joins the food list for everyone, and you earn Pango Points: 20 with a barcode, 10 without (up to 5 foods a day).
      </Text>
      <Field label="Name" value={form.name} onChangeText={set('name')} placeholder="e.g. Ouma Buttermilk Rusks" autoCapitalize="sentences" maxLength={200} error={errors.name} />
      <Field label="Brand (optional)" value={form.brand} onChangeText={set('brand')} maxLength={100} />
      <Field label="Barcode (optional)" value={form.barcode} onChangeText={set('barcode')} keyboardType="number-pad" maxLength={14} error={errors.barcode} />
      <Text variant="label" tone="muted">
        Per 100 g
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Field label="Energy" value={form.calories} onChangeText={set('calories')} keyboardType="decimal-pad" suffix="kcal" error={errors.calories} style={{ flex: 1 }} />
        <Field label="Protein" value={form.protein} onChangeText={set('protein')} keyboardType="decimal-pad" suffix="g" error={errors.protein} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Field label="Carbs" value={form.carbs} onChangeText={set('carbs')} keyboardType="decimal-pad" suffix="g" error={errors.carbs} style={{ flex: 1 }} />
        <Field label="Fat" value={form.fat} onChangeText={set('fat')} keyboardType="decimal-pad" suffix="g" error={errors.fat} style={{ flex: 1 }} />
      </View>
      <Text variant="caption" tone="muted">
        Labels in kJ only? Divide by 4.18 for kcal.
      </Text>
      <Field label="One serving (optional)" value={form.serving} onChangeText={set('serving')} keyboardType="decimal-pad" suffix="g" error={errors.serving} />
      {checks === false ? (
        <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.raised }}>
          <Text variant="small" tone="bad">
            These numbers do not add up (energy should be close to 4 kcal per gram of protein and carbs and 9 per gram of fat). Check them against the label: a food that does not add up earns no points.
          </Text>
        </View>
      ) : null}
      <Button title="Add to the food list" icon="check" loading={saving} onPress={save} />
    </Screen>
  );
}
