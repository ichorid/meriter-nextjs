'use client';

import { AuthGate, Shell } from '@/components/shell';
import { trpc } from '@/lib/trpc/client';

function ProjectsInner({ communityId }: { communityId: string }) {
  const projectsQuery = trpc.project.list.useQuery({
    parentCommunityId: communityId,
    pageSize: 20,
  });

  return (
    <Shell communityId={communityId} active="projects">
      <div className="space-y-4">
        <h1 className="text-xl font-extrabold tracking-tight">Проекты</h1>
        {projectsQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}
        <ul className="space-y-3">
          {(projectsQuery.data?.data ?? []).map((project) => (
            <li
              key={project.id}
              className="rounded-xl border border-stitch-border bg-stitch-surface p-4"
            >
              <p className="font-semibold">{project.name}</p>
              {project.description && (
                <p className="mt-1 text-sm text-stitch-muted line-clamp-3">
                  {project.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}

export default function ProjectsPage({
  params,
}: {
  params: { communityId: string };
}) {
  return (
    <AuthGate>
      <ProjectsInner communityId={params.communityId} />
    </AuthGate>
  );
}
