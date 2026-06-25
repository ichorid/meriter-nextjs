'use client';

import { AuthGate, Shell } from '@/components/shell';
import { useCommunityId } from '@/lib/use-route-params';
import { trpc } from '@/lib/trpc/client';

function ModerationInner({ communityId }: { communityId: string }) {
  const pendingQuery = trpc.publications.listPendingTelegramModeration.useQuery({
    communityId,
  });
  const utils = trpc.useUtils();

  const approveMutation = trpc.publications.approveTelegramModeration.useMutation({
    onSuccess: async () => {
      await utils.publications.listPendingTelegramModeration.invalidate({ communityId });
      await utils.communities.getFeed.invalidate({ communityId });
    },
  });
  const rejectMutation = trpc.publications.rejectTelegramModeration.useMutation({
    onSuccess: async () => {
      await utils.publications.listPendingTelegramModeration.invalidate({ communityId });
    },
  });

  const items = pendingQuery.data ?? [];

  return (
    <Shell communityId={communityId} active="moderation">
      <div className="space-y-6">
        <h1 className="text-xl font-extrabold tracking-tight">Модерация постов</h1>
        <p className="text-sm text-stitch-muted">
          Публикации участников, ожидающие одобрения перед появлением в ленте и в чате
          Telegram.
        </p>

        {pendingQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}

        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-3"
            >
              {item.title && <p className="font-semibold">{item.title}</p>}
              <p className="text-sm whitespace-pre-wrap">{item.content}</p>
              <p className="text-xs text-stitch-muted">
                {item.meta?.author?.name ?? 'Участник'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={approveMutation.isPending}
                  onClick={() =>
                    approveMutation.mutate({ publicationId: item.id })
                  }
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  Одобрить
                </button>
                <button
                  type="button"
                  disabled={rejectMutation.isPending}
                  onClick={() =>
                    rejectMutation.mutate({ publicationId: item.id })
                  }
                  className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm text-red-400 disabled:opacity-50"
                >
                  Отклонить
                </button>
              </div>
            </li>
          ))}
        </ul>

        {!pendingQuery.isLoading && items.length === 0 && (
          <p className="text-sm text-stitch-muted">Нет постов на модерации.</p>
        )}
      </div>
    </Shell>
  );
}

export default function ModerationPage() {
  const communityId = useCommunityId();
  return (
    <AuthGate>
      <ModerationInner communityId={communityId} />
    </AuthGate>
  );
}
