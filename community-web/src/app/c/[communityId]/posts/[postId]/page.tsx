'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/shell';
import { CommunityShell } from '@/components/community-shell';
import { VoteSheet } from '@/components/vote-sheet';
import { useCommunityId } from '@/lib/use-route-params';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { useTelegramBackButton } from '@/lib/use-telegram-chrome';

function PostDetailInner({
  communityId,
  postId,
}: {
  communityId: string;
  postId: string;
}) {
  const router = useRouter();
  const meQuery = trpc.users.getMe.useQuery();
  const postQuery = trpc.publications.getById.useQuery({ id: postId });

  const post = postQuery.data;
  const authorId = post?.authorId ?? post?.author?.id ?? '';

  const backButtonActive = useTelegramBackButton({
    visible: true,
    onClick: () => router.push(`/c/${communityId}/feed`),
  });

  return (
    <CommunityShell communityId={communityId} active="feed" tgActive="me">
      <div className="space-y-6">
        {!backButtonActive && (
          <Link
            href={`/c/${communityId}/feed`}
            className="text-sm text-primary hover:underline"
          >
            ← Лента
          </Link>
        )}

        {postQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}

        {postQuery.isError && (
          <p className="text-sm text-red-400">Пост не найден.</p>
        )}

        {post && (
          <>
            <article className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-stitch-muted">
                  {post.author?.displayName || post.author?.username || 'Автор'}
                </p>
                <span className="text-2xl font-bold text-primary tabular-nums">
                  {post.metrics?.score ?? 0}
                </span>
              </div>
              {post.title && (
                <h1 className="text-xl font-extrabold tracking-tight">{post.title}</h1>
              )}
              <p className="whitespace-pre-wrap text-sm">{post.content}</p>
            </article>

            {meQuery.data?.id && authorId && (
              <VoteSheet
                communityId={communityId}
                publicationId={postId}
                authorId={authorId}
                currentUserId={meQuery.data.id}
              />
            )}
          </>
        )}
      </div>
    </CommunityShell>
  );
}

export default function PostDetailPage() {
  const communityId = useCommunityId();
  const params = useParams<{ postId: string }>();
  const postId = params.postId;

  return (
    <AuthGate>
      <PostDetailInner communityId={communityId} postId={postId} />
    </AuthGate>
  );
}
