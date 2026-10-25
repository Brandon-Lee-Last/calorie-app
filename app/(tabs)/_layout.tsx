import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { useOnboarded } from '../../src/data/hooks';
import { useTheme } from '../../src/theme/theme';
import { TabBar } from '../../src/ui/TabBar';

export default function TabsLayout() {
  const { colors } = useTheme();
  const onboarded = useOnboarded();
  if (onboarded === undefined) return null;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="train" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
