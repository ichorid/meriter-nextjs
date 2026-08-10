import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  DOCUMENT_LIVE_SSE_HEARTBEAT_MS,
  type DocumentLiveEvent,
  type DocumentLiveEventType,
  type DocumentLiveSsePayload,
} from '@meriter/shared-types';
import { Observable, Subject, interval, map, merge, share } from 'rxjs';

export type PublishDocumentLiveEventInput = {
  type: DocumentLiveEventType;
  documentId: string;
  documentUpdatedAt?: Date | string | null;
  blockId?: string;
  variantId?: string;
  actorUserId?: string;
};

type DocumentRoom = {
  subject: Subject<DocumentLiveEvent>;
  revision: number;
};

@Injectable()
export class DocumentLiveUpdatesService implements OnModuleDestroy {
  private readonly logger = new Logger(DocumentLiveUpdatesService.name);
  private readonly rooms = new Map<string, DocumentRoom>();

  publish(input: PublishDocumentLiveEventInput): void {
    const room = this.getOrCreateRoom(input.documentId);
    room.revision += 1;
    const event: DocumentLiveEvent = {
      type: input.type,
      documentId: input.documentId,
      revision: room.revision,
      emittedAt: new Date().toISOString(),
      ...(input.documentUpdatedAt
        ? { documentUpdatedAt: toIso(input.documentUpdatedAt) }
        : {}),
      ...(input.blockId ? { blockId: input.blockId } : {}),
      ...(input.variantId ? { variantId: input.variantId } : {}),
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
    };
    room.subject.next(event);
    this.logger.debug(
      `document live ${input.type} doc=${input.documentId} rev=${event.revision}`,
    );
  }

  stream(documentId: string, sinceRevision = 0): Observable<DocumentLiveSsePayload> {
    const room = this.getOrCreateRoom(documentId);
    const events$ = room.subject.pipe(
      map((event) => event),
      share(),
    );
    const filtered$ = new Observable<DocumentLiveEvent>((subscriber) => {
      const sub = events$.subscribe({
        next: (event) => {
          if (event.revision > sinceRevision) {
            subscriber.next(event);
          }
        },
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });
      return () => sub.unsubscribe();
    });
    const heartbeat$ = interval(DOCUMENT_LIVE_SSE_HEARTBEAT_MS).pipe(
      map(() => ({ type: 'heartbeat' as const })),
    );
    return merge(filtered$, heartbeat$);
  }

  onModuleDestroy(): void {
    for (const room of this.rooms.values()) {
      room.subject.complete();
    }
    this.rooms.clear();
  }

  private getOrCreateRoom(documentId: string): DocumentRoom {
    let room = this.rooms.get(documentId);
    if (!room) {
      room = { subject: new Subject<DocumentLiveEvent>(), revision: 0 };
      this.rooms.set(documentId, room);
    }
    return room;
  }
}

function toIso(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}
