import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';

import { unwrap } from '../src/api/client';
import { useData } from '../src/data/DataProvider';
import { isPlus, refreshEntitlement } from '../src/data/entitlement';
import { useCachedApi, useEntitlement } from '../src/data/hooks';
import { MyPango } from '../src/pango/MyPango';
import { acknowledge, buy, cancelled, loadStorePlans, ownedSubscriptions, purchaseToken, storeAvailable, type StorePlan } from '../src/plus/billing';
import { useTheme } from '../src/theme/theme';
import { brand, radius, spacing } from '../src/theme/tokens';
import { Button, Icon, IconButton, Screen, Text } from '../src/ui';

const BENEFITS = ['Every training program and workout, not only the free ones', 'A year of weight trends on Progress', 'Supports Pango, so the free app stays free'];
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Plus: what it adds, the plans with Google Play's prices, buying, restoring. */
export default function Plus() {
  const { colors } = useTheme();
  const { api, repo } = useData();
  const entitlement = useEntitlement();
  const plus = isPlus(entitlement);
  const subscription = useCachedApi('subscription', (a) => unwrap(a.GET('/v1/subscription')), []);
  const products = subscription.data?.products ?? [];
  const [store, setStore] = useState<{ available: boolean; plans: StorePlan[] } | null>(null);
  const [choice, setChoice] = useState<string>('pro_yearly');
  const [busy, setBusy] = useState<'buy' | 'restore' | 'test' | null>(null);
  const [welcome, setWelcome] = useState(false);

  const ids = products.map((p) => p.id).join(',');
  useEffect(() => {
    let alive = true;
    (async () => {
      const available = await storeAvailable();
      const plans = available ? await loadStorePlans(ids ? ids.split(',') : []).catch(() => []) : [];
      if (alive) setStore({ available, plans });
    })();
    return () => {
      alive = false;
    };
  }, [ids]);

  const plans = products
    .filter((p) => p.plan === 'pro')
    .sort((a, b) => Number(b.period.includes('Y')) - Number(a.period.includes('Y')))
    .map((p) => {
      const sp = store?.plans.find((s) => s.productId === p.id);
      const yearly = p.period.includes('Y');
      const perMonth = yearly && sp?.amount && sp.currency ? new Intl.NumberFormat('en-ZA', { style: 'currency', currency: sp.currency }).format(sp.amount / 12) : null;
      return { id: p.id, yearly, trialDays: p.trialDays, store: sp, name: yearly ? 'Yearly' : 'Monthly', price: sp ? `${sp.price} a ${yearly ? 'year' : 'month'}` : 'Price from Google Play', note: perMonth ? `About ${perMonth} a month` : yearly ? 'Best value' : 'Pay as you go' };
    });
  const chosen = plans.find((p) => p.id === choice) ?? plans[0];

  const verify = async (productId: string, token: string) => {
    await unwrap(api.POST('/v1/subscription/verify', { body: { productId, purchaseToken: token } }));
  };

  const start = async () => {
    if (!chosen?.store) return;
    setBusy('buy');
    try {
      const purchase = await buy(chosen.store);
      const token = purchaseToken(purchase);
      if (!token) throw new Error('Google Play did not return a purchase token.');
      await verify(chosen.id, token); // the server checks it with Google before granting anything
      await acknowledge(purchase);
      await refreshEntitlement(repo, api);
      setWelcome(true);
    } catch (e) {
      if (!cancelled(e)) Alert.alert('Plus did not start', `${message(e)}\n\nIf you were charged, use "Restore purchase"; nothing is lost.`);
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const owned = await ownedSubscriptions();
      for (const p of owned) {
        const token = purchaseToken(p);
        if (token) await verify(p.productId, token).catch(() => {});
      }
      await unwrap(api.POST('/v1/subscription/restore'));
      const e = await refreshEntitlement(repo, api);
      Alert.alert(isPlus(e) ? 'Plus is back' : 'Nothing to restore', isPlus(e) ? 'Your subscription is linked to this account again.' : 'No active Plus subscription was found for this Google account.');
    } catch (e) {
      Alert.alert('Could not restore', message(e));
    } finally {
      setBusy(null);
    }
  };

  // Development builds only: the server grants test Plus when it runs with mock billing, never in production.
  const test = async () => {
    setBusy('test');
    try {
      await unwrap(api.POST('/v1/subscription/simulate', { body: { scenario: 'subscribe', productId: chosen?.id === 'pro_monthly' ? 'pro_monthly' : 'pro_yearly' } }));
      await refreshEntitlement(repo, api);
      setWelcome(true);
    } catch (e) {
      Alert.alert('This server does not allow test purchases', message(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen gap={14}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
        {!plus ? (
          <Pressable accessibilityRole="button" onPress={restore} disabled={!!busy} style={{ height: 44, justifyContent: 'center', paddingHorizontal: 6 }}>
            <Text variant="label" tone="muted" style={{ fontSize: 14 }}>
              {busy === 'restore' ? 'Restoring…' : 'Restore purchase'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ alignItems: 'center' }}>
        <MyPango pose="cheer" size={118} />
      </View>
      <View style={{ gap: 4 }}>
        <Text variant="title" align="center" style={{ fontSize: 34 }} accessibilityRole="header">
          Pango Plus
        </Text>
        <Text variant="body" tone="muted" align="center">
          {plus || welcome ? 'Thank you. Everything in Plus is open.' : 'Free stays free. Plus adds the extras.'}
        </Text>
      </View>

      <View style={{ gap: 9, paddingHorizontal: 4 }}>
        {BENEFITS.map((b) => (
          <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: brand.lime, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={14} color={brand.ink} strokeWidth={3.4} />
            </View>
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {b}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ padding: 12, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
        <Text variant="small" tone="subtle">
          Always free: scanning on your phone, the diary, water, streaks, the weekly recap, What fits and Pango's wardrobe.
        </Text>
      </View>

      {plus ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="body" align="center">
            {entitlement?.expiresAt
              ? `${entitlement.willRenew ? 'Renews' : 'Ends'} on ${new Date(entitlement.expiresAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}`
              : 'Plus is active.'}
            {entitlement?.inGrace ? ' Google Play could not take the last payment and is trying again.' : ''}
          </Text>
          <Button title="Manage in Google Play" variant="secondary" onPress={() => Linking.openURL('https://play.google.com/store/account/subscriptions')} />
        </View>
      ) : (
        <>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
            {plans.map((p) => {
              const on = chosen?.id === p.id;
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${p.name}, ${p.price}${p.trialDays ? `, ${p.trialDays} days free` : ''}`}
                  onPress={() => setChoice(p.id)}
                  style={{ flex: 1, gap: 3, padding: 12, paddingBottom: 14, borderRadius: radius.lg, backgroundColor: on ? colors.raised : colors.surface, borderWidth: 2, borderColor: on ? colors.accent : colors.line }}
                >
                  <View style={{ alignSelf: 'flex-start', height: 20, paddingHorizontal: 8, borderRadius: 10, justifyContent: 'center', backgroundColor: p.yearly ? brand.lime : 'transparent' }}>
                    <Text variant="caption" style={{ fontSize: 11, color: brand.ink }}>
                      {p.yearly ? 'Best value' : ''}
                    </Text>
                  </View>
                  <Text variant="bodyStrong">{p.name}</Text>
                  <Text variant="h3" style={{ fontSize: 16 }}>
                    {p.price}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {p.trialDays ? `${p.trialDays} days free, then billed` : p.note}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {!plans.length ? (
            <Text variant="small" tone="muted" align="center">
              {subscription.loading ? 'Loading the plans…' : 'The plans load when you are online.'}
            </Text>
          ) : null}
          <Button
            title={chosen ? `Start ${chosen.name.toLowerCase()} Plus` : 'Start Plus'}
            onPress={start}
            loading={busy === 'buy'}
            disabled={!chosen?.store || !!busy}
          />
          {store && !store.available ? (
            <Text variant="small" tone="muted" align="center">
              Buying works in the app installed from Google Play.
            </Text>
          ) : null}
          {__DEV__ ? <Button title="Test Plus on a development server" variant="ghost" onPress={test} loading={busy === 'test'} /> : null}
          <Text variant="caption" tone="muted" align="center">
            Billed by Google Play in your currency. Cancel any time in your Play subscriptions.
          </Text>
        </>
      )}
    </Screen>
  );
}
