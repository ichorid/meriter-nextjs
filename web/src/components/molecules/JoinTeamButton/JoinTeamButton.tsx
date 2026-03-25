'use client';

import React from 'react';
import { CommunityJoinRequestPanel } from '@/components/molecules/CommunityJoinRequest/CommunityJoinRequestPanel';

interface JoinTeamButtonProps {
  communityId: string;
  communityName?: string;
}

export const JoinTeamButton: React.FC<JoinTeamButtonProps> = ({ communityId }) => {
  return <CommunityJoinRequestPanel communityId={communityId} layout="inline" />;
};
