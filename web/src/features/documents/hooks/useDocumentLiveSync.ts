'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  DocumentLiveSsePayloadSchema,
  DOCUMENT_LIVE_POLL_INTERVAL_MS,
  type DocumentLiveEvent,
} from '@meriter/shared-types';
import { trpc } from '@/lib/trpc/client';

export type UseDocumentLiveSyncOptions = {
  documentId: string;
  enabled: boolean;
  userId?: string | null;
  /** Level A: poll interval for document + variants (ms). */
  pollIntervalMs?: number;
  /** Level B: subscribe to SSE push stream. */
  sseEnabled?: boolean;
  onRemoteActivity?: (event: DocumentLiveEvent) => void;
};

export { DOCUMENT_LIVE_POLL_INTERVAL_MS };

export function useDocumentLiveSync({
  documentId,
  enabled,
  userId,
  pollIntervalMs = DOCUMENT_LIVE_POLL_INTERVAL_MS,
  sseEnabled = true,
  onRemoteActivity,
}: UseDocumentLiveSyncOptions): { lastRevision: number } {
  const utils = trpc.useUtils();
  const lastRevisionRef = useRef(0);
  const onRemoteActivityRef = useRef(onRemoteActivity);
  onRemoteActivityRef.current = onRemoteActivity;

  const invalidateForEvent = useCallback(
    (event: DocumentLiveEvent) => {
      const invalidateVariants = () => {
        void utils.documentVariants.listByDocument.invalidate({ documentId });
        if (event.blockId) {
          void utils.documentVariants.listByBlock.invalidate({
            documentId,
            blockId: event.blockId,
          });
        }
      };

      switch (event.type) {
        case 'variant.proposed':
        case 'variant.withdrawn':
        case 'vote.cast':
          invalidateVariants();
          return;
        case 'block.locks_changed':
          void utils.documents.getById.invalidate({ id: documentId });
          return;
        case 'document.updated':
        case 'variant.applied':
        case 'wave.closed':
          void utils.documents.getById.invalidate({ id: documentId });
          invalidateVariants();
      }
    },
    [documentId, utils.documentVariants.listByBlock, utils.documentVariants.listByDocument, utils.documents.getById],
  );

  const handleLiveEvent = useCallback(
    (event: DocumentLiveEvent) => {
      lastRevisionRef.current = Math.max(lastRevisionRef.current, event.revision);
      invalidateForEvent(event);
      const fromOther = Boolean(userId && event.actorUserId && event.actorUserId !== userId);
      if (fromOther) {
        onRemoteActivityRef.current?.(event);
      }
    },
    [invalidateForEvent, userId],
  );

  useEffect(() => {
    if (!enabled || !sseEnabled || !documentId || typeof window === 'undefined') {
      return;
    }

    let disposed = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (disposed) {
        return;
      }
      const since = lastRevisionRef.current;
      const url = `/api/v1/documents/${encodeURIComponent(documentId)}/live?since=${since}`;
      es = new EventSource(url, { withCredentials: true });

      es.onmessage = (message) => {
        try {
          const parsed = DocumentLiveSsePayloadSchema.safeParse(JSON.parse(message.data));
          if (!parsed.success) {
            return;
          }
          const payload = parsed.data;
          if (payload.type === 'heartbeat') {
            return;
          }
          handleLiveEvent(payload);
        } catch {
          // ignore malformed payloads
        }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (!disposed) {
          reconnectTimer = setTimeout(connect, 5_000);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      es?.close();
    };
  }, [documentId, enabled, handleLiveEvent, sseEnabled]);

  return { lastRevision: lastRevisionRef.current };
}

/** Query options for Level A polling on the document detail page. */
export function documentLiveQueryOptions(pollIntervalMs = DOCUMENT_LIVE_POLL_INTERVAL_MS): {
  refetchInterval: number;
  refetchIntervalInBackground: boolean;
  refetchOnWindowFocus: boolean;
} {
  return {
    refetchInterval: pollIntervalMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  };
}
