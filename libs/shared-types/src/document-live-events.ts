import { z } from 'zod';

export const DocumentLiveEventTypeSchema = z.enum([
  'document.updated',
  'block.locks_changed',
  'variant.proposed',
  'variant.withdrawn',
  'variant.applied',
  'vote.cast',
  'wave.closed',
]);

export type DocumentLiveEventType = z.infer<typeof DocumentLiveEventTypeSchema>;

export const DocumentLiveEventSchema = z.object({
  type: DocumentLiveEventTypeSchema,
  documentId: z.string().min(1),
  revision: z.number().int().positive(),
  emittedAt: z.string().datetime(),
  documentUpdatedAt: z.string().datetime().optional(),
  blockId: z.string().optional(),
  variantId: z.string().optional(),
  actorUserId: z.string().optional(),
});

export type DocumentLiveEvent = z.infer<typeof DocumentLiveEventSchema>;

export const DocumentLiveHeartbeatSchema = z.object({
  type: z.literal('heartbeat'),
});

export type DocumentLiveHeartbeat = z.infer<typeof DocumentLiveHeartbeatSchema>;

export const DocumentLiveSsePayloadSchema = z.union([
  DocumentLiveEventSchema,
  DocumentLiveHeartbeatSchema,
]);

export type DocumentLiveSsePayload = z.infer<typeof DocumentLiveSsePayloadSchema>;

/** Level A: default poll interval for open document pages (ms). */
export const DOCUMENT_LIVE_POLL_INTERVAL_MS = 20_000;

/** Level B: SSE heartbeat interval (ms). */
export const DOCUMENT_LIVE_SSE_HEARTBEAT_MS = 25_000;
