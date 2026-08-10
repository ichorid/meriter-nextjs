import { redirect } from 'next/navigation';

export default async function CommunityIndexPage({
  params,
}: {
  params: Promise<{ communityId: string }>;
}) {
  const { communityId } = await params;
  redirect(`/c/${communityId}/feed`);
}
