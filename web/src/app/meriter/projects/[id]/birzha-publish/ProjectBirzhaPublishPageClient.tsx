'use client';

import { BirzhaPublishShell } from '@/features/tappalka';

interface ProjectBirzhaPublishPageClientProps {
  projectId: string;
}

export function ProjectBirzhaPublishPageClient({ projectId }: ProjectBirzhaPublishPageClientProps) {
  return (
    <BirzhaPublishShell
      sourceEntityType="project"
      sourceEntityId={projectId}
      backPath={`/meriter/projects/${projectId}`}
    />
  );
}
