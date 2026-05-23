import { Suspense } from 'react';
import { JoinCommunityPageClient } from '../JoinCommunityPageClient';
import { buildCommunityInviteMetadata } from '@/lib/i18n/community-invite-metadata';
import { routes } from '@/lib/constants/routes';

interface PageProps {
  params: Promise<{ id: string; token: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id, token } = await params;
  return buildCommunityInviteMetadata({
    token,
    canonicalPath: routes.communityInviteLegacyLink(id, token),
  });
}

export default async function CommunityJoinWithTokenPage({ params }: PageProps) {
  const { id, token } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[40vh] text-base-content/60 text-sm">
          Loading…
        </div>
      }
    >
      <JoinCommunityPageClient communityId={id} pathToken={token} legacyInvitePath />
    </Suspense>
  );
}
