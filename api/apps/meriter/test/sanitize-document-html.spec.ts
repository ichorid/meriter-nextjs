import { sanitizeDocumentHtml } from '../src/common/utils/sanitize-document-html';

describe('sanitizeDocumentHtml', () => {
  it('strips script tags and event handlers', () => {
    const out = sanitizeDocumentHtml(
      '<p>Hello</p><script>alert(1)</script><img src=x onerror=alert(1)>',
    );
    expect(out).toContain('<p>Hello</p>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('onerror');
  });

  it('keeps allowed formatting tags', () => {
    const out = sanitizeDocumentHtml('<p><strong>Bold</strong></p>');
    expect(out).toBe('<p><strong>Bold</strong></p>');
  });

  it('returns empty for whitespace-only input', () => {
    expect(sanitizeDocumentHtml('   ')).toBe('');
  });
});
