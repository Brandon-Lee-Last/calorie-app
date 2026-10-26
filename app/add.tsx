import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';

import { useData } from '../src/data/DataProvider';
import { mealForTime } from '../src/data/dates';
import { MEALS, emptyForm, formForGrams, formFromEntry, kcalPer100g, parseEntryForm, parseNumber, portionText, type EntryForm, type EntryFormErrors } from '../src/data/entryForm';
import type { MealType } from '../src/data/dates';
import type { DiaryEntry } from '../src/data/repo';
import { spacing } from '../src/theme/tokens';
import { Button, IconButton, Screen, Segmented, Text } from '../src/ui';
import { deletePhoto } from '../src/scan/photos';
import { Field } from '../src/ui/Field';

type Prefill = { name?: string; calories?: string; proteinG?: string; carbG?: string; fatG?: string; meal?: string };

/** A new entry's form, filled from search: the words typed, or a meal logged before. */
function startForm(p: Prefill): EntryForm {
  const meal = MEALS.some((m) => m.value === p.meal) ? (p.meal as MealType) : mealForTime();
  const form = emptyForm(meal);
  for (const key of ['name', 'calories', 'proteinG', 'carbG', 'fatG'] as const) if (p[key]) form[key] = p[key];
  return form;
}

/** Add a meal by hand, or change or delete one (opened with `?id=`). Search can fill a new one in. */
export default function AddEntry() {
  const { id, ...prefill } = useLocalSearchParams<Prefill & { id?: string }>();
  const { repo } = useData();
  const [form, setForm] = useState<EntryForm>(() => startForm(prefill));
  const [errors, setErrors] = useState<EntryFormErrors>({});
  const [loaded, setLoaded] = useState(!id);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  /** The entry as saved, when editing one; with its weight known, the amount can be changed and the numbers follow. */
  const [original, setOriginal] = useState<DiaryEntry | null>(null);
  const [gramsText, setGramsText] = useState('');

  useEffect(() => {
    if (!id) return;
    repo.entry(id).then((e) => {
      if (e) {
        setForm(formFromEntry(e));
        setScanId(e.scanId);
        setOriginal(e);
        setGramsText(e.quantityG ? String(Math.round(e.quantityG * 10) / 10) : '');
      } else setMissing(true);
      setLoaded(true);
    });
  }, [id, repo]);

  const set = (key: keyof EntryForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const grams = parseNumber(gramsText);
  const gramsError = original?.quantityG && !(grams !== null && grams > 0 && grams <= 5000) ? 'Enter grams from 1 to 5 000.' : undefined;
  const changeGrams = (text: string) => {
    setGramsText(text);
    const g = parseNumber(text);
    if (original && g !== null && g > 0 && g <= 5000) setForm((f) => formForGrams(f, original, g));
  };

  const save = async () => {
    const parsed = parseEntryForm(form);
    if (!parsed.ok) return setErrors(parsed.errors);
    if (gramsError) return;
    setSaving(true);
    try {
      if (id) {
        // A food, scan or barcode keeps where it came from; a new amount replaces the old one (and its servings).
        const kept = original && !['manual', 'quick_add'].includes(original.source) ? { source: original.source } : {};
        const portion = original?.quantityG && grams !== original.quantityG ? { quantityG: grams, servings: null } : {};
        await repo.updateEntry(id, { ...parsed.value, ...kept, ...portion });
      }
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
          repo.deleteEntry(id).then(
            () => {
              deletePhoto(scanId);
              router.back();
            },
            (e) => Alert.alert('Could not delete', String(e)),
          );
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
            <Field label="What did you eat?" value={form.name} onChangeText={set('name')} placeholder={`Leave empty for "Quick add"`} maxLength={200} autoFocus={!id && !prefill.name} autoCapitalize="sentences" error={errors.name} />
            <Field label="Calories" value={form.calories} onChangeText={set('calories')} keyboardType="decimal-pad" suffix="kcal" error={errors.calories} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Field label="Protein" value={form.proteinG} onChangeText={set('proteinG')} keyboardType="decimal-pad" suffix="g" error={errors.proteinG} style={{ flex: 1 }} />
              <Field label="Carbs" value={form.carbG} onChangeText={set('carbG')} keyboardType="decimal-pad" suffix="g" error={errors.carbG} style={{ flex: 1 }} />
              <Field label="Fat" value={form.fatG} onChangeText={set('fatG')} keyboardType="decimal-pad" suffix="g" error={errors.fatG} style={{ flex: 1 }} />
            </View>
            {original?.quantityG ? (
              <View style={{ gap: 6 }}>
                <Field label="Amount eaten" value={gramsText} onChangeText={changeGrams} keyboardType="decimal-pad" suffix="g" error={gramsError} />
                <Text variant="caption" tone="muted">
                  {kcalPer100g(original)} kcal per 100 g{original.servings ? `, logged as ${portionText(original)}` : ''}. The same food in a different amount has different calories: change the grams and the numbers above follow.
                </Text>
              </View>
            ) : null}
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
