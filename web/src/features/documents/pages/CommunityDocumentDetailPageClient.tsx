'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { Community } from '@meriter/shared-types';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc/client';
import { routes } from '@/lib/constants/routes';
import { Button } from '@/components/ui/shadcn/button';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { Badge } from '@/components/ui/shadcn/badge';
import { useCommunity, useWallets } from '@/hooks/api';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useUserQuota } from '@/hooks/api/useQuota';
import { getWalletBalance } from '@/lib/utils/wallet';
import { canUseWalletForVoting } from '@/components/organisms/VotingPopup/voting-utils';
import { useToastStore } from '@/shared/stores/toast.store';
import { RichTextEditor } from '@/components/molecules/RichTextEditor/RichTextEditor';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';

const MERIT_VOTE_UNIT = 1;

/** Matches API `MAX_VARIANT_CONTENT` (character count after trim). */
const MAX_VARIANT_HTML_LENGTH = 5000;

function isEmptyTipTapHtml(html: string): boolean {
  const textOnly = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ');
  return textOnly.trim().length === 0;
}

function computeDocumentVariantVoteSplit(args: {
  meritAmount: number;
  direction: 'up' | 'down';
  quotaRemaining: number;
  community: Community | null | undefined;
}): { quotaAmount: number; walletAmount: number } {
  const { meritAmount, direction, quotaRemaining, community } = args;
  if (direction === 'down') {
    return { quotaAmount: 0, walletAmount: meritAmount };
  }
  if (community?.typeTag === 'future-vision') {
    return { quotaAmount: 0, walletAmount: meritAmount };
  }
  const src = community?.votingSettings?.currencySource;
  if (src === 'wallet-only') {
    return { quotaAmount: 0, walletAmount: meritAmount };
  }
  if (src === 'quota-only') {
    return { quotaAmount: Math.min(meritAmount, quotaRemaining), walletAmount: 0 };
  }
  const quotaAmount = Math.min(meritAmount, quotaRemaining);
  const walletAmount = Math.max(0, meritAmount - quotaAmount);
  return { quotaAmount, walletAmount };
}

interface DocBlock {
  id: string;
  order: number;
  blockType: string;
  officialContent?: string;
  currentWaveStartedAt?: string | Date | null;
}

interface DocSection {
  id: string;
  title?: string;
  order: number;
  blocks?: DocBlock[];
}

function flattenDocBlocks(sections: unknown): { section: DocSection; block: DocBlock }[] {
  const out: { section: DocSection; block: DocBlock }[] = [];
  const arr = Array.isArray(sections) ? sections : [];
  for (const raw of arr) {
    const sec = raw as DocSection;
    const blocks = Array.isArray(sec.blocks) ? sec.blocks : [];
    for (const b of blocks) {
      out.push({ section: sec, block: b as DocBlock });
    }
  }
  out.sort((a, b) => {
    if (a.section.order !== b.section.order) return a.section.order - b.section.order;
    return a.block.order - b.block.order;
  });
  return out;
}

function variantStatusLabelKey(
  status: 'open' | 'closed-winner' | 'closed-not-winner' | 'applied' | 'withdrawn',
): 'statusOpen' | 'statusClosedWinner' | 'statusClosedNotWinner' | 'statusApplied' | 'statusWithdrawn' {
  switch (status) {
    case 'closed-winner':
      return 'statusClosedWinner';
    case 'closed-not-winner':
      return 'statusClosedNotWinner';
    case 'applied':
      return 'statusApplied';
    case 'withdrawn':
      return 'statusWithdrawn';
    default:
      return 'statusOpen';
  }
}

export interface CommunityDocumentDetailPageClientProps {
  communityId: string;
  documentId: string;
}

type DocTranslate = (key: string, values?: Record<string, string | number>) => string;

