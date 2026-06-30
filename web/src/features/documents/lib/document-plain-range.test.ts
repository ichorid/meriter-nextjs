import { expandDeletionRangeStart } from '@/features/documents/lib/document-plain-range';

describe('expandDeletionRangeStart', () => {
  it('includes the first letter when deletion started mid-word', () => {
    const plain = 'эффект.Тест прямой правки';
    const start = plain.indexOf('ест');
    expect(expandDeletionRangeStart(plain, start)).toBe(plain.indexOf('Тест'));
  });

  it('does not cross punctuation before the word', () => {
    const plain = 'эффект.Тест';
    const start = plain.indexOf('ест');
    expect(expandDeletionRangeStart(plain, start)).toBe(plain.indexOf('Т'));
  });
});
