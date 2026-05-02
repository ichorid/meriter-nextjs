'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import { useAuth } from '@/contexts/AuthContext';
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
import {
  useApproveTeamRequest,
  useRejectTeamRequest,
  useTeamRequestsForLead,
} from '@/hooks/api/useTeamRequests';
import { Minus, Plus, TrendingUp } from 'lucide-react';
import { usePilotDreamUpvote, usePilotMeritsStats } from '@/hooks/api/useProjects';
import { formatMerits } from '@/lib/utils/currency';
import { useUserProfile } from '@/hooks/api/useUsers';
import { VotingPopup } from '@/components/organisms/VotingPopup';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { invalidatePilotDreamFeeds } from '@/hooks/api/pilot-invalidate';

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
  const tCommunities = useTranslations('pages.communities');
  const addToast = useToastStore((s) => s.addToast);
  const { user } = useAuth();
  const upvoteDream = usePilotDreamUpvote();
  const { data: stats } = usePilotMeritsStats();
  const utils = trpc.useUtils();
  const [membersOpen, setMembersOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportAmount, setSupportAmount] = useState<number>(1);
  const [supportAmountInput, setSupportAmountInput] = useState<string>('1');
  const [editName, setEditName] = useState(project.name);
  const [editDescription, setEditDescription] = useState(project.description ?? '');
  const [editCover, setEditCover] = useState<string | null>(project.coverImageUrl ?? null);

  const quotaRemaining = stats?.quota?.remaining ?? 0;
  const dailyQuota = stats?.quota?.dailyQuota ?? 100;
  const walletBalance = stats?.walletBalance ?? 0;
  const maxAvailable = Math.max(0, quotaRemaining + walletBalance);
  const supportIsOwnDream = project.founderUserId === currentUserId;
  const quotaRemainingForSupport = supportIsOwnDream ? 0 : quotaRemaining;
  const maxAvailableForSupport = Math.max(0, quotaRemainingForSupport + walletBalance);
  const isSuperadmin = user?.globalRole === 'superadmin';

  const clampAmount = (raw: number) => {
    if (!Number.isFinite(raw)) return 1;
    const n = Math.floor(raw);
    const min = 1;
    const max = Math.max(1, maxAvailableForSupport);
    return Math.min(max, Math.max(min, n));
  };

  const getAmountFromInput = (rawInput: string): number => {
    const digitsOnly = (rawInput ?? '').replace(/\D/g, '');
    if (!digitsOnly) return clampAmount(supportAmount || 1);
    const parsed = Number.parseInt(digitsOnly, 10);
    return clampAmount(parsed);
  };

  const setSupportAmountClamped = (raw: number) => {
    const next = clampAmount(raw);
    setSupportAmount(next);
    setSupportAmountInput(String(next));
  };

  const setSupportAmountFromInput = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '');
    if (!digitsOnly) {
      setSupportAmountInput('');
      return;
    }
    const parsed = Number.parseInt(digitsOnly, 10);
    setSupportAmountClamped(parsed);
  };

  useEffect(() => {
    if (!supportOpen) return;
    setSupportAmountClamped(supportAmount || 1);
  }, [supportOpen, maxAvailableForSupport]);

  useEffect(() => {
    trackPilotProductEvent('pilot_dream_viewed', { projectId, pilotContext: 'multi-obraz' });
  }, [projectId]);

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

  const softDeleteDream = trpc.pilotDreams.softDeleteDream.useMutation({
    onSuccess: () => {
      invalidatePilotDreamFeeds(utils, projectId);
      addToast(t('deletedDreamToast'), 'success');
    },
    onError: (e) => addToast(resolveApiErrorToastMessage(e.message), 'error'),
  });

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

  const canModerateMembers = Boolean(canEditDream || user?.globalRole === 'superadmin');
  const {
    data: joinRequestsRaw,
    isLoading: joinRequestsLoading,
  } = useTeamRequestsForLead(canModerateMembers ? projectId : '');
  const joinRequests = Array.isArray(joinRequestsRaw) ? joinRequestsRaw : [];
  const pendingJoinRequests = joinRequests.filter((r) => r.status === 'pending');
  const pendingCount = pendingJoinRequests.length;
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const approveJoinRequest = useApproveTeamRequest();
  const rejectJoinRequest = useRejectTeamRequest();

  const handleApproveJoinRequest = (requestId: string) => {
    setProcessingRequestId(requestId);
    approveJoinRequest.mutate(
      { requestId },
      {
        onSuccess: () => {
          addToast(tCommunities('teamRequests.approved'), 'success');
          void utils.project.getMembers.invalidate({ projectId });
          void utils.teams.getTeamRequestsForLead.invalidate({ communityId: projectId });
        },
        onError: (error: unknown) => {
          const raw = error instanceof Error ? error.message : undefined;
          addToast(
            raw?.trim()
              ? resolveApiErrorToastMessage(raw)
              : tCommunities('teamRequests.approveFailed'),
            'error',
          );
        },
        onSettled: () => setProcessingRequestId(null),
      },
    );
  };

  const handleRejectJoinRequest = (requestId: string) => {
    if (!confirm(tCommunities('teamRequests.confirmReject'))) return;
    setProcessingRequestId(requestId);
    rejectJoinRequest.mutate(
      { requestId },
      {
        onSuccess: () => {
          addToast(tCommunities('teamRequests.rejected'), 'success');
          void utils.teams.getTeamRequestsForLead.invalidate({ communityId: projectId });
        },
        onError: (error: unknown) => {
          const raw = error instanceof Error ? error.message : undefined;
          addToast(
            raw?.trim()
              ? resolveApiErrorToastMessage(raw)
              : tCommunities('teamRequests.rejectFailed'),
            'error',
          );
        },
        onSettled: () => setProcessingRequestId(null),
      },
    );
  };

  const JoinRequestRow = ({ requestId, userId, applicantMessage }: { requestId: string; userId: string; applicantMessage?: string }) => {
    const { data: profile } = useUserProfile(userId);
    const display = profile?.displayName?.trim() || profile?.username || userId.slice(0, 8);
    const handle = profile?.username ? `@${profile.username}` : null;
    const note = typeof applicantMessage === 'string' ? applicantMessage.trim() : '';
    const isApproving = approveJoinRequest.isPending && processingRequestId === requestId;
    const isRejecting = rejectJoinRequest.isPending && processingRequestId === requestId;

    return (
      <div className="flex flex-col gap-3 rounded-xl border border-[#334155] bg-[#0f172a] p-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-3">
          <Avatar className="h-10 w-10 shrink-0 rounded-lg border border-[#334155]">
            {profile?.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt="" /> : null}
            <AvatarFallback userId={userId} className="rounded-lg text-xs font-medium uppercase">
              {display.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{display}</p>
            {handle ? <p className="truncate text-xs text-[#94a3b8]">{handle}</p> : null}
            {note ? (
              <div className="mt-2 rounded-lg border border-[#334155] bg-white/[0.03] px-2.5 py-2 text-xs text-[#e2e8f0]">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#94a3b8]">
                  {tCommunities('teamRequests.applicantMessageLabel')}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words">{note}</p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-stretch">
          <Button
            type="button"
            size="sm"
            className="h-9 flex-1 bg-[#A855F7] text-white hover:bg-[#9333ea] sm:flex-none"
            disabled={isApproving || isRejecting}
            onClick={() => handleApproveJoinRequest(requestId)}
          >
            {isApproving ? tCommunities('teamRequests.approving') : tCommunities('teamRequests.approve')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 flex-1 border-[#334155] text-[#e2e8f0] hover:bg-white/[0.06] hover:text-white sm:flex-none"
            disabled={isApproving || isRejecting}
            onClick={() => handleRejectJoinRequest(requestId)}
          >
            {isRejecting ? tCommunities('teamRequests.rejecting') : tCommunities('teamRequests.reject')}
          </Button>
        </div>
      </div>
    );
  };

  const pathname = usePathname();
  const embeddedInPilotChrome = Boolean(pathname && pathname.startsWith('/dreams/'));

  return (
    <div className={embeddedInPilotChrome ? undefined : 'min-h-dvh bg-[#0f172a] text-[#f1f5f9]'}>
      {!embeddedInPilotChrome ? <PilotMinimalNav /> : null}
      <div className={embeddedInPilotChrome ? 'space-y-6' : 'mx-auto max-w-3xl space-y-6 px-4 py-6'}>
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
            {isSuperadmin ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-red-500/40 text-red-200 hover:bg-red-500/10 hover:text-red-100"
                disabled={softDeleteDream.isPending}
                onClick={() => {
                  if (!window.confirm(t('deletedDreamConfirm'))) return;
                  softDeleteDream.mutate({ dreamId: projectId });
                }}
              >
                {t('deletedDreamDelete')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#334155] text-[#e2e8f0]"
              onClick={() => setMembersOpen(true)}
            >
              <span className="relative inline-flex items-center">
                {t('membersLink')}
                {canModerateMembers && pendingCount > 0 ? (
                  <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#A855F7] px-1.5 text-[11px] font-semibold tabular-nums leading-5 text-white">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                ) : null}
              </span>
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

            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-1.5 text-sm text-[#cbd5e1]">
                <TrendingUp className="h-4 w-4 text-[#94a3b8]" aria-hidden />
                <span className="tabular-nums font-semibold text-white">
                  {project.pilotDreamRating?.score ?? 0}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[#334155] bg-[#0f172a] text-white hover:bg-[#0f172a]/80"
                onClick={() => {
                  setSupportAmount(1);
                  setSupportOpen(true);
                }}
              >
                {t('upvoteDream')}
              </Button>
            </div>
          </div>
        </header>

        {/* Pilot: remove "Tell the story of your dream" banner */}

        <ProjectWorkArea
          projectId={projectId}
          currentUserId={currentUserId}
          canModerateTickets={canModerateTickets}
          isMember={isMember}
          readOnly={readOnly}
          discussionUxVariant="pilotAccordion"
          usePilotTerms
          blockMeriterNavigation
          pilotAllowNonMemberTaskList
        />
      </div>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-h-[85vh] border-[#334155] bg-[#1e293b] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>{t('membersPageTitle')}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[min(60vh,420px)] overflow-y-auto pr-1 space-y-4">
            {canModerateMembers ? (
              <section className="rounded-xl border border-[#334155] bg-[#0f172a] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{tCommunities('teamRequests.title')}</p>
                  {pendingCount > 0 ? (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs tabular-nums text-[#cbd5e1]">
                      {pendingCount}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 space-y-2">
                  {joinRequestsLoading ? (
                    <p className="text-sm text-[#94a3b8]">{tCommon('loading')}</p>
                  ) : pendingJoinRequests.length === 0 ? (
                    <p className="text-sm text-[#94a3b8]">{t('membersRequestsEmpty')}</p>
                  ) : (
                    pendingJoinRequests.map((req) => (
                      <JoinRequestRow
                        key={req.id}
                        requestId={req.id}
                        userId={req.userId}
                        applicantMessage={req.applicantMessage}
                      />
                    ))
                  )}
                </div>
              </section>
            ) : null}

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

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="border-[#334155] bg-[#1e293b] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>{t('supportDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="support-amount-dream">{t('supportAmountLabel')}</Label>
            {supportIsOwnDream ? (
              <p className="text-xs text-[#94a3b8]">{t('supportOwnDreamHint')}</p>
            ) : null}

            {stats ? (
              <div className="flex gap-2">
                {quotaRemainingForSupport > 0 ? (
                  <div className="flex-[1] space-y-1">
                    <div className="text-xs font-medium text-[#94a3b8]">{t('quotaLabel')}</div>
                    <div className="relative h-3 overflow-hidden rounded-full bg-[#0f172a] ring-1 ring-[#334155]">
                      {(() => {
                        const amt = getAmountFromInput(supportAmountInput);
                        const usedQuota = Math.min(amt, quotaRemainingForSupport);
                        const fillPercent = Math.min(100, (usedQuota / Math.max(1, quotaRemainingForSupport)) * 100);
                        return fillPercent > 0 ? (
                          <div
                            className="absolute inset-y-0 left-0 bg-[#A855F7]"
                            style={{ width: `${fillPercent}%` }}
                          />
                        ) : null;
                      })()}
                    </div>
                    <div className="text-[11px] tabular-nums text-[#94a3b8]">
                      {Math.min(getAmountFromInput(supportAmountInput), quotaRemainingForSupport)}/{quotaRemainingForSupport}
                    </div>
                  </div>
                ) : null}

                {walletBalance > 0 ? (
                  <div className={quotaRemainingForSupport > 0 ? 'flex-[3] space-y-1' : 'flex-1 space-y-1'}>
                    <div className="text-xs font-medium text-[#94a3b8]">{t('walletLabel')}</div>
                    <div className="relative h-3 overflow-hidden rounded-full bg-[#0f172a] ring-1 ring-[#334155]">
                      {(() => {
                        const amt = getAmountFromInput(supportAmountInput);
                        const usedWallet = Math.max(0, amt - quotaRemainingForSupport);
                        const fillPercent = Math.min(100, (usedWallet / Math.max(1, walletBalance)) * 100);
                        return fillPercent > 0 ? (
                          <div
                            className="absolute inset-y-0 left-0 bg-[#7C3AED]"
                            style={{ width: `${fillPercent}%` }}
                          />
                        ) : null;
                      })()}
                    </div>
                    <div className="text-[11px] tabular-nums text-[#94a3b8]">
                      {Math.max(0, getAmountFromInput(supportAmountInput) - quotaRemainingForSupport)}/{walletBalance}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-stretch gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 shrink-0 rounded-xl border-[#334155] bg-[#0f172a] p-0 text-white"
                onClick={() => setSupportAmountClamped(getAmountFromInput(supportAmountInput) - 1)}
                disabled={upvoteDream.isPending || getAmountFromInput(supportAmountInput) <= 1}
                aria-label={t('decrease')}
              >
                <Minus className="h-5 w-5" aria-hidden />
              </Button>
              <div className="relative h-12 w-full overflow-hidden rounded-xl border border-[#334155] bg-[#0f172a]">
                <input
                  id="support-amount-dream"
                  type="text"
                  inputMode="numeric"
                  min={1}
                  max={Math.max(1, maxAvailableForSupport)}
                  value={supportAmountInput}
                  onChange={(e) => setSupportAmountFromInput(e.target.value)}
                  onBlur={() => {
                    setSupportAmountClamped(getAmountFromInput(supportAmountInput));
                  }}
                  className="relative z-10 h-full w-full bg-transparent px-3 text-center text-lg font-semibold tabular-nums text-white outline-none"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 shrink-0 rounded-xl border-[#334155] bg-[#0f172a] p-0 text-white"
                onClick={() => setSupportAmountClamped(getAmountFromInput(supportAmountInput) + 1)}
                disabled={
                  upvoteDream.isPending ||
                  getAmountFromInput(supportAmountInput) >= Math.max(1, maxAvailableForSupport)
                }
                aria-label={t('increase')}
              >
                <Plus className="h-5 w-5" aria-hidden />
              </Button>
            </div>

            {stats ? (
              <div className="pt-1 text-xs text-[#94a3b8]">
                {supportIsOwnDream
                  ? t('supportAvailableWalletOnly', { wallet: walletBalance })
                  : t('supportAvailable', { quota: quotaRemainingForSupport, wallet: walletBalance })}
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="border-[#334155] text-white"
              onClick={() => setSupportOpen(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              type="button"
              className="bg-[#A855F7] text-white hover:bg-[#9333ea]"
              onClick={() => {
                const amt = clampAmount(supportAmount || 1);
                upvoteDream.mutate(
                  { dreamId: projectId, amount: amt },
                  {
                    onSuccess: () => setSupportOpen(false),
                    onError: (e) => {
                      const msg =
                        e instanceof Error
                          ? e.message
                          : typeof (e as any)?.message === 'string'
                            ? (e as any).message
                            : '';
                      addToast(resolveApiErrorToastMessage(msg), 'error');
                    },
                  },
                );
              }}
              disabled={upvoteDream.isPending || maxAvailableForSupport <= 0}
            >
              {t('supportSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bottom Widget Area - for BottomPortal (VotingPopup uses it) */}
      <div className="bottom-widget-area fixed inset-0 z-50 pointer-events-none touch-none" />

      {/* Needed for pilot shell: tasks/discussions use global Meriter voting popup (not rendered via AdaptiveLayout). */}
      <VotingPopup communityId={GLOBAL_COMMUNITY_ID} />
    </div>
  );
}
