'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CalendarClock, Loader2, MapPin, User, Users } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { SortToggle } from '@/components/ui/SortToggle';
import { type SortValue } from '@/components/ui/SortTabs';
import { useComments } from '@shared/hooks/use-comments';
import { useAuth } from '@/contexts/AuthContext';
import { useUIStore } from '@/stores/ui.store';
import { useToastStore } from '@/shared/stores/toast.store';
import { usePublication, useCommunity, useWallets } from '@/hooks/api';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { getWalletBalance } from '@/lib/utils/wallet';
import { trpc } from '@/lib/trpc/client';
import { getPublicationIdentifier } from '@/lib/utils/publication';
import { PublicationHeader } from '@/components/organisms/Publication/PublicationHeader';
import { PublicationContent } from '@/components/organisms/Publication/PublicationContent';
import { PublicationActions } from '@/components/organisms/Publication/PublicationActions';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { Comment as CommentComponent } from '@features/comments/components/comment';
import { EventRSVP } from './EventRSVP';
import { EventInviteDialog } from './EventInviteDialog';
import { EventQRDisplay } from './EventQRDisplay';
import { EventDirectInvite } from './EventDirectInvite';
import { EventEditDialog, type EventEditDialogInitial } from './EventEditDialog';
import { routes } from '@/lib/constants/routes';
import {
  resolveVoteCtaCommentMode,
  voteCtaUsesCommentLabel,
} from '@/lib/utils/vote-cta-label';
import { toastMessageForVoteDisabledReason } from '@/lib/i18n/vote-disabled-toast';
import { getEventStatus } from '../lib/event-status';

type PublicationDetail = Record<string, unknown> & {
  id?: string;
  communityId?: string;
  authorId?: string;
  authorKind?: 'user' | 'community';
  authoredCommunityId?: string;
  publishedByUserId?: string;
  beneficiaryId?: string;
  postType?: string;
  title?: string;
  description?: string;
  content?: string;
  eventStartDate?: string | Date;
  eventEndDate?: string | Date;
  eventTime?: string;
  eventLocation?: string;
  eventAttendees?: string[];
  createdAt?: string;
  meta?: {
    author?: { id?: string; name?: string; photoUrl?: string; username?: string };
    beneficiary?: { id?: string; name?: string; photoUrl?: string; username?: string };
    publishedBy?: { id?: string; name?: string; photoUrl?: string; username?: string };
  };
  permissions?: { canVote?: boolean; voteDisabledReason?: string };
  status?: string;
};

export interface EventPageProps {
  communityId: string;
  publicationId: string;
}

