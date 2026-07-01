/**
 * Resolve a client-supplied snapshot timestamp for checkout billing.
 * Returns the snapshot Date if valid (not in the future, after session start),
 * otherwise falls back to now.
 */
export function resolveSnapshotTime(snapshotAt: string | undefined, sessionStartedAt: string): Date {
  if (!snapshotAt) return new Date()
  const snapshot = new Date(snapshotAt)
  if (isNaN(snapshot.getTime())) return new Date()
  const now = new Date()
  const start = new Date(sessionStartedAt)
  if (snapshot > now || snapshot < start) return new Date()
  return snapshot
}
