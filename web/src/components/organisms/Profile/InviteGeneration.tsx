'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles, useLeadCommunities } from '@/hooks/api/useProfile';
import { useInvites, useCreateInvite } from '@/hooks/api/useInvites';
import { useCommunities } from '@/hooks/api/useCommunities';
import { BrandButton } from '@/components/ui/BrandButton';
import { BrandInput } from '@/components/ui/BrandInput';
import { BrandSelect } from '@/components/ui/BrandSelect';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { Copy, Check, ChevronDown, ChevronUp, Loader2, UserPlus } from 'lucide-react';
import type { Invite } from '@/types/api-v1';
import { useToastStore } from '@/shared/stores/toast.store';

export function InviteGeneration() {
  const t = useTranslations('profile.invites');
  const tInvites = useTranslations('invites.create');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: leadCommunities = [] } = useLeadCommunities(user?.id || '');
  const { data: communitiesData } = useCommunities();
  const { data: invites = [], isLoading: invitesLoading } = useInvites();
  const createInvite = useCreateInvite();

  const [inviteExpiresInDays, setInviteExpiresInDays] = useState<number | ''>(30);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>('');
  const [generatedInvite, setGeneratedInvite] = useState<Invite | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showInviteList, setShowInviteList] = useState(false);

  // Determine user role and permissions
  const isSuperadmin = user?.globalRole === 'superadmin';
  const isLead = useMemo(() => {
    return userRoles.some(r => r.role === 'lead') || leadCommunities.length > 0;
  }, [userRoles, leadCommunities]);
  
  // Check if user has any lead role (either from userRoles or leadCommunities)
  const hasLeadRole = useMemo(() => {
    return isSuperadmin || isLead;
  }, [isSuperadmin, isLead]);

  // Set default community for lead (first team community) - auto-select
  useEffect(() => {
    if (isLead && !isSuperadmin && leadCommunities.length > 0) {
      // Filter to only team communities
      const teamCommunities = leadCommunities.filter(c => c.typeTag === 'team');
      if (teamCommunities.length > 0) {
        setSelectedCommunityId(teamCommunities[0].id);
      } else if (leadCommunities.length > 0) {
        setSelectedCommunityId(leadCommunities[0].id);
      }
    }
  }, [isLead, isSuperadmin, leadCommunities]);

  // Determine invite type
  const inviteType = isSuperadmin ? 'superadmin-to-lead' : 'lead-to-participant';

  // Get available communities for selection (only for lead - superadmin doesn't need selection)
  const availableCommunities = useMemo(() => {
    if (isSuperadmin) {
      // Superadmin doesn't need to select a community
      return [];
    } else {
      // For lead, show their team communities
      return leadCommunities.filter(c => c.typeTag === 'team');
    }
  }, [isSuperadmin, leadCommunities]);

  const handleGenerateInvite = async () => {
    // For lead, communityId is required (auto-selected from their team)
    if (!isSuperadmin && !selectedCommunityId) {
      addToast(t('selectCommunity'), 'warning');
      return;
    }

    try {
      const expiresAt = inviteExpiresInDays && inviteExpiresInDays > 0
        ? new Date(Date.now() + inviteExpiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      const inviteData: any = {
        type: inviteType,
        ...(selectedCommunityId && { communityId: selectedCommunityId }), // Only include communityId if provided (for leads)
        expiresAt,
      };

      const invite = await createInvite.mutateAsync(inviteData);
      setGeneratedInvite(invite);
      setInviteCopied(false);
      // Reset form
      setInviteExpiresInDays(30);
      addToast(t('inviteGenerated'), 'success');
    } catch (error) {
      console.error('Failed to create invite:', error);
      addToast(t('inviteError'), 'error');
    }
  };

  const handleCopyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
    addToast(tCommon('copied') || 'Copied!', 'success');
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return t('noExpiration');
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  // Check if invite is expired
  const isInviteExpired = (invite: Invite) => {
    if (!invite.expiresAt) return false;
    return new Date(invite.expiresAt) < new Date();
  };

  // Get community name by ID
  const getCommunityName = (communityId?: string) => {
    if (!communityId) {
      // For superadmin-to-lead invites, communityId is not set (auto-assigned)
      return inviteType === 'superadmin-to-lead' 
        ? t('autoAssigned')
        : t('notSet');
    }
    if (isSuperadmin && communitiesData?.data) {
      const comm = communitiesData.data.find(c => c.id === communityId);
      return comm?.name || communityId;
    } else {
      const comm = leadCommunities.find(c => c.id === communityId);
      return comm?.name || communityId;
    }
  };

  // Hide component completely for participants and viewers (only show for superadmin and leads)
  if (!hasLeadRole) {
    return null;
  }

  return (
    <div className="bg-brand-surface border border-brand-secondary/10 rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="text-brand-primary bg-brand-primary/10 p-2 rounded-lg">
          <UserPlus size={24} />
        </div>
        <h2 className="text-lg font-bold text-brand-text-primary">
          {t('title')}
        </h2>
      </div>
      <div className="space-y-4">
        {isSuperadmin && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {tInvites('superadminToLeadDescription') || 'Create an invite to make a user a Lead'}
            </p>
          </div>
        )}

        {!isSuperadmin && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {tInvites('leadToParticipantDescription')}
            </p>
          </div>
        )}

        {!isSuperadmin && availableCommunities.length > 1 && (
          <BrandFormControl
            label={t('selectCommunity')}
          >
            <BrandSelect
              value={selectedCommunityId}
              onChange={setSelectedCommunityId}
              options={availableCommunities.map(c => ({
                label: c.name,
                value: c.id,
              }))}
              fullWidth
            />
          </BrandFormControl>
        )}

        {!isSuperadmin && availableCommunities.length === 1 && selectedCommunityId && (
          <div className="text-sm text-brand-text-secondary">
            {t('community')}: <span className="font-medium">{availableCommunities[0].name}</span>
          </div>
        )}

        <BrandFormControl
          label={tInvites('expiresInDays') || 'Expires in (days)'}
          helperText={tInvites('expiresInDaysHelp')}
        >
          <BrandInput
            type="number"
            value={inviteExpiresInDays.toString()}
            onChange={(e) => {
              const num = parseInt(e.target.value, 10);
              setInviteExpiresInDays(isNaN(num) ? '' : num);
            }}
            placeholder={tInvites('expiresInDaysPlaceholder') || '30'}
            fullWidth
          />
        </BrandFormControl>

        {generatedInvite && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-green-800 dark:text-green-200">
                {tInvites('inviteCode') || 'Invite Code'}
              </p>
              <button
                onClick={() => handleCopyInviteCode(generatedInvite.code)}
                className="p-1 hover:bg-green-100 dark:hover:bg-green-900/40 rounded"
                title={tCommon('copy') || 'Copy'}
              >
                {inviteCopied ? (
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-green-600 dark:text-green-400" />
                )}
              </button>
            </div>
            <p className="font-mono text-sm text-green-900 dark:text-green-100 break-all">
              {generatedInvite.code}
            </p>
            {inviteCopied && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {tCommon('copied') || 'Copied!'}
              </p>
            )}
          </div>
        )}

        <BrandButton
          variant="primary"
          onClick={handleGenerateInvite}
          disabled={(!isSuperadmin && !selectedCommunityId) || createInvite.isPending}
          isLoading={createInvite.isPending}
          fullWidth
        >
          {createInvite.isPending ? (tInvites('creating') || 'Creating...') : (tInvites('create') || 'Generate Invite')}
        </BrandButton>
      </div>

      {/* Invite List Dropdown */}
      {invites.length > 0 && (
        <div className="border-t border-brand-secondary/10 pt-4">
          <button
            onClick={() => setShowInviteList(!showInviteList)}
            className="flex items-center justify-between w-full p-3 bg-brand-surface border border-brand-secondary/10 rounded-lg hover:bg-brand-secondary/5 transition-colors"
          >
            <span className="font-medium text-brand-text-primary">
              {t('generatedInvites')} ({invites.length})
            </span>
            {showInviteList ? (
              <ChevronUp className="w-5 h-5 text-brand-text-secondary" />
            ) : (
              <ChevronDown className="w-5 h-5 text-brand-text-secondary" />
            )}
          </button>

          {showInviteList && (
            <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
              {invitesLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                </div>
              ) : (
                invites.map((invite) => {
                  const expired = isInviteExpired(invite);
                  const used = invite.isUsed;
                  
                  return (
                    <div
                      key={invite.id}
                      className={`p-3 rounded-lg border ${
                        used
                          ? 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
                          : expired
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                          : 'bg-base-100 border-brand-secondary/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-brand-text-secondary break-all">
                              {invite.code}
                            </span>
                            {used && (
                              <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded">
                                {t('used')}
                              </span>
                            )}
                            {!used && expired && (
                              <span className="px-2 py-0.5 text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300 rounded">
                                {t('expired')}
                              </span>
                            )}
                            {!used && !expired && (
                              <span className="px-2 py-0.5 text-xs bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300 rounded">
                                {t('active')}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-brand-text-secondary space-y-0.5">
                            <div>
                              <span className="font-medium">{t('type')}:</span>{' '}
                              {invite.type === 'superadmin-to-lead' 
                                ? t('superadminToLead')
                                : t('leadToParticipant')}
                            </div>
                            <div>
                              <span className="font-medium">{t('community')}:</span>{' '}
                              {getCommunityName(invite.communityId)}
                            </div>
                            <div>
                              <span className="font-medium">{t('expires')}:</span>{' '}
                              {formatDate(invite.expiresAt)}
                            </div>
                            {used && invite.usedAt && (
                              <div>
                                <span className="font-medium">{t('usedAt')}:</span>{' '}
                                {formatDate(invite.usedAt)}
                              </div>
                            )}
                          </div>
                        </div>
                        {!used && (
                          <button
                            onClick={() => handleCopyInviteCode(invite.code)}
                            className="p-1.5 hover:bg-brand-secondary/10 rounded transition-colors flex-shrink-0"
                            title={tCommon('copy') || 'Copy'}
                          >
                            <Copy className="w-4 h-4 text-brand-text-secondary" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

