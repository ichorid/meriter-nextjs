import { ConfigService } from '@nestjs/config';
import { signJWT, JwtPayload } from '../helpers/jwt';
import { User } from '@meriter/shared-types';
import { AppConfig } from '../../config/configuration';

/**
 * Service for JWT token generation and user mapping
 */
export class JwtService {
  static generateToken(
    userId: string,
    authProvider: string,
    authId: string,
    communityTags: string[],
    jwtSecret: string,
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

  static generateTokenFromConfig(
    userId: string,
    authProvider: string,
    authId: string,
    communityTags: string[],
    configService: ConfigService<AppConfig>,
  ): string {
    const jwtSecret = configService.getOrThrow('jwt.secret' as never);
    return this.generateToken(
      userId,
      authProvider,
      authId,
      communityTags,
      jwtSecret,
    );
  }

  static mapUserToV1Format(user: {
    id: string;
    authProvider?: string;
    authId?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatarUrl?: string;
    globalRole?: string;
    profile?: Partial<User['profile']>;
    inviteCode?: string;
    communityTags?: string[];
    communityMemberships?: string[];
    authenticators?: unknown[];
    createdAt?: Date;
    updatedAt?: Date;
  }): User {
    const contacts = user.profile?.contacts;
    const mappedContacts =
      contacts && (contacts.email || contacts.messenger)
        ? {
            email: contacts.email ?? '',
            messenger: contacts.messenger ?? '',
          }
        : undefined;

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
        isVerified: user.profile?.isVerified ?? false,
        about: user.profile?.about,
        contacts: mappedContacts,
        educationalInstitution: user.profile?.educationalInstitution,
      },
      inviteCode: user.inviteCode,
      communityTags: user.communityTags || [],
      communityMemberships: user.communityMemberships || [],
      authenticators: user.authenticators || [],
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
    } as User;
  }
}
