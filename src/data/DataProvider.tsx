import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useTheme } from '../theme/theme';
import { spacing } from '../theme/tokens';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';
import { startSync, type DataStack } from './stack';

const DataContext = createContext<DataStack | null>(null);

/** The data stack. Only usable under DataProvider, which renders nothing until the database is open. */
export function useData(): DataStack {
  const stack = useContext(DataContext);
  if (!stack) throw new Error('useData needs a DataProvider above it');
  return stack;
}

/**
 * Opens the data stack once, starts syncing, and provides it to the screens. `onReady` fires when the screens (or the
 * error screen) can show, which is when the splash screen should go.
 */
export function DataProvider({ open, onReady, children }: { open: () => Promise<DataStack>; onReady?: () => void; children: ReactNode }) {
  const [state, setState] = useState<{ stack?: DataStack; error?: unknown }>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    open().then(
      (stack) => {
        if (cancelled) return;
        stop = startSync(stack.sync);
        setState({ stack });
      },
      (error) => {
        if (!cancelled) setState({ error });
      },
    );
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [open, attempt]);

  const settled = !!state.stack || state.error !== undefined;
  useEffect(() => {
    if (settled) onReady?.();
  }, [settled, onReady]);

  const retry = () => {
    setState({});
    setAttempt((n) => n + 1);
  };
  if (state.error !== undefined) return <StartupError error={state.error} onRetry={retry} />;
  if (!state.stack) return null;
  return <DataContext.Provider value={state.stack}>{children}</DataContext.Provider>;
}

function StartupError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <Screen style={{ flexGrow: 1, justifyContent: 'center' }}>
      <EmptyState pose="oops" title="Pango could not open your diary" body="Your meals are stored on this phone. Something stopped the app reading them." />
      <Text variant="caption" align="center" style={{ color: colors.muted, marginBottom: spacing.md }} selectable>
        {error instanceof Error ? error.message : String(error)}
      </Text>
      <Button title="Try again" onPress={onRetry} />
    </Screen>
  );
}
