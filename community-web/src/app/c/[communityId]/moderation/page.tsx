'use client';

import { AuthGate } from '@/components/shell';
import { CommunityShell } from '@/components/community-shell';
import { useCommunityId } from '@/lib/use-route-params';
import { trpc } from '@/lib/trpc/client';
import { hapticError, hapticSuccess } from '@/lib/telegram-env';

function ModerationInner({ communityId }: { communityId: string }) {
  const pendingQuery = trpc.publications.listPendingTelegramModeration.useQuery({
    communityId,
  });
  const utils = trpc.useUtils();

  const approveMutation = trpc.publications.approveTelegramModeration.useMutation({
    onSuccess: async () => {
      hapticSuccess();
      await utils.publications.listPendingTelegramModeration.invalidate({ communityId });
      await utils.communities.getFeed.invalidate({ communityId });
    },
    onError: () => hapticError(),
  });
  const rejectMutation = trpc.publications.rejectTelegramModeration.useMutation({
    onSuccess: async () => {
      hapticSuccess();
      await utils.publications.listPendingTelegramModeration.invalidate({ communityId });
    },
    onError: () => hapticError(),
  });

  const items = pendingQuery.data ?? [];

  return (
    <CommunityShell communityId={communityId} active="moderation" tgActive="feed">
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
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={approveMutation.isPending}
                  onClick={() =>
                    approveMutation.mutate({ publicationId: item.id })
                  }
                  className="min-h-[44px] rounded-lg bg-primary px-3 py-2 text-sm text-white disabled:opacity-50 sm:flex-1"
                >
                  Одобрить
                </button>
                <button
                  type="button"
                  disabled={rejectMutation.isPending}
                  onClick={() =>
                    rejectMutation.mutate({ publicationId: item.id })
                  }
                  className="min-h-[44px] rounded-lg border border-stitch-border px-3 py-2 text-sm text-red-400 disabled:opacity-50 sm:flex-1"
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
    </CommunityShell>
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
