import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pango } from '../src/pango/Pango';
import { getModel } from '../src/scan/model';
import { brand, radius, spacing } from '../src/theme/tokens';
import { useTheme } from '../src/theme/theme';
import { Button, Icon, IconButton, Segmented, Text } from '../src/ui';

type Mode = 'plate' | 'barcode';
const MODES = [
  { value: 'plate', label: 'Plate' },
  { value: 'barcode', label: 'Barcode' },
] as const;
const BARCODES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];
const HINTS: Record<Mode, { title: string; sub: string; chip: string }> = {
  plate: { title: 'Whole plate in the frame', sub: 'From above works best. Pango counts it on your phone; the photo is not uploaded.', chip: 'On your phone' },
  barcode: { title: 'Point at the barcode', sub: 'Pango looks the product up in the food list. Needs a connection.', chip: 'Looks it up online' },
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The camera: photograph a plate for the on-phone model, or scan a barcode. */
export default function Lens() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const handled = useRef(false);
  const { mode: startMode } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(startMode === 'barcode' ? 'barcode' : 'plate');
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const hint = HINTS[mode];

  // Load the model while the person lines up the shot.
  useEffect(() => {
    getModel().catch(() => {});
  }, []);

  const toResult = (uri: string) => router.replace({ pathname: '/scan', params: { uri } });

  const shoot = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.9 });
      toResult(picture.uri);
    } catch (e) {
      setBusy(false);
      Alert.alert('Could not take the photo', message(e));
    }
  };

  const choose = async () => {
    if (busy) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = picked.assets?.[0];
    if (!picked.canceled && asset) toResult(asset.uri);
  };

  const onBarcode = (result: BarcodeScanningResult) => {
    if (handled.current || !result.data) return;
    handled.current = true;
    Haptics.selectionAsync().catch(() => {});
    router.replace({ pathname: '/food', params: { barcode: result.data } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        {permission?.granted ? (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: BARCODES }}
            onBarcodeScanned={mode === 'barcode' ? onBarcode : undefined}
            onMountError={(e) => Alert.alert('The camera did not start', e.message)}
          />
        ) : permission ? (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xxl, backgroundColor: colors.bg }]}>
            <Pango pose="think" size={140} />
            <Text variant="h2" align="center">
              Pango needs the camera to see your plate
            </Text>
            <Text variant="body" tone="muted" align="center">
              Photos are counted on your phone and stay there. You can also choose a photo you already took.
            </Text>
            {permission.canAskAgain ? (
              <Button title="Allow the camera" onPress={() => requestPermission()} style={{ alignSelf: 'stretch' }} />
            ) : (
              <Button title="Open settings" onPress={() => Linking.openSettings()} style={{ alignSelf: 'stretch' }} />
            )}
          </View>
        ) : null}

        {permission?.granted ? <Frame mode={mode} /> : null}

        <View style={{ position: 'absolute', left: spacing.xl, right: spacing.xl, top: insets.top + spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton icon="close" label="Close" tone="overlay" onPress={() => router.back()} />
          <View style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.overlay, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: brand.lime }} />
            <Text variant="label" style={{ color: '#F4F1EC' }}>
              {hint.chip}
            </Text>
          </View>
          <IconButton icon="bolt" label={torch ? 'Turn the light off' : 'Turn the light on'} tone={torch ? 'accent' : 'overlay'} onPress={() => setTorch((t) => !t)} />
        </View>
      </View>

      <View style={{ marginTop: -30, paddingTop: 14, paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 26, gap: 14, backgroundColor: colors.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64 }}>
          <View style={{ width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <Pango pose="scan" crop="face" size={46} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h3" style={{ fontSize: 16 }}>
              {hint.title}
            </Text>
            <Text variant="small" tone="muted">
              {hint.sub}
            </Text>
          </View>
        </View>
        <Segmented
          options={MODES}
          value={mode}
          onChange={(m) => {
            handled.current = false;
            setMode(m);
          }}
          stretch
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a photo"
            onPress={choose}
            style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="image" size={22} />
          </Pressable>
          {mode === 'plate' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take the photo"
              accessibilityState={{ disabled: busy || !permission?.granted, busy }}
              disabled={busy || !permission?.granted}
              onPress={shoot}
              style={({ pressed }) => ({ width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: colors.text, alignItems: 'center', justifyContent: 'center', opacity: permission?.granted ? 1 : 0.4, transform: [{ scale: pressed ? 0.94 : 1 }] })}
            >
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                {busy ? <ActivityIndicator color={colors.onAccent} /> : null}
              </View>
            </Pressable>
          ) : (
            <View style={{ width: 78, height: 78, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="search" size={28} color={colors.muted} />
            </View>
          )}
          <View style={{ width: 52 }} />
        </View>
      </View>
    </View>
  );
}

/** Lime corner marks where the plate (or barcode) should go. */
function Frame({ mode }: { mode: Mode }) {
  const corner = { position: 'absolute', width: 44, height: 44, borderColor: brand.lime } as const;
  const box = mode === 'plate' ? { left: '8%', right: '8%', top: '22%', bottom: '20%' } : { left: '10%', right: '10%', top: '36%', bottom: '38%' };
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>
      <View style={{ position: 'absolute', ...box } as const}>
        <View style={{ ...corner, left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 16 }} />
        <View style={{ ...corner, right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 16 }} />
        <View style={{ ...corner, left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 16 }} />
        <View style={{ ...corner, right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 16 }} />
        {mode === 'barcode' ? <View style={{ position: 'absolute', left: 12, right: 12, top: '50%', height: 3, borderRadius: 2, backgroundColor: brand.lime }} /> : null}
      </View>
    </View>
  );
}
