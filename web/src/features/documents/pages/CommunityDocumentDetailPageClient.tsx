'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, History, Loader2, Settings } from 'lucide-react';
import type { Community } from '@meriter/shared-types';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc/client';
import { routes } from '@/lib/constants/routes';
import { Button } from '@/components/ui/shadcn/button';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { Badge } from '@/components/ui/shadcn/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { useCommunity, useWallets } from '@/hooks/api';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useUserQuota } from '@/hooks/api/useQuota';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { getWalletBalance } from '@/lib/utils/wallet';
import { canUseWalletForVoting } from '@/components/organisms/VotingPopup/voting-utils';
import { useToastStore } from '@/shared/stores/toast.store';
import { RichTextEditor } from '@/components/molecules/RichTextEditor';
import {
  DocumentStructureProvider,
  useDocumentStructure,
} from '@/features/documents/context/DocumentStructureContext';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import { DocumentVariantReferencesEditor } from '@/features/documents/components/DocumentVariantReferencesEditor';
import { DocumentVariantReferencesList } from '@/features/documents/components/DocumentVariantReferencesList';
import { DocumentBlockStructureControls } from '@/features/documents/components/DocumentBlockStructureControls';
import { DocumentSettingsDialog } from '@/features/documents/components/DocumentSettingsDialog';
import type { MeriterBlockType } from '@/features/documents/types/document-block';
import {
  parseVariantReferencesFromApi,
  referencesForPropose,
  validateReferenceDrafts,
  type DocumentVariantReference,
  type DocumentVariantReferenceDraft,
} from '@/features/documents/types/document-variant-reference';

const MERIT_VOTE_UNIT = 1;

/** Matches API `MAX_VARIANT_CONTENT` (character count after trim). */
const MAX_VARIANT_HTML_LENGTH = 5000;

function isEmptyTipTapHtml(html: string): boolean {
  const textOnly = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ');
  return textOnly.trim().length === 0;
}

function computeVariantProposalFeeSplit(
  variantCost: number,
  quotaRemaining: number,
  community: Community | null | undefined,
): { quotaAmount: number; walletAmount: number } {
  if (variantCost <= 0) {
    return { quotaAmount: 0, walletAmount: 0 };
  }
  const canPayFromQuota = community?.settings?.canPayPostFromQuota ?? false;
  if (canPayFromQuota) {
    const quotaAmount = Math.min(variantCost, quotaRemaining);
    const walletAmount = Math.max(0, variantCost - quotaAmount);
    return { quotaAmount, walletAmount };
  }
  return { quotaAmount: 0, walletAmount: variantCost };
}

