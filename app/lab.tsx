import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { photoToRgb } from '../src/imaging/photoToRgb';
import { Button } from '../src/lab/Button';
import { Card } from '../src/lab/Card';
import { NotFoodCard } from '../src/lab/NotFoodCard';
import { NutritionResult } from '../src/lab/NutritionResult';
import { colors, spacing } from '../src/lab/theme';
import { type Nutrition, looksLikeFood } from '../src/model/contract';
import { type Delegate, type LoadedModel, estimate, loadNutritionModel } from '../src/model/nutritionModel';
import { type CheckResult, runSelfTests } from '../src/selfTest';

type Result = { nutrition: Nutrition; food: number | null; previewUri: string; prepMs: number; inferenceMs: number };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Model lab: the v0 test screen, kept for checking the on-device model on a phone (self-test, CPU/GPU, raw estimate). */
export default function ModelLab() {
  const insets = useSafeAreaInsets();
  const [delegate, setDelegate] = useState<Delegate>('cpu');
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [tests, setTests] = useState<CheckResult[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [estimateAnyway, setEstimateAnyway] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setModel(null);
    setModelError(null);
    setTests(null);
    loadNutritionModel(delegate)
      .then((loaded) => !cancelled && setModel(loaded))
      .catch((e) => !cancelled && setModelError(message(e)));
    return () => {
      cancelled = true;
    };
  }, [delegate]);

  const runTests = async () => {
    if (!model) return;
    setTesting(true);
    try {
      setTests(await runSelfTests(model.model, model.problems));
    } finally {
      setTesting(false);
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    if (!model || busy) return;
    setError(null);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Camera permission was denied. Allow it in system settings, or choose a photo instead.');
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
      const picked =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      const asset = picked.assets?.[0];
      if (picked.canceled || !asset) return;

      setBusy(true);
      const start = Date.now();
      const { rgb, previewUri } = await photoToRgb(asset.uri);
      const prepMs = Date.now() - start;
      const { nutrition, food, inferenceMs } = await estimate(model.model, rgb);
      setEstimateAnyway(false);
      setResult({ nutrition, food, previewUri, prepMs, inferenceMs });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const ready = !!model && model.problems.length === 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Model lab</Text>
          <Text style={styles.subtitle}>Rough estimates from a photo, all on this phone</Text>
        </View>
        <Text accessibilityRole="button" onPress={() => router.back()} style={styles.close}>
          Close
        </Text>
      </View>

      <Card title="Model">
        {modelError ? (
          <Text style={styles.bad}>Could not load the model: {modelError}</Text>
        ) : !model ? (
          <View style={styles.inline}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading model…</Text>
          </View>
        ) : (
          <>
            <Text style={model.problems.length ? styles.bad : styles.good}>
              {model.problems.length
                ? `Model does not match the contract: ${model.problems.join('; ')}`
                : `Ready · ${model.delegate === 'cpu' ? 'CPU' : 'GPU'} · loaded in ${model.loadMs} ms`}
            </Text>
          </>
        )}
        <View style={styles.row}>
          <Button title="CPU" variant={delegate === 'cpu' ? 'primary' : 'secondary'} onPress={() => setDelegate('cpu')} />
          <Button
            title="GPU (experimental)"
            variant={delegate === 'android-gpu' ? 'primary' : 'secondary'}
            onPress={() => setDelegate('android-gpu')}
          />
        </View>
      </Card>

      <Card title="Self-test">
        <Text style={styles.muted}>
          Runs the bundled golden photo through the model on this phone to check loading, tensor layout, output order and
          resizing.
        </Text>
        <View style={styles.row}>
          <Button title={testing ? 'Running…' : 'Run self-test'} variant="secondary" disabled={!ready || testing} onPress={runTests} />
        </View>
        {tests?.map((t) => (
          <View key={t.name} style={styles.check}>
            <Text style={t.ok ? styles.good : styles.bad}>
              {t.ok ? '✓' : '✗'} {t.name}
            </Text>
            <Text style={styles.muted}>{t.detail}</Text>
          </View>
        ))}
      </Card>

      <Card title="Photo">
        <View style={styles.row}>
          <Button title="Take photo" disabled={!ready || busy} onPress={() => pick('camera')} />
          <Button title="Choose photo" variant="secondary" disabled={!ready || busy} onPress={() => pick('library')} />
        </View>
        {busy ? (
          <View style={styles.inline}>
            <ActivityIndicator />
            <Text style={styles.muted}>Estimating…</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.bad}>{error}</Text> : null}
      </Card>

      {result ? (
        looksLikeFood(result.food) || estimateAnyway ? (
          <NutritionResult
            nutrition={result.nutrition}
            overridden={!looksLikeFood(result.food)}
            previewUri={result.previewUri}
            prepMs={result.prepMs}
            inferenceMs={result.inferenceMs}
          />
        ) : (
          <NotFoodCard food={result.food} previewUri={result.previewUri} onEstimateAnyway={() => setEstimateAnyway(true)} />
        )
      ) : null}

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          Estimates come from a small model trained on cafeteria photos and can be far off, especially for food unlike its
          training data. Not medical or dietary advice. Trained on Nutrition5k (Google Research, CC BY 4.0).
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  close: { fontSize: 16, fontWeight: '700', color: colors.accent, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', gap: spacing.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  check: { gap: 2 },
  muted: { fontSize: 13, color: colors.muted },
  good: { fontSize: 14, fontWeight: '600', color: colors.good },
  bad: { fontSize: 14, fontWeight: '600', color: colors.bad },
  notice: { backgroundColor: colors.warnBg, borderRadius: 12, padding: spacing.md },
  noticeText: { fontSize: 12, color: colors.warnText },
});
