import { buildPlainTextRangeRevision } from '@/features/documents/lib/document-range-revision';

describe('buildPlainTextRangeRevision', () => {
  it('shows full document with a contiguous deletion', () => {
    const plain = 'Тест прямой правки';
    const revision = buildPlainTextRangeRevision(plain, 0, plain.length, '');
    expect(revision?.kind).toBe('flat');
    if (revision?.kind !== 'flat') {
      return;
    }
    expect(revision.tokens).toEqual([{ kind: 'delete', value: plain }]);
  });

  it('keeps context before and after the edited span', () => {
    const plain = 'Alpha Beta Gamma';
    const revision = buildPlainTextRangeRevision(plain, 5, 10, '');
    expect(revision?.kind).toBe('flat');
    if (revision?.kind !== 'flat') {
      return;
    }
    expect(revision.tokens).toEqual([
      { kind: 'same', value: 'Alpha' },
      { kind: 'delete', value: ' Beta' },
      { kind: 'same', value: ' Gamma' },
    ]);
  });
});
