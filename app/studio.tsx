import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Pango } from '../src/pango/Pango';
import { OUTFITS, POSES, type Outfit, type Pose } from '../src/pango/types';
import { useTheme } from '../src/theme/theme';
import { radius, spacing } from '../src/theme/tokens';
import { Chip, IconButton, Screen, Segmented, Text } from '../src/ui';

const POSE_NAMES: Record<Pose, string> = {
  idle: 'Standing',
  wave: 'Hello',
  scan: 'Scanning',
  eat: 'Snacking',
  cheer: 'Cheering',
  think: 'Thinking',
  oops: 'Oops',
  sleep: 'Curled up',
  roll: 'Rolling',
};

/** A design check: Pango in every pose and outfit, on the phone itself. */
export default function Studio() {
  const { colors } = useTheme();
  const [pose, setPose] = useState<Pose>('wave');
  const [outfit, setOutfit] = useState<Outfit>('none');
  const [crop, setCrop] = useState<'full' | 'face'>('full');
  const [motion, setMotion] = useState<'on' | 'off'>('on');

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title">Pango studio</Text>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </View>
      <View style={{ height: 320, borderRadius: radius.xxl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
        <Pango pose={pose} outfit={outfit} crop={crop} motion={motion === 'on'} size={crop === 'face' ? 200 : 280} />
      </View>
      <Text variant="eyebrow" tone="muted">
        Pose
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {POSES.map((p) => (
          <Chip key={p} label={POSE_NAMES[p]} selected={p === pose} onPress={() => setPose(p)} />
        ))}
      </View>
      <Text variant="eyebrow" tone="muted">
        Outfit
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {OUTFITS.map((o) => (
          <Chip key={o} label={o === 'none' ? 'Classic' : o.charAt(0).toUpperCase() + o.slice(1)} selected={o === outfit} onPress={() => setOutfit(o)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
        <Segmented options={[{ value: 'full', label: 'Full body' }, { value: 'face', label: 'Face' }]} value={crop} onChange={setCrop} />
        <Segmented options={[{ value: 'on', label: 'Motion' }, { value: 'off', label: 'Still' }]} value={motion} onChange={setMotion} />
      </View>
    </Screen>
  );
}
