import { useState } from 'react';
import { Image, View } from 'react-native';

import type { MealType } from '../data/dates';
import type { DiaryEntry } from '../data/repo';
import { photoFor } from '../scan/photos';
import { useTheme } from '../theme/theme';
import { Icon, type IconName } from './Icon';

const MEAL_ICON: Record<MealType, IconName> = { breakfast: 'sun', lunch: 'flame', dinner: 'flame', snack: 'sparkle' };
export const MEAL_TINT = { breakfast: 'carbs', lunch: 'good', dinner: 'protein', snack: 'fat' } as const;

/** The scan photo kept on the phone, or an icon for the meal. */
export function EntryThumb({ entry, size = 38, rounded = size / 2 }: { entry: DiaryEntry; size?: number; rounded?: number }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const photo = failed ? null : photoFor(entry.scanId);
  const tint = colors[MEAL_TINT[entry.mealType]];
  if (photo) {
    return <Image source={{ uri: photo }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: rounded }} accessibilityIgnoresInvertColors />;
  }
  const icon: IconName = entry.source === 'scan' ? 'scan' : entry.source === 'barcode' ? 'search' : MEAL_ICON[entry.mealType];
  return (
    <View style={{ width: size, height: size, borderRadius: rounded, backgroundColor: tint + '22', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={Math.round(size * 0.52)} color={tint} />
    </View>
  );
}
