/**
 * Utility class for formatting user data for API responses
 */
export class UserFormatter {
  /**
   * Format user for API response (author/beneficiary format)
   * @param user User object or null
   * @param userId User ID (fallback if user is null)
   * @returns Formatted user object for API response
   */
  static formatUserForApi(user: any | null, userId: string): {
    id: string;
    name: string;
    username?: string;
    photoUrl?: string;
  } {
    if (user) {
      return {
        id: userId,
        name: this.formatUserName(user),
        username: user.username,
        photoUrl: user.avatarUrl,
      };
    }
    
    return {
      id: userId,
      name: 'Unknown',
      username: undefined,
      photoUrl: undefined,
    };
  }

  /**
   * Format user name from user object
   * Priority: displayName > firstName + lastName > username > 'Unknown'
   */
  static formatUserName(user: any): string {
    if (user.displayName) {
      return user.displayName;
    }
    
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (fullName) {
      return fullName;
    }
    
    if (user.username) {
      return user.username;
    }
    
    return 'Unknown';
  }
}

