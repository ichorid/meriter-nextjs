import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import { resolveProposeDiffPayload } from '@/features/documents/lib/document-variant-propose-diff';

describe('resolveProposeDiffPayload', () => {
  const previous =
    '<p>Title</p><p>Keep this line.</p><p>правка с комментом</p><p>Footer</p>';
  const next = '<p>Title</p><p>Keep this line.</p><p>Footer</p>';

  it('uses range mode for a pure deletion (empty proposedText)', () => {
    const payload = resolveProposeDiffPayload(previous, next);
    expect(payload.mode).toBe('range');
    if (payload.mode !== 'range') {
      return;
    }
    expect(payload.proposedText).toBe('');
    expect(payload.rangeEnd).toBeGreaterThan(payload.rangeStart);
    const plain = blockHtmlToPlainText(previous);
    const merged = plain.slice(0, payload.rangeStart) + plain.slice(payload.rangeEnd);
    expect(merged).toBe(blockHtmlToPlainText(next));
  });
});
