import { Injectable } from '@nestjs/common';
import { UserService } from '../../domain/services/user.service';
import { UserFormatter } from '../../api-v1/common/utils/user-formatter.util';

/**
 * Batch fetch pipeline for user display enrichment (name + avatar).
 */
@Injectable()
export class UserEnrichmentService {
  constructor(private readonly userService: UserService) {}

  /**
   * Batch fetch users by IDs and return as a Map for efficient lookup.
   * Uses a single domain query instead of N× getUser.
   */
  async batchFetchUsers(userIds: string[]): Promise<Map<string, any>> {
    if (userIds.length === 0) {
      return new Map();
    }

    return this.userService.getUsersByIdsForEnrichment(userIds);
  }

  /**
   * Format user for API response (author/beneficiary format).
   */
  formatUserForApi(
    user: any | null,
    userId: string,
  ): {
    id: string;
    name: string;
    username?: string;
    photoUrl?: string;
  } {
    return UserFormatter.formatUserForApi(user, userId);
  }
}
