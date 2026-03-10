'use client';

import { useTranslations } from 'next-intl';
import { useTickets } from '@/hooks/api/useTickets';
import { useUserProfile } from '@/hooks/api/useUsers';
import Link from 'next/link';

interface DiscussionListProps {
  projectId: string;
}

function AuthorLabel({ userId }: { userId: string }) {
  const { data: user } = useUserProfile(userId);
  return <span className="text-xs text-muted-foreground">{user?.displayName ?? user?.username ?? userId.slice(0, 8)}</span>;
}

export function DiscussionList({ projectId }: DiscussionListProps) {
  const t = useTranslations('projects');
  const { data: discussions, isLoading } = useTickets(projectId, { postType: 'discussion' });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading discussions…</p>;
  }

  const list = discussions ?? [];

  if (list.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noDiscussions')}</p>;
  }

  return (
    <ul className="space-y-3">
      {list.map((post: { id: string; title?: string; content: string; authorId: string }) => (
        <li key={post.id}>
          <Link
            href={`/meriter/communities/${projectId}/posts/${post.id}`}
            className="block rounded-lg border bg-card p-4 text-card-foreground shadow-sm hover:bg-accent/50"
          >
            {post.title && <div className="font-medium">{post.title}</div>}
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{post.content}</p>
            <AuthorLabel userId={post.authorId} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
