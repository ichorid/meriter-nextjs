import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

export const MAX_REFERENCES_PER_VARIANT = 10;
export const MAX_REFERENCE_SUMMARY = 280;
export const MAX_REFERENCE_URL_LENGTH = 2000;

export interface DocumentVariantReferenceInput {
  id?: string;
  url: string;
  summary: string;
  stance?: 'pro' | 'con';
}

export interface NormalizedDocumentVariantReference {
  id: string;
  url: string;
  summary: string;
  stance?: 'pro' | 'con';
}

/**
 * §17 — validate and normalize variant references (shared by service + tests).
 */
export function normalizeDocumentVariantReferences(
  refs: DocumentVariantReferenceInput[] | undefined,
): NormalizedDocumentVariantReference[] {
  if (!refs?.length) {
    return [];
  }
  const out: NormalizedDocumentVariantReference[] = [];
  for (const r of refs.slice(0, MAX_REFERENCES_PER_VARIANT)) {
    const rawUrl = (r.url ?? '').trim();
    if (!rawUrl) {
      throw new BadRequestException('Reference URL is required');
    }
    if (rawUrl.length > MAX_REFERENCE_URL_LENGTH) {
      throw new BadRequestException(
        `Reference URL must be at most ${MAX_REFERENCE_URL_LENGTH} characters`,
      );
    }
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException(`Invalid reference URL: ${rawUrl}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException('Reference URL must be http(s)');
    }
    const summary = (r.summary ?? '').trim();
    if (!summary) {
      throw new BadRequestException('Reference summary is required');
    }
    if (summary.length > MAX_REFERENCE_SUMMARY) {
      throw new BadRequestException(
        `Reference summary must be at most ${MAX_REFERENCE_SUMMARY} characters`,
      );
    }
    const entry: NormalizedDocumentVariantReference = {
      id: r.id ?? randomUUID(),
      url: rawUrl,
      summary,
    };
    if (r.stance === 'pro' || r.stance === 'con') {
      entry.stance = r.stance;
    }
    out.push(entry);
  }
  return out;
}
