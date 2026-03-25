import { CommunityMembersPageClient } from '@/app/meriter/communities/[id]/members/CommunityMembersPageClient';
import { routes } from '@/lib/constants/routes';

interface ProjectMembersPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return {
    title: 'Members',
  };
}

export default async function ProjectMembersPage({ params }: ProjectMembersPageProps) {
  const { id } = await params;
  return (
    <CommunityMembersPageClient
      communityId={id}
      returnTo={routes.project(id)}
      membersContext="project"
    />
  );
}
