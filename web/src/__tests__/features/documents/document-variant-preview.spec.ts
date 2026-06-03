import {
  buildVariantDisplayPreview,
  findPlainTextChangeBounds,
  resolveVariantChangeBounds,
} from '@/features/documents/lib/document-variant-preview';

describe('document-variant-preview', () => {
  const official = '<p>Hello world.</p>';

  it('detects append-only change at block end', () => {
    const variant = '<p>Hello world.</p><p>New line</p>';
    const bounds = findPlainTextChangeBounds('Hello world.', 'Hello world.\nNew line');
    expect(bounds?.rangeStart).toBe(12);
    expect(bounds?.rangeEnd).toBe(12);
    expect(bounds?.proposedText.trim()).toBe('New line');
    const preview = buildVariantDisplayPreview(official, { content: variant });
    expect(preview?.segments.some((s) => s.kind === 'insert')).toBe(true);
    const insert = preview?.segments.find((s) => s.kind === 'insert');
    expect(insert && insert.kind === 'insert' ? insert.html : '').toContain('New line');
  });

  it('uses stored range fields when present', () => {
    const bounds = resolveVariantChangeBounds(official, {
      content: '<p>Hello universe.</p>',
      rangeStart: 6,
      rangeEnd: 11,
      proposedText: '<p>universe</p>',
    });
    expect(bounds?.rangeStart).toBe(6);
    expect(bounds?.proposedText).toContain('universe');
  });

  it('shows previous block tail when edit starts at block start', () => {
    const preview = buildVariantDisplayPreview('<p>Second</p>', {
      content: '<p>Second</p>',
      rangeStart: 0,
      rangeEnd: 0,
      proposedText: '<p>Lead-in</p>',
    }, {
      prevBlockHtml: '<p>First block text here</p>',
    });
    expect(preview?.segments.some((s) => s.kind === 'context' && s.position === 'prevBlock')).toBe(
      true,
    );
  });
});
