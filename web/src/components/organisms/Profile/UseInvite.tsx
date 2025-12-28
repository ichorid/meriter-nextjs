'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles, useLeadCommunities } from '@/hooks/api/useProfile';
import { InviteInput } from '@/components/molecules/InviteInput/InviteInput';
import { Ticket } from 'lucide-react';

function UseInviteComponent() {
  const t = useTranslations('profile.useInvite');
  const { user } = useAuth();

  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: leadCommunities = [] } = useLeadCommunities(user?.id || '');

  // Determine user role and permissions
  const isSuperadmin = user?.globalRole === 'superadmin';
  const isLead = useMemo(() => {
    return userRoles.some(r => r.role === 'lead') || leadCommunities.length > 0;
  }, [userRoles, leadCommunities]);
  const isParticipant = useMemo(() => {
    return userRoles.some(r => r.role === 'participant') && !isLead && !isSuperadmin;
  }, [userRoles, isLead, isSuperadmin]);
  const isViewer = useMemo(() => {
    return userRoles.some(r => r.role === 'viewer') && !isLead && !isSuperadmin && !isParticipant;
  }, [userRoles, isLead, isSuperadmin, isParticipant]);

  // Only show component for viewers
  if (!isViewer) {
    return null;
  }

  return (
    <div className="bg-brand-surface border border-brand-secondary/10 rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="text-brand-primary bg-brand-primary/10 p-2 rounded-lg">
          <Ticket size={24} />
        </div>
        <h2 className="text-lg font-bold text-brand-text-primary">
          {t('title')}
        </h2>
      </div>
      <div className="space-y-4">
        <InviteInput hideLabel />
      </div>
    </div>
  );
}

export const UseInvite = UseInviteComponent;

