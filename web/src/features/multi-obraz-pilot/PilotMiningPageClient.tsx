'use client';

import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { routes } from '@/lib/constants/routes';
import { useAuth } from '@/contexts/AuthContext';

function DreamCard({
  dream,
  onChoose,
  disabled,
}: {
  dream: any;
  onChoose: () => void;
  disabled: boolean;
}) {
  const t = useTranslations('multiObraz');
  return (
    <div className="overflow-hidden rounded-xl border border-[#334155] bg-[#1e293b]">
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
          <Button
            type="button"
            variant="secondary"
            className="w-full rounded-lg border border-[#334155] bg-[#0f172a] text-white hover:bg-[#0f172a]/80"
            onClick={onChoose}
            disabled={disabled}
          >
            {t('miningChoose')}
          </Button>
          <Button asChild variant="ghost" className="shrink-0 text-[#94a3b8] hover:text-white">
            <Link href={routes.project(dream.id)}>{t('openDream')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PilotMiningPageClient() {
  const t = useTranslations('multiObraz');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const pairQuery = trpc.pilotMining.getPair.useQuery(undefined, {
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const submit = trpc.pilotMining.submitChoice.useMutation({
    onSuccess: () => {
      void utils.project.getGlobalList.invalidate();
      void pairQuery.refetch();
    },
  });

  const pair = pairQuery.data?.pair ?? null;
  const cycleId = pairQuery.data?.cycleId ?? null;

  if (pairQuery.isLoading) {
    return <p className="text-sm text-[#94a3b8]">{tCommon('loading')}</p>;
  }

  if (!pair) {
    return (
      <div className="rounded-2xl border border-[#334155] bg-[#1e293b] p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">{t('miningTitle')}</h1>
        <p className="mt-3 text-sm text-[#94a3b8]">{t('miningEmpty')}</p>
      </div>
    );
  }

  const disabled = submit.isPending || !cycleId;

  const choose = (winnerId: string) => {
    if (!cycleId) return;
    submit.mutate({
      cycleId,
      aDreamId: pair.a.id,
      bDreamId: pair.b.id,
      winnerDreamId: winnerId,
    });
  };

  return (
    <div className={cn('space-y-6')}>
      <header className="rounded-2xl border border-[#334155] bg-[#1e293b] p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">{t('miningTitle')}</h1>
        <p className="mt-3 text-sm text-[#94a3b8]">{t('miningBody')}</p>
        {!user ? (
          <p className="mt-4 text-sm text-[#94a3b8]">{t('miningGuestHint')}</p>
        ) : null}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <DreamCard dream={pair.a} onChoose={() => choose(pair.a.id)} disabled={disabled} />
        <DreamCard dream={pair.b} onChoose={() => choose(pair.b.id)} disabled={disabled} />
      </div>
    </div>
  );
}

