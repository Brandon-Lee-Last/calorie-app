import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';

import { useData } from '../src/data/DataProvider';
import { mealForTime } from '../src/data/dates';
import { MEALS, emptyForm, formFromEntry, parseEntryForm, type EntryForm, type EntryFormErrors } from '../src/data/entryForm';
import { spacing } from '../src/theme/tokens';
import { Button, IconButton, Screen, Segmented, Text } from '../src/ui';
import { Field } from '../src/ui/Field';

/** Add a meal by hand, or change or delete one (opened with `?id=`). */
export default function AddEntry() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { repo } = useData();
  const [form, setForm] = useState<EntryForm>(() => emptyForm(mealForTime()));
  const [errors, setErrors] = useState<EntryFormErrors>({});
  const [loaded, setLoaded] = useState(!id);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    repo.entry(id).then((e) => {
      if (e) setForm(formFromEntry(e));
      else setMissing(true);
      setLoaded(true);
    });
  }, [id, repo]);

  const set = (key: keyof EntryForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = async () => {
    const parsed = parseEntryForm(form);
    if (!parsed.ok) return setErrors(parsed.errors);
    setSaving(true);
    try {
      if (id) await repo.updateEntry(id, parsed.value);
      else await repo.addEntry(parsed.value);
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    }
  };

  const remove = () => {
    if (!id) return;
    Alert.alert('Delete this entry?', form.name || undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          repo.deleteEntry(id).then(() => router.back(), (e) => Alert.alert('Could not delete', String(e)));
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="title" accessibilityRole="header">
            {id ? 'Edit entry' : 'Add food'}
          </Text>
          <IconButton icon="close" label="Close" onPress={() => router.back()} />
        </View>
        {missing ? (
          <Text variant="body" tone="muted">
            This entry is gone. It may have been deleted on another phone.
          </Text>
        ) : loaded ? (
          <>
            <Field label="What did you eat?" value={form.name} onChangeText={set('name')} placeholder={`Leave empty for "Quick add"`} maxLength={200} autoFocus={!id} autoCapitalize="sentences" error={errors.name} />
            <Field label="Calories" value={form.calories} onChangeText={set('calories')} keyboardType="decimal-pad" suffix="kcal" error={errors.calories} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Field label="Protein" value={form.proteinG} onChangeText={set('proteinG')} keyboardType="decimal-pad" suffix="g" error={errors.proteinG} style={{ flex: 1 }} />
              <Field label="Carbs" value={form.carbG} onChangeText={set('carbG')} keyboardType="decimal-pad" suffix="g" error={errors.carbG} style={{ flex: 1 }} />
              <Field label="Fat" value={form.fatG} onChangeText={set('fatG')} keyboardType="decimal-pad" suffix="g" error={errors.fatG} style={{ flex: 1 }} />
            </View>
            <View style={{ gap: 6 }}>
              <Text variant="label" tone="muted">
                Meal
              </Text>
              <Segmented options={MEALS} value={form.mealType} onChange={(mealType) => setForm((f) => ({ ...f, mealType }))} stretch />
            </View>
            <Button title={id ? 'Save changes' : 'Add to today'} icon="check" onPress={save} loading={saving} />
            {id ? <Button title="Delete" variant="ghost" icon="trash" onPress={remove} /> : null}
            <Text variant="caption" tone="muted" align="center">
              Saved on this phone straight away, and backed up when you are online.
            </Text>
          </>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
