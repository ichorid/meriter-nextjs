/**
 * Orchestration port (BC-06 / P-6): finalize collaborative-document voting waves
 * (periodic sweep + per-block finalize, auto-apply on auto-mode documents). Implemented
 * in application (FinalizeDocumentWaveUseCase), wired at the composition root (Zone 8
 * inversion).
 */
export const FINALIZE_DOCUMENT_WAVE_PORT = Symbol('FINALIZE_DOCUMENT_WAVE_PORT');

import type { DocumentVotingThreadRecord } from './document.persistence.port';

export interface FinalizeDocumentWavePort {
  /** Periodic sweep invoked by the document-wave cron. */
  execute(): Promise<void>;
  finalizeBlock(
    documentId: string,
    blockId: string,
    options?: { force?: boolean },
  ): Promise<void>;
  finalizeThread(
    thread: DocumentVotingThreadRecord,
    options?: { force?: boolean },
  ): Promise<void>;
}
