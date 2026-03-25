'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { MessagesSquare } from 'lucide-react';
import { useTickets } from '@/hooks/api/useTickets';
import { useUserProfile } from '@/hooks/api/useUsers';
import Link from 'next/link';
import { Button } from '@/components/ui/shadcn/button';
import { routes } from '@/lib/constants/routes';
import { plainTextExcerpt } from '@/lib/utils/plain-text-excerpt';

interface DiscussionListProps {
  projectId: string;
}

function AuthorLabel({ userId }: { userId: string }) {
  const { data: user } = useUserProfile(userId);
  return <span className="text-xs text-muted-foreground">{user?.displayName ?? user?.username ?? userId.slice(0, 8)}</span>;
}

export function DiscussionList({ projectId }: DiscussionListProps) {
  const t = useTranslations('projects');
  const tComments = useTranslations('comments');
  const { user } = useAuth();
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
          <Link href={routes.projectDiscussionCreate(projectId)}>{t('createDiscussion')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {list.map((post: { id: string; title?: string; content: string; authorId: string }) => (
        <li key={post.id}>
          <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-card-foreground shadow-none transition-colors duration-200 hover:bg-white/[0.07] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <Link href={routes.communityPost(projectId, post.id)} className="min-w-0 flex-1">
              {post.title && <div className="font-medium">{post.title}</div>}
              <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {plainTextExcerpt(post.content)}
              </div>
              <AuthorLabel userId={post.authorId} />
            </Link>
            {user?.id ? (
              <Button variant="outline" size="sm" className="h-8 shrink-0 px-3 text-xs sm:self-center" asChild>
                <Link href={routes.communityPost(projectId, post.id)}>{tComments('voteTitle')}</Link>
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
