'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { useAuth } from '@/contexts/AuthContext';
import { pilotDreamHref } from '@/lib/constants/pilot-routes';
import { invalidatePilotDreamFeeds } from '@/hooks/api/pilot-invalidate';

export default function DeletedDreamsPage() {
  const t = useTranslations('multiObraz');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const isSuperadmin = user?.globalRole === 'superadmin';
  const utils = trpc.useUtils();

  const { data, isLoading, isError } = trpc.pilotDreams.listSoftDeleted.useQuery(undefined, {
    enabled: Boolean(isSuperadmin),
    retry: false,
  });

  const restore = trpc.pilotDreams.restoreDream.useMutation({
    onSuccess: (_data, vars) => {
      invalidatePilotDreamFeeds(utils, vars.dreamId);
    },
  });

  if (!isSuperadmin) {
    return (
      <div className="rounded-2xl border border-[#334155] bg-[#1e293b] p-6 text-sm text-[#94a3b8]">
        {t('deletedDreamsForbidden')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-white">{t('deletedDreamsTitle')}</h1>

      {isLoading ? (
        <p className="text-sm text-[#94a3b8]">{tCommon('loading')}</p>
      ) : isError ? (
        <p className="text-sm text-red-400">{t('deletedDreamsLoadFailed')}</p>
      ) : !data?.length ? (
        <p className="text-sm text-[#94a3b8]">{t('deletedDreamsEmpty')}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((d) => (
            <li key={d.id} className="rounded-xl border border-[#334155] bg-[#0f172a] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{d.name}</div>
                  {d.description ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[#94a3b8]">{d.description}</p>
                  ) : null}
                  <div className="mt-2 text-xs text-[#94a3b8]">
                    {t('deletedDreamsDeletedAt', {
                      ts:
                        d.pilotDreamSoftDeletedAt instanceof Date
                          ? d.pilotDreamSoftDeletedAt.toISOString()
                          : String(d.pilotDreamSoftDeletedAt),
                    })}
                  </div>
                </div>
                <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:items-stretch">
                  <Button size="sm" variant="outline" className="border-[#334155] text-white" asChild>
                    <Link href={pilotDreamHref(d.id)}>{t('deletedDreamsOpen')}</Link>
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#A855F7] text-white hover:bg-[#9333ea]"
                    disabled={restore.isPending}
                    onClick={() => restore.mutate({ dreamId: d.id })}
                  >
                    {t('deletedDreamsRestore')}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

