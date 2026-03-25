'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProject, useJoinProject, useLeaveProject, useProjectMembers } from '@/hooks/api/useProjects';
import { ProjectHero } from '@/components/organisms/Project/project-hero';
import { ProjectParentSettingsCard } from '@/components/organisms/Project/ProjectParentSettingsCard';
import { ProjectDashboard } from '@/components/organisms/Project/project-dashboard';
import { ProjectWorkArea } from '@/components/organisms/Project/project-work-area';
import { ProjectActions } from '@/components/organisms/Project/project-actions';
import { PublishToBirzhaButton } from '@/components/organisms/Project/PublishToBirzhaButton';
import { CloseProjectDialog } from '@/components/organisms/Project/CloseProjectDialog';
import { LeaveProjectDialog } from '@/components/organisms/Project/LeaveProjectDialog';
import { UpdateSharesDialog } from '@/components/organisms/Project/UpdateSharesDialog';
import { TransferAdminDialog } from '@/components/organisms/Project/TransferAdminDialog';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';

interface ProjectPageClientProps {
  projectId: string;
}

export default function ProjectPageClient({ projectId }: ProjectPageClientProps) {
  const router = useRouter();
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const { data, isLoading } = useProject(projectId);
  const { data: membersData } = useProjectMembers(projectId, { limit: 100 });
  const joinProject = useJoinProject();
  const leaveProject = useLeaveProject();

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [updateSharesDialogOpen, setUpdateSharesDialogOpen] = useState(false);
  const [transferAdminDialogOpen, setTransferAdminDialogOpen] = useState(false);

  const isLead = useMemo(() => {
    if (!user || !membersData?.data) return false;
    const me = membersData.data.find(
      (m: { id?: string; userId?: string; role?: string }) =>
        (m.id ?? m.userId) === user.id,
    );
    return me?.role === 'lead';
  }, [user, membersData?.data]);

  const canModerateCover = useMemo(() => {
    if (!user) return false;
    if (user.globalRole === 'superadmin') return true;
    return isLead;
  }, [user, isLead]);

  const canModerateTickets = Boolean(
    user && (isLead || user.globalRole === 'superadmin'),
  );

  if (isLoading || !data) {
    return (
      <AdaptiveLayout
        stickyHeader={
          <SimpleStickyHeader
            title={t('backToProjects')}
            showBack={true}
            onBack={() => router.push('/meriter/projects')}
            asStickyHeader={true}
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
  const isMember = Boolean(user && project.members?.includes(user.id));
  const isArchived = status === 'archived';

  const heroStatus: 'active' | 'closed' | 'archived' =
    status === 'closed' ? 'closed' : status === 'archived' ? 'archived' : 'active';

  const totalMembers = membersData?.pagination?.total ?? membersData?.data?.length ?? 0;

  const stickyHeader = (
    <SimpleStickyHeader
      title={<span className="truncate max-w-[200px] sm:max-w-[280px]" title={project.name}>{project.name}</span>}
      showBack={true}
      onBack={() => router.push('/meriter/projects')}
      asStickyHeader={true}
      showScrollToTop={true}
    />
  );

  return (
    <AdaptiveLayout stickyHeader={stickyHeader}>
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
        />

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
          showBirzhaSourcePosts={isLead}
        />

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
            joinBlock={
              !isMember ? (
                <Button
                  className="w-full sm:w-auto"
                  size="sm"
                  onClick={() => joinProject.mutate({ projectId })}
                  disabled={joinProject.isPending}
                >
                  {t('requestToJoin')}
                </Button>
              ) : undefined
            }
            publishBirzha={
              isMember ? (
                <PublishToBirzhaButton projectId={projectId} isLead={isLead} />
              ) : undefined
            }
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
