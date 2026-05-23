import { Suspense } from 'react';
import { JoinCommunityPageClient } from '@/app/meriter/communities/[id]/join/JoinCommunityPageClient';
import { buildCommunityInviteMetadata } from '@/lib/i18n/community-invite-metadata';
import { routes } from '@/lib/constants/routes';

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { token } = await params;
  return buildCommunityInviteMetadata({
    token,
    canonicalPath: routes.communityInviteLink(token),
  });
}

export default async function CommunityShortInvitePage({ params }: PageProps) {
  const { token } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[40vh] text-base-content/60 text-sm">
          Loading…
        </div>
      }
    >
      <JoinCommunityPageClient pathToken={token} />
    </Suspense>
  );
}
