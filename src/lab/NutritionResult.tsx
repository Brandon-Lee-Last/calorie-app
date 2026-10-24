import { Image, StyleSheet, Text, View } from 'react-native';

import {
  LABELS,
  type Nutrition,
  type NutritionKey,
  UNITS,
  roundForDisplay,
  typicalRange,
} from '../model/contract';
import { Card } from './Card';
import { colors, spacing } from './theme';

const MACROS: NutritionKey[] = ['protein', 'carb', 'fat', 'mass'];

type Props = {
  nutrition: Nutrition;
  /** Set when the user asked for an estimate although the model said this is not food. */
  overridden?: boolean;
  previewUri: string;
  prepMs: number;
  inferenceMs: number;
};

function Row({ k, value }: { k: NutritionKey; value: number }) {
  const { low, high } = typicalRange(k, value);
  return (
    <View style={styles.macro}>
      <Text style={styles.macroLabel}>{LABELS[k]}</Text>
      <Text style={styles.macroValue}>
        ≈ {roundForDisplay(k, value)} {UNITS[k]}
      </Text>
      <Text style={styles.macroRange}>
        {Math.round(low)}–{Math.round(high)}
      </Text>
    </View>
  );
}

export function NutritionResult({ nutrition, overridden, previewUri, prepMs, inferenceMs }: Props) {
  const { calories } = nutrition;
  return (
    <Card title="Estimate">
      {overridden ? (
        <Text style={styles.warning}>
          The model thought this was not food, so treat these numbers as meaningless.
        </Text>
      ) : null}
      <View style={styles.top}>
        <View style={styles.previewWrap}>
          <Image source={{ uri: previewUri }} style={styles.preview} />
          <Text style={styles.previewCaption}>What the model saw</Text>
        </View>
        <View style={styles.calories}>
          <Text style={styles.caloriesValue}>≈ {roundForDisplay('calories', calories)}</Text>
          <Text style={styles.caloriesUnit}>kcal</Text>
          <Text style={styles.muted}>
            typically off by about ±{Math.round(typicalRange('calories', calories).high - calories)} kcal
          </Text>
        </View>
      </View>
      <View style={styles.macros}>
        {MACROS.map((k) => (
          <Row key={k} k={k} value={nutrition[k]} />
        ))}
      </View>
      <Text style={styles.muted}>
        Ranges are the model's average error on cafeteria photos, not a guarantee. Photo prep {prepMs} ms · model{' '}
        {inferenceMs} ms.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  previewWrap: { alignItems: 'center', gap: spacing.xs },
  preview: { width: 112, height: 112, borderRadius: 10, backgroundColor: colors.bg },
  previewCaption: { fontSize: 11, color: colors.muted },
  calories: { flex: 1, gap: 2 },
  caloriesValue: { fontSize: 44, fontWeight: '800', color: colors.text },
  caloriesUnit: { fontSize: 16, fontWeight: '600', color: colors.muted, marginTop: -6 },
  macros: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  macro: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: spacing.md,
    gap: 2,
  },
  macroLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  macroValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  macroRange: { fontSize: 12, color: colors.muted },
  muted: { fontSize: 12, color: colors.muted },
  warning: { fontSize: 13, fontWeight: '600', color: colors.bad },
});
