import type { StoredTrack } from '../core/types';
const database = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('ridgeline-local', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('tracks', { keyPath: 'track.id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('浏览器未允许本地存储，请检查隐私模式或空间。'));
});
async function operation<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', mode);
    const request = action(tx.objectStore('tracks'));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('本地存储失败；请检查可用空间。')); };
  });
}
export const listTracks = () => operation<StoredTrack[]>('readonly', s => s.getAll());
export const saveTrack = (track: StoredTrack) => operation('readwrite', s => s.put(track));
export async function saveTracks(records: StoredTrack[]): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    for (const record of records) tx.objectStore('tracks').put(record);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('本地保存失败，所有本次路线均未写入；请检查可用空间。')); };
  });
}
export const deleteTrack = (id: string) => operation('readwrite', s => s.delete(id));
export async function hashFile(text: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(x => x.toString(16).padStart(2, '0')).join('');
}
