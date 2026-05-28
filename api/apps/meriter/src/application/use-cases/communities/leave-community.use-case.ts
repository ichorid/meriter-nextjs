import { TRPCError } from '@trpc/server';
import type { CommunityService } from '../../../domain/services/community.service';

export type LeaveCommunityInput = {
  userId: string;
  communityId: string;
};

export type LeaveCommunityDeps = {
  communityService: CommunityService;
};

/**
 * BC-01: participant leaves a non-project local community.
 * inv-08: membership and role validations before removal side effects.
 */
export class LeaveCommunityUseCase {
  constructor(private readonly deps: LeaveCommunityDeps) {}

  async execute(input: LeaveCommunityInput): Promise<{ success: true }> {
    if (!input.userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }

    await this.deps.communityService.leaveLocalCommunity(
      input.userId,
      input.communityId,
    );

    return { success: true as const };
  }
}

export function createLeaveCommunityUseCase(
  deps: LeaveCommunityDeps,
): LeaveCommunityUseCase {
  return new LeaveCommunityUseCase(deps);
}
