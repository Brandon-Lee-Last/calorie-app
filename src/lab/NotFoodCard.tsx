import { Image, StyleSheet, Text, View } from 'react-native';

import { FOOD_THRESHOLD } from '../model/contract';
import { Button } from './Button';
import { Card } from './Card';
import { colors, spacing } from './theme';

type Props = {
  /** Probability the photo shows food, as reported by the model. */
  food: number | null;
  previewUri: string;
  onEstimateAnyway: () => void;
};

export function NotFoodCard({ food, previewUri, onEstimateAnyway }: Props) {
  return (
    <Card title="Not food?">
      <View style={styles.row}>
        <Image source={{ uri: previewUri }} style={styles.preview} />
        <View style={styles.text}>
          <Text style={styles.headline}>This doesn't look like food</Text>
          <Text style={styles.muted}>
            The model puts the chance this is food at {food === null ? '?' : Math.round(food * 100)}% (below the{' '}
            {Math.round(FOOD_THRESHOLD * 100)}% cutoff), so no estimate is shown. Try a close-up of the meal in good
            light.
          </Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <Button title="Estimate anyway" variant="secondary" onPress={onEstimateAnyway} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  preview: { width: 96, height: 96, borderRadius: 10, backgroundColor: colors.bg },
  text: { flex: 1, gap: spacing.xs },
  headline: { fontSize: 18, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  buttons: { flexDirection: 'row' },
});
