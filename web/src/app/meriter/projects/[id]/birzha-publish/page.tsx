import { ProjectBirzhaPublishPageClient } from './ProjectBirzhaPublishPageClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return { title: 'Publish to Birzha' };
}

export default async function ProjectBirzhaPublishPage({ params }: PageProps) {
  const { id } = await params;
  return <ProjectBirzhaPublishPageClient projectId={id} />;
}
