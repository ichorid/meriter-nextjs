import { redirect } from 'next/navigation';

export default function CommunityIndexPage({
  params,
}: {
  params: { communityId: string };
}) {
  redirect(`/c/${params.communityId}/feed`);
}
