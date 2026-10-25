import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '../src/data/DataProvider';
import { shiftDate } from '../src/data/dates';
import { RECAP_SHARED_KEY, useGoals, useRepoQuery, useSettings, useStreak, useToday } from '../src/data/hooks';
import { lastWeek, rangeText } from '../src/data/progress';
import { buildRecap, consistencyLine, shareText, weekdayName } from '../src/data/recap';
import { MyPango } from '../src/pango/MyPango';
import { brand } from '../src/theme/tokens';
import { Icon, Text } from '../src/ui';

const INK = brand.ink;
const PAGES = 3;
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Three tap-through cards about a week (the last finished one unless `start` is given). */
export default function Recap() {
  const params = useLocalSearchParams<{ start?: string }>();
  const today = useToday();
  const start = params.start ?? lastWeek(today).start;
  const insets = useSafeAreaInsets();
  const { repo } = useData();
  const goals = useGoals();
  const [{ waterGoalMl }] = useSettings();
  const streak = useStreak(today) ?? 0;
  const [page, setPage] = useState(0);
  const recap = useRepoQuery(
    ['diary', 'water'],
    async (r) => {
      const all = await r.entriesSince('0000-01-01');
      const end = shiftDate(start, 6);
      return buildRecap({ start, week: all.filter((e) => e.localDate >= start && e.localDate <= end), history: all.filter((e) => e.localDate < start), waterByDay: await r.waterByDay(), goals, waterGoalMl, streak });
    },
    [start, goals.calories, goals.proteinG, waterGoalMl, streak],
  );
  const label = rangeText(start, shiftDate(start, 6));
  const bg = [brand.guava, brand.periwinkle, brand.lime][page];
  const maxProtein = Math.max(1, ...(recap?.protein ?? [0]));

  const share = async () => {
    if (!recap) return;
    const result = await Share.share({ message: shareText(recap, label) });
    if (result.action === Share.sharedAction) await repo.setMeta(RECAP_SHARED_KEY, true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
      <View style={{ flexDirection: 'row', gap: 6 }} accessible accessibilityLabel={`Card ${page + 1} of ${PAGES}`}>
        {Array.from({ length: PAGES }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= page ? INK : `${INK}33` }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, zIndex: 2 }}>
        <Text variant="bodyStrong" style={{ color: INK }}>
          Pango recap
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close the recap" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${INK}1F`, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={20} color={INK} strokeWidth={2.6} />
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {/* Tap the left third to go back, anywhere else to go on. */}
        <View style={{ position: 'absolute', inset: 0, flexDirection: 'row', zIndex: 1 }} pointerEvents={page === PAGES - 1 ? 'box-none' : 'auto'}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous card" onPress={() => setPage((p) => Math.max(0, p - 1))} style={{ width: '33%' }} />
          {page < PAGES - 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Next card" onPress={() => setPage((p) => Math.min(PAGES - 1, p + 1))} style={{ flex: 1 }} /> : null}
        </View>

        {!recap ? null : page === 0 ? (
          <View style={{ flex: 1, paddingTop: 24 }}>
            <Text variant="eyebrow" style={{ color: INK, fontSize: 13 }}>
              Your week with Pango
            </Text>
            <Text variant="bodyStrong" style={{ color: INK, fontSize: 16, marginTop: 6 }}>
              {label}
            </Text>
            <View style={{ alignItems: 'center', marginVertical: 12 }}>
              <MyPango pose="cheer" moment="celebrate" size={220} />
            </View>
            <Text style={{ color: INK, fontSize: 80, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -4, lineHeight: 80 }} accessibilityLabel={`${recap.daysLogged} of 7 days logged`}>
              {recap.daysLogged} of 7
            </Text>
            <Text variant="h2" style={{ color: INK, fontSize: 24 }}>
              days logged
            </Text>
            <Text variant="bodyStrong" style={{ color: INK, fontSize: 16, marginTop: 6 }}>
              {consistencyLine(recap)}
            </Text>
          </View>
        ) : page === 1 ? (
          <View style={{ flex: 1, paddingTop: 24, gap: 18 }}>
            <View>
              <Text variant="eyebrow" style={{ color: INK, fontSize: 13 }}>
                Protein hero
              </Text>
              {recap.proteinHero ? (
                <>
                  <Text style={{ color: INK, fontSize: 56, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -2 }}>{weekdayName(recap.proteinHero.date)}</Text>
                  <Text variant="h2" style={{ color: INK }}>
                    {recap.proteinHero.grams} g of protein
                  </Text>
                </>
              ) : (
                <Text variant="h2" style={{ color: INK, marginTop: 6 }}>
                  No meals logged this week
                </Text>
              )}
            </View>
            <View accessible accessibilityLabel={`Protein per day: ${recap.protein.map((g, i) => `${DAY_LETTERS[i]} ${g} grams`).join(', ')}`} style={{ height: 170, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
              {recap.protein.map((g, i) => {
                const hero = recap.proteinHero && shiftDate(start, i) === recap.proteinHero.date;
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                    <View style={{ width: '100%', height: g ? Math.max(6, (g / maxProtein) * 150) : 0, borderRadius: 10, backgroundColor: hero ? INK : `${INK}40` }} />
                    <Text variant="caption" style={{ color: INK }}>
                      {DAY_LETTERS[i]}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="eyebrow" style={{ color: INK, fontSize: 13 }}>
                  Most logged
                </Text>
                <Text variant="h2" style={{ color: INK }}>
                  {recap.mostLogged ? `${recap.mostLogged.name}, ${recap.mostLogged.times} times` : 'Something different every time'}
                </Text>
              </View>
              <MyPango pose="eat" size={120} />
            </View>
          </View>
        ) : (
          <View style={{ flex: 1, paddingTop: 24 }}>
            <Text variant="eyebrow" style={{ color: INK, fontSize: 13 }}>
              Next week
            </Text>
            <Text style={{ color: INK, fontSize: 44, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -1.5, lineHeight: 46, marginTop: 6 }}>
              {recap.streak > 1 ? `Keep the ${recap.streak}-day streak going` : 'Start a new streak tomorrow'}
            </Text>
            <View style={{ alignItems: 'center', marginVertical: 8 }}>
              <MyPango pose="wave" size={180} />
            </View>
            <Text variant="bodyStrong" style={{ color: INK, fontSize: 17, lineHeight: 24 }}>
              One idea from Pango: {recap.tip}
            </Text>
            <View style={{ flex: 1 }} />
            <View style={{ gap: 10, zIndex: 2 }}>
              <Pressable accessibilityRole="button" onPress={share} style={{ height: 56, borderRadius: 28, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="h3" style={{ color: '#F4F1EC' }}>
                  Share my week
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ height: 48, borderRadius: 24, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="h3" style={{ color: INK, fontSize: 16 }}>
                  Done
                </Text>
              </Pressable>
            </View>
          </View>
        )}
        {page < PAGES - 1 ? (
          <Text variant="label" align="center" style={{ color: INK, opacity: 0.7 }}>
            Tap to continue
          </Text>
        ) : null}
      </View>
    </View>
  );
}
