/** Ephemeral locks for `finalizeExpiredWaveOnBlock` (unique `_id` per block). */
export const DOCUMENT_WAVE_FINALIZE_LOCKS_COLLECTION = 'document_wave_finalize_locks';

export function documentWaveFinalizeLockId(documentId: string, blockId: string): string {
  return `${documentId}:${blockId}`;
}
