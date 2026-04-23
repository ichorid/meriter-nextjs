import { ProjectMembersPilotWrapper } from '@/app/meriter/projects/[id]/members/ProjectMembersPilotWrapper';

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
  return <ProjectMembersPilotWrapper projectId={id} />;
}
