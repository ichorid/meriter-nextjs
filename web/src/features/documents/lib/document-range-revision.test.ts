import { buildPlainTextRangeRevision } from '@/features/documents/lib/document-range-revision';

describe('buildPlainTextRangeRevision', () => {
  it('shows full document with a contiguous deletion', () => {
    const plain = 'Тест прямой правки';
    const revision = buildPlainTextRangeRevision(plain, 0, plain.length, '');
    expect(revision?.kind).toBe('flat');
    if (revision?.kind !== 'flat') {
      return;
    }
    expect(revision.tokens.every((t) => t.kind === 'delete' || t.kind === 'same')).toBe(true);
    expect(revision.tokens.some((t) => t.kind === 'delete')).toBe(true);
  });

  it('word-splits a replacement inside the edited span', () => {
    const plain = 'The quick brown fox';
    const start = plain.indexOf('brown');
    const end = start + 'brown'.length;
    const revision = buildPlainTextRangeRevision(plain, start, end, 'red');
    expect(revision?.kind).toBe('flat');
    if (revision?.kind !== 'flat') {
      return;
    }
    expect(revision.tokens.some((t) => t.kind === 'delete' && t.value === 'brown')).toBe(true);
    expect(revision.tokens.some((t) => t.kind === 'insert' && t.value === 'red')).toBe(true);
    expect(revision.tokens.some((t) => t.kind === 'same' && t.value.includes('quick'))).toBe(
      true,
    );
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
      { kind: 'delete', value: 'Beta' },
      { kind: 'same', value: ' Gamma' },
    ]);
  });
});
