'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight, FileText } from 'lucide-react';
import { routes } from '@/lib/constants/routes';

export interface CommunityDocumentsHubTileProps {
  communityId: string;
}

export function CommunityDocumentsHubTile({ communityId }: CommunityDocumentsHubTileProps) {
  const tCommunities = useTranslations('pages.communities');

  return (
    <Link
      href={routes.communityDocuments(communityId)}
      className="flex items-center justify-between gap-3 rounded-xl border border-base-300 bg-base-200/60 p-4 transition-colors hover:bg-base-300/60 dark:border-base-content/10"
    >
      <div className="flex min-w-0 items-center gap-3">
        <FileText className="h-5 w-5 shrink-0 text-base-content/70" aria-hidden />
        <span className="truncate font-medium text-base-content">
          {tCommunities('communityDocuments')}
        </span>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
        {tCommunities('all')}
        <ChevronRight size={14} />
      </span>
    </Link>
  );
}
