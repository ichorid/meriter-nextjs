import { redirect } from 'next/navigation';
import { routes } from '@/lib/constants/routes';

interface PageProps {
  params: Promise<{ token: string }>;
}

/** Legacy short URL for invite links (`/event/invite/:token`). */
export default async function LegacyEventInviteRedirect({ params }: PageProps) {
  const { token } = await params;
  redirect(routes.eventInvite(token));
}
