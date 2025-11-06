import { Injectable } from '@nestjs/common';
import { UserService } from '../../../domain/services/user.service';
import { UserFormatter } from '../utils/user-formatter.util';

/**
 * Service for batch fetching and enriching users
 */
@Injectable()
export class UserEnrichmentService {
  constructor(private readonly userService: UserService) {}

  /**
   * Batch fetch users by IDs and return as a Map for efficient lookup
   * @param userIds Array of user IDs to fetch
   * @returns Map of userId -> user object
   */
  async batchFetchUsers(userIds: string[]): Promise<Map<string, any>> {
    const usersMap = new Map<string, any>();
    
    if (userIds.length === 0) {
      return usersMap;
    }

    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const user = await this.userService.getUser(userId);
          if (user) {
            usersMap.set(userId, user);
          }
        } catch (error) {
          // Silently skip users that don't exist
        }
      })
    );

    return usersMap;
  }

  /**
   * Format user for API response (author/beneficiary format)
   * @param user User object
   * @param userId User ID (fallback if user is null)
   * @returns Formatted user object for API response
   */
  formatUserForApi(user: any | null, userId: string): {
    id: string;
    name: string;
    username?: string;
    photoUrl?: string;
  } {
    return UserFormatter.formatUserForApi(user, userId);
  }
}

