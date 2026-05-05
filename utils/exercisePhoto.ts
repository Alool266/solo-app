import { genId } from './id';
import * as FileSystem from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type ExercisePhotoSource = 'library' | 'camera';

/** Deletes persisted photo storage (native file, web blob, or no-op for data URLs). */
export async function deleteStoredExerciseImage(uri: string | undefined): Promise<void> {
  if (!uri) return;
  if (uri.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(uri);
    } catch {
      /* ignore */
    }
    return;
  }
  if (uri.startsWith('data:')) return;
  if (!uri.startsWith('file:')) return;
  const doc = FileSystem.documentDirectory;
  if (!doc || !uri.startsWith(doc)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    /* ignore */
  }
}

async function persistPick(uri: string): Promise<string> {
  const doc = FileSystem.documentDirectory;
  if (!doc) return uri;
  const dest = `${doc}ex-img-${genId()}.jpg`;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

function webAssetToDataUri(asset: ImagePickerAsset): string | null {
  const mime =
    asset.mimeType && typeof asset.mimeType === 'string' && asset.mimeType.startsWith('image/')
      ? asset.mimeType
      : 'image/jpeg';
  let out: string | null = null;
  if (asset.base64) {
    out = `data:${mime};base64,${asset.base64}`;
  } else if (asset.uri?.startsWith('data:')) {
    out = asset.uri;
  }
  try {
    if (asset.uri?.startsWith('blob:')) URL.revokeObjectURL(asset.uri);
  } catch {
    /* ignore */
  }
  return out;
}

/**
 * Start image picking on web in the same synchronous turn as the tap (required for mobile Safari).
 * Do not wrap this call in an async function before invoking.
 */
export function pickExerciseImageWebFromGesture(
  source: ExercisePhotoSource,
  onResult: (uri: string | null) => void
): void {
  if (Platform.OS !== 'web') {
    onResult(null);
    return;
  }
  const p =
    source === 'camera'
      ? ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.85,
          base64: true,
        })
      : ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.85,
          base64: true,
        });
  void p.then((shot) => {
    if (shot.canceled || !shot.assets?.[0]) {
      onResult(null);
      return;
    }
    onResult(webAssetToDataUri(shot.assets[0]));
  });
}

export async function pickExerciseImage(
  source: ExercisePhotoSource
): Promise<string | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      pickExerciseImageWebFromGesture(source, resolve);
    });
  }

  if (source === 'camera') {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) return null;
    const shot = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (shot.canceled || !shot.assets?.[0]?.uri) return null;
    return persistPick(shot.assets[0].uri);
  }

  const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!lib.granted) return null;
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  if (picked.canceled || !picked.assets?.[0]?.uri) return null;
  return persistPick(picked.assets[0].uri);
}
