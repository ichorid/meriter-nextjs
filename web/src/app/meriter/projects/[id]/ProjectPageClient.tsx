'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Calendar, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProject, useLeaveProject, useProjectMembers } from '@/hooks/api/useProjects';
import { ProjectHero } from '@/components/organisms/Project/project-hero';
import { ProjectParentSettingsCard } from '@/components/organisms/Project/ProjectParentSettingsCard';
import { ProjectDashboard } from '@/components/organisms/Project/project-dashboard';
import { ProjectWorkArea } from '@/components/organisms/Project/project-work-area';
import { ProjectActions } from '@/components/organisms/Project/project-actions';
import { PublishToBirzhaButton } from '@/components/organisms/Project/PublishToBirzhaButton';
import { BirzhaSourcePostsEntryRow } from '@/components/organisms/Birzha/BirzhaSourcePostsEntryRow';
import { routes } from '@/lib/constants/routes';
import { CloseProjectDialog } from '@/components/organisms/Project/CloseProjectDialog';
import { LeaveProjectDialog } from '@/components/organisms/Project/LeaveProjectDialog';
import { UpdateSharesDialog } from '@/components/organisms/Project/UpdateSharesDialog';
import { TransferAdminDialog } from '@/components/organisms/Project/TransferAdminDialog';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { QuotaDisplay } from '@/components/molecules/QuotaDisplay/QuotaDisplay';
import { EarnMeritsBirzhaButton } from '@/components/molecules/EarnMeritsBirzhaButton/EarnMeritsBirzhaButton';
import { Button } from '@/components/ui/shadcn/button';
import { CommunityJoinRequestPanel } from '@/components/molecules/CommunityJoinRequest/CommunityJoinRequestPanel';
import { cn } from '@/lib/utils';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { useUserQuota } from '@/hooks/api/useQuota';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';

interface ProjectPageClientProps {
  projectId: string;
}

