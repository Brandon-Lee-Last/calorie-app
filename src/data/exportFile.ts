import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes the export to a file in the app's cache and opens Android's share sheet (save to Drive, email, and so on). */
export async function shareJson(name: string, data: unknown): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  await file.write(JSON.stringify(data, null, 2));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Pango data' });
}
