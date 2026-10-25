import { Linking, View } from 'react-native';

import { useData } from '../data/DataProvider';
import { useRepoQuery, useServerConfig } from '../data/hooks';
import { UPDATE_DISMISSED_KEY, noticeFor, storeUrl } from '../data/serverConfig';
import { Pango } from '../pango/Pango';
import { useTheme } from '../theme/theme';
import { radius, spacing } from '../theme/tokens';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Screen } from './Screen';
import { Text } from './Text';

/** A note on Today when the server is under maintenance or a newer version is out. */
export function ServerNotice() {
  const { colors } = useTheme();
  const { repo } = useData();
  const config = useServerConfig();
  const dismissed = useRepoQuery(['meta'], (r) => r.getMeta<string>(UPDATE_DISMISSED_KEY), []);
  const notice = noticeFor(config, dismissed);
  if (!notice || notice.kind === 'required') return null;
  const update = notice.kind === 'update';
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 14, borderRadius: radius.lg, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}>
      <Icon name={update ? 'sparkle' : 'clock'} size={20} color={colors.accentText} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{update ? 'A new version of Pango is out' : 'Pango is having a short break'}</Text>
        <Text variant="caption" tone="muted">
          {update ? `Version ${notice.version} is ready in the Play Store.` : `${notice.message} Everything you log is kept on your phone and backed up afterwards.`}
        </Text>
        {update ? <Button title="Update" size="md" variant="secondary" onPress={() => Linking.openURL(storeUrl(config)).catch(() => {})} style={{ alignSelf: 'flex-start', marginTop: 6 }} /> : null}
      </View>
      {update ? <IconButton icon="close" label="Not now" onPress={() => repo.setMeta(UPDATE_DISMISSED_KEY, notice.version).catch(() => {})} /> : null}
    </View>
  );
}

/** Instead of the app, when the server no longer accepts this version: nothing would back up until it is updated. */
export function UpdateRequired() {
  const config = useServerConfig();
  return (
    <Screen style={{ justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <Pango pose="think" size={170} />
        <Text variant="title" align="center" accessibilityRole="header">
          Time to update Pango
        </Text>
        <Text variant="body" tone="muted" align="center">
          This version is too old for Pango's server, so your diary cannot be backed up. Everything on this phone is safe and comes along when you update.
        </Text>
        <Button title="Update in the Play Store" onPress={() => Linking.openURL(storeUrl(config)).catch(() => {})} style={{ alignSelf: 'stretch' }} />
      </View>
    </Screen>
  );
}
