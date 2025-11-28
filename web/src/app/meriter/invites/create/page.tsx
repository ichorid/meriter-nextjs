'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLeadCommunities } from '@/hooks/api/useProfile';
import { useCreateInvite } from '@/hooks/api/useInvites';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandButton } from '@/components/ui/BrandButton';
import { BrandInput } from '@/components/ui/BrandInput';
import { BrandCheckbox } from '@/components/ui/BrandCheckbox';
import { BrandSelect } from '@/components/ui/BrandSelect';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { Loader2 } from 'lucide-react';

export default function CreateInvitePage() {
  const router = useRouter();
  const t = useTranslations('invites.create');
  const { user } = useAuth();

  const { data: leadCommunities, isLoading: communitiesLoading } = useLeadCommunities(user?.id || '');
  const createInvite = useCreateInvite();

  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [inviteType, setInviteType] = useState<'superadmin-to-lead' | 'lead-to-participant'>('lead-to-participant');
  const [targetUserId, setTargetUserId] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>(30);
  const [generatedInvites, setGeneratedInvites] = useState<Array<{ code: string; communityId: string }>>([]);

  // Check if user has permission to create invites
  const hasPermission = leadCommunities && leadCommunities.length > 0;

  const handleToggleCommunity = (communityId: string) => {
    setSelectedCommunities((prev) =>
      prev.includes(communityId)
        ? prev.filter((id) => id !== communityId)
        : [...prev, communityId]
    );
  };

  const handleCreateInvites = async () => {
    if (selectedCommunities.length === 0) {
      return;
    }

    if (inviteType === 'lead-to-participant' && !targetUserId.trim()) {
      return;
    }

    // Calculate expiration date
    let expiresAt: string | undefined;
    if (expiresInDays && expiresInDays > 0) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expiresInDays);
      expiresAt = expirationDate.toISOString();
    }

    const invites: Array<{ code: string; communityId: string }> = [];

    for (const communityId of selectedCommunities) {
      try {
        const invite = await createInvite.mutateAsync({
          targetUserId: targetUserId.trim() || user?.id || '',
          type: inviteType,
          communityId,
          expiresAt,
        });
        invites.push({ code: invite.code, communityId });
      } catch (error) {
        console.error(`Failed to create invite for community ${communityId}:`, error);
      }
    }

    setGeneratedInvites(invites);

    // Copy all invite codes to clipboard
    if (invites.length > 0) {
      const codes = invites.map((inv) => `${inv.communityId}: ${inv.code}`).join('\n');
      navigator.clipboard.writeText(codes);
    }
  };

  return (
    <AdaptiveLayout>
      <div className="flex flex-col min-h-screen bg-white">
        <PageHeader title={t('title')} showBack={true} />

        <div className="p-4 space-y-6">
          {!communitiesLoading && !hasPermission && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="font-bold text-yellow-800 mb-2">{t('noPermission')}</p>
              <p className="text-sm text-yellow-700">{t('noPermissionDescription')}</p>
            </div>
          )}

          {hasPermission && (
            <>
              <BrandFormControl label={t('inviteType')}>
                <BrandSelect
                  value={inviteType}
                  onChange={(value) => setInviteType(value as any)}
                  options={[
                    { label: t('leadToParticipant'), value: 'lead-to-participant' },
                    { label: t('superadminToLead'), value: 'superadmin-to-lead' },
                  ]}
                  fullWidth
                />
              </BrandFormControl>

              {inviteType === 'lead-to-participant' && (
                <BrandFormControl label={t('targetUserId')}>
                  <BrandInput
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    placeholder={t('targetUserIdPlaceholder')}
                    fullWidth
                  />
                </BrandFormControl>
              )}

              <BrandFormControl
                label={t('expiresInDays')}
                helperText={t('expiresInDaysHelp')}
              >
                <BrandInput
                  type="number"
                  value={expiresInDays.toString()}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10);
                    setExpiresInDays(isNaN(num) ? '' : num);
                  }}
                  placeholder={t('expiresInDaysPlaceholder')}
                  fullWidth
                />
              </BrandFormControl>

              <div className="space-y-3">
                <h2 className="text-base font-semibold text-brand-text-primary">
                  {t('selectCommunities')}
                </h2>
                {communitiesLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                  </div>
                ) : !leadCommunities || leadCommunities.length === 0 ? (
                  <p className="text-brand-text-secondary">{t('noCommunities')}</p>
                ) : (
                  <div className="space-y-2">
                    {leadCommunities.map((community) => (
                      <BrandCheckbox
                        key={community.id}
                        checked={selectedCommunities.includes(community.id)}
                        onChange={() => handleToggleCommunity(community.id)}
                        label={community.name}
                      />
                    ))}
                  </div>
                )}
              </div>

              {generatedInvites.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-base font-semibold text-brand-text-primary">
                    {t('generatedInvites')}
                  </h2>
                  <div className="space-y-2">
                    {generatedInvites.map((invite) => (
                      <div
                        key={invite.communityId}
                        className="p-3 bg-green-50 border border-green-200 rounded-lg"
                      >
                        <p className="font-bold text-brand-text-primary">{invite.communityId}</p>
                        <p className="font-mono text-sm text-brand-text-secondary">{invite.code}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-green-600">
                    {t('invitesCopied')}
                  </p>
                </div>
              )}

              <BrandButton
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleCreateInvites}
                disabled={
                  selectedCommunities.length === 0 ||
                  (inviteType === 'lead-to-participant' && !targetUserId.trim()) ||
                  createInvite.isPending
                }
                isLoading={createInvite.isPending}
              >
                {createInvite.isPending ? t('creating') : t('create')}
              </BrandButton>
            </>
          )}
        </div>
      </div>
    </AdaptiveLayout>
  );
}
