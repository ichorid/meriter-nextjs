/**
 * Orchestration port (BC-01): ensure a user is a member of the platform base hub
 * communities. Implemented in application (ProvisionBaseMembershipUseCase), wired at
 * the composition root (Zone 8 inversion).
 */
export const PROVISION_BASE_MEMBERSHIP_PORT = Symbol(
  'PROVISION_BASE_MEMBERSHIP_PORT',
);

export interface ProvisionBaseMembershipPort {
  execute(userId: string): Promise<void>;
}
