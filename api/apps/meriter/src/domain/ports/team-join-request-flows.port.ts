import type { TeamJoinRequest } from '../models/team-join-request/team-join-request.schema';

/**
 * Orchestration ports (BC-11 / P-9): team join-request submit/approve/reject flows.
 * Implemented in application (`use-cases/teams/*`), wired at the composition root
 * (Zone 8 inversion). `TeamJoinRequestLeadAction` lives here (domain) so the shared
 * `loadPendingJoinRequestForLead` helper does not import the application layer.
 */
export type TeamJoinRequestLeadAction = 'approve' | 'reject';

export const SUBMIT_TEAM_JOIN_REQUEST_PORT = Symbol(
  'SUBMIT_TEAM_JOIN_REQUEST_PORT',
);

export interface SubmitTeamJoinRequestPort {
  execute(
    userId: string,
    communityId: string,
    applicantMessage?: string,
    options?: { pendingEventPublicationId?: string },
  ): Promise<TeamJoinRequest>;
}

export const APPROVE_TEAM_JOIN_REQUEST_PORT = Symbol(
  'APPROVE_TEAM_JOIN_REQUEST_PORT',
);

export interface ApproveTeamJoinRequestPort {
  execute(requestId: string, leadId: string): Promise<TeamJoinRequest>;
}

export const REJECT_TEAM_JOIN_REQUEST_PORT = Symbol(
  'REJECT_TEAM_JOIN_REQUEST_PORT',
);

export interface RejectTeamJoinRequestPort {
  execute(requestId: string, leadId: string): Promise<TeamJoinRequest>;
}
