import type { AudioTrackItem, OfflineAudioRecord } from '../types/media';

const DB_NAME = 'surdrishyo_offline_audio_v1';
const STORE_NAME = 'tracks';
const DB_VERSION = 1;

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open offline storage'));
  });
}

export async function saveAudioOffline(track: AudioTrackItem): Promise<OfflineAudioRecord> {
  const response = await fetch(track.audioUrl);
  if (!response.ok) {
    throw new Error(`অডিও ডাউনলোড করা যায়নি (${response.status})`);
  }
  const blob = await response.blob();
  const record: OfflineAudioRecord = {
    id: track.id,
    title: track.title,
    artist: track.artist,
    category: track.category,
    durationLabel: track.durationLabel,
    durationSeconds: track.durationSeconds,
    coverUrl: track.coverUrl,
    mimeType: blob.type || 'audio/wav',
    sizeBytes: blob.size,
    savedAt: Date.now(),
    blob,
  };

  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to store offline audio'));
  });
  db.close();
  return record;
}

export async function getAllOfflineAudio(): Promise<OfflineAudioRecord[]> {
  const db = await openOfflineDb();
  const records = await new Promise<OfflineAudioRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as OfflineAudioRecord[]) || []);
    req.onerror = () => reject(req.error || new Error('Failed to read offline audio'));
  });
  db.close();
  return records.sort((a, b) => b.savedAt - a.savedAt);
}

export async function getOfflineAudioRecord(trackId: string): Promise<OfflineAudioRecord | null> {
  const db = await openOfflineDb();
  const record = await new Promise<OfflineAudioRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(trackId);
    req.onsuccess = () => resolve((req.result as OfflineAudioRecord) || null);
    req.onerror = () => reject(req.error || new Error('Failed to read offline track'));
  });
  db.close();
  return record;
}

export async function removeOfflineAudio(trackId: string): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(trackId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete offline audio'));
  });
  db.close();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function downloadAudioToDevice(track: AudioTrackItem): Promise<void> {
  // Prefer already-cached offline blob if present so downloads even work offline!
  const offline = await getOfflineAudioRecord(track.id).catch(() => null);
  let blobUrl: string;
  let shouldRevoke = false;

  if (offline?.blob) {
    blobUrl = URL.createObjectURL(offline.blob);
    shouldRevoke = true;
  } else {
    const resp = await fetch(track.downloadUrl || track.audioUrl);
    if (!resp.ok) throw new Error('ডাউনলোড শুরু করা যায়নি');
    const blob = await resp.blob();
    blobUrl = URL.createObjectURL(blob);
    shouldRevoke = true;
  }

  const safeTitle = track.title.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim() || track.id;
  const ext = track.audioUrl.endsWith('.mp3') ? 'mp3' : 'wav';
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = `${safeTitle}.${ext}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  if (shouldRevoke) {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  }
}
