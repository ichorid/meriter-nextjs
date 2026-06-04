'use client';

import { useTranslations } from 'next-intl';
import { DocumentProposalRailContent } from '@/features/documents/components/DocumentProposalRailContent';
import { useDocumentCanvasFocusRequired } from '@/features/documents/context/DocumentCanvasFocusContext';
import { documentLiveQueryOptions } from '@/features/documents/hooks/useDocumentLiveSync';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

export interface DocumentProposalRailProps {
  sections: unknown;
  className?: string;
}

export function DocumentProposalRail({ sections, className }: DocumentProposalRailProps) {
  const tGdocs = useTranslations('pages.documents.gdocs');
  const focus = useDocumentCanvasFocusRequired();
  const threadsQuery = trpc.documentVariants.listByDocument.useQuery(
    { documentId: focus.documentId },
    documentLiveQueryOptions(),
  );

  const threadCount = threadsQuery.data?.threads.length ?? 0;

  return (
    <aside
      className={cn(
        'sticky top-4 flex max-h-[calc(100vh-6rem)] w-full min-w-0 flex-col overflow-hidden rounded-xl',
        'border border-stitch-border bg-stitch-surface lg:max-w-[320px]',
        className,
      )}
    >
      <div className="border-b border-stitch-border px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-base-content">
          {tGdocs('railTitle')}
        </h2>
        <p className="text-xs text-base-content/55">
          {tGdocs('railSubtitle', { count: threadCount })}
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <DocumentProposalRailContent sections={sections} />
      </div>
    </aside>
  );
}
