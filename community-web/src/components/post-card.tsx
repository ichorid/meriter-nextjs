'use client';

import Link from 'next/link';

type PostCardProps = {
  communityId: string;
  post: {
    id: string;
    title?: string | null;
    content?: string | null;
    metrics?: { score?: number };
    author?: { displayName?: string; username?: string };
  };
  currentUserId?: string;
  authorId?: string;
  showVoteActions?: boolean;
};

export function PostCard({
  communityId,
  post,
  showVoteActions = true,
}: PostCardProps) {
  const preview =
    post.content && post.content.length > 160
      ? `${post.content.slice(0, 160)}…`
      : post.content;

  return (
    <article className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-3">
      <Link href={`/c/${communityId}/posts/${post.id}`} className="block space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-stitch-muted">
            {post.author?.displayName || post.author?.username || 'Автор'}
          </p>
          <span className="shrink-0 text-lg font-bold text-primary tabular-nums">
            {post.metrics?.score ?? 0}
          </span>
        </div>
        {post.title && <h3 className="font-semibold">{post.title}</h3>}
        {preview && <p className="text-sm whitespace-pre-wrap">{preview}</p>}
      </Link>
      {showVoteActions && (
        <div className="flex gap-2">
          <Link
            href={`/c/${communityId}/posts/${post.id}`}
            className="rounded-lg bg-stitch-elevated px-3 py-1.5 text-xs font-medium hover:bg-primary/20"
          >
            👍 +1 / заслуги
          </Link>
        </div>
      )}
    </article>
  );
}