export function EventPage({ communityId, publicationId }: EventPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('common');
  const tShared = useTranslations('shared');
  const tComments = useTranslations('comments');
  const tEvents = useTranslations('events');

  const [commentSort, setCommentSort] = useState<SortValue>('recent');
  const activeCommentHook = useState<string | null>(null);
  const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [directOpen, setDirectOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrInviteUrl, setQrInviteUrl] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const highlightCommentId = searchParams?.get('highlight');

  const { user } = useAuth();
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();

  const { data: publication, isLoading, error, isFetched } = usePublication(publicationId);
  const pub = publication as PublicationDetail | undefined;

  const { data: community } = useCommunity(communityId);
  const publicationCommunityId = pub?.communityId ?? communityId;
  const { data: votingContextCommunity } = useCommunity(publicationCommunityId);
  const { data: userRoles = [] } = useUserRoles(user?.id || '');

  const isLeadInCommunity = userRoles.some(
    (r: { communityId: string; role: string }) =>
      r.communityId === communityId && r.role === 'lead',
  );

  const isMember = userRoles.some(
    (r: { communityId: string; role: string }) =>
      r.communityId === publicationCommunityId &&
      (r.role === 'lead' || r.role === 'participant'),
  );

  const { data: balance = 0 } = useWalletBalance(communityId);
  const { data: wallets = [] } = useWallets();
  const currentBalance = getWalletBalance(wallets, communityId);

  const {
    comments,
    showComments,
    setShowComments,
  } = useComments(
    false,
    publicationId,
    '',
    balance,
    async () => {},
    0,
    0,
    activeCommentHook,
    true,
    publicationCommunityId,
    wallets,
    commentSort as 'recent' | 'voted',
  );

  useEffect(() => {
    setShowComments(true);
  }, [setShowComments]);

  useEffect(() => {
    if (!user?.id) {
      router.push('/meriter/login?returnTo=' + encodeURIComponent(window.location.pathname));
    }
  }, [user, router]);

  useEffect(() => {
    if (highlightCommentId && publication) {
      const timer = setTimeout(() => {
        const el = document.querySelector(`[data-comment-id="${highlightCommentId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight');
          setTimeout(() => {
            el.classList.remove('highlight');
          }, 3000);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [highlightCommentId, publication]);

  useEffect(() => {
    if (isFetched && !isLoading && user?.id) {
      const isNotFound =
        error &&
        ((error as { data?: { code?: string } }).data?.code === 'NOT_FOUND' ||
          (error instanceof Error && error.message?.toLowerCase().includes('not found')));
      if (isNotFound) {
        router.replace('/meriter/not-found');
      }
    }
  }, [isFetched, isLoading, error, user, router]);

  const eventStatus = useMemo(() => {
    if (!pub?.eventStartDate || !pub?.eventEndDate) return null;
    return getEventStatus(new Date(pub.eventStartDate), new Date(pub.eventEndDate));
  }, [pub?.eventStartDate, pub?.eventEndDate]);

  const statusLabel =
    eventStatus === 'upcoming'
      ? tEvents('statusUpcoming')
      : eventStatus === 'active'
        ? tEvents('statusActive')
        : eventStatus === 'past'
          ? tEvents('statusPast')
          : '';

  const canManageInvites = Boolean(
    user?.id &&
      pub?.authorId &&
      (user.id === pub.authorId || isLeadInCommunity || user.globalRole === 'superadmin'),
  );

  const canEditEvent = canManageInvites;

  const editInitial: EventEditDialogInitial | null = useMemo(() => {
    if (!pub?.id || pub.postType !== 'event') return null;
    return {
      publicationId: pub.id,
      title: pub.title,
      description: pub.description,
      content: String(pub.content ?? ''),
      eventStartDate: pub.eventStartDate as string,
      eventEndDate: pub.eventEndDate as string,
      eventTime: pub.eventTime,
      eventLocation: pub.eventLocation,
    };
  }, [pub]);

  const handleSaved = useCallback(() => {
    void utils.publications.getById.invalidate({ id: publicationId });
  }, [utils, publicationId]);

  const createInviteLink = trpc.events.createInviteLink.useMutation();

  const openQrWithFreshLink = async () => {
    try {
      const rec = await createInviteLink.mutateAsync({
        publicationId,
        options: undefined,
      });
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setQrInviteUrl(`${origin}${routes.eventInvite(rec.token)}`);
      setQrOpen(true);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : t('unexpectedError'), 'error');
    }
  };

  const pageHeader = (
    <SimpleStickyHeader
      title={
        <button
          type="button"
          onClick={() => router.push(`/meriter/communities/${communityId}`)}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          {community ? (
            <>
              <Avatar className="h-6 w-6 text-xs">
                {community.avatarUrl ? (
                  <AvatarImage src={community.avatarUrl} alt={community.name} />
                ) : null}
                <AvatarFallback communityId={community.id} className="font-medium uppercase">
                  {community.name ? community.name.slice(0, 2).toUpperCase() : <User size={14} />}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[150px] truncate font-medium">{community.name}</span>
              {community.settings?.iconUrl ? (
                <img src={community.settings.iconUrl} alt="" className="h-4 w-4" />
              ) : null}
            </>
          ) : null}
        </button>
      }
      showBack
      onBack={() => router.push(`/meriter/communities/${communityId}`)}
      rightAction={
        <SortToggle
          value={commentSort as 'recent' | 'voted'}
          onChange={(val) => setCommentSort(val)}
          compact
        />
      }
      asStickyHeader
    />
  );

  if (isLoading || !user?.id) {
    return (
      <AdaptiveLayout
        className="feed"
        communityId={communityId}
        balance={balance}
        wallets={wallets}
        myId={user?.id}
        activeCommentHook={activeCommentHook}
        activeWithdrawPost={activeWithdrawPost}
        setActiveWithdrawPost={setActiveWithdrawPost}
        stickyHeader={pageHeader}
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (error || !pub?.id) {
    return (
      <AdaptiveLayout
        className="feed"
        communityId={communityId}
        balance={balance}
        wallets={wallets}
        myId={user?.id}
        activeCommentHook={activeCommentHook}
        activeWithdrawPost={activeWithdrawPost}
        setActiveWithdrawPost={setActiveWithdrawPost}
        stickyHeader={pageHeader}
      >
        <div className="flex h-64 flex-col items-center justify-center">
          <p className="text-error">{t('publicationNotFound')}</p>
          <button
            type="button"
            className="btn btn-primary mt-4"
            onClick={() => router.push(`/meriter/communities/${communityId}`)}
          >
            {t('backToCommunity')}
          </button>
        </div>
      </AdaptiveLayout>
    );
  }

  if (pub.postType !== 'event' || pub.communityId !== communityId) {
    return (
      <AdaptiveLayout
        className="feed"
        communityId={communityId}
        balance={balance}
        wallets={wallets}
        myId={user?.id}
        activeCommentHook={activeCommentHook}
        activeWithdrawPost={activeWithdrawPost}
        setActiveWithdrawPost={setActiveWithdrawPost}
        stickyHeader={pageHeader}
      >
        <div className="flex h-64 flex-col items-center justify-center gap-2">
          <p className="text-error">{tEvents('pageNotEvent')}</p>
          <Button type="button" variant="outline" onClick={() => router.push(`/meriter/communities/${communityId}`)}>
            {t('backToCommunity')}
          </Button>
        </div>
      </AdaptiveLayout>
    );
  }

  const isCommunityAuthorDetail = pub.authorKind === 'community' && Boolean(pub.authoredCommunityId);
  const transformedMeta = {
    ...pub.meta,
    author: {
      ...pub.meta?.author,
      id:
        isCommunityAuthorDetail && pub.authoredCommunityId
          ? pub.authoredCommunityId
          : pub.authorId,
    },
    beneficiary:
      pub.beneficiaryId && pub.meta?.beneficiary
        ? {
            ...pub.meta.beneficiary,
            id: pub.beneficiaryId,
          }
        : undefined,
  };

  const voteCtaMode = resolveVoteCtaCommentMode({
    publicationStatus: pub.status,
    postType: pub.postType,
    communitySettings: votingContextCommunity?.settings as
      | { commentMode?: 'all' | 'neutralOnly' | 'weightedOnly'; tappalkaOnlyMode?: boolean }
      | undefined,
  });
  const voteCtaPrimaryLabel = voteCtaUsesCommentLabel(voteCtaMode)
    ? tComments('commentButton')
    : tComments('voteTitle');

  const attendeeIds = Array.isArray(pub.eventAttendees) ? pub.eventAttendees : [];
  const isAttending = Boolean(user?.id && attendeeIds.includes(user.id));

  return (
    <AdaptiveLayout
      className="feed"
      communityId={communityId}
      balance={balance}
      wallets={wallets}
      myId={user?.id}
      activeCommentHook={activeCommentHook}
      activeWithdrawPost={activeWithdrawPost}
      setActiveWithdrawPost={setActiveWithdrawPost}
      stickyHeader={pageHeader}
    >
      <div className="space-y-4 pb-24">
        <article className="rounded-xl bg-[#F5F5F5] p-5 shadow-none dark:bg-[#2a3239]">
          <PublicationHeader
            publication={{
              id: pub.id,
              slug: (pub as { slug?: string }).slug || pub.id,
              createdAt: pub.createdAt as string,
              meta: transformedMeta,
              postType: pub.postType,
              isProject: (pub as { isProject?: boolean }).isProject,
              permissions: pub.permissions as Record<string, unknown> | undefined,
              authorKind: pub.authorKind,
              authoredCommunityId: pub.authoredCommunityId,
              publishedByUserId: pub.publishedByUserId,
            }}
            showCommunityAvatar={false}
            className="mb-4 border-b border-base-content/10 pb-4"
            authorId={pub.authorId as string}
            metrics={(pub as { metrics?: unknown }).metrics}
            publicationId={pub.id}
            communityId={communityId}
            isPoll={false}
          />

          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 flex-1 text-xl font-semibold leading-tight text-base-content">
              {pub.title?.trim() ? pub.title : tEvents('untitledEvent')}
            </h1>
            {statusLabel ? (
              <Badge variant={eventStatus === 'past' ? 'secondary' : 'default'} className="shrink-0">
                {statusLabel}
              </Badge>
            ) : null}
          </div>

          <div className="mb-4 space-y-2 text-sm text-base-content/80">
            {pub.eventStartDate && pub.eventEndDate ? (
              <p className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-base-content/50" aria-hidden />
                <span className="min-w-0 break-words">
                  {new Date(pub.eventStartDate).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}{' '}
                  —{' '}
                  {new Date(pub.eventEndDate).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </p>
            ) : null}
            {pub.eventTime ? (
              <p className="flex items-start gap-2 pl-6 text-base-content/70">
                <span>
                  {tEvents('eventTimeLabel')}: {pub.eventTime}
                </span>
              </p>
            ) : null}
            {pub.eventLocation ? (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-base-content/50" aria-hidden />
                <span className="min-w-0 break-words">{pub.eventLocation}</span>
              </p>
            ) : null}
            <p className="flex items-center gap-2 text-base-content/70">
              <Users className="h-4 w-4 shrink-0 text-base-content/50" aria-hidden />
              {tEvents('attendeeCount', { count: attendeeIds.length })}
            </p>
          </div>

          {canEditEvent || canManageInvites ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {canEditEvent ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-lg px-2.5 text-xs"
                  onClick={() => setEditOpen(true)}
                >
                  {tEvents('editOpen')}
                </Button>
              ) : null}
              {canManageInvites ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg px-2.5 text-xs"
                    onClick={() => setInviteOpen(true)}
                  >
                    {tEvents('actionInviteLink')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg px-2.5 text-xs"
                    disabled={createInviteLink.isPending}
                    onClick={() => void openQrWithFreshLink()}
                  >
                    {tEvents('actionShowQr')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg px-2.5 text-xs"
                    onClick={() => setDirectOpen(true)}
                  >
                    {tEvents('actionDirectInvite')}
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}

          <PublicationContent
            publication={{
              id: pub.id,
              createdAt: pub.createdAt as string,
              content: (pub.content as string) || '',
              title: pub.title,
              description: pub.description,
              isProject: (pub as { isProject?: boolean }).isProject,
              postType: pub.postType,
              images: (pub as { images?: unknown }).images,
              hashtags: ((pub as { hashtags?: string[] }).hashtags as string[]) || [],
              categories: ((pub as { categories?: string[] }).categories as string[]) || [],
              impactArea: (pub as { impactArea?: unknown }).impactArea,
              stage: (pub as { stage?: unknown }).stage,
              beneficiaries: (pub as { beneficiaries?: unknown }).beneficiaries,
              methods: (pub as { methods?: unknown }).methods,
              helpNeeded: (pub as { helpNeeded?: unknown }).helpNeeded,
              meta: transformedMeta,
            }}
            className="mb-4 border-t border-base-content/10 pt-4"
            hideTitle
          />

          <PublicationActions
            publication={{
              id: pub.id,
              createdAt: pub.createdAt,
              authorId: pub.authorId,
              beneficiaryId: pub.beneficiaryId,
              communityId: publicationCommunityId,
              slug: (pub as { slug?: string }).slug || pub.id,
              content: pub.content,
              permissions: pub.permissions,
              type: ((pub as { type?: string }).type as string) || 'text',
              metrics: (pub as { metrics?: unknown }).metrics,
              meta: transformedMeta,
              postType: pub.postType,
              isProject: (pub as { isProject?: boolean }).isProject,
              withdrawals:
                ((pub as { withdrawals?: Record<string, unknown> }).withdrawals as Record<string, unknown>) || {
                  totalWithdrawn: 0,
                },
              investingEnabled: (pub as { investingEnabled?: boolean }).investingEnabled ?? false,
              investorSharePercent: (pub as { investorSharePercent?: number }).investorSharePercent ?? 50,
              investmentPool: (pub as { investmentPool?: number }).investmentPool ?? 0,
              investmentPoolTotal: (pub as { investmentPoolTotal?: number }).investmentPoolTotal ?? 0,
              status: pub.status,
              closingSummary: (pub as { closingSummary?: unknown }).closingSummary as
                | {
                    totalEarned: number;
                    distributedToInvestors: number;
                    authorReceived: number;
                    spentOnShows: number;
                  }
                | undefined,
              ttlExpiresAt: (pub as { ttlExpiresAt?: Date | string | null }).ttlExpiresAt,
            }}
            onVote={() => {}}
            onComment={() => {}}
            activeCommentHook={activeCommentHook}
            isVoting={false}
            isCommenting={false}
            maxPlus={currentBalance}
            wallets={wallets}
            updateAll={() => {
              void utils.publications.getById.invalidate({ id: getPublicationIdentifier(publication) ?? '' });
            }}
          />
        </article>

        <EventRSVP
          publicationId={publicationId}
          communityId={publicationCommunityId}
          attendeeIds={attendeeIds}
          isMember={isMember}
          isAttending={isAttending}
        />

        {showComments ? (
          <div className="mt-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-base-content">
                {tShared('comments')}
                <span className="ml-2 text-sm font-normal text-base-content/50">{comments?.length || 0}</span>
              </h2>
            </div>

            {(() => {
              const hasUserVoted = Boolean(
                user?.id &&
                  comments?.some(
                    (c: { authorId?: string; meta?: { author?: { id?: string } } }) =>
                      c.authorId === user.id || c.meta?.author?.id === user.id,
                  ),
              );
              const postStatus = pub.status ?? 'active';
              const votePerms = pub.permissions;
              const canVoteOnPost = votePerms?.canVote ?? false;

              if (hasUserVoted || !canVoteOnPost || postStatus === 'closed') {
                return null;
              }

              return (
                <div className="mb-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!canVoteOnPost) {
                        const msg = toastMessageForVoteDisabledReason(votePerms?.voteDisabledReason, tShared);
                        addToast(msg, 'error');
                        return;
                      }
                      const typeTag = votingContextCommunity?.typeTag;
                      const mode: 'standard' | 'wallet-only' | 'quota-only' =
                        typeTag === 'future-vision'
                          ? 'wallet-only'
                          : typeTag === 'marathon-of-good'
                            ? 'quota-only'
                            : 'standard';
                      useUIStore.getState().openVotingPopup(publicationId, 'publication', mode, {
                        publicationIsTask: false,
                        taskAllowWeightedMerits: false,
                      });
                    }}
                    className="w-full"
                  >
                    {voteCtaPrimaryLabel}
                  </Button>
                </div>
              );
            })()}

            <div className="flex flex-col gap-3">
              {comments?.map((c: Record<string, unknown>, index: number) => (
                <CommentComponent
                  key={(c.id as string) || (c._id as string) || `comment-${index}`}
                  {...c}
                  _id={(c._id as string) || (c.id as string) || `comment-${index}`}
                  balance={balance}
                  updBalance={() => {}}
                  spaceSlug=""
                  inPublicationSlug={publicationId}
                  activeCommentHook={activeCommentHook}
                  myId={user?.id}
                  highlightTransactionId={highlightCommentId || undefined}
                  wallets={wallets}
                  updateWalletBalance={() => {}}
                  updateAll={() => {}}
                  communityId={publicationCommunityId}
                  isDetailPage
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <EventInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} publicationId={publicationId} />
      <EventDirectInvite
        open={directOpen}
        onOpenChange={setDirectOpen}
        publicationId={publicationId}
        communityId={publicationCommunityId}
      />
      {qrInviteUrl ? (
        <EventQRDisplay open={qrOpen} onOpenChange={setQrOpen} inviteUrl={qrInviteUrl} />
      ) : null}
      <EventEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        communityId={publicationCommunityId}
        initial={editInitial}
        onSaved={handleSaved}
      />
    </AdaptiveLayout>
  );
}
