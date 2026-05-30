import type { AuditEntry } from '../../types/execution';
export type { AuditEntry };
import { secureStorage } from './secureStorage';

const AUDIT_KEY = 'audit_log';
const MAX_ENTRIES = 500;
let cache: AuditEntry[] = [];
const listeners = new Set<(entries: AuditEntry[]) => void>();

async function load() {
  cache = (await secureStorage.get<AuditEntry[]>(AUDIT_KEY)) ?? [];
}

function emit() {
  listeners.forEach((cb) => cb([...cache]));
}

export const auditLog = {
  async init() {
    await load();
    emit();
  },

  async record(action: string, details: string, success: boolean, extra?: Partial<AuditEntry>) {
    const entry: AuditEntry = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action,
      details,
      success,
      timestamp: Date.now(),
      ...extra,
    };
    cache.unshift(entry);
    if (cache.length > MAX_ENTRIES) cache.length = MAX_ENTRIES;
    await secureStorage.set(AUDIT_KEY, cache);
    emit();
    return entry;
  },

  getEntries() {
    return [...cache];
  },

  subscribe(cb: (entries: AuditEntry[]) => void) {
    listeners.add(cb);
    cb([...cache]);
    return () => listeners.delete(cb);
  },

  async clear() {
    cache = [];
    await secureStorage.set(AUDIT_KEY, []);
    emit();
  },
};
