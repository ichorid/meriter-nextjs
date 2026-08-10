/** Ephemeral locks for `finalizeExpiredWaveOnBlock` (unique `_id` per block). */
export const DOCUMENT_WAVE_FINALIZE_LOCKS_COLLECTION = 'document_wave_finalize_locks';

/** Locks older than this are considered orphaned (crash before release) and may be taken over. */
export const WAVE_FINALIZE_LOCK_STALE_MS = 10 * 60 * 1000;

export function documentWaveFinalizeLockId(documentId: string, blockId: string): string {
  return `${documentId}:${blockId}`;
}

export function documentVotingThreadFinalizeLockId(
  documentId: string,
  threadId: string,
): string {
  return `${documentId}:thread:${threadId}`;
}
