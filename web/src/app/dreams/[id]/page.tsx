import { Metadata } from 'next';
import ProjectPageClient from '../../meriter/projects/[id]/ProjectPageClient';

interface DreamPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Dream',
};

export default async function DreamPage({ params }: DreamPageProps) {
  const { id } = await params;
  return <ProjectPageClient projectId={id} />;
}

