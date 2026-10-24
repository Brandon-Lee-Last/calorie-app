import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Pango } from '../pango/Pango';
import type { Pose } from '../pango/types';
import { spacing } from '../theme/tokens';
import { Text } from './Text';

/** Pango with a short message, for screens with nothing to show yet. */
export function EmptyState({ pose = 'think', title, body, action }: { pose?: Pose; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
      <Pango pose={pose} size={160} />
      <Text variant="h2" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="body" tone="muted" align="center" style={{ maxWidth: 300 }}>
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}
