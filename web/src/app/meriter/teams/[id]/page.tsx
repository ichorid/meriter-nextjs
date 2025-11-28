'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useTeam, useTeamParticipants, useRemoveParticipant } from '@/hooks/api/useTeams';
import { useInvites, useCreateInvite, useDeleteInvite } from '@/hooks/api/useInvites';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandButton } from '@/components/ui/BrandButton';
import { BrandInput } from '@/components/ui/BrandInput';
import { BrandSelect } from '@/components/ui/BrandSelect';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { BrandModal } from '@/components/ui/BrandModal';
import { UserPlus, X, Copy, Check, Loader2 } from 'lucide-react';

export default function TeamManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const t = useTranslations('teams');
  const { user } = useAuth();
  const [resolvedParams, setResolvedParams] = React.useState<{ id: string } | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteType, setInviteType] = useState<'superadmin-to-lead' | 'lead-to-participant'>('lead-to-participant');
  const [copiedInviteCode, setCopiedInviteCode] = useState<string | null>(null);

  React.useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  const teamId = resolvedParams?.id;
  const { data: team, isLoading: teamLoading } = useTeam(teamId || '');
  const { data: participantsData, isLoading: participantsLoading } = useTeamParticipants(teamId || '');
  const { data: invites, isLoading: invitesLoading } = useInvites();
  const createInvite = useCreateInvite();
  const deleteInvite = useDeleteInvite();
  const removeParticipant = useRemoveParticipant();

  const teamInvites = invites?.filter(inv => inv.teamId === teamId) || [];
  const participants = participantsData?.participants || [];

  const handleCreateInvite = async () => {
    if (!team || !inviteUserId.trim()) return;

    try {
      const invite = await createInvite.mutateAsync({
        targetUserId: inviteUserId.trim(),
        type: inviteType,
        communityId: team.communityId,
        teamId: team.id,
      });

      setInviteUserId('');
      setShowInviteModal(false);
      // Copy invite code to clipboard
      if (invite.code) {
        navigator.clipboard.writeText(invite.code);
        setCopiedInviteCode(invite.code);
        setTimeout(() => setCopiedInviteCode(null), 3000);
      }
    } catch (error) {
      console.error('Failed to create invite:', error);
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    if (!teamId) return;
    if (!confirm('Are you sure you want to remove this participant?')) return;

    try {
      await removeParticipant.mutateAsync({ teamId, userId });
    } catch (error) {
      console.error('Failed to remove participant:', error);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedInviteCode(code);
    setTimeout(() => setCopiedInviteCode(null), 3000);
  };

  if (!teamId || teamLoading) {
    return (
      <AdaptiveLayout>
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!team) {
    return (
      <AdaptiveLayout>
        <div className="p-4">
          <p className="text-brand-text-secondary">{t('teamNotFound')}</p>
        </div>
      </AdaptiveLayout>
    );
  }

  const isLead = team.leadId === user?.id;

  return (
    <AdaptiveLayout>
      <div className="flex flex-col min-h-screen bg-white">
        <PageHeader title={team.name} showBack={true} />

        <div className="p-4 space-y-6">
          {/* Team Info */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-brand-text-primary">{t('teamInformation')}</h2>
            <div className="space-y-2">
              <p className="text-sm text-brand-text-primary">
                <span className="font-bold">{t('name')}:</span> {team.name}
              </p>
              {team.school && (
                <p className="text-sm text-brand-text-primary">
                  <span className="font-bold">{t('school')}:</span> {team.school}
                </p>
              )}
              <p className="text-sm text-brand-text-primary">
                <span className="font-bold">{t('communityId')}:</span> {team.communityId}
              </p>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-brand-text-primary">{t('participants')}</h2>
              {isLead && (
                <BrandButton
                  variant="primary"
                  size="sm"
                  onClick={() => setShowInviteModal(true)}
                  leftIcon={<UserPlus size={16} />}
                >
                  {t('createInvite')}
                </BrandButton>
              )}
            </div>

            {participantsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              </div>
            ) : participants.length === 0 ? (
              <p className="text-brand-text-secondary">{t('noParticipants')}</p>
            ) : (
              <div className="space-y-2">
                {participants.map((participantId) => (
                  <div
                    key={participantId}
                    className="flex items-center justify-between p-3 bg-brand-surface border border-brand-secondary/10 rounded-lg"
                  >
                    <p className="text-sm text-brand-text-primary">{participantId}</p>
                    {isLead && (
                      <BrandButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveParticipant(participantId)}
                      >
                        <X size={16} />
                      </BrandButton>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invites */}
          {isLead && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-brand-text-primary">{t('activeInvites')}</h2>
              {invitesLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                </div>
              ) : teamInvites.length === 0 ? (
                <p className="text-brand-text-secondary">{t('noActiveInvites')}</p>
              ) : (
                <div className="space-y-2">
                  {teamInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 bg-brand-surface border border-brand-secondary/10 rounded-lg"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-bold text-sm text-brand-text-primary">{invite.code}</p>
                        <p className="text-xs text-brand-text-secondary">
                          {t('type')}: {invite.type} | {t('target')}: {invite.targetUserId}
                          {invite.isUsed && ` (${t('used')})`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <BrandButton
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInviteCode(invite.code)}
                        >
                          {copiedInviteCode === invite.code ? (
                            <Check size={16} className="text-green-600" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </BrandButton>
                        {!invite.isUsed && (
                          <BrandButton
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteInvite.mutate(invite.id)}
                          >
                            <X size={16} />
                          </BrandButton>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create Invite Modal */}
        <BrandModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          title={t('createInviteModal.title')}
          size="md"
          footer={
            <>
              <BrandButton
                variant="outline"
                onClick={() => setShowInviteModal(false)}
              >
                {t('createInviteModal.cancel')}
              </BrandButton>
              <BrandButton
                variant="primary"
                onClick={handleCreateInvite}
                disabled={!inviteUserId.trim() || createInvite.isPending}
                isLoading={createInvite.isPending}
              >
                {t('createInviteModal.create')}
              </BrandButton>
            </>
          }
        >
          <div className="space-y-4">
            <BrandFormControl label={t('createInviteModal.userId')}>
              <BrandInput
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
                placeholder={t('createInviteModal.userIdPlaceholder')}
                fullWidth
              />
            </BrandFormControl>

            <BrandFormControl label={t('createInviteModal.inviteType')}>
              <BrandSelect
                value={inviteType}
                onChange={(value) => setInviteType(value as any)}
                options={[
                  { label: t('createInviteModal.leadToParticipant'), value: 'lead-to-participant' },
                  { label: t('createInviteModal.superadminToLead'), value: 'superadmin-to-lead' },
                ]}
                fullWidth
              />
            </BrandFormControl>
          </div>
        </BrandModal>
      </div>
    </AdaptiveLayout>
  );
}
