import { Tabs } from 'expo-router/js-tabs';

import { useTheme } from '../../src/theme/theme';
import { TabBar } from '../../src/ui/TabBar';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="train" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
