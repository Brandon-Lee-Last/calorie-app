import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DataProvider } from '../src/data/DataProvider';
import { openAppData } from '../src/data/appData';
import { useAppFonts } from '../src/theme/fonts';
import { ThemeProvider, useTheme } from '../src/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Navigator() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="studio" options={{ presentation: 'modal' }} />
        <Stack.Screen name="lab" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const ready = useAppFonts();
  const hideSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <DataProvider open={openAppData} onReady={hideSplash}>
            <Navigator />
          </DataProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
