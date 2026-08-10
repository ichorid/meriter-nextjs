import type { TeamInvitation } from '../models/team-invitation/team-invitation.schema';

/**
 * Orchestration port (BC-11 / P-8): accept a pending team invitation. Implemented in
 * application (AcceptTeamInvitationUseCase), wired at the composition root (Zone 8
 * inversion). `TeamInvitationTargetAction` lives here (domain) so the shared
 * `loadPendingInvitationForTarget` helper does not import the application layer.
 */
export type TeamInvitationTargetAction = 'accept' | 'reject';

export type AcceptTeamInvitationResult = TeamInvitation & {
  inviteTargetIsProject: boolean;
};

export const ACCEPT_TEAM_INVITATION_PORT = Symbol('ACCEPT_TEAM_INVITATION_PORT');

export interface AcceptTeamInvitationPort {
  execute(
    invitationId: string,
    userId: string,
  ): Promise<AcceptTeamInvitationResult>;
}
