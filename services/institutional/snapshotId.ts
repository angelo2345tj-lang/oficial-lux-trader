/** Formato canônico: SYMBOL_TIMEFRAME_BAR_TS (ex: XAUUSD_60_1717000000000) */
const CANONICAL_SNAPSHOT = /^[A-Z0-9]{3,12}_\d+_\d{10,}$/;

export function isCanonicalSnapshotId(snapshotId: string | undefined | null): boolean {
  if (!snapshotId || typeof snapshotId !== 'string') return false;
  const id = snapshotId.trim().toUpperCase();
  if (id.includes('NODATA') || id.startsWith('SIG-')) return false;
  return CANONICAL_SNAPSHOT.test(id);
}

export function extractSnapshotIdFromSignalId(signalId: string): string | null {
  const m = /^SIG-([A-Z0-9]+_\d+_\d+)-/i.exec(signalId);
  return m ? m[1].toUpperCase() : null;
}

export function resolveSnapshotId(
  explicit: string | undefined,
  signalId?: string
): string | null {
  if (isCanonicalSnapshotId(explicit)) return explicit!.trim().toUpperCase();
  if (signalId) {
    const extracted = extractSnapshotIdFromSignalId(signalId);
    if (isCanonicalSnapshotId(extracted)) return extracted;
  }
  return null;
}
