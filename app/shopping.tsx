import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';

import { useData } from '../src/data/DataProvider';
import { isPlus } from '../src/data/entitlement';
import { useEntitlement, useGoals, useMealPlans, usePlanDiet, usePlanSwaps, useRepoQuery, useToday } from '../src/data/hooks';
import { gramsText, planDates, planDay, shoppingList, SHOPPING_TICKS_KEY } from '../src/data/mealPlan';
import { useTheme } from '../src/theme/theme';
import { radius, spacing } from '../src/theme/tokens';
import { Button, Chip, EmptyState, Icon, IconButton, Screen, Text } from '../src/ui';

const SPANS = [
  { days: 3, label: 'Next 3 days' },
  { days: 7, label: 'The week' },
] as const;

/** Plus: everything the planned days need, by shop aisle, to tick off or send to someone. */
export default function Shopping() {
  const { colors } = useTheme();
  const { repo } = useData();
  const today = useToday();
  const goals = useGoals();
  const plus = isPlus(useEntitlement());
  const data = useMealPlans().data;
  const [dietSlug] = usePlanDiet();
  const swaps = usePlanSwaps();
  const ticks = useRepoQuery(['meta'], (r) => r.getMeta<Record<string, boolean>>(SHOPPING_TICKS_KEY), []) ?? {};
  const [span, setSpan] = useState<number>(7);
  const diet = data?.diets.find((d) => d.slug === dietSlug && !d.locked);

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <IconButton icon="back" label="Back" onPress={() => router.back()} />
      <Text variant="h2" style={{ flex: 1 }} accessibilityRole="header">
        Shopping list
      </Text>
    </View>
  );
  if (!plus)
    return (
      <Screen>
        {header}
        <EmptyState pose="think" title="The shopping list comes with Plus" body="Plus plans the week ahead and adds up what to buy." />
        <Button title="See Plus" onPress={() => router.push('/plus')} />
      </Screen>
    );
  if (!data || !diet)
    return (
      <Screen>
        {header}
        <EmptyState pose="think" title="Pick a meal plan first" body="The list is made from your plan." />
        <Button title="Choose a style" onPress={() => router.push('/diets')} />
      </Screen>
    );

  const days = planDates(today, true)
    .slice(0, span)
    .map((d) => planDay(data, diet, d, goals.calories, swaps));
  const groups = shoppingList(days);
  const toggle = (name: string) => repo.setMeta(SHOPPING_TICKS_KEY, { ...ticks, [name]: !ticks[name] });
  const send = () =>
    Share.share({
      message: [`Shopping for ${span} days (${diet.title} plan, Pango)`, ...groups.flatMap((g) => ['', g.label, ...g.items.map((i) => `- ${i.name}: ${gramsText(i.grams)}`)])].join('\n'),
    }).catch(() => {});

  return (
    <Screen>
      {header}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {SPANS.map((s) => (
          <Chip key={s.days} label={s.label} selected={span === s.days} onPress={() => setSpan(s.days)} />
        ))}
      </View>
      <Text variant="small" tone="muted">
        Amounts as eaten (cooked rice, drained beans) for your portions. Round up to what the shop sells, and check the cupboard first.
      </Text>
      {groups.map((g) => (
        <View key={g.aisle} style={{ gap: spacing.xs }}>
          <Text variant="h3">{g.label}</Text>
          <View
            style={{
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            {g.items.map((i, n) => (
              <Pressable
                key={i.name}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!ticks[i.name] }}
                accessibilityLabel={`${i.name}, ${gramsText(i.grams)}`}
                onPress={() => toggle(i.name)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  minHeight: 48,
                  borderTopWidth: n ? 1 : 0,
                  borderColor: colors.line,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: ticks[i.name] ? colors.good : colors.lineStrong,
                    backgroundColor: ticks[i.name] ? colors.good : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {ticks[i.name] ? <Icon name="check" size={14} color={colors.bg} /> : null}
                </View>
                <Text
                  variant="body"
                  tone={ticks[i.name] ? 'muted' : 'default'}
                  style={{
                    flex: 1,
                    textDecorationLine: ticks[i.name] ? 'line-through' : 'none',
                  }}
                >
                  {i.name}
                </Text>
                <Text variant="body" tone="muted">
                  {gramsText(i.grams)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <Button title="Send the list" icon="share" onPress={send} />
      {Object.values(ticks).some(Boolean) ? <Button title="Untick everything" variant="ghost" onPress={() => repo.setMeta(SHOPPING_TICKS_KEY, {})} /> : null}
    </Screen>
  );
}
