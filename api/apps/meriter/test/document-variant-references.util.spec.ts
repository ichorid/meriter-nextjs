import { BadRequestException } from '@nestjs/common';
import {
  MAX_REFERENCE_URL_LENGTH,
  normalizeDocumentVariantReferences,
} from '../src/domain/common/document-variant-references.util';

describe('normalizeDocumentVariantReferences', () => {
  it('accepts valid http(s) references with stance', () => {
    const out = normalizeDocumentVariantReferences([
      {
        url: 'https://example.com/article',
        summary: 'Supports the change',
        stance: 'pro',
      },
      {
        url: 'http://other.org/page',
        summary: 'Counterpoint',
        stance: 'con',
      },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]?.url).toBe('https://example.com/article');
    expect(out[0]?.stance).toBe('pro');
    expect(out[1]?.stance).toBe('con');
    expect(out[0]?.id).toBeTruthy();
  });

  it('rejects non-http schemes', () => {
    expect(() =>
      normalizeDocumentVariantReferences([
        { url: 'javascript:alert(1)', summary: 'x' },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects empty summary', () => {
    expect(() =>
      normalizeDocumentVariantReferences([
        { url: 'https://example.com', summary: '   ' },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects URL longer than max', () => {
    const long = `https://example.com/${'a'.repeat(MAX_REFERENCE_URL_LENGTH)}`;
    expect(() =>
      normalizeDocumentVariantReferences([{ url: long, summary: 'ok' }]),
    ).toThrow(BadRequestException);
  });

  it('caps at 10 references', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      url: `https://example.com/${i}`,
      summary: `ref ${i}`,
    }));
    expect(normalizeDocumentVariantReferences(many)).toHaveLength(10);
  });
});
