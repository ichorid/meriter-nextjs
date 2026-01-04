'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles, useLeadCommunities } from '@/hooks/api/useProfile';
import { useInvites, useCreateInvite } from '@/hooks/api/useInvites';
import { useCommunities } from '@/hooks/api/useCommunities';
import { InviteCreationForm } from '@/components/organisms/Community/InviteCreationForm';
import { InviteList } from '@/components/organisms/Community/InviteList';
import { CollapsibleSection } from '@/components/ui/taxonomy/CollapsibleSection';
import { Loader2 } from 'lucide-react';
import type { Invite } from '@/types/api-v1';

export const InviteManagement: React.FC = () => {
  const t = useTranslations('profile.invites');
  const tInvites = useTranslations('invites.create');
  const tCommon = useTranslations('common');
  const { user } = useAuth();

  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: leadCommunities = [] } = useLeadCommunities(user?.id || '');
  const { data: communitiesData } = useCommunities();

  const isSuperadmin = user?.globalRole === 'superadmin';
  const isLead = userRoles.some(r => r.role === 'lead') || leadCommunities.length > 0;
  const hasPermission = isSuperadmin || isLead;

  const { data: allInvitesResponse, isLoading: invitesLoading } = useInvites();
  const allInvites = Array.isArray(allInvitesResponse)
    ? allInvitesResponse
    : (allInvitesResponse?.data ?? []);

  const createInvite = useCreateInvite();

  const [generatedInvite, setGeneratedInvite] = useState<Invite | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  // Determine invite type
  const inviteType = isSuperadmin ? 'superadmin-to-lead' : 'lead-to-participant';

  // Get available communities for selection (only for lead - superadmin doesn't need selection)
  const availableCommunities = React.useMemo(() => {
    if (isSuperadmin) {
      return [];
    } else {
      const teams = leadCommunities.filter(c => c.typeTag === 'team');
      return teams.length > 0 ? teams : leadCommunities;
    }
  }, [isSuperadmin, leadCommunities]);

  // Pre-select first community if available
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>('');
  
  React.useEffect(() => {
    if (availableCommunities.length > 0 && !selectedCommunityId) {
      const teamCommunities = availableCommunities.filter(c => c.typeTag === 'team');
      if (teamCommunities.length > 0) {
        setSelectedCommunityId(teamCommunities[0]?.id ?? '');
      } else if (availableCommunities.length > 0) {
        setSelectedCommunityId(availableCommunities[0]?.id ?? '');
      }
    }
  }, [availableCommunities, selectedCommunityId]);

  const handleCreateInvite = async (data: {
    type: 'superadmin-to-lead' | 'lead-to-participant';
    communityId?: string;
    expiresAt?: string;
  }) => {
    const inviteData: any = {
      type: data.type,
      ...(data.communityId || (!isSuperadmin && selectedCommunityId) ? { communityId: data.communityId || selectedCommunityId } : {}),
      expiresAt: data.expiresAt,
    };
    
    const invite = await createInvite.mutateAsync(inviteData);
    setGeneratedInvite(invite);
    return invite;
  };

  const handleCopyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
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
  const getCommunityName = (inviteCommunityId?: string) => {
    if (!inviteCommunityId) {
      return inviteType === 'superadmin-to-lead'
        ? t('autoAssigned')
        : t('notSet');
    }
    if (isSuperadmin && communitiesData?.data) {
      const comm = communitiesData.data.find(c => c.id === inviteCommunityId);
      return comm?.name || inviteCommunityId;
    } else {
      const comm = leadCommunities.find(c => c.id === inviteCommunityId);
      return comm?.name || inviteCommunityId;
    }
  };

  if (!hasPermission) {
    return null;
  }

  if (invitesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-base-content/50" />
      </div>
    );
  }

  return (
    <CollapsibleSection
      title={t('title')}
      summary={t('description') || 'Create and manage invitation codes'}
      open={isOpen}
      setOpen={setIsOpen}
    >
      <div className="space-y-6">
        <InviteCreationForm
          isSuperadmin={isSuperadmin}
          inviteType={inviteType}
          availableCommunities={availableCommunities}
          selectedCommunityId={selectedCommunityId}
          onCommunityChange={setSelectedCommunityId}
          onCreateInvite={handleCreateInvite}
          isCreating={createInvite.isPending}
          generatedInvite={generatedInvite}
          onInviteGenerated={(invite) => {
            setGeneratedInvite(invite);
          }}
        />

        {/* Invite List - Always visible */}
        <div className="border-t border-base-300 pt-4">
          <h3 className="text-sm font-semibold text-base-content mb-3">
            {t('generatedInvites')} ({allInvites.length})
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <InviteList
              invites={allInvites}
              isLoading={invitesLoading}
              onCopyInvite={handleCopyInviteCode}
              inviteCopied={inviteCopied}
              getCommunityName={getCommunityName}
              formatDate={formatDate}
              isInviteExpired={isInviteExpired}
              showHeader={false}
            />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};

