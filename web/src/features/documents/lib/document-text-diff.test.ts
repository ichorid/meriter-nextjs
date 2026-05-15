import {
  htmlToPlainText,
  liteWordDiff,
  variantDiffersFromOfficial,
} from './document-text-diff';

describe('document-text-diff', () => {
  it('strips HTML to plain text', () => {
    expect(htmlToPlainText('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('detects when variant differs from official', () => {
    expect(variantDiffersFromOfficial('<p>Official</p>', '<p>Official changed</p>')).toBe(true);
    expect(variantDiffersFromOfficial('<p>Same</p>', '<p>Same</p>')).toBe(false);
  });

  it('marks new words in lite diff', () => {
    const tokens = liteWordDiff('one two', 'one two three');
    expect(tokens).not.toBeNull();
    expect(tokens?.filter((t) => t.kind === 'add').map((t) => t.value)).toEqual(['three']);
  });

  it('skips diff when official text is empty', () => {
    expect(liteWordDiff('', 'new proposal text')).toBeNull();
    expect(liteWordDiff('<p></p>', 'hello')).toBeNull();
  });

  it('returns null when only word order changes', () => {
    expect(liteWordDiff('alpha beta', 'beta alpha')).toBeNull();
  });
});
