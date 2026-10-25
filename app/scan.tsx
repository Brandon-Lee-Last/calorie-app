import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '../src/data/DataProvider';
import { mealForTime, type MealType } from '../src/data/dates';
import { MEALS, mealLabel } from '../src/data/entryForm';
import type { ScanRecord } from '../src/data/repo';
import { looksLikeFood } from '../src/model/contract';
import { Pango } from '../src/pango/Pango';
import { analysePhoto, type Analysis } from '../src/scan/model';
import { keepPhoto } from '../src/scan/photos';
import { entryFromScan, portionLabel, scanRecord, shownFor, stepPortion, typicalErrorKcal, MAX_PORTION, MIN_PORTION } from '../src/scan/scanMath';
import { useTheme } from '../src/theme/theme';
import { brand, radius, spacing } from '../src/theme/tokens';
import { Button, Icon, IconButton, Segmented, Text } from '../src/ui';
import { Field } from '../src/ui/Field';

type State = { kind: 'analysing' } | { kind: 'error'; message: string } | { kind: 'ready'; analysis: Analysis };
const fmt = (n: number) => Math.round(n).toLocaleString('en-ZA');

/** The model's estimate for a photo: adjust the portion, name it, pick the meal, save. */
export default function ScanResult() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const { repo } = useData();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ kind: 'analysing' });
  const [anyway, setAnyway] = useState(false);
  const [portion, setPortion] = useState(1);
  const [name, setName] = useState('');
  const [meal, setMeal] = useState<MealType>(() => mealForTime());
  const [saving, setSaving] = useState(false);
  const recorded = useRef(false);

  useEffect(() => {
    let alive = true;
    if (!uri) return setState({ kind: 'error', message: 'No photo was passed in.' });
    analysePhoto(uri).then(
      (analysis) => alive && setState({ kind: 'ready', analysis }),
      (e) => alive && setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  const analysis = state.kind === 'ready' ? state.analysis : null;
  const notFood = !!analysis && !looksLikeFood(analysis.food) && !anyway;
  const shown = analysis ? shownFor(analysis.nutrition, portion) : null;

  /** One record per photo, whatever the person does with it. */
  const record = async (outcome: ScanRecord['outcome'], scanId = repo.newId()) => {
    if (recorded.current || !analysis) return;
    recorded.current = true;
    await repo.recordScan(
      scanId,
      scanRecord({ nutrition: analysis.nutrition, food: analysis.food, outcome, saved: outcome === 'saved' || outcome === 'edited' ? shown : null, portion, at: Date.now() }),
    );
  };

  const leave = (outcome: ScanRecord['outcome']) => {
    record(outcome).catch((e) => console.warn(e));
    router.back();
  };

  const save = async () => {
    if (!shown || saving) return;
    setSaving(true);
    try {
      const scanId = repo.newId();
      await keepPhoto(scanId, uri);
      await repo.addEntry(entryFromScan(shown, { scanId, name, mealType: meal }));
      await record(portion === 1 ? 'saved' : 'edited', scanId);
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
      <View style={{ height: 360, backgroundColor: '#1A1410' }}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
        <Corners />
        <View style={{ position: 'absolute', left: spacing.xl, right: spacing.xl, top: insets.top + spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <IconButton icon="close" label="Close" tone="overlay" onPress={() => leave(notFood ? 'not_food' : 'discarded')} />
          {analysis ? (
            <View style={{ height: 44, paddingHorizontal: spacing.lg, borderRadius: 22, backgroundColor: colors.overlay, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: notFood ? brand.amber : brand.lime }} />
              <Text variant="label" style={{ color: '#F4F1EC', fontSize: 14 }}>
                {notFood ? 'Not sure this is food' : 'Food spotted'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ flexGrow: 1, marginTop: -34, paddingTop: 14, paddingHorizontal: 22, paddingBottom: insets.bottom + 28, gap: 14, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.line, borderTopLeftRadius: 34, borderTopRightRadius: 34 }}>
        <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong }} />

        {state.kind === 'analysing' ? (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }} accessibilityLiveRegion="polite">
            <Pango pose="scan" size={120} />
            <Text variant="h3">Pango is looking…</Text>
            <Text variant="small" tone="muted" align="center">
              Counting on your phone. Nothing is uploaded.
            </Text>
          </View>
        ) : state.kind === 'error' ? (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
            <Pango pose="oops" size={120} />
            <Text variant="h3" align="center">
              Pango could not read that photo
            </Text>
            <Text variant="small" tone="muted" align="center" selectable>
              {state.message}
            </Text>
            <Button title="Try another photo" onPress={() => router.replace('/lens')} style={{ alignSelf: 'stretch' }} />
            <Button title="Add it by hand" variant="ghost" onPress={() => router.replace('/add')} />
          </View>
        ) : notFood ? (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
            <Pango pose="oops" size={120} />
            <Text variant="h2" align="center">
              This does not look like food
            </Text>
            <Text variant="body" tone="muted" align="center">
              Pango is not sure there is a meal in this photo. Try again with the whole plate in view, or ask for an estimate anyway.
            </Text>
            <Button title="Take another photo" onPress={() => leave('not_food')} style={{ alignSelf: 'stretch' }} />
            <Button title="Estimate anyway" variant="secondary" onPress={() => setAnyway(true)} style={{ alignSelf: 'stretch' }} />
          </View>
        ) : shown ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <Text variant="label" tone="muted">
                  Estimate for this plate
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }} accessible accessibilityLabel={`About ${shown.calories} calories`}>
                  <Text variant="numberXL">{fmt(shown.calories)}</Text>
                  <Text variant="h3" tone="muted">
                    kcal
                  </Text>
                </View>
              </View>
              <Pango pose="scan" size={66} />
            </View>
            <Text variant="small" tone="muted">
              It is an estimate, usually within {typicalErrorKcal(portion)} kcal. If it looks off, change the portion, or edit it after saving.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Tile value={`${shown.proteinG} g`} label="Protein" color={colors.protein} />
              <Tile value={`${shown.carbG} g`} label="Carbs" color={colors.carbs} />
              <Tile value={`${shown.fatG} g`} label="Fat" color={colors.fat} />
              <Tile value={`${shown.massG} g`} label="Weight" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, paddingLeft: 18, paddingRight: spacing.sm, borderRadius: 26, backgroundColor: colors.raised }}>
              <Text variant="bodyStrong">Portion</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Step icon="minus" label="Smaller portion" disabled={portion <= MIN_PORTION} onPress={() => setPortion((p) => stepPortion(p, -1))} />
                <Text variant="h3" style={{ minWidth: 92, textAlign: 'center', fontSize: 17 }} accessibilityLiveRegion="polite">
                  {portionLabel(portion)}
                </Text>
                <Step icon="plus" label="Bigger portion" disabled={portion >= MAX_PORTION} onPress={() => setPortion((p) => stepPortion(p, 1))} />
              </View>
            </View>
            <Field label="What is it? (optional)" value={name} onChangeText={setName} placeholder="Scanned meal" maxLength={200} autoCapitalize="sentences" />
            <Segmented options={MEALS} value={meal} onChange={setMeal} stretch />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title={`Save to ${mealLabel(meal).toLowerCase()}, ${fmt(shown.calories)} kcal`} onPress={save} loading={saving} style={{ flex: 1 }} />
              <IconButton icon="trash" label="Discard" onPress={() => leave('discarded')} style={{ width: 56, height: 56, borderRadius: 28 }} />
            </View>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Tile({ value, label, color }: { value: string; label: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, borderRadius: radius.md, backgroundColor: colors.raised }}>
      <Text variant="h3" style={{ fontSize: 17, color: color ?? colors.text }}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function Step({ icon, label, disabled, onPress }: { icon: 'plus' | 'minus'; label: string; disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
    >
      <Icon name={icon} size={20} />
    </Pressable>
  );
}

function Corners() {
  const c = { position: 'absolute', width: 48, height: 48, borderColor: brand.lime } as const;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 36, right: 36, top: 96, bottom: 56 }}>
      <View style={{ ...c, left: 0, top: 0, borderLeftWidth: 5, borderTopWidth: 5, borderTopLeftRadius: 16 }} />
      <View style={{ ...c, right: 0, top: 0, borderRightWidth: 5, borderTopWidth: 5, borderTopRightRadius: 16 }} />
      <View style={{ ...c, left: 0, bottom: 0, borderLeftWidth: 5, borderBottomWidth: 5, borderBottomLeftRadius: 16 }} />
      <View style={{ ...c, right: 0, bottom: 0, borderRightWidth: 5, borderBottomWidth: 5, borderBottomRightRadius: 16 }} />
    </View>
  );
}
