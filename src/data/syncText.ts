import type { SyncStatus } from './sync';

const changes = (n: number) => `${n} change${n === 1 ? '' : 's'}`;

/** One line on where the user's data stands. Everything is on the phone first; the backup is the server copy. */
export function describeSync(s: SyncStatus): { text: string; tone: 'muted' | 'good' | 'bad' } {
  switch (s.state) {
    case 'syncing':
      return { text: 'Backing up…', tone: 'muted' };
    case 'offline':
      return { text: s.pending ? `Offline. ${changes(s.pending)} saved on this phone, backed up when you are online.` : 'Offline. Everything is saved on this phone.', tone: 'muted' };
    case 'error':
      return { text: `Backup paused: ${s.lastError ?? 'unknown error'}. Your data is safe on this phone.`, tone: 'bad' };
    case 'signed-out':
      return { text: 'Not backed up: no account on this phone yet.', tone: 'muted' };
    case 'idle':
      if (s.pending) return { text: `${changes(s.pending)} waiting to back up.`, tone: 'muted' };
      return s.lastSyncedAt ? { text: 'Backed up.', tone: 'good' } : { text: 'Saved on this phone.', tone: 'muted' };
  }
}
