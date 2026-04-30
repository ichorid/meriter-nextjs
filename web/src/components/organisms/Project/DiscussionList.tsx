'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { MessagesSquare, TrendingUp } from 'lucide-react';
import { useTickets } from '@/hooks/api/useTickets';
import { useCommentsByPublication } from '@/hooks/api/useComments';
import { useUserProfile } from '@/hooks/api/useUsers';
import { useCommunity } from '@/hooks/api';
import Link from 'next/link';
import { Button } from '@/components/ui/shadcn/button';
import { routes } from '@/lib/constants/routes';
import { PilotTicketDetailDialog } from '@/components/organisms/Project/PilotTicketDetailDialog';
import { PilotThreadCommentRow } from '@/components/organisms/Project/PilotThreadCommentRow';
import { plainTextExcerpt } from '@/lib/utils/plain-text-excerpt';
import { formatMerits } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui.store';

interface DiscussionListProps {
  projectId: string;
  /** Pilot: accordion preview + primary comment CTA (FR-18–FR-20). */
  uxVariant?: 'default' | 'pilotAccordion';
  /** Pilot shell: no links to full Meriter post pages; inline comment / create flows. */
  blockMeriterNavigation?: boolean;
  /** When blockMeriterNavigation: empty-state CTA opens parent discussion dialog. */
  onPilotCreateDiscussion?: () => void;
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

export function DiscussionList({
  projectId,
  uxVariant = 'default',
  blockMeriterNavigation = false,
  onPilotCreateDiscussion,
}: DiscussionListProps) {
  const t = useTranslations('projects');
  const tPilot = useTranslations('multiObraz');
  const tComments = useTranslations('comments');
  const { user } = useAuth();
  const { data: discussions, isLoading, error } = useTickets(projectId, { postType: 'discussion' });
  const { data: community } = useCommunity(projectId);
  const openVotingPopup = useUIStore((s) => s.openVotingPopup);

  const tCommon = useTranslations('common');

  if (isLoading) {
    return <p className="text-sm text-base-content/60">{tCommon('loading')}</p>;
  }

  // Pilot UX: if user is not a member, backend returns 403. Treat as "join to participate" state.
  const forbiddenMessage = (error as { message?: string } | null)?.message || '';
  if (forbiddenMessage.includes('Only project members can view tickets')) {
    return <p className="text-sm text-[#94a3b8]">{tPilot('joinToParticipate')}</p>;
  }

  const list = discussions ?? [];

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-6 py-12 text-center">
        <MessagesSquare className="h-12 w-12 text-base-content/30" aria-hidden />
        <p className="max-w-md text-sm text-base-content/70">{t('emptyDiscussionsHint')}</p>
        {blockMeriterNavigation ? (
          onPilotCreateDiscussion ? (
            <Button size="sm" variant="default" type="button" onClick={onPilotCreateDiscussion}>
              {t('createDiscussion')}
            </Button>
          ) : null
        ) : (
          <Button size="sm" variant="default" asChild>
            <Link href={routes.projectDiscussionCreate(projectId)}>{t('createDiscussion')}</Link>
          </Button>
        )}
      </div>
    );
  }

  if (uxVariant === 'pilotAccordion') {
    return (
      <ul className="space-y-3">
        {list.map(
          (post: {
            id: string;
            title?: string;
            content: string;
            authorId: string;
            metrics?: { commentCount?: number };
          }) => (
            <li key={post.id}>
              {blockMeriterNavigation ? (
                <DiscussionPilotCompactCard
                  projectId={projectId}
                  postId={post.id}
                  title={post.title}
                  content={post.content}
                  commentCount={post.metrics?.commentCount ?? 0}
                />
              ) : (
                <DiscussionPilotAccordionLegacyCard
                  projectId={projectId}
                  postId={post.id}
                  title={post.title}
                  excerpt={plainTextExcerpt(post.content)}
                  authorId={post.authorId}
                />
              )}
            </li>
          ),
        )}
      </ul>
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

/** Pilot shell: compact row (title + comment count), full thread in dialog (same pattern as tasks). */
function DiscussionPilotCompactCard({
  projectId,
  postId,
  title,
  content,
  commentCount,
}: {
  projectId: string;
  postId: string;
  title?: string;
  content: string;
  commentCount: number;
}) {
  const t = useTranslations('multiObraz');
  const [detailOpen, setDetailOpen] = useState(false);
  const heading = title?.trim() ? title : t('discussionUntitled');

  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/5 text-card-foreground shadow-none',
        'transition-colors duration-200 hover:bg-white/[0.07]',
      )}
    >
      <button
        type="button"
        className="block w-full p-4 pb-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
        onClick={() => setDetailOpen(true)}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 font-medium text-base-content">{heading}</div>
          <span
            className="shrink-0 rounded-md border border-white/10 bg-white/10 px-2 py-0.5 text-xs font-medium tabular-nums text-base-content/80"
            title={t('pilotDiscussionCommentCountAria', { count: commentCount })}
          >
            {commentCount}
          </span>
        </div>
      </button>
      <PilotTicketDetailDialog
        threadVariant="discussion"
        open={detailOpen}
        onOpenChange={setDetailOpen}
        projectId={projectId}
        publicationId={postId}
        fallbackTitle={title}
        fallbackContent={content}
      />
    </div>
  );
}

/** Non-pilot: accordion preview and link to full Meriter thread. */
function DiscussionPilotAccordionLegacyCard({
  projectId,
  postId,
  title,
  excerpt,
  authorId,
}: {
  projectId: string;
  postId: string;
  title?: string;
  excerpt: string;
  authorId: string;
}) {
  const t = useTranslations('multiObraz');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const pageSize = 25;
  const { data, isFetching } = useCommentsByPublication(open ? postId : '', {
    page: 1,
    pageSize,
  });

  const payload = data as
    | {
        data?: Array<{
          id: string;
          content?: string | null;
          authorId?: string;
          createdAt?: string;
          meta?: { author?: { name?: string; username?: string } | null };
        }>;
        total?: number;
      }
    | undefined;
  const comments = payload?.data ?? [];
  const total = payload?.total ?? comments.length;
  const threadHref = routes.communityPost(projectId, postId);
  const heading = title?.trim() ? title : t('discussionUntitled');

  return (
    <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-4 text-[#f1f5f9]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <Link href={threadHref} className="block font-medium text-white hover:underline">
            {heading}
          </Link>
          <p className="line-clamp-2 text-sm text-[#94a3b8]">{excerpt}</p>
          <AuthorLabel userId={authorId} />
        </div>
        <Button
          asChild
          size="sm"
          className="h-11 min-w-[132px] shrink-0 self-start rounded-lg bg-[#A855F7] px-4 text-white hover:bg-[#9333ea]"
        >
          <Link href={threadHref}>{t('commentCta')}</Link>
        </Button>
      </div>
      <button
        type="button"
        className="mt-4 flex w-full min-h-11 items-center justify-between rounded-lg border border-[#334155] bg-[#0f172a] px-3 text-left text-sm text-[#e2e8f0] hover:bg-[#0f172a]/80"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{t('repliesToggle', { count: total })}</span>
        <span className="text-xs text-[#94a3b8]" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <div className="mt-3 space-y-2 border-t border-[#334155] pt-3">
          {isFetching ? (
            <p className="text-sm text-[#94a3b8]">{tCommon('loading')}</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-[#94a3b8]">{t('noRepliesYet')}</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <PilotThreadCommentRow key={c.id} comment={c} />
              ))}
            </ul>
          )}
          {total > pageSize ? (
            <p className="text-xs text-[#94a3b8]">{t('moreRepliesOnThread')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
