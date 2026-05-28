import { TRPCError } from '@trpc/server';
import type {
  PermissionGatesPort,
  PostTypeGateResult,
  PublicationPostTypeGateInput,
} from '../../../domain/ports/permission-gates.port';

export const EVENT_POST_TYPE = 'event' as const;

export function isEventPostType(postType?: string | null): boolean {
  return postType === EVENT_POST_TYPE;
}

/**
 * inv-05 vote gate for event publications (delegates to PermissionGatesPort when available).
 */
export function evaluateEventPublicationVoteGate(
  permissionGates: PermissionGatesPort,
  input: PublicationPostTypeGateInput = { postType: EVENT_POST_TYPE },
): PostTypeGateResult {
  return permissionGates.evaluatePublicationVotePostTypeGate(input);
}

/** inv-05: event publications cannot be forwarded. */
export function assertEventPublicationNotForwardable(postType?: string | null): void {
  if (!isEventPostType(postType)) {
    return;
  }
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Cannot forward event publications',
  });
}

/** inv-05: event publications cannot be published to Birzha. */
export function assertEventPublicationNotBirzhaEligible(postType?: string | null): void {
  if (!isEventPostType(postType)) {
    return;
  }
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Event publications cannot be published to Birzha',
  });
}

/** inv-05: event publications cannot receive votes. */
export function assertEventPublicationNotVotable(postType?: string | null): void {
  if (!isEventPostType(postType)) {
    return;
  }
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Event publications cannot be voted on',
  });
}
