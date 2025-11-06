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
    telegramId: string,
    communityTags: string[],
    jwtSecret: string
  ): string {
    if (!jwtSecret) {
      throw new Error('JWT secret not configured');
    }

    const payload: JwtPayload = {
      uid: userId,
      telegramId,
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
    telegramId: string,
    communityTags: string[],
    configService: ConfigService
  ): string {
    const jwtSecret = configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      throw new Error('JWT secret not configured');
    }

    return this.generateToken(userId, telegramId, communityTags, jwtSecret);
  }

  /**
   * Map user object to V1 API format
   * @param user User object from database
   * @returns User object in V1 API format
   */
  static mapUserToV1Format(user: any): User {
    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      profile: {
        bio: user.profile?.bio,
        location: user.profile?.location,
        website: user.profile?.website,
        isVerified: user.profile?.isVerified,
      },
      communityTags: user.communityTags || [],
      communityMemberships: user.communityMemberships || [],
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}

