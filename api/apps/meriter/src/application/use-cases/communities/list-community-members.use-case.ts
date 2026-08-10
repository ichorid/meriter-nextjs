import type { z } from 'zod';
import type { CommunityService } from '../../../domain/services/community.service';
import { PaginationHelper } from '../../../common/helpers/pagination.helper';
import { PaginationInputSchema } from '../../../common/schemas/pagination.schema';

export type ListCommunityMembersInput = {
  communityId: string;
  pagination: z.infer<typeof PaginationInputSchema>;
  search?: string;
};

export type ListCommunityMembersDeps = {
  communityService: CommunityService;
};

/**
 * BC-01: paginated community member list with quota enrichment.
 */
export class ListCommunityMembersUseCase {
  constructor(private readonly deps: ListCommunityMembersDeps) {}

  async execute(input: ListCommunityMembersInput) {
    const pagination = PaginationHelper.parseOptions(input.pagination);
    const skip = PaginationHelper.getSkip(pagination);

    const result = await this.deps.communityService.getCommunityMembers(
      input.communityId,
      pagination.limit || 20,
      skip,
      input.search,
    );

    return PaginationHelper.createResult(result.members, result.total, pagination);
  }
}

export function createListCommunityMembersUseCase(
  deps: ListCommunityMembersDeps,
): ListCommunityMembersUseCase {
  return new ListCommunityMembersUseCase(deps);
}
