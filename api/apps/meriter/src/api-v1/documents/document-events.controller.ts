import {
  Controller,
  Logger,
  Param,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { UserGuard } from '../../user.guard';
import { DocumentLiveAccessService } from './document-live-access.service';
import { DocumentLiveUpdatesService } from '../../domain/services/document-live-updates.service';

type MessageEvent = {
  data: string | object;
};

@Controller('api/v1/documents')
@UseGuards(UserGuard)
export class DocumentEventsController {
  private readonly logger = new Logger(DocumentEventsController.name);

  constructor(
    private readonly liveUpdates: DocumentLiveUpdatesService,
    private readonly liveAccess: DocumentLiveAccessService,
  ) {}

  /**
   * SSE stream for collaborative document changes (Level B).
   * GET /api/v1/documents/:documentId/live?since=<revision>
   */
  @Sse(':documentId/live')
  async live(
    @Param('documentId') documentId: string,
    @Query('since') sinceRaw: string | undefined,
    @Req() req: { user: { id: string } },
  ): Promise<Observable<MessageEvent>> {
    await this.liveAccess.assertCanSubscribe(req.user.id, documentId);
    const sinceRevision = parseSinceRevision(sinceRaw);
    this.logger.debug(
      `SSE subscribe doc=${documentId} user=${req.user.id} since=${sinceRevision}`,
    );
    return this.liveUpdates.stream(documentId, sinceRevision).pipe(
      map((payload) => ({
        data: JSON.stringify(payload),
      })),
    );
  }
}

function parseSinceRevision(raw: string | undefined): number {
  if (!raw?.trim()) {
    return 0;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
