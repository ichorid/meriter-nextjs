import { ProjectBirzhaPublishPageClient } from './ProjectBirzhaPublishPageClient';
import { metadataTitle } from '@/lib/i18n/metadata-title';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return metadataTitle('birzhaSource.publishTitle');
}

export default async function ProjectBirzhaPublishPage({ params }: PageProps) {
  const { id } = await params;
  return <ProjectBirzhaPublishPageClient projectId={id} />;
}
