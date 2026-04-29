'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Community } from '@meriter/shared-types';
import { PilotMinimalNav } from '@/features/multi-obraz-pilot/PilotMinimalNav';
import { ProjectWorkArea } from '@/components/organisms/Project/project-work-area';
import { Button } from '@/components/ui/shadcn/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/shadcn/avatar';
import { routes } from '@/lib/constants/routes';
import { trpc } from '@/lib/trpc/client';
import { useProjectMembers } from '@/hooks/api/useProjects';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { useToastStore } from '@/shared/stores/toast.store';
import { trackPilotProductEvent } from '@/features/multi-obraz-pilot/pilot-telemetry';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Input } from '@/components/ui/shadcn/input';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { Label } from '@/components/ui/shadcn/label';
import { ImageUploader } from '@/components/ui/ImageUploader/ImageUploader';
import { CommunityJoinRequestPanel } from '@/components/molecules/CommunityJoinRequest/CommunityJoinRequestPanel';

export interface ProjectPilotDreamShellProps {
  projectId: string;
  project: Community;
  currentUserId: string;
  isMember: boolean;
  canModerateTickets: boolean;
  readOnly: boolean;
  canEditDream: boolean;
}

export function ProjectPilotDreamShell({
  projectId,
  project,
  currentUserId,
  isMember,
  canModerateTickets,
  readOnly,
  canEditDream,
}: ProjectPilotDreamShellProps) {
  const t = useTranslations('multiObraz');
  const tCommon = useTranslations('common');
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();
  const [storyBannerVisible, setStoryBannerVisible] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editDescription, setEditDescription] = useState(project.description ?? '');
  const [editCover, setEditCover] = useState<string | null>(project.coverImageUrl ?? null);

  const storageKey = useMemo(() => `pilotDreamStoryDismissed:${projectId}`, [projectId]);

  useEffect(() => {
    trackPilotProductEvent('pilot_dream_viewed', { projectId, pilotContext: 'multi-obraz' });
  }, [projectId]);

  useEffect(() => {
    try {
      setStoryBannerVisible(!localStorage.getItem(storageKey));
    } catch {
      setStoryBannerVisible(true);
    }
  }, [storageKey]);

  const updateProject = trpc.project.update.useMutation({
    onSuccess: () => {
      void utils.project.getById.invalidate({ id: projectId });
      void utils.project.getGlobalList.invalidate();
      void utils.project.list.invalidate();
      addToast(t('editSaved'), 'success');
      setEditOpen(false);
    },
    onError: (e) => addToast(resolveApiErrorToastMessage(e.message), 'error'),
  });

  const dismissStory = () => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
    setStoryBannerVisible(false);
  };

  const { data: membersPayload, isLoading: membersLoading, isError: membersError } = useProjectMembers(
    membersOpen ? projectId : null,
    { limit: 100 },
  );
  const members = membersPayload?.data ?? [];

  const memberRoleLabel = (role?: string, globalRole?: string) => {
    if (globalRole === 'superadmin') return tCommon('superadmin');
    if (role === 'lead') return tCommon('lead');
    if (role === 'participant') return tCommon('participant');
    return '';
  };

  return (
    <div className="min-h-dvh bg-[#0f172a] text-[#f1f5f9]">
      <PilotMinimalNav />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <header className="space-y-2">
          {project.coverImageUrl ? (
            <img
              src={project.coverImageUrl}
              alt=""
              className="max-h-56 w-full rounded-xl border border-[#334155] object-cover"
            />
          ) : null}
          <h1 className="text-2xl font-extrabold tracking-tight text-white">{project.name}</h1>
          {project.description ? (
            <p className="whitespace-pre-wrap text-sm text-[#94a3b8]">{project.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {canEditDream ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#334155] text-[#e2e8f0]"
              onClick={() => {
                setEditName(project.name);
                setEditDescription(project.description ?? '');
                setEditCover(project.coverImageUrl ?? null);
                setEditOpen(true);
              }}
            >
              {t('editDream')}
            </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#334155] text-[#e2e8f0]"
              onClick={() => setMembersOpen(true)}
            >
              {t('membersLink')}
            </Button>
            {!isMember && !readOnly ? (
              <CommunityJoinRequestPanel
                communityId={projectId}
                layout="inline"
                className="max-w-full"
                entityKind="project"
                ctaOpenOverride={t('joinDream')}
              />
            ) : null}
          </div>
        </header>

        {storyBannerVisible && isMember ? (
          <section
            className="rounded-xl border border-[#334155] bg-[#1e293b] p-4"
            aria-label={t('storyBannerAria')}
          >
            <p className="text-sm text-[#e2e8f0]">{t('storyBanner')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" className="bg-[#A855F7] text-white hover:bg-[#9333ea]">
                <Link href={`${routes.project(projectId)}?tab=discussions`}>{t('storyBannerCta')}</Link>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={dismissStory}>
                {t('storyBannerDismiss')}
              </Button>
            </div>
          </section>
        ) : null}

        {isMember ? (
          <ProjectWorkArea
            projectId={projectId}
            currentUserId={currentUserId}
            canModerateTickets={canModerateTickets}
            isMember={isMember}
            readOnly={readOnly}
            discussionUxVariant="pilotAccordion"
            usePilotTerms
            blockMeriterNavigation
          />
        ) : (
          <p className="text-sm text-[#94a3b8]">{t('joinToParticipate')}</p>
        )}
      </div>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-h-[85vh] border-[#334155] bg-[#1e293b] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>{t('membersPageTitle')}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[min(60vh,420px)] overflow-y-auto pr-1">
            {membersLoading ? (
              <p className="text-sm text-[#94a3b8]">{tCommon('loading')}</p>
            ) : membersError ? (
              <p className="text-sm text-red-400">{t('membersDialogError')}</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">{t('membersDialogEmpty')}</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => {
                  const display = m.displayName?.trim() || m.username || m.id;
                  const handle = m.username ? `@${m.username}` : null;
                  const roleText = memberRoleLabel(m.role, m.globalRole);
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2"
                    >
                      <Avatar className="h-10 w-10 shrink-0 rounded-lg border border-[#334155]">
                        {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
                        <AvatarFallback userId={m.id} className="rounded-lg text-xs font-medium uppercase">
                          {display.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">{display}</p>
                        {handle ? <p className="truncate text-xs text-[#94a3b8]">{handle}</p> : null}
                        {roleText ? (
                          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
                            {roleText}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setMembersOpen(false)}>
              {tCommon('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-[#334155] bg-[#1e293b] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>{t('editDreamTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="pilot-edit-name">{t('fieldTitle')}</Label>
              <Input
                id="pilot-edit-name"
                value={editName}
                maxLength={200}
                onChange={(e) => setEditName(e.target.value)}
                className="border-[#334155] bg-[#0f172a]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pilot-edit-desc">{t('fieldDescription')}</Label>
              <Textarea
                id="pilot-edit-desc"
                value={editDescription}
                maxLength={5000}
                onChange={(e) => setEditDescription(e.target.value)}
                className="border-[#334155] bg-[#0f172a]"
                rows={5}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('fieldDreamImage')}</Label>
              <ImageUploader
                value={editCover ?? undefined}
                onUpload={(url) => setEditCover(url.trim() ? url : null)}
                onRemove={() => setEditCover(null)}
                aspectRatio={16 / 9}
                maxWidth={1920}
                maxHeight={1080}
                className="rounded-lg border border-[#334155] bg-[#0f172a] p-2"
                labels={{
                  placeholder: t('dreamImagePlaceholder'),
                  formats: t('dreamImageFormats'),
                  maxSize: t('dreamImageMaxSize'),
                  uploading: t('dreamImageUploading'),
                  invalidType: t('dreamImageInvalidType'),
                  tooLarge: t('dreamImageTooLarge'),
                  uploadFailed: t('dreamImageUploadFailed'),
                }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              className="bg-[#A855F7] text-white hover:bg-[#9333ea]"
              disabled={updateProject.isPending}
              onClick={() => {
                const name = editName.trim();
                const description = editDescription.trim();
                if (!name || !description) {
                  addToast(t('validationRequired'), 'error');
                  return;
                }
                updateProject.mutate({
                  id: projectId,
                  data: {
                    name,
                    description,
                    coverImageUrl:
                      editCover === (project.coverImageUrl ?? null) ? undefined : editCover,
                  },
                });
              }}
            >
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
