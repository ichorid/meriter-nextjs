export type DocumentVariantReferenceStance = 'pro' | 'con';

export interface DocumentVariantReferenceDraft {
  id: string;
  url: string;
  summary: string;
  stance?: DocumentVariantReferenceStance;
}

export interface DocumentVariantReference {
  id: string;
  url: string;
  summary: string;
  stance?: DocumentVariantReferenceStance;
}

export const MAX_DOCUMENT_VARIANT_REFERENCES = 10;
export const MAX_REFERENCE_SUMMARY_LENGTH = 280;
export const MAX_REFERENCE_URL_LENGTH = 2000;

export function createEmptyReferenceDraft(): DocumentVariantReferenceDraft {
  return {
    id: crypto.randomUUID(),
    url: '',
    summary: '',
  };
}

export function validateReferenceDrafts(
  refs: DocumentVariantReferenceDraft[],
): string | null {
  for (const r of refs) {
    const url = r.url.trim();
    const summary = r.summary.trim();
    if (!url && !summary) {
      continue;
    }
    if (!url) {
      return 'referenceUrlRequired';
    }
    if (url.length > MAX_REFERENCE_URL_LENGTH) {
      return 'referenceUrlTooLong';
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return 'referenceUrlInvalid';
      }
    } catch {
      return 'referenceUrlInvalid';
    }
    if (!summary) {
      return 'referenceSummaryRequired';
    }
    if (summary.length > MAX_REFERENCE_SUMMARY_LENGTH) {
      return 'referenceSummaryTooLong';
    }
  }
  return null;
}

export function parseVariantReferencesFromApi(raw: unknown): DocumentVariantReference[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
    .map((r) => ({
      id: String(r.id ?? ''),
      url: String(r.url ?? ''),
      summary: String(r.summary ?? ''),
      stance:
        r.stance === 'pro' || r.stance === 'con'
          ? (r.stance as DocumentVariantReferenceStance)
          : undefined,
    }))
    .filter((r) => r.id && r.url && r.summary);
}

export function referencesForPropose(
  refs: DocumentVariantReferenceDraft[],
): DocumentVariantReference[] {
  return refs
    .filter((r) => r.url.trim() && r.summary.trim())
    .slice(0, MAX_DOCUMENT_VARIANT_REFERENCES)
    .map((r) => ({
      id: r.id,
      url: r.url.trim(),
      summary: r.summary.trim(),
      ...(r.stance ? { stance: r.stance } : {}),
    }));
}
