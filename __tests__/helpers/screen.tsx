import { render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { memorySecretStore } from '../../src/auth/secretStore';
import { DataProvider } from '../../src/data/DataProvider';
import { openStack, type DataStack } from '../../src/data/stack';
import { ThemeProvider } from '../../src/theme/theme';
import { FakeServer } from './fakeServer';
import { memoryDb } from './sqljsDb';

let n = 0;
export const ids = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

/** The real stack (SQL schema, repo, session, sync) on sql.js and the fake server. */
export async function testStack(server = new FakeServer()): Promise<DataStack> {
  return openStack({ db: await memoryDb(), store: memorySecretStore(), baseUrl: 'http://api.test', ids, deviceLabel: 'test', fetchImpl: (r) => server.fetch(r) });
}

/** A screen under the real providers. */
export async function renderWith(ui: ReactNode, stack: DataStack) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider scheme="dark">
        <DataProvider open={() => Promise.resolve(stack)}>{ui}</DataProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

export async function mount(ui: ReactNode, server = new FakeServer()) {
  const stack = await testStack(server);
  const view = await renderWith(ui, stack);
  return { view, stack, server };
}

/** Waits for the sync round started on mount to finish, so it does not run into the next test. */
export async function settle(stack: DataStack) {
  await waitFor(() => expect(stack.sync.current.state).toBe('idle'));
}