function canAffordVariantProposal(
  variantCost: number,
  quotaRemaining: number,
  globalWalletBalance: number,
  community: Community | null | undefined,
): boolean {
  if (variantCost <= 0) {
    return true;
  }
  const { quotaAmount, walletAmount } = computeVariantProposalFeeSplit(
    variantCost,
    quotaRemaining,
    community,
  );
  if (quotaAmount > quotaRemaining) {
    return false;
  }
  if (walletAmount > 0) {
    if (!canUseWalletForVoting(globalWalletBalance, community)) {
      return false;
    }
    if (globalWalletBalance < walletAmount) {
      return false;
    }
  }
  return true;
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

type OfficialContentReason = 'vote' | 'admin' | 'initial';

interface BlockEditHistoryEntry {
  changedAt: string | Date;
  changedBy: string;
  reason: OfficialContentReason;
  variantId?: string;
  previousContent: string;
}

interface DocBlock {
  id: string;
  order: number;
  blockType: string;
  officialContent?: string;
  officialContentReason?: OfficialContentReason;
  currentWaveStartedAt?: string | Date | null;
  editHistory?: BlockEditHistoryEntry[];
}

function parseDateMs(value: string | Date | null | undefined): number | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function formatWaveRemaining(endsAtMs: number): string {
  const diff = endsAtMs - Date.now();
  if (diff <= 0) return '';
  const totalMin = Math.ceil(diff / 60_000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
}

function officialReasonLabelKey(
  reason: OfficialContentReason | undefined,
): 'officialReasonInitial' | 'officialReasonVote' | 'officialReasonAdmin' | null {
  if (reason === 'vote') return 'officialReasonVote';
  if (reason === 'admin') return 'officialReasonAdmin';
  if (reason === 'initial') return 'officialReasonInitial';
  return null;
}

function historyReasonLabelKey(
  reason: OfficialContentReason,
): 'historyReasonInitial' | 'historyReasonVote' | 'historyReasonAdmin' {
  if (reason === 'vote') return 'historyReasonVote';
  if (reason === 'admin') return 'historyReasonAdmin';
  return 'historyReasonInitial';
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
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const globalWalletBalance = getWalletBalance(wallets, GLOBAL_COMMUNITY_ID);

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-base-content/70">
            <span>
              {doc.type === 'imageOfFuture'
                ? t('typeImageOfFuture')
                : doc.type === 'description'
                  ? t('typeDescription')
                  : t('typeCustom')}
            </span>
            <Badge variant="outline" className="rounded-lg font-normal">
              {doc.mode === 'auto' ? t('settings.modeAuto') : t('settings.modeManual')}
            </Badge>
            <span>{t('metaVotingHours', { hours: doc.votingDurationHours ?? 48 })}</span>
            <span>{t('metaVariantCost', { cost: doc.variantCost ?? 1 })}</span>
            {doc.updatedAt ? (
              <span>{t('metaUpdated', { date: new Date(doc.updatedAt).toLocaleString() })}</span>
            ) : null}
          </div>
          {canManageDocument ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1 rounded-lg text-xs"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={14} />
              {t('settings.open')}
            </Button>
          ) : null}
        </div>

        {canManageDocument ? (
          <DocumentSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            document={{
              id: doc.id,
              type: doc.type,
              title: doc.title,
              mode: doc.mode,
              votingDurationHours: doc.votingDurationHours ?? 48,
              variantCost: doc.variantCost ?? 1,
              allowDownvotes: doc.allowDownvotes ?? true,
            }}
            onSaved={() => addToast(t('settings.saved'), 'success')}
            onError={(message) => addToast(message, 'error')}
          />
        ) : null}

        <DocumentStructureProvider
          documentId={doc.id}
          documentUpdatedAt={doc.updatedAt}
          sections={doc.sections}
          canManageDocument={canManageDocument}
          addToast={addToast}
        >
        {blocksFlat.map(({ section, block }) => (
          <DocumentBlockSection
            key={block.id}
            documentId={doc.id}
            docMode={doc.mode}
            variantCost={doc.variantCost ?? 1}
            votingDurationHours={doc.votingDurationHours ?? 48}
            docAllowDownvotes={doc.allowDownvotes}
            canManageDocument={canManageDocument}
            community={community ?? null}
            sectionId={section.id}
            sectionTitle={section.title ?? ''}
            block={block}
            quotaRemaining={quotaRemaining}
            walletBalance={walletBalance}
            globalWalletBalance={globalWalletBalance}
            userId={user.id}
            addToast={addToast}
            t={t as DocTranslate}
          />
        ))}
        </DocumentStructureProvider>
      </div>
    </AdaptiveLayout>
  );
}

interface DocumentBlockSectionProps {
  documentId: string;
  docMode: 'manual' | 'auto';
  variantCost: number;
  votingDurationHours: number;
  docAllowDownvotes: boolean;
  canManageDocument: boolean;
  community: Community | null;
  sectionId: string;
  sectionTitle: string;
  block: DocBlock;
  quotaRemaining: number;
  walletBalance: number;
  globalWalletBalance: number;
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
    references: DocumentVariantReference[];
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

  const applyOpenMutation = trpc.documentVariants.applyOpenAsAdmin.useMutation({
    onSuccess: async () => {
      await utils.documents.getById.invalidate({ id: documentId });
      await utils.documentVariants.listByBlock.invalidate({ documentId, blockId });
    },
    onError: (err) => {
      addToast(err.message, 'error');
    },
  });

