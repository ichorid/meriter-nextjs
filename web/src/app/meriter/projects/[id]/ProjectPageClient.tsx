'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useProject, useJoinProject, useLeaveProject, useProjectMembers } from '@/hooks/api/useProjects';
import { ProjectMembersList } from '@/components/organisms/Project/ProjectMembersList';
import { ProjectTabs } from '@/components/organisms/Project/ProjectTabs';
import { ProjectWalletCard } from '@/components/organisms/Project/ProjectWalletCard';
import { PublishToBirzhaButton } from '@/components/organisms/Project/PublishToBirzhaButton';
import { CloseProjectDialog } from '@/components/organisms/Project/CloseProjectDialog';
import { LeaveProjectDialog } from '@/components/organisms/Project/LeaveProjectDialog';
import { UpdateSharesDialog } from '@/components/organisms/Project/UpdateSharesDialog';
import { TransferAdminDialog } from '@/components/organisms/Project/TransferAdminDialog';
import { CooperativeSharesDisplay } from '@/components/molecules/CooperativeSharesDisplay';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { Users } from 'lucide-react';
import type { Community } from '@meriter/shared-types';

interface ProjectPageClientProps {
  projectId: string;
}

function projectGradient(name: string): [string, string] {
  const colors: [string, string][] = [
    ['from-blue-600', 'to-purple-600'],
    ['from-emerald-500', 'to-teal-600'],
    ['from-orange-500', 'to-red-600'],
    ['from-pink-500', 'to-rose-600'],
    ['from-indigo-500', 'to-blue-600'],
    ['from-amber-500', 'to-orange-600'],
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index] ?? ['from-blue-600', 'to-purple-600'];
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
  const isMember = user && project.members?.includes(user.id);
  const isArchived = status === 'archived';

  const [gradientFrom, gradientTo] = projectGradient(project.name);
  const coverImageUrl =
    project.coverImageUrl ?? (project as Community & { futureVisionCover?: string }).futureVisionCover;
  const hasCover = !!coverImageUrl;

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
        <header>
          <div className="h-40 sm:h-48 w-full relative overflow-hidden flex-shrink-0 rounded-xl mb-4">
            {hasCover ? (
              <img src={coverImageUrl} alt="" className="object-cover w-full h-full" />
            ) : (
              <div
                className={`w-full h-full bg-gradient-to-r ${gradientFrom} ${gradientTo}`}
                aria-hidden
              />
            )}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-base-content">{project.name}</h1>
              <Badge variant={status === 'active' ? 'default' : 'secondary'} className="shrink-0">
                {statusLabel}
              </Badge>
            </div>
            {project.description && (
              <p className="text-base-content/70">{project.description}</p>
            )}
          </div>
          {parentCommunity && (
            <div className="flex flex-wrap gap-4 text-sm mt-2">
              <span className="text-base-content/60">{t('parentCommunity')}: </span>
              <Link
                href={`/meriter/communities/${parentCommunity.id}`}
                className="text-primary hover:underline"
              >
                {parentCommunity.name}
              </Link>
            </div>
          )}
        </header>

        <section className="rounded-xl bg-[#F5F5F5] dark:bg-[#2a3239] p-5 shadow-none space-y-4">
          <ProjectWalletCard projectId={projectId} />
          <div className="pt-2 border-t border-base-300">
            <CooperativeSharesDisplay
              founderSharePercent={project.founderSharePercent ?? 0}
              investorSharePercent={project.investorSharePercent ?? 0}
            />
          </div>
        </section>

        {isMember && user && (
          <section aria-labelledby="project-tabs-heading">
            <h2 id="project-tabs-heading" className="sr-only">
              {t('tabs.tickets')} / {t('tabs.discussions')}
            </h2>
            <ProjectTabs
              projectId={projectId}
              currentUserId={user.id}
              isLead={isLead}
              isMember={isMember}
              readOnly={isArchived}
            />
          </section>
        )}

        {user && !isArchived && (
          <section className="flex flex-wrap gap-2" aria-label={t('actionsSection')}>
            {!isMember && (
              <Button
                size="sm"
                onClick={() => joinProject.mutate({ projectId })}
                disabled={joinProject.isPending}
              >
                {t('requestToJoin')}
              </Button>
            )}
            {isMember && (
              <>
                <PublishToBirzhaButton
                  projectId={projectId}
                  investorSharePercent={project.investorSharePercent}
                  isLead={isLead}
                />
                {isLead && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setTransferAdminDialogOpen(true)}>
                      {t('transferAdmin', { defaultValue: 'Transfer admin' })}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setUpdateSharesDialogOpen(true)}>
                      {t('updateShares', { defaultValue: 'Update shares' })}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setCloseDialogOpen(true)}>
                      {t('closeProject', { defaultValue: 'Close project' })}
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLeaveDialogOpen(true)}
                  disabled={leaveProject.isPending}
                >
                  {t('leaveProject')}
                </Button>
              </>
            )}
          </section>
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

        <section aria-labelledby="project-members-heading">
          <h2 id="project-members-heading" className="flex items-center gap-2 text-lg font-medium mb-2">
            <Users className="h-5 w-5" aria-hidden />
            {t('members')}
          </h2>
          <ProjectMembersList projectId={projectId} />
        </section>
      </div>
    </AdaptiveLayout>
  );
}