export default function ProjectPageClient({ projectId }: ProjectPageClientProps) {
  const router = useRouter();
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const tPagesCommunities = useTranslations('pages.communities');
  const { user } = useAuth();
  const { data, isLoading } = useProject(projectId);
  const { data: membersData } = useProjectMembers(projectId, { limit: 100 });
  const leaveProject = useLeaveProject();

  const { data: globalBalance = 0 } = useWalletBalance(GLOBAL_COMMUNITY_ID);
  const { data: projectWalletBalance = 0 } = useWalletBalance(projectId);
  const { data: quotaData } = useUserQuota(projectId);

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [updateSharesDialogOpen, setUpdateSharesDialogOpen] = useState(false);
  const [transferAdminDialogOpen, setTransferAdminDialogOpen] = useState(false);

  const meInProjectMembers = useMemo(() => {
    if (!user?.id || !membersData?.data) return null;
    return (
      membersData.data.find(
        (m: { id?: string; userId?: string; role?: string }) =>
          (m.id ?? m.userId) === user.id,
      ) ?? null
    );
  }, [user?.id, membersData?.data]);

  const canModerateCover = useMemo(() => {
    if (!user) return false;
    if (user.globalRole === 'superadmin') return true;
    return meInProjectMembers?.role === 'lead';
  }, [user, meInProjectMembers?.role]);

  const canModerateTickets = Boolean(
    user && (meInProjectMembers?.role === 'lead' || user.globalRole === 'superadmin'),
  );

  if (isLoading || !data) {
    return (
      <AdaptiveLayout
        communityId={projectId}
        stickyHeader={
          <SimpleStickyHeader
            title={t('backToProjects')}
            showBack={true}
            onBack={() => router.push('/meriter/projects')}
            asStickyHeader={true}
            rightAction={
              user ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <QuotaDisplay
                    balance={globalBalance}
                    showPermanent={true}
                    showDaily={false}
                    compact={true}
                    className="mr-2 -ml-[15px] mt-[5px]"
                  />
                </div>
              ) : undefined
            }
          />
        }
      >
        <div className="max-w-4xl mx-auto p-4">
          <p className="text-base-content/70">
            {isLoading ? tCommon('loading') : t('projectNotFound')}
          </p>
          {!isLoading && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => router.push('/meriter/projects')}>
              {t('backToProjects')}
            </Button>
          )}
        </div>
      </AdaptiveLayout>
    );
  }

  const { project, parentCommunity } = data;
  const status = project.projectStatus ?? 'active';
  const statusLabel = status === 'active' ? t('active') : status === 'closed' ? t('closed') : t('archived');
  const isLead = meInProjectMembers?.role === 'lead';
  const isMember = Boolean(
    user &&
      (project.members?.includes(user.id) ||
        meInProjectMembers?.role === 'lead' ||
        meInProjectMembers?.role === 'participant'),
  );
  const isArchived = status === 'archived';

  const heroStatus: 'active' | 'closed' | 'archived' =
    status === 'closed' ? 'closed' : status === 'archived' ? 'archived' : 'active';

  const totalMembers = membersData?.pagination?.total ?? membersData?.data?.length ?? 0;

  const userRoleInProject =
    user?.globalRole === 'superadmin'
      ? ('superadmin' as const)
      : (meInProjectMembers?.role ?? null);

  const hasProjectQuota = Boolean(
    user &&
      userRoleInProject &&
      project.meritSettings?.quotaEnabled !== false &&
      (project.meritSettings?.dailyQuota ?? 0) > 0 &&
      (project.meritSettings?.quotaRecipients ?? []).includes(userRoleInProject),
  );

  const quotaRemaining = quotaData?.remainingToday ?? 0;
  const quotaMax = quotaData?.dailyQuota ?? 0;

  const canEarnProjectMerits = project.meritSettings?.canEarn === true;
  /** Non-members have no project wallet/quota row — avoids "0 merits" noise */
  const showProjectMeritsUnderHero =
    Boolean(user && isMember) && (hasProjectQuota || canEarnProjectMerits);
  const showJoinUnderHero = Boolean(user && !isMember && !isArchived);

  const stickyHeader = (
    <SimpleStickyHeader
      title={<span className="truncate max-w-[200px] sm:max-w-[280px]" title={project.name}>{project.name}</span>}
      showBack={true}
      onBack={() => router.push('/meriter/projects')}
      asStickyHeader={true}
      showScrollToTop={true}
      rightAction={
        user ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <QuotaDisplay
              balance={globalBalance}
              showPermanent={true}
              showDaily={false}
              compact={true}
              className="mr-2 -ml-[15px] mt-[5px]"
            />
            <EarnMeritsBirzhaButton />
          </div>
        ) : undefined
      }
    />
  );

  return (
    <AdaptiveLayout communityId={projectId} stickyHeader={stickyHeader}>
      <div className="flex flex-col gap-6 p-4 max-w-4xl mx-auto w-full">
        <ProjectHero
          project={{
            id: project.id,
            name: project.name,
            description: project.description,
            avatarUrl: project.avatarUrl,
            coverImageUrl: project.coverImageUrl,
            projectStatus: project.projectStatus,
            futureVisionCover: project.futureVisionCover,
          }}
          parentCommunity={parentCommunity ? { id: parentCommunity.id, name: parentCommunity.name } : null}
          isPersonalProject={project.isPersonalProject === true}
          pendingParentLink={
            data.pendingParentLink
              ? {
                  targetParentCommunityId: data.pendingParentLink.targetParentCommunityId,
                  parentName: data.pendingParentLink.parentName,
                }
              : null
          }
          statusLabel={statusLabel}
          status={heroStatus}
          showModerationLinks={canModerateCover}
          avatarRowEndSlot={
            showJoinUnderHero ? (
              <CommunityJoinRequestPanel
                communityId={projectId}
                layout="hero"
                className="max-w-full sm:ml-auto"
                entityKind="project"
              />
            ) : undefined
          }
        />

        {showProjectMeritsUnderHero ? (
          <div className="-mt-2 flex justify-end">
            <QuotaDisplay
              localContext="project"
              balance={canEarnProjectMerits ? projectWalletBalance : undefined}
              quotaRemaining={hasProjectQuota ? quotaRemaining : undefined}
              quotaMax={hasProjectQuota ? quotaMax : undefined}
              currencyIconUrl={
                (parentCommunity as { settings?: { iconUrl?: string } } | null | undefined)
                  ?.settings?.iconUrl
              }
              showPermanent={canEarnProjectMerits}
              showDaily={hasProjectQuota}
              compact={true}
              className="max-w-full text-right"
            />
          </div>
        ) : null}

        {isLead && !isArchived && (
          <ProjectParentSettingsCard
            projectId={projectId}
            parentCommunityId={project.parentCommunityId}
            isPersonalProject={project.isPersonalProject === true}
            pendingParentLink={
              data.pendingParentLink
                ? {
                    requestId: data.pendingParentLink.requestId,
                    targetParentCommunityId: data.pendingParentLink.targetParentCommunityId,
                    parentName: data.pendingParentLink.parentName,
                  }
                : null
            }
          />
        )}

        <ProjectDashboard
          projectId={projectId}
          founderSharePercent={project.founderSharePercent ?? 0}
          investorSharePercent={project.investorSharePercent ?? 0}
          totalMembers={totalMembers}
          investingEnabled={project.settings?.investingEnabled === true}
          isProjectMember={isMember}
          canPayout={Boolean(user && isLead)}
          readOnly={isArchived}
        />

        {user && isMember ? (
          <Link
            href={routes.projectEvents(projectId)}
            className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-base-300 bg-base-200/60 p-4 transition-colors hover:bg-base-300/60"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Calendar className="h-5 w-5 shrink-0 text-base-content/70" aria-hidden />
              <span className="truncate font-medium text-base-content">{t('navEvents')}</span>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
              {tPagesCommunities('all')}
              <ChevronRight size={14} />
            </span>
          </Link>
        ) : null}

        {isLead && !isArchived ? (
          <BirzhaSourcePostsEntryRow
            variant="project"
            sourceEntityType="project"
            sourceEntityId={projectId}
            listHref={routes.projectBirzhaPosts(projectId)}
            publishSlot={
              <PublishToBirzhaButton
                projectId={projectId}
                isLead
                className="min-h-[52px] w-full sm:w-auto sm:px-6"
              />
            }
          />
        ) : null}

        {isMember && user && (
          <ProjectWorkArea
            projectId={projectId}
            currentUserId={user.id}
            canModerateTickets={canModerateTickets}
            isMember={isMember}
            readOnly={isArchived}
          />
        )}

        {user && !isArchived && (
          <ProjectActions
            managementSlot={
              isMember ? (
                <>
                  {isLead && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-base-content hover:bg-white/10"
                        onClick={() => setTransferAdminDialogOpen(true)}
                      >
                        {t('transferAdmin')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-base-content hover:bg-white/10"
                        onClick={() => setUpdateSharesDialogOpen(true)}
                      >
                        {t('updateShares')}
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn('text-base-content/55 hover:text-base-content/80 hover:bg-white/5')}
                    onClick={() => setLeaveDialogOpen(true)}
                    disabled={leaveProject.isPending}
                  >
                    {t('leaveProject')}
                  </Button>
                </>
              ) : undefined
            }
            closeProjectSlot={
              isMember && isLead ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl border border-red-600/20 bg-red-600/10 py-3 h-auto font-medium text-red-400 hover:bg-red-600/15 hover:text-red-300"
                  onClick={() => setCloseDialogOpen(true)}
                >
                  <AlertTriangle className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                  {t('closeProject')}
                </Button>
              ) : undefined
            }
          />
        )}

        <CloseProjectDialog
          projectId={projectId}
          projectName={project.name}
          open={closeDialogOpen}
          onOpenChange={setCloseDialogOpen}
        />
        <LeaveProjectDialog
          projectId={projectId}
          projectName={project.name}
          open={leaveDialogOpen}
          onOpenChange={setLeaveDialogOpen}
        />
        <UpdateSharesDialog
          projectId={projectId}
          projectName={project.name}
          currentFounderSharePercent={project.founderSharePercent ?? 0}
          open={updateSharesDialogOpen}
          onOpenChange={setUpdateSharesDialogOpen}
        />
        {user && (
          <TransferAdminDialog
            projectId={projectId}
            projectName={project.name}
            currentUserId={user.id}
            open={transferAdminDialogOpen}
            onOpenChange={setTransferAdminDialogOpen}
          />
        )}

      </div>
    </AdaptiveLayout>
  );
}
