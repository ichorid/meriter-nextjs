'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PieChart, Users, Wallet } from 'lucide-react';
import { CooperativeSharesDisplay } from '@/components/molecules/CooperativeSharesDisplay';
import { ProjectWalletCard } from './ProjectWalletCard';
import { Button } from '@/components/ui/shadcn/button';
import { routes } from '@/lib/constants/routes';

export interface ProjectDashboardProps {
  projectId: string;
  founderSharePercent: number;
  investorSharePercent: number;
  totalMembers: number;
}

function SharesMiniBar({ founder, investor }: { founder: number; investor: number }) {
  const other = Math.max(0, 100 - founder - investor);
  if (founder === 0 && investor === 0 && other === 0) {
    return null;
  }
  return (
    <div className="h-1.5 w-full overflow-hidden flex rounded-full bg-white/10">
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
  totalMembers,
}: ProjectDashboardProps) {
  const t = useTranslations('projects');

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-white/5 p-4 md:h-full">
        <ProjectWalletCard
          projectId={projectId}
          title={t('cardWallet')}
          footer={
            founderSharePercent > 0 || investorSharePercent > 0 ? (
              <div className="text-xs text-base-content/60">
                <CooperativeSharesDisplay
                  founderSharePercent={founderSharePercent}
                  investorSharePercent={investorSharePercent}
                />
              </div>
            ) : undefined
          }
        />
      </div>

      <div className="flex min-h-0 flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:h-full">
        <div className="flex items-center gap-2 text-sm font-medium text-base-content">
          <Users className="h-5 w-5 text-base-content/70 shrink-0" aria-hidden />
          {t('cardTeam')}
        </div>
        <p className="text-3xl font-semibold tabular-nums text-base-content">{totalMembers}</p>
        {totalMembers === 0 && (
          <p className="text-sm text-base-content/50">{t('teamNoMembersPreview')}</p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-auto h-9 min-h-9 w-full shrink-0 rounded-xl px-3 sm:w-auto"
          asChild
        >
          <Link href={routes.projectMembersManage(projectId)}>{t('viewTeamMembers')}</Link>
        </Button>
      </div>

      <div className="flex min-h-0 flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:h-full">
        <div className="flex items-center gap-2 text-sm font-medium text-base-content">
          <PieChart className="h-5 w-5 text-base-content/70 shrink-0" aria-hidden />
          {t('cardShares')}
        </div>
        {(founderSharePercent > 0 || investorSharePercent > 0) && (
          <div className="text-sm text-base-content/70">
            <CooperativeSharesDisplay
              founderSharePercent={founderSharePercent}
              investorSharePercent={investorSharePercent}
            />
          </div>
        )}
        <div className="min-h-0 flex-1" aria-hidden />
        <SharesMiniBar founder={founderSharePercent} investor={investorSharePercent} />
      </div>
    </div>
  );
}
