import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useData } from '../src/data/DataProvider';
import { LOOK_KEY, useStats, useToday, useWornLook } from '../src/data/hooks';
import { Pango } from '../src/pango/Pango';
import { SCARF_PATTERNS, type Outfit, type Pose } from '../src/pango/types';
import { HAT_COLOURS, SEEN_KEY, WARDROBE, blockerFor, describeLook, earnedIds, lookForOutfit, stateOf, type Item, type Slot, type WornLook } from '../src/pango/wardrobe';
import { useTheme } from '../src/theme/theme';
import { radius, spacing } from '../src/theme/tokens';
import { Icon, IconButton, Screen, Text } from '../src/ui';

const TABS: { slot: Slot; label: string; columns: number }[] = [
  { slot: 'outfit', label: 'Looks', columns: 5 },
  { slot: 'hat', label: 'Hats', columns: 5 },
  { slot: 'glasses', label: 'Specs', columns: 4 },
  { slot: 'scarf', label: 'Scarf', columns: 4 },
  { slot: 'scales', label: 'Scales', columns: 3 },
  { slot: 'pin', label: 'Pins', columns: 5 },
];
const SAME_KEYS = ['hat', 'hatColour', 'glasses', 'scarf', 'scarfPattern', 'pin', 'scales'] as const;