export function CommunityDocumentDetailPageClient({
  communityId,
  documentId,
}: CommunityDocumentDetailPageClientProps) {
  const router = useRouter();
  const t = useTranslations('pages.documents');
  const addToast = useToastStore((s) => s.addToast);
  const { user, isLoading: authLoading } = useAuth();
  const { data: userRoles = [] } = useUserRoles(user?.id ?? '');
  const { data: community } = useCommunity(communityId);
  const { data: wallets = [] } = useWallets();
  const { data: quotaData } = useUserQuota(communityId);

  const docQuery = trpc.documents.getById.useQuery(
    { id: documentId },
    { enabled: Boolean(documentId && user?.id) },
  );

  const quotaRemaining = quotaData?.remainingToday ?? 0;
  const walletBalance = getWalletBalance(wallets, communityId);

  const userRoleInCommunity =
    user?.globalRole === 'superadmin'
      ? 'superadmin'
      : (userRoles.find((r) => r.communityId === communityId)?.role ?? null);

  const canManageDocument =
    user?.globalRole === 'superadmin' ||
    (docQuery.data?.createdBy != null && docQuery.data.createdBy === user?.id) ||
    userRoleInCommunity === 'lead';

  const blocksFlat = useMemo(
    () => (docQuery.data ? flattenDocBlocks(docQuery.data.sections) : []),
    [docQuery.data],
  );

  const pageHeader = (
    <SimpleStickyHeader
      title={docQuery.data?.title ?? t('listTitle')}
      showBack
      onBack={() => router.push(routes.communityDocuments(communityId))}
      asStickyHeader
      showScrollToTop
    />
  );

  if (authLoading) {
    return (
      <AdaptiveLayout
        className="feed"
        communityId={communityId}
        myId={user?.id}
        stickyHeader={pageHeader}
      >
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!user?.id) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader}>
        <p className="p-4 text-sm text-base-content/70">{t('loginToParticipate')}</p>
      </AdaptiveLayout>
    );
  }

  if (docQuery.isLoading) {
    return (
      <AdaptiveLayout
        className="feed"
        communityId={communityId}
        myId={user.id}
        stickyHeader={pageHeader}
      >
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (docQuery.error || !docQuery.data) {
    return (
      <AdaptiveLayout
        className="feed"
        communityId={communityId}
        myId={user.id}
        stickyHeader={pageHeader}
      >
        <p className="p-4 text-sm text-error">{t('detailError')}</p>
      </AdaptiveLayout>
    );
  }

  const doc = docQuery.data;
  if (doc.communityId !== communityId) {
    return (
      <AdaptiveLayout
        className="feed"
        communityId={communityId}
        myId={user.id}
        stickyHeader={pageHeader}
      >
        <p className="p-4 text-sm text-error">{t('wrongCommunity')}</p>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout
      className="feed"
      communityId={communityId}
      myId={user.id}
      stickyHeader={pageHeader}
    >
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-base-content/70">
          <span>
            {doc.type === 'imageOfFuture'
              ? t('typeImageOfFuture')
              : doc.type === 'description'
                ? t('typeDescription')
                : t('typeCustom')}
          </span>
          <Badge variant="outline" className="rounded-lg font-normal">
            {doc.mode === 'auto' ? 'auto' : 'manual'}
          </Badge>
        </div>

        {blocksFlat.map(({ section, block }) => (
          <DocumentBlockSection
            key={block.id}
            documentId={doc.id}
            docMode={doc.mode}
            docAllowDownvotes={doc.allowDownvotes}
            canManageDocument={canManageDocument}
            community={community ?? null}
            sectionTitle={section.title ?? ''}
            block={block}
            quotaRemaining={quotaRemaining}
            walletBalance={walletBalance}
            userId={user.id}
            addToast={addToast}
            t={t as DocTranslate}
          />
        ))}
      </div>
    </AdaptiveLayout>
  );
}

interface DocumentBlockSectionProps {
  documentId: string;
  docMode: 'manual' | 'auto';
  docAllowDownvotes: boolean;
  canManageDocument: boolean;
  community: Community | null;
  sectionTitle: string;
  block: DocBlock;
  quotaRemaining: number;
  walletBalance: number;
  userId: string;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  t: DocTranslate;
}

function DocumentVariantRow({
  variant,
  documentId,
  blockId,
  docMode,
  docAllowDownvotes,
  canManageDocument,
  community,
  quotaRemaining,
  walletBalance,
  userId,
  addToast,
  t,
}: {
  variant: {
    id: string;
    documentId: string;
    blockId: string;
    content: string;
    proposedBy: string;
    status: 'open' | 'closed-winner' | 'closed-not-winner' | 'applied' | 'withdrawn';
    rating: number;
  };
  documentId: string;
  blockId: string;
  docMode: 'manual' | 'auto';
  docAllowDownvotes: boolean;
  canManageDocument: boolean;
  community: Community | null;
  quotaRemaining: number;
  walletBalance: number;
  userId: string;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  t: DocTranslate;
}) {
  const utils = trpc.useUtils();
  const [voteComment, setVoteComment] = useState('');

  const voteMutation = trpc.votes.createWithComment.useMutation({
    onSuccess: async () => {
      setVoteComment('');
      await utils.documents.getById.invalidate({ id: documentId });
      await utils.documentVariants.listByBlock.invalidate({ documentId, blockId });
    },
    onError: (err) => {
      addToast(err.message, 'error');
    },
  });

  const withdrawMutation = trpc.documentVariants.withdraw.useMutation({
    onSuccess: async () => {
      await utils.documents.getById.invalidate({ id: documentId });
      await utils.documentVariants.listByBlock.invalidate({ documentId, blockId });
    },
    onError: (err) => {
      addToast(err.message, 'error');
    },
  });

  const applyWinnerMutation = trpc.documentVariants.applyVotingWinner.useMutation({
    onSuccess: async () => {
      await utils.documents.getById.invalidate({ id: documentId });
      await utils.documentVariants.listByBlock.invalidate({ documentId, blockId });
    },
    onError: (err) => {
      addToast(err.message, 'error');
    },
  });

  const submitVote = (direction: 'up' | 'down') => {
    const isFv = community?.typeTag === 'future-vision';
    if (isFv && !voteComment.trim()) {
      addToast(t('voteCommentRequiredFv'), 'error');
      return;
    }

    const { quotaAmount, walletAmount } = computeDocumentVariantVoteSplit({
      meritAmount: MERIT_VOTE_UNIT,
      direction,
      quotaRemaining,
      community,
    });

    if (walletAmount > 0) {
      if (!canUseWalletForVoting(walletBalance, community) || walletBalance < walletAmount) {
        addToast(t('voteInsufficientWallet'), 'error');
        return;
      }
    }

    voteMutation.mutate({
      targetType: 'document-variant',
      targetId: variant.id,
      quotaAmount,
      walletAmount,
      direction,
      comment: voteComment.trim(),
    });
  };

  return (
    <li className="rounded-lg border border-base-300 bg-base-100/40 p-3 dark:bg-base-100/10">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-md font-normal">
          {t(variantStatusLabelKey(variant.status))}
        </Badge>
        <span className="text-xs text-base-content/60">{t('rating', { rating: variant.rating ?? 0 })}</span>
      </div>
      <div className="mb-3 max-h-48 overflow-y-auto rounded-lg bg-base-300/20 p-2">
        <DocumentRichContent html={variant.content} className="text-sm" />
      </div>

      <div className="flex flex-wrap gap-2">
        {variant.status === 'open' && variant.proposedBy === userId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={withdrawMutation.isPending}
            onClick={() => withdrawMutation.mutate({ variantId: variant.id })}
          >
            {t('withdraw')}
          </Button>
        ) : null}

        {variant.status === 'open' ? (
          <div className="w-full min-w-[200px] flex-1 space-y-2">
            <Textarea
              value={voteComment}
              onChange={(e) => setVoteComment(e.target.value)}
              placeholder={t('voteComment')}
              className="min-h-[72px] rounded-lg border-base-300 bg-base-100 text-sm"
              disabled={voteMutation.isPending}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="rounded-lg"
                disabled={voteMutation.isPending}
                onClick={() => submitVote('up')}
              >
                {t('voteUp')}
              </Button>
              {docAllowDownvotes ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={voteMutation.isPending}
                  onClick={() => submitVote('down')}
                >
                  {t('voteDown')}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {docMode === 'manual' &&
        variant.status === 'closed-winner' &&
        (variant.rating ?? 0) > 0 &&
        canManageDocument ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="rounded-lg"
            disabled={applyWinnerMutation.isPending}
            onClick={() => applyWinnerMutation.mutate({ variantId: variant.id })}
          >
            {t('applyWinner')}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function DocumentBlockSection({
  documentId,
  docMode,
  docAllowDownvotes,
  canManageDocument,
  community,
  sectionTitle,
  block,
  quotaRemaining,
  walletBalance,
  userId,
  addToast,
  t,
}: DocumentBlockSectionProps) {
  const utils = trpc.useUtils();
  const variantsQuery = trpc.documentVariants.listByBlock.useQuery(
    { documentId, blockId: block.id },
    { enabled: !!documentId && !!block.id },
  );

  const proposalBodyRef = useRef('');
  const [proposalResetKey, setProposalResetKey] = useState(0);

  const proposeMutation = trpc.documentVariants.propose.useMutation({
    onSuccess: async () => {
      proposalBodyRef.current = '';
      setProposalResetKey((k) => k + 1);
      await utils.documents.getById.invalidate({ id: documentId });
      await utils.documentVariants.listByBlock.invalidate({ documentId, blockId: block.id });
    },
    onError: (err) => {
      addToast(err.message, 'error');
    },
  });

  const official = (block.officialContent ?? '').trim();
  const variants = variantsQuery.data ?? [];

  const submitProposal = () => {
    const raw = proposalBodyRef.current;
    const trimmed = raw.trim();
    if (isEmptyTipTapHtml(trimmed)) return;
    if (trimmed.length > MAX_VARIANT_HTML_LENGTH) {
      addToast(t('proposalTooLong', { max: MAX_VARIANT_HTML_LENGTH }), 'error');
      return;
    }
    proposeMutation.mutate({
      documentId,
      blockId: block.id,
      content: trimmed,
    });
  };

  return (
    <section className="rounded-xl border border-base-300 bg-base-200/40 p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-base-content/50">
        {sectionTitle ? `${t('section')}: ${sectionTitle}` : t('section')}
      </div>
      <p className="mb-1 text-xs text-base-content/50">{block.blockType}</p>

      <div className="mb-4">
        <h3 className="mb-2 text-sm font-medium text-base-content">{t('official')}</h3>
        {official ? (
          <div className="rounded-lg bg-base-300/30 p-3">
            <DocumentRichContent html={block.officialContent ?? ''} className="text-sm" />
          </div>
        ) : (
          <p className="text-sm text-base-content/60">{t('noOfficialYet')}</p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-base-content">{t('variants')}</h3>
        {variantsQuery.isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
        ) : variants.length === 0 ? (
          <p className="text-sm text-base-content/60">{t('noVariants')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {variants.map((v) => (
              <DocumentVariantRow
                key={v.id}
                variant={{
                  id: v.id,
                  documentId: v.documentId,
                  blockId: v.blockId,
                  content: v.content,
                  proposedBy: v.proposedBy,
                  status: v.status,
                  rating: v.rating ?? 0,
                }}
                documentId={documentId}
                blockId={block.id}
                docMode={docMode}
                docAllowDownvotes={docAllowDownvotes}
                canManageDocument={canManageDocument}
                community={community}
                quotaRemaining={quotaRemaining}
                walletBalance={walletBalance}
                userId={userId}
                addToast={addToast}
                t={t}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 border-t border-base-300 pt-4">
        <h3 className="mb-2 text-sm font-medium text-base-content">{t('propose')}</h3>
        <RichTextEditor
          key={`propose-${block.id}-${proposalResetKey}`}
          content=""
          onChange={(html) => {
            proposalBodyRef.current = html;
          }}
          placeholder={t('proposePlaceholder')}
          editable={!proposeMutation.isPending}
          className="mb-3 [&_.ProseMirror]:min-h-[120px]"
        />
        <Button
          type="button"
          className="rounded-lg"
          disabled={proposeMutation.isPending}
          onClick={submitProposal}
        >
          {t('submitProposal')}
        </Button>
      </div>
    </section>
  );
}
