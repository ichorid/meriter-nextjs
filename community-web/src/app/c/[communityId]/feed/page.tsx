'use client';

import { useState } from 'react';
import { AuthGate, Shell } from '@/components/shell';
import { PollSection } from '@/components/poll-section';
import { trpc } from '@/lib/trpc/client';

function FeedPageInner({ communityId }: { communityId: string }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const utils = trpc.useUtils();

  const feedQuery = trpc.communities.getFeed.useInfiniteQuery(
    { communityId, pageSize: 10, sort: 'recent' },
    {
      initialPageParam: 1,
      getNextPageParam: (last) =>
        last.pagination.hasNext ? (last.pagination.page ?? 1) + 1 : undefined,
    },
  );

  const createMutation = trpc.publications.create.useMutation({
    onSuccess: async () => {
      setTitle('');
      setContent('');
      await utils.communities.getFeed.invalidate({ communityId });
    },
  });

  const posts =
    feedQuery.data?.pages.flatMap((p) =>
      p.data.filter((item) => item.type === 'publication'),
    ) ?? [];

  return (
    <Shell communityId={communityId} active="feed">
      <div className="space-y-6">
        <section className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-3">
          <h2 className="font-semibold">Новый пост</h2>
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
            onClick={() =>
              createMutation.mutate({
                communityId,
                content: content.trim(),
                title: title.trim() || undefined,
                type: 'text',
              })
            }
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Опубликовать
          </button>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Лента</h2>
          {feedQuery.isLoading && (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          )}
          {posts.map((post) => (
            <article
              key={post.id}
              className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-2"
            >
              {post.title && <h3 className="font-semibold">{post.title}</h3>}
              <p className="text-sm whitespace-pre-wrap">{post.content}</p>
              <p className="text-xs text-stitch-muted">
                Рейтинг: {post.metrics?.score ?? 0} заслуг
              </p>
            </article>
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
    </Shell>
  );
}

export default function FeedPage({
  params,
}: {
  params: { communityId: string };
}) {
  const { communityId } = params;
  return (
    <AuthGate>
      <FeedPageInner communityId={communityId} />
    </AuthGate>
  );
}
