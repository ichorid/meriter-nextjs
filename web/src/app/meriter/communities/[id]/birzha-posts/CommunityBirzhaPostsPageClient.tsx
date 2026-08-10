'use client';

import { BirzhaSourcePostsShell } from '@/features/tappalka';
import { routes } from '@/lib/constants/routes';

export function CommunityBirzhaPostsPageClient({
  communityId,
  variant = 'page',
  listTitleSearch = '',
  suppressPublishToolbar = false,
  showPublishCta = false,
}: {
  communityId: string;
  variant?: 'page' | 'embedded';
  listTitleSearch?: string;
  /** Hub chrome renders the publish CTA. */
  suppressPublishToolbar?: boolean;
  /** Member or superadmin — default off so embeds never leak the CTA. */
  showPublishCta?: boolean;
}) {
  return (
    <BirzhaSourcePostsShell
      sourceEntityType="community"
      sourceEntityId={communityId}
      backPath={routes.community(communityId)}
      publishHref={routes.communityBirzhaPublish(communityId)}
      variant={variant}
      listTitleSearch={listTitleSearch}
      suppressPublishToolbar={suppressPublishToolbar}
      showPublishCta={showPublishCta}
    />
  );
}
