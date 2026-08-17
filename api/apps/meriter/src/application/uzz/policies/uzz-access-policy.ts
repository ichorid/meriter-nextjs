import { UzzIdentityRecord } from '../ports/uzz-repositories';
import { UzzCommunityAccessPort } from '../ports/uzz-community-access.port';
import { UzzForbiddenError } from '../../../domain/uzz/errors';
import {
  evaluatePurchaseGate,
  PurchaseGateDecision,
  PurchaseGateMode,
} from '../../../domain/uzz/policies/purchase-gate-policy';

export function isIdentityReady(
  identity: UzzIdentityRecord | null | undefined,
): boolean {
  return Boolean(identity?.normalizedEmail && identity.telegramUserId);
}

export class UzzAccessPolicy {
  constructor(private readonly communityAccess: UzzCommunityAccessPort) {}

  async assertMember(communityId: string, userIds: string[]): Promise<void> {
    if (!(await this.communityAccess.isAnyMember(communityId, userIds))) {
      throw new UzzForbiddenError('COMMUNITY_MEMBERSHIP_REQUIRED');
    }
  }

  assertIdentityReady(identity: UzzIdentityRecord | null): void {
    if (!isIdentityReady(identity)) {
      throw new UzzForbiddenError('IDENTITY_LINK_REQUIRED');
    }
  }

  assertListingAuthor(authorId: string, actorId: string): void {
    if (authorId !== actorId) {
      throw new UzzForbiddenError('LISTING_AUTHOR_REQUIRED');
    }
  }

  evaluatePurchase(input: {
    mode: PurchaseGateMode;
    activeListingCount: number;
    minimum: number;
  }): PurchaseGateDecision {
    const decision = evaluatePurchaseGate(input);
    if (!decision.allowed) {
      throw new UzzForbiddenError('MIN_LISTINGS_REQUIRED');
    }
    return decision;
  }
}
