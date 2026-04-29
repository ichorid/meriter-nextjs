'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { routes } from '@/lib/constants/routes';
import { useAuth } from '@/contexts/AuthContext';
import { useToastStore } from '@/shared/stores/toast.store';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { TappalkaMeritIcon } from '@/features/tappalka/components/TappalkaMeritIcon';
import { formatMerits } from '@/lib/utils/currency';

function DreamCard({
  dream,
  onDropMerit,
  onDragEnter,
  onDragLeave,
  isDropTarget,
  isSelected,
  disabled,
  isTokenHovered,
  isDragging,
}: {
  dream: any;
  onDropMerit: () => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  isDropTarget: boolean;
  isSelected: boolean;
  disabled: boolean;
  isTokenHovered: boolean;
  isDragging: boolean;
}) {
  const t = useTranslations('multiObraz');
  const handleDragOver = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
    },
    [disabled],
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      onDropMerit();
    },
    [disabled, onDropMerit],
  );

  const handleDragEnterInner = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      onDragEnter();
    },
    [disabled, onDragEnter],
  );

  const handleDragLeaveInner = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        onDragLeave();
      }
    },
    [onDragLeave],
  );

  return (
    <div
      data-pilot-dream-id={dream.id}
      className={cn(
        'overflow-hidden rounded-xl border-2 bg-[#1e293b] transition-all duration-300',
        isSelected
          ? 'border-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.45),0_10px_24px_rgba(0,0,0,0.45)]'
          : isDropTarget
            ? 'border-[#A855F7] shadow-[0_0_0_2px_rgba(168,85,247,0.25),0_10px_24px_rgba(0,0,0,0.45)]'
            : 'border-[#334155] shadow-[0_10px_24px_rgba(0,0,0,0.45)]',
        disabled && 'opacity-80',
      )}
      style={{
        outline:
          isDragging && !isSelected && !isDropTarget
            ? '1px solid rgba(168,85,247,0.35)'
            : 'none',
        outlineOffset: -1,
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnter={handleDragEnterInner}
      onDragLeave={handleDragLeaveInner}
    >
      {dream.coverImageUrl ? (
        <img src={dream.coverImageUrl} alt="" className="h-44 w-full object-cover" />
      ) : null}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-white">{dream.name}</div>
            {dream.description ? (
              <p className="mt-2 line-clamp-3 text-sm text-[#94a3b8]">{dream.description}</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
              {t('dreamScore')}
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums text-white">
              {dream.pilotDreamRating?.score ?? 0}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button asChild variant="ghost" className="shrink-0 text-[#94a3b8] hover:text-white">
            <Link href={routes.project(dream.id)}>{t('openDream')}</Link>
          </Button>
        </div>
        {(isTokenHovered || isDragging) && !disabled ? (
          <div className="mt-3 text-xs text-[#94a3b8]">
            {t('miningDropHint')}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PilotMiningPageClient() {
  const t = useTranslations('multiObraz');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);

  const progressQuery = trpc.pilotMining.getProgress.useQuery(undefined, {
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const pairQuery = trpc.pilotMining.getPair.useQuery(undefined, {
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Drag-and-drop state (mirrors tappalka UX)
  const [draggedToken, setDraggedToken] = React.useState<string | null>(null);
  const [dropTargetDreamId, setDropTargetDreamId] = React.useState<string | null>(null);
  const [selectedDreamId, setSelectedDreamId] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isTokenHovered, setIsTokenHovered] = React.useState(false);

  const submit = trpc.pilotMining.submitChoice.useMutation({
    onSuccess: (result) => {
      void utils.project.getGlobalList.invalidate();
      void progressQuery.refetch();
      void pairQuery.refetch();

      if (result?.rewardEarned && result?.userMeritsEarned) {
        addToast(t('miningRewardToast', { merits: formatMerits(result.userMeritsEarned) }), 'success');
      }
    },
  });

  const pair = pairQuery.data?.pair ?? null;
  const cycleId = pairQuery.data?.cycleId ?? null;
  const progress = progressQuery.data ?? null;

  const aId = pair?.a?.id ?? null;
  const bId = pair?.b?.id ?? null;
  const disabled = submit.isPending || !cycleId || !aId || !bId;

  const choose = React.useCallback(
    async (winnerId: string) => {
      if (!cycleId || !aId || !bId) return;
      if (disabled) return;
      if (winnerId !== aId && winnerId !== bId) return;

      setSelectedDreamId(winnerId);
      setDraggedToken(null);
      setDropTargetDreamId(null);
      setIsDragging(false);

      try {
        await submit.mutateAsync({
          cycleId,
          aDreamId: aId,
          bDreamId: bId,
          winnerDreamId: winnerId,
        });
        // small delay to keep selection feedback visible
        setTimeout(() => {
          setSelectedDreamId(null);
        }, 220);
      } catch (error) {
        console.error('Failed to submit pilot mining choice:', error);
        const raw = error instanceof Error ? error.message : undefined;
        addToast(resolveApiErrorToastMessage(raw), 'error');
        setSelectedDreamId(null);
      }
    },
    [cycleId, aId, bId, disabled, submit, addToast],
  );

  const comparisonsRequired = progress?.comparisonsRequired ?? 10;
  const comparisonCount = progress?.comparisonCount ?? 0;
  const progressPercent =
    comparisonsRequired > 0 ? Math.min(100, (comparisonCount / comparisonsRequired) * 100) : 0;

  const handleDragStart = React.useCallback(() => {
    if (disabled) return;
    setDraggedToken('merit');
    setIsDragging(true);
  }, [disabled]);

  const handleDragEnd = React.useCallback(
    (releasePoint?: { x: number; y: number }) => {
      if (releasePoint && typeof document !== 'undefined') {
        const el = document.elementFromPoint(releasePoint.x, releasePoint.y);
        const card = el?.closest('[data-pilot-dream-id]');
        const dreamId = card?.getAttribute('data-pilot-dream-id');
        if (dreamId && (dreamId === pair?.a.id || dreamId === pair?.b.id)) {
          void choose(dreamId);
        }
      }
      setDraggedToken(null);
      setDropTargetDreamId(null);
      setIsDragging(false);
    },
    [pair?.a.id, pair?.b.id, choose],
  );

  const handleTouchDragMove = React.useCallback(
    (x: number, y: number) => {
      if (typeof document === 'undefined') return;
      const el = document.elementFromPoint(x, y);
      const card = el?.closest('[data-pilot-dream-id]');
      const dreamId = card?.getAttribute('data-pilot-dream-id');
      if (dreamId && (dreamId === pair?.a.id || dreamId === pair?.b.id)) {
        setDropTargetDreamId(dreamId);
      } else {
        setDropTargetDreamId(null);
      }
    },
    [pair?.a.id, pair?.b.id],
  );

  const handleDropOnDream = React.useCallback(
    async (dreamId: string) => {
      if (!draggedToken || disabled) return;
      await choose(dreamId);
    },
    [draggedToken, disabled, choose],
  );

  if (pairQuery.isLoading) {
    return <p className="text-sm text-[#94a3b8]">{tCommon('loading')}</p>;
  }

  if (!pair || !aId || !bId) {
    return (
      <div className="rounded-2xl border border-[#334155] bg-[#1e293b] p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">{t('miningTitle')}</h1>
        <p className="mt-3 text-sm text-[#94a3b8]">{t('miningEmpty')}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6')}>
      <header className="rounded-2xl border border-[#334155] bg-[#1e293b] p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">{t('miningTitle')}</h1>
        <p className="mt-3 text-sm text-[#94a3b8]">{t('miningBody')}</p>
        {!user ? (
          <p className="mt-4 text-sm text-[#94a3b8]">{t('miningGuestHint')}</p>
        ) : null}

        {progress ? (
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#94a3b8]">
                {t('miningProgress')} <span className="tabular-nums text-white">{comparisonCount}</span>
                <span className="text-[#94a3b8]"> / </span>
                <span className="tabular-nums text-white">{comparisonsRequired}</span>
              </span>
              <span className="tabular-nums text-[#94a3b8]">{Math.round(progressPercent)}%</span>
            </div>
            <div className="mt-2 relative h-3 overflow-hidden rounded-full bg-[#0f172a] ring-1 ring-[#334155]">
              <div
                className={cn(
                  'absolute inset-y-0 left-0 transition-all duration-300 rounded-full',
                  progressPercent >= 100 ? 'bg-emerald-500' : 'bg-[#A855F7]',
                )}
                style={{ width: `${progressPercent}%` }}
              />
              {progressPercent > 0 && progressPercent < 100 ? (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/15"
                  style={{ left: `${progressPercent}%` }}
                />
              ) : null}
            </div>
            <p className="mt-2 text-xs text-[#94a3b8]">{t('miningProgressHint')}</p>
          </div>
        ) : null}
      </header>

      <div className="relative flex flex-col items-stretch gap-4 md:flex-row md:items-stretch">
        <div className="flex-1">
          <DreamCard
            dream={pair.a}
            disabled={disabled}
            onDropMerit={() => void handleDropOnDream(aId)}
            onDragEnter={() => setDropTargetDreamId(aId)}
            onDragLeave={() => setDropTargetDreamId(null)}
            isDropTarget={dropTargetDreamId === aId}
            isSelected={selectedDreamId === aId}
            isTokenHovered={isTokenHovered}
            isDragging={isDragging}
          />
        </div>

        <div className="flex items-center justify-center md:w-24 md:shrink-0">
          <TappalkaMeritIcon
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onHoverChange={setIsTokenHovered}
            onTouchDragMove={handleTouchDragMove}
            disabled={disabled}
            isTokenHovered={isTokenHovered}
            isDragging={isDragging}
            className={cn(!disabled && !isDragging && 'animate-tappalka-tremble')}
            size="lg"
          />
        </div>

        <div className="flex-1">
          <DreamCard
            dream={pair.b}
            disabled={disabled}
            onDropMerit={() => void handleDropOnDream(bId)}
            onDragEnter={() => setDropTargetDreamId(bId)}
            onDragLeave={() => setDropTargetDreamId(null)}
            isDropTarget={dropTargetDreamId === bId}
            isSelected={selectedDreamId === bId}
            isTokenHovered={isTokenHovered}
            isDragging={isDragging}
          />
        </div>
      </div>
    </div>
  );
}

