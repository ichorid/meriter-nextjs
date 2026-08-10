import type { TicketStatus } from '@meriter/shared-types';

/**
 * Orchestration port (BC-08/BC-09): auditable project ticket status transitions.
 * Implemented in application (TransitionTicketStatusUseCase), wired at the composition
 * root (Zone 8 inversion).
 */
export const TRANSITION_TICKET_STATUS_PORT = Symbol(
  'TRANSITION_TICKET_STATUS_PORT',
);

export type TransitionTicketStatusInput = {
  ticketId: string;
  userId: string;
  newStatus: TicketStatus;
};

export type AcceptTicketWorkInput = {
  ticketId: string;
  leadUserId: string;
};

export type ReturnTicketWorkForRevisionInput = {
  ticketId: string;
  leadUserId: string;
  reason: string;
  locale?: string;
};

export type DeclineTicketAsAssigneeInput = {
  ticketId: string;
  userId: string;
  reason: string;
  locale?: string;
};

export interface TransitionTicketStatusPort {
  updateStatus(input: TransitionTicketStatusInput): Promise<{ success: true }>;
  acceptWork(input: AcceptTicketWorkInput): Promise<{ success: true }>;
  returnWorkForRevision(
    input: ReturnTicketWorkForRevisionInput,
  ): Promise<{ success: true }>;
  declineAsAssignee(
    input: DeclineTicketAsAssigneeInput,
  ): Promise<{ success: true }>;
}
