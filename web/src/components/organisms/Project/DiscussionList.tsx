'use client';

import { useTranslations } from 'next-intl';
import { MessagesSquare } from 'lucide-react';
import { useTickets } from '@/hooks/api/useTickets';
import { useUserProfile } from '@/hooks/api/useUsers';
import Link from 'next/link';
import { Button } from '@/components/ui/shadcn/button';

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

  const tCommon = useTranslations('common');

  if (isLoading) {
    return <p className="text-sm text-base-content/60">{tCommon('loading')}</p>;
  }

  const list = discussions ?? [];

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-6 py-12 text-center">
        <MessagesSquare className="h-12 w-12 text-base-content/30" aria-hidden />
        <p className="max-w-md text-sm text-base-content/70">{t('emptyDiscussionsHint')}</p>
        <Button size="sm" variant="default" asChild>
          <Link href={`/meriter/communities/${projectId}/create?postType=discussion`}>
            {t('createDiscussion')}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {list.map((post: { id: string; title?: string; content: string; authorId: string }) => (
        <li key={post.id}>
          <Link
            href={`/meriter/communities/${projectId}/posts/${post.id}`}
            className="block rounded-xl border border-white/10 bg-white/5 p-4 text-card-foreground shadow-none transition-colors duration-200 hover:bg-white/[0.07]"
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
