'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { MessagesSquare, TrendingUp } from 'lucide-react';
import { useTickets } from '@/hooks/api/useTickets';
import { useUserProfile } from '@/hooks/api/useUsers';
import { useCommunity } from '@/hooks/api';
import Link from 'next/link';
import { Button } from '@/components/ui/shadcn/button';
import { routes } from '@/lib/constants/routes';
import { plainTextExcerpt } from '@/lib/utils/plain-text-excerpt';
import { formatMerits } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui.store';

interface DiscussionListProps {
  projectId: string;
}

function AuthorLabel({ userId }: { userId: string }) {
  const { data: user } = useUserProfile(userId);
  return <span className="text-xs text-muted-foreground">{user?.displayName ?? user?.username ?? userId.slice(0, 8)}</span>;
}

function resolvePublicationVotingMode(community: {
  typeTag?: string;
  votingSettings?: { currencySource?: string };
} | null | undefined): 'standard' | 'wallet-only' | 'quota-only' {
  const currencySource =
    community?.votingSettings?.currencySource ||
    (community?.typeTag === 'marathon-of-good'
      ? 'quota-only'
      : community?.typeTag === 'future-vision'
        ? 'wallet-only'
        : 'quota-and-wallet');
  if (currencySource === 'quota-only') return 'quota-only';
  if (currencySource === 'wallet-only') return 'wallet-only';
  return 'standard';
}

export function DiscussionList({ projectId }: DiscussionListProps) {
  const t = useTranslations('projects');
  const tComments = useTranslations('comments');
  const { user } = useAuth();
  const { data: discussions, isLoading } = useTickets(projectId, { postType: 'discussion' });
  const { data: community } = useCommunity(projectId);
  const openVotingPopup = useUIStore((s) => s.openVotingPopup);

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
      {list.map(
        (post: {
          id: string;
          title?: string;
          content: string;
          authorId: string;
          metrics?: { score?: number; upvotes?: number };
        }) => {
          const showVote = Boolean(user?.id && post.authorId !== user.id);
          const score = post.metrics?.score ?? 0;
          return (
            <li key={post.id}>
              <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-card-foreground shadow-none transition-colors duration-200 hover:bg-white/[0.07]">
                <Link href={routes.communityPost(projectId, post.id)} className="min-w-0 flex-1 block">
                  {post.title && <div className="font-medium">{post.title}</div>}
                  <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {plainTextExcerpt(post.content)}
                  </div>
                  <AuthorLabel userId={post.authorId} />
                </Link>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-1.5 text-sm hover:bg-white/10 rounded-lg px-2 py-1.5 transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openVotingPopup(
                        post.id,
                        'publication',
                        resolvePublicationVotingMode(community),
                      );
                    }}
                  >
                    <TrendingUp
                      className="h-4 w-4 shrink-0 text-base-content/50"
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'font-medium tabular-nums',
                        score > 0
                          ? 'text-success'
                          : score < 0
                            ? 'text-error'
                            : 'text-base-content/60',
                      )}
                    >
                      {score > 0 ? '+' : ''}
                      {formatMerits(score)}
                    </span>
                  </button>
                  {showVote ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 px-3 text-xs"
                      onClick={() =>
                        openVotingPopup(
                          post.id,
                          'publication',
                          resolvePublicationVotingMode(community),
                        )
                      }
                    >
                      {tComments('voteTitle')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        },
      )}
    </ul>
  );
}
