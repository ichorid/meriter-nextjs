'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PieChart, Users, Wallet } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/shadcn/avatar';
import { CooperativeSharesDisplay } from '@/components/molecules/CooperativeSharesDisplay';
import { ProjectWalletCard } from './ProjectWalletCard';
import { routes } from '@/lib/constants/routes';
import { cn } from '@/lib/utils';

export type ProjectDashboardMember = {
  id?: string;
  userId?: string;
  displayName?: string;
  role?: string;
  avatarUrl?: string;
};

export interface ProjectDashboardProps {
  projectId: string;
  founderSharePercent: number;
  investorSharePercent: number;
  members: ProjectDashboardMember[];
  totalMembers: number;
}

function SharesMiniBar({ founder, investor }: { founder: number; investor: number }) {
  const other = Math.max(0, 100 - founder - investor);
  if (founder === 0 && investor === 0 && other === 0) {
    return null;
  }
  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden flex rounded-full bg-white/10">
      {founder > 0 && (
        <div
          className="h-full shrink-0 bg-blue-500 transition-all"
          style={{ width: `${founder}%` }}
        />
      )}
      {investor > 0 && (
        <div
          className="h-full shrink-0 bg-amber-500 transition-all"
          style={{ width: `${investor}%` }}
        />
      )}
      {other > 0 && (
        <div
          className="h-full shrink-0 bg-white/25 transition-all"
          style={{ width: `${other}%` }}
        />
      )}
    </div>
  );
}

export function ProjectDashboard({
  projectId,
  founderSharePercent,
  investorSharePercent,
  members,
  totalMembers,
}: ProjectDashboardProps) {
  const t = useTranslations('projects');

  const preview = members.slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <ProjectWalletCard
          projectId={projectId}
          title={t('cardWallet')}
          footer={
            <div className="text-xs text-base-content/60">
              <CooperativeSharesDisplay
                founderSharePercent={founderSharePercent}
                investorSharePercent={investorSharePercent}
              />
            </div>
          }
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-base-content">
          <Users className="h-5 w-5 text-base-content/70 shrink-0" aria-hidden />
          {t('cardTeam')}
        </div>
        <p className="text-3xl font-semibold tabular-nums text-base-content">{totalMembers}</p>
        {preview.length > 0 ? (
          <div className="flex -space-x-2">
            {preview.map((m) => {
              const key = m.id ?? m.userId ?? m.displayName ?? '';
              const label = (m.displayName ?? key).slice(0, 2).toUpperCase();
              return (
                <Avatar key={key} className="h-9 w-9 ring-2 ring-base-100 text-xs">
                  {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="text-[10px] font-medium">{label || '?'}</AvatarFallback>
                </Avatar>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-base-content/50">{t('teamNoMembersPreview')}</p>
        )}
        <Link
          href={routes.communityMembers(projectId)}
          className="text-sm font-medium text-blue-400 hover:underline w-fit"
        >
          {t('inviteMembersLink')}
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col">
        <div className="flex items-center gap-2 text-sm font-medium text-base-content">
          <PieChart className="h-5 w-5 text-base-content/70 shrink-0" aria-hidden />
          {t('cardShares')}
        </div>
        <div
          className={cn(
            'mt-2 text-sm text-base-content/70 flex-1',
            founderSharePercent === 0 && investorSharePercent === 0 && 'text-base-content/50',
          )}
        >
          <CooperativeSharesDisplay
            founderSharePercent={founderSharePercent}
            investorSharePercent={investorSharePercent}
          />
        </div>
        <SharesMiniBar founder={founderSharePercent} investor={investorSharePercent} />
      </div>
    </div>
  );
}
