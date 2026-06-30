'use client';

import { BirzhaSourcePostsShell } from '@/features/tappalka';

export function ProjectBirzhaPostsPageClient({
  projectId,
  variant = 'page',
  listTitleSearch = '',
  suppressPublishToolbar = false,
  showPublishCta = false,
}: {
  projectId: string;
  variant?: 'page' | 'embedded';
  listTitleSearch?: string;
  suppressPublishToolbar?: boolean;
  /** Lead/participant/superadmin only — default off so public embeds never leak the CTA. */
  showPublishCta?: boolean;
}) {
  return (
    <BirzhaSourcePostsShell
      sourceEntityType="project"
      sourceEntityId={projectId}
      backPath={`/meriter/projects/${projectId}`}
      publishHref={`/meriter/projects/${projectId}/birzha-publish`}
      variant={variant}
      listTitleSearch={listTitleSearch}
      suppressPublishToolbar={suppressPublishToolbar}
      showPublishCta={showPublishCta}
    />
  );
}
