'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { User as UserIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Community } from '@meriter/shared-types';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import { Button } from '@/components/ui/shadcn/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/shadcn/avatar';
import { usePilotPendingJoinRequests, usePilotUserDreams } from '@/hooks/api/useProjects';
import { isPilotDreamProject } from '@/config/pilot';
import { pilotCreateHref } from '@/lib/constants/pilot-routes';
import { cn } from '@/lib/utils';
import { WalletQuotaBlock } from '@/components/molecules/WalletQuotaBlock/WalletQuotaBlock';
import { usePilotMeritsStats } from '@/hooks/api/useProjects';
import { useApproveTeamRequest, useRejectTeamRequest } from '@/hooks/api/useTeamRequests';

const dreamRowClass =
  'block rounded-xl border border-[#334155] bg-[#0f172a] transition-colors hover:border-[#A855F7]/50 hover:bg-[#0f172a]/90';

function PilotDreamRows({ projects }: { projects: Community[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {projects.map((project) => (
        <li key={project.id}>
          <Link href={routes.project(project.id)} className={cn(dreamRowClass, 'overflow-hidden p-0')}>
            {project.coverImageUrl ? (
              <img
                src={project.coverImageUrl}
                alt=""
                className="h-28 w-full object-cover"
              />
            ) : null}
            <div className="p-4">
              <div className="font-semibold text-white">{project.name}</div>
              {project.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-[#94a3b8]">{project.description}</p>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PilotProfilePageClient() {
  const { user, isLoading } = useAuth();
  const t = useTranslations('multiObraz');
  const tCommon = useTranslations('common');
  const { data: stats } = usePilotMeritsStats();
  const isSuperadmin = user?.globalRole === 'superadmin';
  const { data: pendingRequests } = usePilotPendingJoinRequests(Boolean(isSuperadmin));
  const approve = useApproveTeamRequest();
  const reject = useRejectTeamRequest();

  const { data: dreamsPayload, isLoading: dreamsLoading } = usePilotUserDreams(user?.id);

  const { myDreams, joinedDreams } = useMemo(() => {
    const rows = (dreamsPayload?.data ?? []).filter((p) => isPilotDreamProject(p));
    if (!user?.id) {
      return { myDreams: [] as Community[], joinedDreams: [] as Community[] };
    }
    const mine: Community[] = [];
    const joined: Community[] = [];
    for (const p of rows) {
      if (p.founderUserId === user.id) {
        mine.push(p);
      } else {
        joined.push(p);
      }
    }
    return { myDreams: mine, joinedDreams: joined };
  }, [dreamsPayload?.data, user?.id]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[#334155] bg-[#1e293b] p-8 text-center text-sm text-[#94a3b8]">
        {t('pilotProfileLoading')}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4 rounded-2xl border border-[#334155] bg-[#1e293b] p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">{t('pilotProfilePageTitle')}</h1>
        <p className="text-sm leading-relaxed text-[#94a3b8]">{t('guestCtaHint')}</p>
        <Button className="w-full sm:w-auto" asChild>
          <Link href={routes.login}>{t('navLogin')}</Link>
        </Button>
      </div>
    );
  }

  const displayName = user.displayName?.trim() || user.username || tCommon('user');
  const avatarUrl = user.avatarUrl?.trim();
  const aboutSelf = [user.profile?.about?.trim(), user.profile?.bio?.trim()].find(Boolean) ?? '';

  return (
    <div className="space-y-8 rounded-2xl border border-[#334155] bg-[#1e293b] p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <Avatar className="h-20 w-20 shrink-0 rounded-2xl border-2 border-[#334155] bg-[#0f172a] text-xl ring-1 ring-[#334155]/80">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
          <AvatarFallback userId={user.id} className="rounded-2xl font-medium uppercase">
            {displayName ? displayName.slice(0, 2).toUpperCase() : <UserIcon className="h-8 w-8 opacity-80" />}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{displayName}</h1>
          {user.username ? (
            <p className="text-sm font-medium text-[#94a3b8]">@{user.username}</p>
          ) : null}
          {aboutSelf ? (
            <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-[#94a3b8]">{aboutSelf}</p>
          ) : null}
        </div>
        {stats ? (
          <WalletQuotaBlock
            balance={stats.walletBalance ?? 0}
            remainingQuota={stats.quota?.remaining ?? 0}
            dailyQuota={stats.quota?.dailyQuota ?? 10}
            className="self-start"
          />
        ) : null}
      </div>

      {dreamsLoading ? (
        <p className="text-sm text-[#94a3b8]">{tCommon('loading')}</p>
      ) : (
        <>
          {isSuperadmin ? (
            <section aria-labelledby="pilot-profile-join-requests" className="space-y-3">
              <p
                id="pilot-profile-join-requests"
                className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]"
              >
                {t('adminJoinRequestsTitle')}
              </p>
              {!pendingRequests?.length ? (
                <p className="text-sm text-[#94a3b8]">{t('adminJoinRequestsEmpty')}</p>
              ) : (
                <ul className="space-y-2">
                  {pendingRequests.map((r: any) => (
                    <li key={r.id} className="rounded-xl border border-[#334155] bg-[#0f172a] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">
                            {t('adminJoinRequestsDream', { id: r.communityId })}
                          </div>
                          <div className="mt-1 text-xs text-[#94a3b8]">
                            {t('adminJoinRequestsUser', { id: r.userId })}
                          </div>
                          {r.applicantMessage ? (
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#cbd5e1]">
                              {r.applicantMessage}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-[#334155] text-white"
                            onClick={() => approve.mutate({ requestId: r.id })}
                            disabled={approve.isPending || reject.isPending}
                          >
                            {t('adminApprove')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-[#334155] text-white hover:bg-red-500/10"
                            onClick={() => reject.mutate({ requestId: r.id })}
                            disabled={approve.isPending || reject.isPending}
                          >
                            {t('adminReject')}
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <section aria-labelledby="pilot-profile-my-dreams">
            <p
              id="pilot-profile-my-dreams"
              className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]"
            >
              {t('pilotProfileDreamsCreated')}
            </p>
            {myDreams.length > 0 ? (
              <PilotDreamRows projects={myDreams} />
            ) : (
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#94a3b8]">{t('pilotProfileNoDreamsCreated')}</p>
                <Button asChild className="w-full sm:w-auto">
                  <Link href={pilotCreateHref()}>{t('navCreate')}</Link>
                </Button>
              </div>
            )}
          </section>

          <section aria-labelledby="pilot-profile-joined-dreams">
            <p
              id="pilot-profile-joined-dreams"
              className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]"
            >
              {t('pilotProfileDreamsJoined')}
            </p>
            {joinedDreams.length > 0 ? (
              <PilotDreamRows projects={joinedDreams} />
            ) : (
              <p className="mt-2 text-sm text-[#94a3b8]">{t('pilotProfileNoDreamsJoined')}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
