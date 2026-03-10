'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { ChevronLeft, Users } from 'lucide-react';

interface ProjectPageClientProps {
  projectId: string;
}

export default function ProjectPageClient({ projectId }: ProjectPageClientProps) {
  const t = useTranslations('projects');
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
      <AdaptiveLayout>
        <div className="p-4">{isLoading ? 'Loading...' : 'Project not found'}</div>
      </AdaptiveLayout>
    );
  }

  const { project, parentCommunity } = data;
  const status = project.projectStatus ?? 'active';
  const statusLabel = status === 'active' ? t('active') : status === 'closed' ? t('closed') : t('archived');
  const isMember = user && project.members?.includes(user.id);
  const isArchived = status === 'archived';

  return (
    <AdaptiveLayout>
      <div className="flex flex-col gap-6 p-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/meriter/projects">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to projects
          </Link>
        </Button>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <Badge variant={status === 'active' ? 'default' : 'secondary'}>{statusLabel}</Badge>
          </div>
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          {parentCommunity && (
            <div>
              <span className="text-muted-foreground">{t('parentCommunity')}: </span>
              <Link
                href={`/meriter/communities/${parentCommunity.id}`}
                className="text-primary hover:underline"
              >
                {parentCommunity.name}
              </Link>
            </div>
          )}
        </div>

        <ProjectWalletCard projectId={projectId} />

        <CooperativeSharesDisplay
          founderSharePercent={project.founderSharePercent ?? 0}
          investorSharePercent={project.investorSharePercent ?? 0}
        />

        {isMember && user && (
          <ProjectTabs
            projectId={projectId}
            currentUserId={user.id}
            isLead={isLead}
            isMember={isMember}
            readOnly={isArchived}
          />
        )}

        {user && !isArchived && (
          <div className="flex flex-wrap gap-2">
            {!isMember && (
              <Button
                size="sm"
                onClick={() => joinProject.mutate({ projectId })}
                disabled={joinProject.isPending}
              >
                Request to join
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
                <Button size="sm" variant="outline" onClick={() => setLeaveDialogOpen(true)} disabled={leaveProject.isPending}>
                  Leave project
                </Button>
              </>
            )}
          </div>
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

        <section>
          <h2 className="flex items-center gap-2 text-lg font-medium mb-2">
            <Users className="h-5 w-5" />
            {t('members')}
          </h2>
          <ProjectMembersList projectId={projectId} />
        </section>
      </div>
    </AdaptiveLayout>
  );
}
