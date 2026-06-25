'use client';

import { AuthGate, Shell } from '@/components/shell';
import { trpc } from '@/lib/trpc/client';

function ProjectDetailInner({
  communityId,
  projectId,
}: {
  communityId: string;
  projectId: string;
}) {
  const meQuery = trpc.users.getMe.useQuery();
  const projectQuery = trpc.project.getById.useQuery({ id: projectId });
  const joinMutation = trpc.project.join.useMutation({
    onSuccess: () => projectQuery.refetch(),
  });

  const project = projectQuery.data?.project;
  const walletBalance = projectQuery.data?.walletBalance ?? 0;
  const meId = meQuery.data?.id;

  return (
    <Shell communityId={communityId} active="projects">
      <div className="space-y-6">
        <a
          href={`/c/${communityId}/projects`}
          className="text-sm text-primary hover:underline"
        >
          ← К проектам
        </a>

        {projectQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}

        {project && (
          <>
            <header className="space-y-2">
              <h1 className="text-xl font-extrabold tracking-tight">{project.name}</h1>
              {project.projectStatus && (
                <p className="text-sm text-stitch-muted">
                  Статус:{' '}
                  {project.projectStatus === 'active' ? 'активен' : project.projectStatus}
                </p>
              )}
            </header>

            {project.description && (
              <p className="text-sm whitespace-pre-wrap">{project.description}</p>
            )}

            <div className="rounded-xl border border-stitch-border bg-stitch-surface p-4 text-sm space-y-1">
              <p>
                Кошелёк проекта:{' '}
                <span className="font-semibold text-primary">{walletBalance} заслуг</span>
              </p>
              {projectQuery.data?.parentCommunity && (
                <p className="text-stitch-muted">
                  Сообщество: {projectQuery.data.parentCommunity.name}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={joinMutation.isPending || !meId}
              onClick={() =>
                joinMutation.mutate({
                  projectId,
                  applicantMessage: 'Заявка из community-web',
                })
              }
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Подать заявку на участие
            </button>
            {joinMutation.isSuccess && (
              <p className="text-sm text-green-400">
                Заявка отправлена. Ожидайте одобрения лида проекта.
              </p>
            )}
            {joinMutation.isError && (
              <p className="text-sm text-red-400">
                Не удалось отправить заявку (возможно, вы уже участник).
              </p>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: { communityId: string; projectId: string };
}) {
  return (
    <AuthGate>
      <ProjectDetailInner
        communityId={params.communityId}
        projectId={params.projectId}
      />
    </AuthGate>
  );
}
