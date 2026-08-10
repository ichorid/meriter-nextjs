import { expandDeletionRangeStart } from '../src/domain/common/document-plain-range.util';

describe('expandDeletionRangeStart', () => {
  it('extends deletion start to the beginning of a Cyrillic word', () => {
    const plain = 'эффект.Тест прямой правки далее';
    const start = plain.indexOf('ест');
    expect(expandDeletionRangeStart(plain, start)).toBe(plain.indexOf('Тест'));
  });

  it('does not move start when already at a word boundary', () => {
    const plain = 'Тест прямой правки';
    const start = plain.indexOf('Т');
    expect(expandDeletionRangeStart(plain, start)).toBe(start);
  });
});
