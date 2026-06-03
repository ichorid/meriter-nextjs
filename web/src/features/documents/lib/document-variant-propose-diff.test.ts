import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import { resolveProposeDiffPayload } from '@/features/documents/lib/document-variant-propose-diff';

describe('resolveProposeDiffPayload', () => {
  it('treats near-full deletion with a stray first letter as deleting the whole block', () => {
    const previous = '<p>Тест прямой правки</p>';
    const next = '<p>Т</p>';
    const payload = resolveProposeDiffPayload(previous, next);
    expect(payload).toEqual({
      mode: 'range',
      rangeStart: 0,
      rangeEnd: 'Тест прямой правки'.length,
      proposedText: '',
    });
  });

  it('deletes a whole phrase inside a long document when only the first letter was left in the editor', () => {
    const previous =
      '<p>Prefix эффект.</p><p>Тест прямой правки</p><p>Мир</p>';
    const next = '<p>Prefix эффект.</p><p>Т</p><p>Мир</p>';
    const payload = resolveProposeDiffPayload(previous, next);
    expect(payload.mode).toBe('range');
    if (payload.mode !== 'range') {
      return;
    }
    expect(payload.proposedText).toBe('');
    const plain = blockHtmlToPlainText(previous);
    const deleted = plain.slice(payload.rangeStart, payload.rangeEnd);
    expect(deleted).toBe('Тест прямой правки');
    const merged = plain.slice(0, payload.rangeStart) + plain.slice(payload.rangeEnd);
    expect(merged).not.toContain('Тест прямой правки');
    expect(merged).toContain('эффект.');
    expect(merged).toContain('Мир');
  });

  it('keeps a short intentional prefix when only a small tail is removed', () => {
    const previous = '<p>Hello world</p>';
    const next = '<p>Hello</p>';
    const payload = resolveProposeDiffPayload(previous, next);
    expect(payload.mode).toBe('range');
    if (payload.mode !== 'range') {
      return;
    }
    expect(payload.rangeStart).toBe(5);
    expect(payload.rangeEnd).toBe('Hello world'.length);
    expect(payload.proposedText).toBe('');
  });
});
