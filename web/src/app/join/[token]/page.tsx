import { redirect } from 'next/navigation';
import { routes } from '@/lib/constants/routes';

interface PageProps {
  params: Promise<{ token: string }>;
}

/** Legacy short URL for community invite links (`/join/:token`). */
export default async function LegacyCommunityInviteRedirect({ params }: PageProps) {
  const { token } = await params;
  redirect(routes.communityInviteLink(token));
}
