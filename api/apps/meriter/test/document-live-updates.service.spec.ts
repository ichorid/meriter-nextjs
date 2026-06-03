import { DocumentLiveUpdatesService } from '../src/domain/services/document-live-updates.service';

describe('DocumentLiveUpdatesService', () => {
  it('publishes monotonic revisions per document', () => {
    const service = new DocumentLiveUpdatesService();
    const collected: number[] = [];
    const sub = service.stream('doc-1', 0).subscribe((payload) => {
      if (payload.type !== 'heartbeat') {
        collected.push(payload.revision);
      }
    });

    service.publish({
      type: 'variant.proposed',
      documentId: 'doc-1',
      blockId: 'block-1',
    });
    service.publish({
      type: 'vote.cast',
      documentId: 'doc-1',
      blockId: 'block-1',
    });

    expect(collected).toEqual([1, 2]);
    sub.unsubscribe();
    service.onModuleDestroy();
  });

  it('filters events with since revision', () => {
    const service = new DocumentLiveUpdatesService();
    service.publish({ type: 'document.updated', documentId: 'doc-2' });
    service.publish({ type: 'wave.closed', documentId: 'doc-2', blockId: 'b1' });

    const collected: number[] = [];
    const sub = service.stream('doc-2', 1).subscribe((payload) => {
      if (payload.type !== 'heartbeat') {
        collected.push(payload.revision);
      }
    });

    service.publish({ type: 'variant.proposed', documentId: 'doc-2', blockId: 'b1' });

    expect(collected).toEqual([3]);
    sub.unsubscribe();
    service.onModuleDestroy();
  });
});
