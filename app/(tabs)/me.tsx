import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Pango } from '../../src/pango/Pango';
import { useTheme } from '../../src/theme/theme';
import { radius, spacing } from '../../src/theme/tokens';
import { Card, Icon, Screen, Text, type IconName } from '../../src/ui';

function Row({ icon, title, body, onPress }: { icon: IconName; title: string; body: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}
    >
      <Icon name={icon} size={22} color={colors.accentText} />
      <View style={{ flex: 1, paddingVertical: spacing.md }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="muted">
          {body}
        </Text>
      </View>
      <Icon name="chevron" size={20} color={colors.muted} />
    </Pressable>
  );
}

export default function Me() {
  return (
    <Screen>
      <Text variant="title">Me</Text>
      <Card raised style={{ alignItems: 'center', gap: spacing.sm }}>
        <Pango pose="wave" size={150} />
        <Text variant="h3">Pango says hi</Text>
        <Text variant="small" tone="muted" align="center">
          Your profile, goals and Pango's wardrobe arrive with sign-in.
        </Text>
      </Card>
      <Row icon="sparkle" title="Pango studio" body="Every pose and outfit, live" onPress={() => router.push('/studio')} />
      <Row icon="scan" title="Model lab" body="Self-test and raw estimates from the on-phone model" onPress={() => router.push('/lab')} />
      <Text variant="caption" tone="muted" align="center">
        Version {Constants.expoConfig?.version ?? '?'}. Light or dark follows your phone.
      </Text>
    </Screen>
  );
}
