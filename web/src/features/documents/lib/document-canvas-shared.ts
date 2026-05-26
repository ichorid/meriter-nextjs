import type { Community } from '@meriter/shared-types';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { canUseWalletForVoting } from '@/components/organisms/VotingPopup/voting-utils';

export const MAX_VARIANT_HTML_LENGTH = 5000;
export const MERIT_VOTE_UNIT = 1;
export const MAX_VISIBLE_VARIANTS = 2;
/** When expanded list exceeds this count, use a scroll region instead of growing the page. */
export const VARIANT_LIST_SCROLL_THRESHOLD = 12;

export type OfficialContentReason = 'vote' | 'admin' | 'initial';

export interface BlockEditHistoryEntry {
  changedAt: string | Date;
  changedBy: string;
  reason: OfficialContentReason;
  variantId?: string;
  previousContent: string;
}

export interface DocBlock {
  id: string;
  order: number;
  blockType: string;
  officialContent?: string;
  officialContentReason?: OfficialContentReason;
  currentWaveStartedAt?: string | Date | null;
  editHistory?: BlockEditHistoryEntry[];
  /** When true, non-admin members cannot propose variants for this block. */
  proposalsLocked?: boolean;
}

export interface DocSection {
  id: string;
  title?: string;
  order: number;
  blocks?: DocBlock[];
}

export type DocTranslate = (key: string, values?: Record<string, string | number>) => string;

export function isEmptyTipTapHtml(html: string): boolean {
  const textOnly = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ');
  return textOnly.trim().length === 0;
}

export function parseDateMs(value: string | Date | null | undefined): number | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function formatWaveRemaining(endsAtMs: number): string {
  const diff = endsAtMs - Date.now();
  if (diff <= 0) return '';
  const totalMin = Math.ceil(diff / 60_000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
}

export function officialReasonLabelKey(
  reason: OfficialContentReason | undefined,
): 'officialReasonInitial' | 'officialReasonVote' | 'officialReasonAdmin' | null {
  if (reason === 'vote') return 'officialReasonVote';
  if (reason === 'admin') return 'officialReasonAdmin';
  if (reason === 'initial') return 'officialReasonInitial';
  return null;
}

export function historyReasonLabelKey(
  reason: OfficialContentReason,
): 'historyReasonInitial' | 'historyReasonVote' | 'historyReasonAdmin' {
  if (reason === 'vote') return 'historyReasonVote';
  if (reason === 'admin') return 'historyReasonAdmin';
  return 'historyReasonInitial';
}

export function groupBlocksBySection(sections: unknown): { section: DocSection; blocks: DocBlock[] }[] {
  const arr = Array.isArray(sections) ? (sections as DocSection[]) : [];
  const sorted = [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sorted.map((section) => ({
    section,
    blocks: [...(section.blocks ?? [])]
      .map((b) => b as DocBlock)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  }));
}

export function variantStatusLabelKey(
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

export function variantStatusToneClass(
  status: 'open' | 'closed-winner' | 'closed-not-winner' | 'applied' | 'withdrawn',
): string {
  switch (status) {
    case 'closed-winner':
      return 'bg-primary';
    case 'applied':
      return 'bg-emerald-400/80';
    case 'closed-not-winner':
    case 'withdrawn':
      return 'bg-base-content/30';
    default:
      return 'bg-primary/70';
  }
}

export function computeVariantProposalFeeSplit(
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

export function canAffordVariantProposal(
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

export function computeDocumentVariantVoteSplit(args: {
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

export function sectionTitleForDisplay(title: string | undefined): string | null {
  const t = title?.trim() ?? '';
  if (!t) return null;
  const lowered = t.toLowerCase();
  if (lowered === 'новый раздел' || lowered === 'new section') return null;
  return t;
}
