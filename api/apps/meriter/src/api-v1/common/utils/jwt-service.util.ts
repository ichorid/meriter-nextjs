import { ConfigService } from '@nestjs/config';
import { signJWT, JwtPayload } from '../../../common/helpers/jwt';
import { User } from '@meriter/shared-types';

/**
 * Service for JWT token generation and user mapping
 */
export class JwtService {
  /**
   * Generate JWT token for a user
   * @param userId User ID
   * @param telegramId Telegram user ID
   * @param communityTags Array of community tags
   * @param jwtSecret JWT secret key
   * @returns JWT token string
   */
  static generateToken(
    userId: string,
    authProvider: string,
    authId: string,
    communityTags: string[],
    jwtSecret: string
  ): string {
    if (!jwtSecret) {
      throw new Error('JWT secret not configured');
    }

    const payload: JwtPayload = {
      uid: userId,
      authProvider,
      authId,
      communityTags: communityTags || [],
    };

    return signJWT(payload, jwtSecret, '365d');
  }

  /**
   * Generate JWT token using ConfigService
   * @param userId User ID
   * @param telegramId Telegram user ID
   * @param communityTags Array of community tags
   * @param configService ConfigService instance
   * @returns JWT token string
   */
  static generateTokenFromConfig(
    userId: string,
    authProvider: string,
    authId: string,
    communityTags: string[],
    configService: ConfigService
  ): string {
    const jwtSecret = configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      throw new Error('JWT secret not configured');
    }

    return this.generateToken(userId, authProvider, authId, communityTags, jwtSecret);
  }

  /**
   * Map user object to V1 API format
   * @param user User object from database
   * @returns User object in V1 API format
   */
  static mapUserToV1Format(user: any): User {
    return {
      id: user.id,
      authProvider: user.authProvider,
      authId: user.authId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      globalRole: user.globalRole,
      profile: {
        bio: user.profile?.bio,
        location: user.profile?.location,
        website: user.profile?.website,
        isVerified: user.profile?.isVerified,
      },
      inviteCode: user.inviteCode,
      communityTags: user.communityTags || [],
      communityMemberships: user.communityMemberships || [],
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}

