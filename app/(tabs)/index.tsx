import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Pango } from '../../src/pango/Pango';
import { useTheme } from '../../src/theme/theme';
import { radius, spacing } from '../../src/theme/tokens';
import { Card, Icon, ProgressBar, Ring, Screen, Text, type IconName } from '../../src/ui';

// Sample numbers until the data layer (step 2) feeds this screen from the phone's database.
const DAY = {
  goal: 2000,
  eaten: 1240,
  streak: 6,
  macros: [
    { key: 'protein', label: 'Protein', eaten: 62, goal: 130 },
    { key: 'carbs', label: 'Carbs', eaten: 148, goal: 220 },
    { key: 'fat', label: 'Fat', eaten: 41, goal: 65 },
  ] as const,
  meals: [
    { name: 'Oats with banana', meal: 'Breakfast', kcal: 320, icon: 'sun' as IconName, tint: 'carbs' as const },
    { name: 'Chicken and rice', meal: 'Lunch, scanned', kcal: 540, icon: 'scan' as IconName, tint: 'good' as const },
    { name: 'Rusks and coffee', meal: 'Snack', kcal: 380, icon: 'flame' as IconName, tint: 'fat' as const },
  ],
  water: { glasses: 4, goal: 8, litres: 1.2, goalLitres: 2.5 },
};

export default function Today() {
  const { colors } = useTheme();
  const left = Math.max(0, DAY.goal - DAY.eaten);
  const date = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' });
  const tint = { carbs: colors.carbs, good: colors.good, fat: colors.fat };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <Pango crop="face" size={40} motion={false} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h2">Hey there</Text>
          <Text variant="small" tone="muted">
            {date}
          </Text>
        </View>
        <View accessibilityLabel={`${DAY.streak} day streak`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: spacing.md, borderRadius: 18, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}>
          <Icon name="flame" size={16} color={colors.warn} />
          <Text variant="label">{DAY.streak} days</Text>
        </View>
      </View>

      <Card padding={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <Ring value={DAY.eaten / DAY.goal} label={`${DAY.eaten} of ${DAY.goal} calories eaten`}>
          <Text variant="number">{DAY.eaten.toLocaleString('en-ZA')}</Text>
          <Text variant="caption" tone="muted">
            of {DAY.goal.toLocaleString('en-ZA')} kcal
          </Text>
        </Ring>
        <View style={{ flex: 1, gap: spacing.md }}>
          {DAY.macros.map((m) => (
            <View key={m.key} style={{ gap: 5 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption" tone={m.key}>
                  {m.label}
                </Text>
                <Text variant="caption">
                  {m.eaten} / {m.goal} g
                </Text>
              </View>
              <ProgressBar value={m.eaten / m.goal} color={colors[m.key]} label={`${m.label} ${m.eaten} of ${m.goal} grams`} />
            </View>
          ))}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Text variant="h3">Meals</Text>
        <Text variant="label" tone="accent">
          {left.toLocaleString('en-ZA')} kcal left
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        {DAY.meals.map((meal) => (
          <View key={meal.name} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, height: 62, paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: tint[meal.tint] + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={meal.icon} size={20} color={tint[meal.tint]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{meal.name}</Text>
              <Text variant="caption" tone="muted">
                {meal.meal}
              </Text>
            </View>
            <Text variant="bodyStrong">{meal.kcal}</Text>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/lab')}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 54, borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.lineStrong }}
        >
          <Icon name="plus" size={18} color={colors.muted} />
          <Text variant="bodyStrong" tone="muted">
            Add dinner
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, height: 62, paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
        <Icon name="drop" size={22} color={colors.water} />
        <Text variant="bodyStrong">Water</Text>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 4 }} accessibilityLabel={`${DAY.water.glasses} of ${DAY.water.goal} glasses`}>
          {Array.from({ length: DAY.water.goal }, (_, i) => (
            <View key={i} style={{ width: 12, height: 22, borderRadius: 6, backgroundColor: i < DAY.water.glasses ? colors.water : colors.track }} />
          ))}
        </View>
        <Text variant="label" tone="muted">
          {DAY.water.litres} / {DAY.water.goalLitres} L
        </Text>
      </View>

      <Text variant="caption" tone="muted" align="center">
        Sample day. Your own meals show here once sync is in.
      </Text>
    </Screen>
  );
}
