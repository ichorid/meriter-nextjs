import { ProjectBirzhaPostsPageClient } from './ProjectBirzhaPostsPageClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return { title: 'Birzha posts' };
}

export default async function ProjectBirzhaPostsPage({ params }: PageProps) {
  const { id } = await params;
  return <ProjectBirzhaPostsPageClient projectId={id} />;
}
