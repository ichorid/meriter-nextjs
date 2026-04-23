'use client';

import { CommunityMembersPageClient } from '@/app/meriter/communities/[id]/members/CommunityMembersPageClient';
import { isPilotClientMode, isPilotDreamProject } from '@/config/pilot';
import { useProject } from '@/hooks/api/useProjects';
import { routes } from '@/lib/constants/routes';

export function ProjectMembersPilotWrapper({ projectId }: { projectId: string }) {
  const { data } = useProject(projectId);
  const hideMeritChrome =
    isPilotClientMode() && Boolean(data?.project && isPilotDreamProject(data.project));

  return (
    <CommunityMembersPageClient
      communityId={projectId}
      returnTo={routes.project(projectId)}
      membersContext="project"
      hideMeritActions={hideMeritChrome}
      pilotParticipantsCopy={hideMeritChrome}
    />
  );
}
