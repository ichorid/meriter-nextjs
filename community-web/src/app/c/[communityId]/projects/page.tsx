'use client';

import { useState } from 'react';
import { AuthGate, Shell } from '@/components/shell';
import { useCommunityId } from '@/lib/use-route-params';
import { trpc } from '@/lib/trpc/client';

function ProjectCreateForm({ communityId }: { communityId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const utils = trpc.useUtils();

  const createMutation = trpc.project.create.useMutation({
    onSuccess: async () => {
      setName('');
      setDescription('');
      setOpen(false);
      await utils.project.list.invalidate({ parentCommunityId: communityId });
    },
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
      >
        Создать проект
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-3">
      <h2 className="font-semibold">Новый проект</h2>
      <input
        className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
        placeholder="Название"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        className="w-full min-h-[80px] rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
        placeholder="Описание"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!name.trim() || createMutation.isPending}
          onClick={() =>
            createMutation.mutate({
              name: name.trim(),
              description: description.trim() || undefined,
              parentCommunityId: communityId,
            })
          }
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Создать
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-stitch-muted"
        >
          Отмена
        </button>
      </div>
      {createMutation.isError && (
        <p className="text-sm text-red-400">Не удалось создать проект.</p>
      )}
    </div>
  );
}

function ProjectsInner({ communityId }: { communityId: string }) {
  const projectsQuery = trpc.project.list.useQuery({
    parentCommunityId: communityId,
    pageSize: 20,
  });

  return (
    <Shell communityId={communityId} active="projects">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold tracking-tight">Проекты</h1>
          <ProjectCreateForm communityId={communityId} />
        </div>
        {projectsQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}
        <ul className="space-y-3">
          {(projectsQuery.data?.data ?? []).map((project) => (
            <li key={project.id}>
              <a
                href={`/c/${communityId}/projects/${project.id}`}
                className="block rounded-xl border border-stitch-border bg-stitch-surface p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{project.name}</p>
                  {project.projectStatus && (
                    <span className="text-xs text-stitch-muted shrink-0">
                      {project.projectStatus === 'active' ? 'активен' : project.projectStatus}
                    </span>
                  )}
                </div>
                {project.description && (
                  <p className="mt-1 text-sm text-stitch-muted line-clamp-3">
                    {project.description}
                  </p>
                )}
              </a>
            </li>
          ))}
        </ul>
        {!projectsQuery.isLoading && (projectsQuery.data?.data ?? []).length === 0 && (
          <p className="text-sm text-stitch-muted">Пока нет проектов.</p>
        )}
      </div>
    </Shell>
  );
}

export default function ProjectsPage() {
  const communityId = useCommunityId();
  return (
    <AuthGate>
      <ProjectsInner communityId={communityId} />
    </AuthGate>
  );
}