  const deleteVariantMutation = trpc.documentVariants.deleteVariant.useMutation({
    onSuccess: async () => {
      await utils.documents.getById.invalidate({ id: documentId });
      await utils.documentVariants.listByBlock.invalidate({ documentId, blockId });
    },
    onError: (err) => {
      addToast(err.message, 'error');
    },
  });

  const submitVote = (direction: 'up' | 'down') => {
    if (!voteComment.trim()) {
      addToast(t('voteCommentRequired'), 'error');
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

      <DocumentVariantReferencesList references={variant.references} className="mb-3" />

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

        {variant.status === 'open' && canManageDocument ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-lg"
            disabled={applyOpenMutation.isPending}
            onClick={() => applyOpenMutation.mutate({ variantId: variant.id })}
          >
            {t('applyOpenAsAdmin')}
          </Button>
        ) : null}

        {canManageDocument && variant.status !== 'applied' ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="rounded-lg text-error"
            disabled={deleteVariantMutation.isPending}
            onClick={() => deleteVariantMutation.mutate({ variantId: variant.id })}
          >
            {t('deleteVariant')}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function DocumentBlockSection({
  documentId,
  docMode,
  variantCost,
  votingDurationHours,
  docAllowDownvotes,
  canManageDocument,
  community,
  sectionId,
  sectionTitle,
  block,
  quotaRemaining,
  walletBalance,
  globalWalletBalance,
  userId,
  addToast,
  t,
}: DocumentBlockSectionProps) {
  const structure = useDocumentStructure();
  const utils = trpc.useUtils();
  const variantsQuery = trpc.documentVariants.listByBlock.useQuery(
    { documentId, blockId: block.id },
    { enabled: !!documentId && !!block.id },
  );

  const proposalBodyRef = useRef('');
  const [referenceDrafts, setReferenceDrafts] = useState<DocumentVariantReferenceDraft[]>([]);
  const [proposalResetKey, setProposalResetKey] = useState(0);
  const [variantsExpanded, setVariantsExpanded] = useState(true);
  const [adminOverrideOpen, setAdminOverrideOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const adminOverrideRef = useRef('');
  const [adminOverrideResetKey, setAdminOverrideResetKey] = useState(0);
  const [waveCountdown, setWaveCountdown] = useState('');

  const waveStartMs = parseDateMs(block.currentWaveStartedAt);
  const waveEndsAtMs =
    waveStartMs != null ? waveStartMs + votingDurationHours * 3_600_000 : null;
  const waveActive =
    waveEndsAtMs != null && waveEndsAtMs > Date.now() && (variantsQuery.data ?? []).some((v) => v.status === 'open');

  useEffect(() => {
    if (!waveActive || waveEndsAtMs == null) {
      setWaveCountdown('');
      return;
    }
    const tick = () => setWaveCountdown(formatWaveRemaining(waveEndsAtMs));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [waveActive, waveEndsAtMs]);

  const closeVotingMutation = trpc.documentVariants.closeVotingWaveOnBlock.useMutation({
    onSuccess: async () => {
      addToast(t('closeVotingSuccess'), 'success');
      await utils.documents.getById.invalidate({ id: documentId });
      await utils.documentVariants.listByBlock.invalidate({ documentId, blockId: block.id });
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const adminOverrideMutation = trpc.documents.applyAdminOverride.useMutation({
    onSuccess: async () => {
      addToast(t('adminOverrideSuccess'), 'success');
      setAdminOverrideOpen(false);
      adminOverrideRef.current = '';
      setAdminOverrideResetKey((k) => k + 1);
      await utils.documents.getById.invalidate({ id: documentId });
      await utils.documentVariants.listByBlock.invalidate({ documentId, blockId: block.id });
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const proposeMutation = trpc.documentVariants.propose.useMutation({
    onSuccess: async () => {
      proposalBodyRef.current = '';
      setReferenceDrafts([]);
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

  const canAffordProposal = useMemo(
    () =>
      canAffordVariantProposal(
        variantCost,
        quotaRemaining,
        globalWalletBalance,
        community,
      ),
    [variantCost, quotaRemaining, globalWalletBalance, community],
  );

  const submitProposal = () => {
    const raw = proposalBodyRef.current;
    const trimmed = raw.trim();
    if (isEmptyTipTapHtml(trimmed)) return;
    if (trimmed.length > MAX_VARIANT_HTML_LENGTH) {
      addToast(t('proposalTooLong', { max: MAX_VARIANT_HTML_LENGTH }), 'error');
      return;
    }
    const refError = validateReferenceDrafts(referenceDrafts);
    if (refError) {
      addToast(t(`references.${refError}`), 'error');
      return;
    }

    if (variantCost > 0) {
      const { quotaAmount, walletAmount } = computeVariantProposalFeeSplit(
        variantCost,
        quotaRemaining,
        community,
      );
      if (walletAmount > 0) {
        if (
          !canUseWalletForVoting(globalWalletBalance, community) ||
          globalWalletBalance < walletAmount
        ) {
          addToast(t('proposeInsufficientPayment', { cost: variantCost }), 'error');
          return;
        }
      }
      if (quotaAmount > quotaRemaining) {
        addToast(t('proposeInsufficientQuota', { cost: variantCost }), 'error');
        return;
      }
    }

    const refs = referencesForPropose(referenceDrafts);
    proposeMutation.mutate({
      documentId,
      blockId: block.id,
      content: trimmed,
      ...(refs.length > 0 ? { references: refs } : {}),
    });
  };

  const submitAdminOverride = () => {
    const trimmed = adminOverrideRef.current.trim();
    if (isEmptyTipTapHtml(trimmed)) return;
    if (trimmed.length > MAX_VARIANT_HTML_LENGTH) {
      addToast(t('proposalTooLong', { max: MAX_VARIANT_HTML_LENGTH }), 'error');
      return;
    }
    adminOverrideMutation.mutate({
      documentId,
      blockId: block.id,
      newContent: trimmed,
    });
  };

  const historyEntries = [...(block.editHistory ?? [])].sort((a, b) => {
    const ta = parseDateMs(a.changedAt) ?? 0;
    const tb = parseDateMs(b.changedAt) ?? 0;
    return tb - ta;
  });

  const hasOfficialContent = official.length > 0;

  return (
    <section className="rounded-xl border border-base-300 bg-base-200/40 p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-base-content/50">
        {sectionTitle ? `${t('section')}: ${sectionTitle}` : t('section')}
      </div>
      {structure ? (
        <DocumentBlockStructureControls
          sectionId={sectionId}
          sectionTitle={sectionTitle}
          blockId={block.id}
          blockType={block.blockType}
          hasOfficialContent={hasOfficialContent}
          canRemoveSection={structure.canRemoveSection}
          canRemoveBlock={structure.canRemoveBlock}
          disabled={structure.structureBusy}
          onSectionTitleSave={(title) => structure.onSectionTitleSave(sectionId, title)}
          onBlockTypeChange={(blockType: MeriterBlockType) =>
            structure.onBlockTypeChange(block.id, blockType)
          }
          onRemoveSection={(confirm) => structure.onRemoveSection(sectionId, confirm)}
          onRemoveBlock={(confirm) => structure.onRemoveBlock(block.id, confirm)}
        />
      ) : null}
      <p className="mb-1 text-xs text-base-content/50">{block.blockType}</p>

      <div className="mb-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium text-base-content">{t('official')}</h3>
          {officialReasonLabelKey(block.officialContentReason) ? (
            <Badge variant="outline" className="rounded-md font-normal">
              {t(officialReasonLabelKey(block.officialContentReason)!)}
            </Badge>
          ) : null}
          {waveActive && waveCountdown ? (
            <span className="text-xs text-base-content/60">
              {t('waveEndsIn', { time: waveCountdown })}
            </span>
          ) : null}
          {!waveActive && waveEndsAtMs != null && waveEndsAtMs <= Date.now() ? (
            <span className="text-xs text-base-content/50">{t('waveEnded')}</span>
          ) : null}
        </div>
        {canManageDocument ? (
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-xs"
              onClick={() => setHistoryOpen(true)}
            >
              <History size={14} className="mr-1" />
              {t('history')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-xs"
              onClick={() => setAdminOverrideOpen(true)}
            >
              {t('editor.adminOverride')}
            </Button>
            {waveActive ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-lg text-xs"
                disabled={closeVotingMutation.isPending}
                onClick={() =>
                  closeVotingMutation.mutate({ documentId, blockId: block.id })
                }
              >
                {t('editor.closeVoting')}
              </Button>
            ) : null}
          </div>
        ) : null}
        {official ? (
          <div className="rounded-lg bg-base-300/30 p-3">
            <DocumentRichContent html={block.officialContent ?? ''} className="text-sm" />
          </div>
        ) : (
          <p className="text-sm text-base-content/60">{t('noOfficialYet')}</p>
        )}
      </div>

      <div>
        <button
          type="button"
          className="mb-2 flex w-full items-center gap-2 text-sm font-medium text-base-content"
          onClick={() => setVariantsExpanded((v) => !v)}
        >
          <ChevronDown
            size={16}
            className={variantsExpanded ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
          {t('variantsCount', { count: variants.length })}
        </button>
        {!variantsExpanded ? null : variantsQuery.isLoading ? (
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
                  references: parseVariantReferencesFromApi(v.references),
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
        {variantCost > 0 ? (
          <p className="mb-2 text-xs text-base-content/60">
            {t('proposeCostHint', { cost: variantCost })}
          </p>
        ) : null}
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
        <DocumentVariantReferencesEditor
          key={`refs-${block.id}-${proposalResetKey}`}
          value={referenceDrafts}
          onChange={setReferenceDrafts}
          disabled={proposeMutation.isPending}
        />
        <Button
          type="button"
          className="mt-3 rounded-lg"
          disabled={proposeMutation.isPending || !canAffordProposal}
          onClick={submitProposal}
        >
          {t('submitProposal')}
        </Button>
      </div>

      <Dialog open={adminOverrideOpen} onOpenChange={setAdminOverrideOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('adminOverrideTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-base-content/70">{t('adminOverrideHelp')}</p>
          <RichTextEditor
            key={`admin-override-${block.id}-${adminOverrideResetKey}`}
            content={block.officialContent ?? ''}
            onChange={(html) => {
              adminOverrideRef.current = html;
            }}
            editable={!adminOverrideMutation.isPending}
            className="[&_.ProseMirror]:min-h-[160px]"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => setAdminOverrideOpen(false)}
            >
              {t('adminOverrideCancel')}
            </Button>
            <Button
              type="button"
              className="rounded-lg"
              disabled={adminOverrideMutation.isPending}
              onClick={submitAdminOverride}
            >
              {t('adminOverrideSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('historyTitle')}</DialogTitle>
          </DialogHeader>
          {historyEntries.length === 0 ? (
            <p className="text-sm text-base-content/60">{t('historyEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {historyEntries.map((entry, idx) => (
                <li
                  key={`${parseDateMs(entry.changedAt) ?? idx}-${entry.changedBy}`}
                  className="rounded-lg border border-base-300 p-3"
                >
                  <div className="mb-2 flex flex-wrap gap-2 text-xs text-base-content/60">
                    <Badge variant="secondary" className="rounded-md font-normal">
                      {t(historyReasonLabelKey(entry.reason))}
                    </Badge>
                    <span>
                      {entry.changedAt
                        ? new Date(entry.changedAt).toLocaleString()
                        : ''}
                    </span>
                  </div>
                  <DocumentRichContent html={entry.previousContent} className="text-sm" />
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
