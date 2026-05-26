import {
  buildRevisionTokens,
  buildStructuredRevision,
  hasOfficialText,
  htmlToPlainText,
  liteWordDiff,
  variantDiffersFromOfficial,
} from './document-text-diff';

describe('document-text-diff', () => {
  it('strips HTML to plain text', () => {
    expect(htmlToPlainText('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('detects when variant differs from official', () => {
    expect(variantDiffersFromOfficial('one two', 'one two three')).toBe(true);
    expect(variantDiffersFromOfficial('same', 'same')).toBe(false);
  });

  it('builds revision tokens with insertions', () => {
    const tokens = buildRevisionTokens('one two', 'one two three');
    expect(tokens).not.toBeNull();
    expect(tokens?.some((t) => t.kind === 'insert' && t.value === 'three')).toBe(true);
  });

  it('treats empty official as full insertion in compare mode', () => {
    expect(buildRevisionTokens('', 'new proposal text')).toEqual([
      { kind: 'insert', value: 'new proposal text' },
    ]);
  });

  it('shows reorder as delete/insert in compare mode', () => {
    const tokens = buildRevisionTokens('two one', 'one two');
    expect(tokens?.some((t) => t.kind === 'delete')).toBe(true);
    expect(tokens?.some((t) => t.kind === 'insert')).toBe(true);
  });

  it('marks deletions from official', () => {
    const tokens = buildRevisionTokens('alpha beta gamma', 'alpha gamma');
    expect(tokens?.some((t) => t.kind === 'delete' && t.value === 'beta')).toBe(true);
  });

  it('preserves list structure in structured revision', () => {
    const official = '<ul><li>Список 1 1</li><li>Список 1 2</li><li>Список 1 3</li></ul>';
    const variant = '<ul><li>Список 1 1</li><li>Список 1 2</li><li>Список 1 3 11451</li></ul>';
    const structured = buildStructuredRevision(official, variant, 'list-bullet');
    expect(structured?.kind).toBe('list');
    if (structured?.kind !== 'list') return;
    expect(structured.items).toHaveLength(3);
    expect(structured.items[2]?.some((t) => t.kind === 'insert' && t.value === '11451')).toBe(true);
  });

  it('detects list type from blockType when html tags are missing', () => {
    const official = 'one\ntwo';
    const variant = 'one\ntwo three';
    const structured = buildStructuredRevision(official, variant, 'list-bullet');
    expect(structured?.kind).toBe('list');
  });
});
