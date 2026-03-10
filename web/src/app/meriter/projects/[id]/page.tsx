import { Metadata } from 'next';
import ProjectPageClient from './ProjectPageClient';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Project',
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  return <ProjectPageClient projectId={id} />;
}
