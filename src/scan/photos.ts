import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Scan photos are kept on the phone only (for the diary's thumbnails), downsized, one file per scan id. Nothing here
 * throws: a missing photo just means no thumbnail.
 */
const folder = () => new Directory(Paths.document, 'scans');
const fileFor = (scanId: string) => new File(folder(), `${scanId}.jpg`);

export async function keepPhoto(scanId: string, uri: string): Promise<string | null> {
  try {
    folder().create({ intermediates: true, idempotent: true });
    const rendered = await ImageManipulator.manipulate(uri).resize({ width: 640 }).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    const target = fileFor(scanId);
    if (target.exists) target.delete();
    await new File(saved.uri).move(target);
    return target.uri;
  } catch (e) {
    console.warn('Could not keep the scan photo', e);
    return null;
  }
}

export function photoFor(scanId: string | null | undefined): string | null {
  if (!scanId) return null;
  try {
    const f = fileFor(scanId);
    return f.exists ? f.uri : null;
  } catch {
    return null;
  }
}

export function deletePhoto(scanId: string | null | undefined): void {
  if (!scanId) return;
  try {
    const f = fileFor(scanId);
    if (f.exists) f.delete();
  } catch {
    // nothing to clean up
  }
}

/** Removes every kept photo (the account was deleted). */
export function deleteAllPhotos(): void {
  try {
    const dir = folder();
    if (dir.exists) dir.delete();
  } catch {
    // nothing to clean up
  }
}