/** Try on everything, wear what is earned. Unlocks come from what you log, so they follow you to a new phone. */
export default function Wardrobe() {
  const { colors } = useTheme();
  const { repo } = useData();
  const today = useToday();
  const stats = useStats(today) ?? null;
  const worn = useWornLook();
  const [look, setLook] = useState<WornLook>(worn);
  const [tab, setTab] = useState<Slot>('outfit');
  const [justWore, setJustWore] = useState(false);

  useEffect(() => setLook(worn), [worn]);
  // Everything earned so far has now been seen (clears the "new" badge on Me). Keyed on the ids, not the stats
  // object: saving emits a change that re-reads the stats, which would otherwise save again, forever.
  const earnedKey = stats ? earnedIds(stats).join(',') : null;
  useEffect(() => {
    if (earnedKey !== null) repo.setMeta(SEEN_KEY, earnedKey ? earnedKey.split(',') : []).catch(() => {});
  }, [earnedKey, repo]);

  const blocker = blockerFor(look, stats);
  const same = SAME_KEYS.every((k) => look[k] === worn[k]);
  const pose: Pose = justWore ? 'cheer' : blocker ? 'think' : same ? 'idle' : 'wave';
  const choose = (patch: Partial<WornLook>) => {
    setJustWore(false);
    setLook((l) => ({ ...l, outfit: 'custom', ...patch }));
  };
  const pick = (i: Item) => {
    Haptics.selectionAsync().catch(() => {});
    if (i.slot === 'outfit') {
      setJustWore(false);
      setLook(lookForOutfit(i.id as Outfit));
    } else if (i.slot === 'glasses') choose({ glasses: i.id as WornLook['glasses'] });
    else if (i.slot === 'scales') choose({ scales: i.id as WornLook['scales'] });
    else if (i.slot === 'pin') choose({ pin: i.id as WornLook['pin'] });
    else if (i.slot === 'hat') choose({ hat: i.id as WornLook['hat'] });
    else choose({ scarf: i.id });
  };
  const selected = (i: Item) =>
    i.slot === 'outfit' ? look.outfit === i.id : i.slot === 'hat' ? look.hat === i.id : i.slot === 'glasses' ? look.glasses === i.id : i.slot === 'scarf' ? look.scarf === i.id : i.slot === 'scales' ? look.scales === i.id : look.pin === i.id;
  const surprise = () => {
    const any = (slot: Slot) => {
      const open = WARDROBE[slot].filter((i) => stateOf(i, stats).open);
      return open[Math.floor(Math.random() * open.length)].id;
    };
    setJustWore(false);
    setLook({
      outfit: 'custom',
      hat: any('hat') as WornLook['hat'],
      hatColour: HAT_COLOURS[Math.floor(Math.random() * HAT_COLOURS.length)],
      glasses: any('glasses') as WornLook['glasses'],
      scarf: any('scarf'),
      scarfPattern: SCARF_PATTERNS[Math.floor(Math.random() * SCARF_PATTERNS.length)],
      pin: any('pin') as WornLook['pin'],
      scales: any('scales') as WornLook['scales'],
    });
  };
  const wear = async () => {
    if (blocker || same) return;
    Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await repo.setMeta(LOOK_KEY, look);
    setJustWore(true);
  };
  const { outfit, ...parts } = look;
  const columns = TABS.find((t) => t.slot === tab)!.columns;

  return (
    <Screen gap={10}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <Text variant="h2" accessibilityRole="header" style={{ flex: 1 }}>
          Pango's wardrobe
        </Text>
      </View>

      <View style={{ height: 250, padding: 12, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center' }}>
        <View style={{ position: 'absolute', left: 14, top: 12, flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.bg }}>
          <Icon name="flame" size={14} color={colors.warn} />
          <Text variant="caption">{stats?.currentStreak ?? 0}-day streak</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Surprise me with a random look"
          onPress={surprise}
          style={{ position: 'absolute', right: 12, top: 10, zIndex: 1, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Icon name="sparkle" size={14} color={colors.accentText} />
          <Text variant="caption">Surprise me</Text>
        </Pressable>
        <Pango pose={pose} size={182} {...parts} outfit={outfit === 'custom' ? undefined : outfit} />
        <Text variant="label" tone="subtle" style={{ marginTop: -6 }} numberOfLines={1}>
          {describeLook(look)}
        </Text>
      </View>

      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
        {TABS.map((t) => {
          const on = t.slot === tab;
          return (
            <Pressable
              key={t.slot}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setTab(t.slot)}
              style={{ flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.accent : 'transparent' }}
            >
              <Text variant="caption" style={{ fontSize: 12, color: on ? colors.onAccent : colors.text }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {WARDROBE[tab].map((i) => (
          <Tile key={i.id} item={i} look={look} on={selected(i)} open={stateOf(i, stats).open} width={`${(100 - (columns - 1) * 2) / columns}%`} onPress={() => pick(i)} />
        ))}
      </View>

      {tab === 'hat' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          <Text variant="label" tone="muted">
            Hat colour
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {HAT_COLOURS.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityState={{ checked: look.hatColour === c }}
                accessibilityLabel={`Hat colour ${c}`}
                onPress={() => choose({ hatColour: c })}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: look.hatColour === c ? 3 : 2, borderColor: look.hatColour === c ? colors.text : '#4A2E1D' }}
              />
            ))}
          </View>
        </View>
      ) : null}
      {tab === 'scarf' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          <Text variant="label" tone="muted">
            Pattern
          </Text>
          <View style={{ flexDirection: 'row', gap: 4, padding: 3, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
            {SCARF_PATTERNS.map((p) => {
              const on = look.scarfPattern === p;
              return (
                <Pressable
                  key={p}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => choose({ scarfPattern: p })}
                  style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: on ? colors.accent : 'transparent' }}
                >
                  <Text variant="caption" style={{ color: on ? colors.onAccent : colors.text }}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <Text variant="small" tone={blocker ? 'subtle' : 'muted'} align="center" accessibilityLiveRegion="polite">
        {blocker ?? 'Everything here is earned, never sold.'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!blocker || same }}
        onPress={wear}
        style={{ height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: !blocker && !same ? colors.accent : colors.surface, borderWidth: !blocker && !same ? 0 : 1, borderColor: colors.line }}
      >
        <Text variant="h3" style={{ fontSize: 16, color: !blocker && !same ? colors.onAccent : colors.muted }}>
          {blocker ? 'Keep going to unlock this' : same ? (justWore ? 'Looking good!' : 'Pango is wearing this') : 'Wear this look'}
        </Text>
      </Pressable>
    </Screen>
  );
}

function Tile({ item, look, on, open, width, onPress }: { item: Item; look: WornLook; on: boolean; open: boolean; width: `${number}%`; onPress: () => void }) {
  const { colors } = useTheme();
  const preview: WornLook =
    item.slot === 'outfit'
      ? lookForOutfit(item.id as Outfit)
      : { ...look, outfit: 'custom', ...(item.slot === 'scarf' ? { scarf: item.id } : { [item.slot === 'glasses' ? 'glasses' : item.slot]: item.id }) };
  const { outfit, ...parts } = preview;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${item.name}${open ? '' : ', locked'}`}
      onPress={onPress}
      style={{ width, minHeight: 72, paddingVertical: 6, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: on ? colors.raised : colors.surface, borderWidth: 2, borderColor: on ? colors.accent : colors.line, opacity: open ? 1 : 0.75 }}
    >
      {item.slot === 'scarf' ? (
        <View style={{ height: 40, justifyContent: 'center' }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: item.id, borderWidth: 3, borderColor: '#4A2E1D' }} />
        </View>
      ) : (
        <View style={{ height: 40, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <Pango crop="face" size={36} motion={false} {...parts} outfit={outfit === 'custom' ? undefined : outfit} />
        </View>
      )}
      <Text variant="caption" style={{ fontSize: 11 }} numberOfLines={1}>
        {item.name}
      </Text>
      {!open ? (
        <View style={{ position: 'absolute', right: 4, top: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock" size={11} color={colors.muted} />
        </View>
      ) : null}
    </Pressable>
  );
}
