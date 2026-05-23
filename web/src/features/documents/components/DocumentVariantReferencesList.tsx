'use client';

import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/shadcn/badge';
import type { DocumentVariantReference } from '@/features/documents/types/document-variant-reference';

export interface DocumentVariantReferencesListProps {
  references: DocumentVariantReference[];
  className?: string;
}

export function DocumentVariantReferencesList({
  references,
  className,
}: DocumentVariantReferencesListProps) {
  const t = useTranslations('pages.documents.references');

  const list = references.filter((r) => r.url?.trim() && r.summary?.trim());
  if (list.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-base-content/50">
        {t('listTitle')}
      </p>
      <ul className="flex flex-col gap-2">
        {list.map((ref) => (
          <li
            key={ref.id}
            className="rounded-lg border border-base-300/60 bg-base-300/15 px-3 py-2 text-sm"
          >
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {ref.stance === 'pro' ? (
                <Badge variant="default" className="rounded-md text-xs font-normal">
                  {t('stancePro')}
                </Badge>
              ) : null}
              {ref.stance === 'con' ? (
                <Badge variant="secondary" className="rounded-md text-xs font-normal">
                  {t('stanceCon')}
                </Badge>
              ) : null}
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1 truncate text-brand-primary underline"
              >
                <span className="truncate">{ref.url}</span>
                <ExternalLink size={12} className="shrink-0" aria-hidden />
              </a>
            </div>
            <p className="text-base-content/80">{ref.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
