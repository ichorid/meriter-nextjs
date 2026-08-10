'use client';

import { useCallback, useState } from 'react';
import { AuthGate } from '@/components/shell';
import { CommunityShell } from '@/components/community-shell';
import { PostCard } from '@/components/post-card';
import { PollSection } from '@/components/poll-section';
import { useCommunityId } from '@/lib/use-route-params';
import { trpc } from '@/lib/trpc/client';
import { useTelegramMainButton } from '@/lib/use-telegram-chrome';
import { hapticError, hapticSuccess } from '@/lib/telegram-env';

function FeedPageInner({ communityId }: { communityId: string }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pendingNotice, setPendingNotice] = useState(false);
  const utils = trpc.useUtils();

  const communityQuery = trpc.communities.getById.useQuery({ id: communityId });

  const feedQuery = trpc.communities.getFeed.useInfiniteQuery(
    { communityId, pageSize: 10, sort: 'recent' },
    {
      initialPageParam: 1,
      getNextPageParam: (last) =>
        last.pagination.hasNext ? (last.pagination.page ?? 1) + 1 : undefined,
    },
  );

  const createMutation = trpc.publications.create.useMutation({
    onSuccess: async (result) => {
      hapticSuccess();
      setTitle('');
      setContent('');
      setPendingNotice(result.telegramModerationStatus === 'pending');
      await utils.communities.getFeed.invalidate({ communityId });
    },
    onError: () => {
      hapticError();
    },
  });

  const canPublish = Boolean(content.trim()) && !createMutation.isPending;

  const publish = useCallback(() => {
    if (!content.trim()) return;
    createMutation.mutate({
      communityId,
      content: content.trim(),
      title: title.trim() || undefined,
      type: 'text',
    });
  }, [communityId, content, createMutation, title]);

  const mainButtonActive = useTelegramMainButton({
    text: 'Опубликовать',
    visible: Boolean(content.trim()),
    enabled: canPublish,
    loading: createMutation.isPending,
    onClick: publish,
  });

  const posts =
    feedQuery.data?.pages.flatMap((p) =>
      p.data.filter((item) => item.type === 'publication'),
    ) ?? [];

  return (
    <CommunityShell communityId={communityId} active="feed" tgActive="me">
      <div className="space-y-6">
        {pendingNotice && (
          <p className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
            Пост отправлен на модерацию. Он появится в ленте после одобрения лидом.
          </p>
        )}

        <section className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-3">
          <h2 className="font-semibold">Новый пост</h2>
          {communityQuery.data?.settings?.telegramModerationEnabled && (
            <p className="text-xs text-stitch-muted">
              В этом сообществе посты проходят модерацию перед публикацией.
            </p>
          )}
          <p className="text-xs text-stitch-muted">
            В группе можно также опубликовать через #хэштег в сообщении.
          </p>
          <input
            className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
            placeholder="Заголовок (необязательно)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="w-full min-h-[100px] rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
            placeholder="Текст публикации"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button
            type="button"
            disabled={!content.trim() || createMutation.isPending}
            onClick={publish}
            className={`rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50${mainButtonActive ? ' hidden' : ''}`}
          >
            Опубликовать
          </button>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Лента</h2>
          {feedQuery.isLoading && (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          )}
          {!feedQuery.isLoading && posts.length === 0 && (
            <p className="text-sm text-stitch-muted">
              Пока нет постов. Опубликуйте или добавьте #идея в группе.
            </p>
          )}
          {posts.map((post) => (
            <PostCard key={post.id} communityId={communityId} post={post} />
          ))}
          {feedQuery.hasNextPage && (
            <button
              type="button"
              onClick={() => feedQuery.fetchNextPage()}
              className="text-sm text-primary hover:underline"
            >
              Загрузить ещё
            </button>
          )}
        </section>

        <PollSection communityId={communityId} />
      </div>
    </CommunityShell>
  );
}

export default function FeedPage() {
  const communityId = useCommunityId();
  return (
    <AuthGate>
      <FeedPageInner communityId={communityId} />
    </AuthGate>
  );
}
