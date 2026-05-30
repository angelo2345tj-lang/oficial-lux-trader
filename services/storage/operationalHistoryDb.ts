import { TradeHistoryItem } from '../../types';

const DB_NAME = 'lux-trader-fx';
const DB_VERSION = 1;
const STORE = 'operational_history';
const LS_KEY = 'lux_history';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

function normalize(items: TradeHistoryItem[]): TradeHistoryItem[] {
  return items.map((item) => ({
    ...item,
    timestamp:
      typeof item.timestamp === 'string'
        ? item.timestamp
        : new Date(item.timestamp).toISOString(),
  }));
}

export async function loadHistory(): Promise<TradeHistoryItem[]> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const fromLs: TradeHistoryItem[] = raw ? JSON.parse(raw) : [];
    if (!('indexedDB' in window)) return normalize(fromLs);

    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const all = await new Promise<TradeHistoryItem[]>((resolve, reject) => {
      const r = store.getAll();
      r.onsuccess = () => resolve(normalize((r.result as TradeHistoryItem[]) ?? []));
      r.onerror = () => reject(r.error);
    });
    db.close();

    if (all.length >= fromLs.length) return all;
    if (fromLs.length > 0) {
      await saveHistory(fromLs);
      return fromLs;
    }
    return all;
  } catch {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? normalize(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
  }
}

export async function saveHistory(items: TradeHistoryItem[]): Promise<void> {
  const normalized = normalize(items);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(normalized));
  } catch {
    /* quota */
  }
  if (!('indexedDB' in window)) return;

  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    await new Promise<void>((resolve, reject) => {
      const clear = store.clear();
      clear.onsuccess = () => {
        let pending = normalized.length;
        if (pending === 0) {
          resolve();
          return;
        }
        for (const item of normalized) {
          const put = store.put(item);
          put.onsuccess = () => {
            pending -= 1;
            if (pending === 0) resolve();
          };
          put.onerror = () => reject(put.error);
        }
      };
      clear.onerror = () => reject(clear.error);
    });
    db.close();
  } catch {
    /* ignore idb errors — localStorage still holds data */
  }
}

export function subscribeHistoryStorage(onChange: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === LS_KEY) onChange();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
