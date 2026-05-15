import {
  referencesForPropose,
  validateReferenceDrafts,
} from './document-variant-reference';

describe('document-variant-reference', () => {
  it('validateReferenceDrafts accepts empty rows', () => {
    expect(validateReferenceDrafts([])).toBeNull();
    expect(validateReferenceDrafts([{ id: '1', url: '', summary: '' }])).toBeNull();
  });

  it('validateReferenceDrafts rejects invalid url', () => {
    expect(
      validateReferenceDrafts([{ id: '1', url: 'not-a-url', summary: 'note' }]),
    ).toBe('referenceUrlInvalid');
  });

  it('referencesForPropose strips empty rows', () => {
    const out = referencesForPropose([
      { id: '1', url: 'https://a.com', summary: 'A', stance: 'pro' },
      { id: '2', url: '', summary: '' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.stance).toBe('pro');
  });
});
