import { router } from 'expo-router';
import { View } from 'react-native';

import { isPlus } from '../src/data/entitlement';
import { useEntitlement, useMealPlans, usePlanDiet, useProfile } from '../src/data/hooks';
import { suitsGoal, type Diet } from '../src/data/mealPlan';
import { useTheme } from '../src/theme/theme';
import { radius, spacing } from '../src/theme/tokens';
import { Button, EmptyState, Icon, IconButton, Screen, Text } from '../src/ui';

const GOAL_WORDS = {
  lose: 'losing weight',
  maintain: 'keeping your weight',
  gain: 'gaining weight',
} as const;

/** Pick a meal plan style. Pro styles are open with Plus. */
export default function Diets() {
  const plans = useMealPlans();
  const [current, setDiet] = usePlanDiet();
  const goal = useProfile()?.goal;
  const plus = isPlus(useEntitlement());
  const diets = plans.data?.diets ?? [];

  const choose = async (d: Diet) => {
    if (d.locked && !plus) return router.push('/plus');
    await setDiet(d.slug);
    router.replace('/plan');
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <Text variant="h2" style={{ flex: 1 }} accessibilityRole="header">
          Meal plan style
        </Text>
      </View>
      <Text variant="body" tone="muted">
        Every plan fits your calorie goal. Pick the way of eating you will enjoy: the one you stick to works best.
      </Text>
      {diets.length === 0 ? (
        plans.loading ? (
          <EmptyState pose="roll" title="Loading meal plans" />
        ) : (
          <EmptyState pose="sleep" title="Meal plans need a connection the first time" body="Open this again when you are online; after that they work offline." />
        )
      ) : (
        diets.map((d) => <DietCard key={d.slug} diet={d} chosen={d.slug === current} suits={suitsGoal(d, goal)} goal={goal} plus={plus} onChoose={() => choose(d)} />)
      )}
      <Text variant="caption" tone="muted" align="center">
        General guidance, not medical advice. Pregnant, under 18, or managing a health condition? Check with a doctor or registered dietitian first.
      </Text>
    </Screen>
  );
}

function DietCard({ diet, chosen, suits, goal, plus, onChoose }: { diet: Diet; chosen: boolean; suits: boolean; goal: string | null | undefined; plus: boolean; onChoose: () => void }) {
  const { colors } = useTheme();
  const locked = diet.locked && !plus;
  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: chosen ? 2 : 1,
        borderColor: chosen ? colors.accent : colors.line,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="h3" style={{ flex: 1 }}>
          {diet.title}
        </Text>
        {chosen ? (
          <Text variant="label" tone="accent">
            Your plan
          </Text>
        ) : diet.tier === 'pro' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {locked ? <Icon name="lock" size={14} color={colors.muted} /> : null}
            <Text variant="label" tone="muted">
              Plus
            </Text>
          </View>
        ) : (
          <Text variant="label" tone="good">
            Free
          </Text>
        )}
      </View>
      <Text variant="body">{diet.summary}</Text>
      {diet.highlights.map((h) => (
        <View
          key={h}
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            alignItems: 'center',
          }}
        >
          <Icon name="check" size={14} color={colors.good} />
          <Text variant="small" tone="muted" style={{ flex: 1 }}>
            {h}
          </Text>
        </View>
      ))}
      {suits && goal && goal in GOAL_WORDS ? (
        <Text variant="caption" tone="good">
          Suits {GOAL_WORDS[goal as keyof typeof GOAL_WORDS]}
        </Text>
      ) : null}
      {diet.caution ? (
        <Text variant="caption" tone="muted">
          {diet.caution}
        </Text>
      ) : null}
      <Button
        title={locked ? 'Unlock with Plus' : chosen ? 'See my plan' : `Use ${diet.title}`}
        variant={chosen || locked ? 'secondary' : 'primary'}
        size="md"
        onPress={onChoose}
        accessibilityLabel={locked ? `${diet.title}: unlock with Plus` : chosen ? 'See my plan' : `Use ${diet.title}`}
      />
    </View>
  );
}
