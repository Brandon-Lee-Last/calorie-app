import { fetchProducts, finishTransaction, getAvailablePurchases, initConnection, purchaseErrorListener, purchaseUpdatedListener, requestPurchase, type Purchase } from 'expo-iap';
import { Platform } from 'react-native';

/** A subscription as Google Play sells it to this person: the price in their currency and the offer to buy. */
export type StorePlan = { productId: string; price: string; amount: number | null; currency: string | null; offerToken: string | null };

let connecting: Promise<boolean> | null = null;

/** Whether Google Play Billing is there (it is not on the web, in tests, or in builds not installed from Play). */
export function storeAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(false);
  connecting ??= initConnection().then(
    (ok) => ok !== false,
    () => {
      connecting = null;
      return false;
    },
  );
  return connecting;
}

export async function loadStorePlans(productIds: string[]): Promise<StorePlan[]> {
  if (!productIds.length || !(await storeAvailable())) return [];
  const products = ((await fetchProducts({ skus: productIds, type: 'subs' })) ?? []) as {
    id: string;
    displayPrice: string;
    price?: number | null;
    currency?: string | null;
    subscriptionOffers?: { offerTokenAndroid?: string | null; displayPrice?: string }[] | null;
  }[];
  return products.map((p) => ({
    productId: p.id,
    price: p.subscriptionOffers?.[0]?.displayPrice ?? p.displayPrice,
    amount: p.price ?? null,
    currency: p.currency ?? null,
    offerToken: p.subscriptionOffers?.find((o) => o.offerTokenAndroid)?.offerTokenAndroid ?? null,
  }));
}

/** Opens Google Play's purchase sheet. Resolves with the purchase, or rejects if it fails or is cancelled. */
export function buy(plan: StorePlan): Promise<Purchase> {
  return new Promise((resolve, reject) => {
    const done = purchaseUpdatedListener((p) => {
      if (p.productId !== plan.productId) return;
      cleanup();
      resolve(p);
    });
    const failed = purchaseErrorListener((e) => {
      cleanup();
      reject(Object.assign(new Error(e.message || 'The purchase did not go through'), { code: e.code }));
    });
    const cleanup = () => {
      done.remove();
      failed.remove();
    };
    requestPurchase({
      type: 'subs',
      request: { google: { skus: [plan.productId], subscriptionOffers: plan.offerToken ? [{ sku: plan.productId, offerToken: plan.offerToken }] : undefined } },
    }).catch((e: unknown) => {
      cleanup();
      reject(e);
    });
  });
}

/** Tells Google Play the purchase was delivered; unacknowledged purchases are refunded after three days. */
export async function acknowledge(purchase: Purchase): Promise<void> {
  await finishTransaction({ purchase, isConsumable: false });
}

/** Subscriptions this Google account already owns, to restore on a new phone or account. */
export async function ownedSubscriptions(): Promise<Purchase[]> {
  if (!(await storeAvailable())) return [];
  return (await getAvailablePurchases()) ?? [];
}

export const purchaseToken = (p: Purchase): string | null => (p as { purchaseToken?: string | null }).purchaseToken ?? null;

/** True when the person closed the purchase sheet themselves. */
export const cancelled = (e: unknown) => /cancel/i.test(String((e as { code?: string })?.code ?? '')) || /cancel/i.test(e instanceof Error ? e.message : '');
