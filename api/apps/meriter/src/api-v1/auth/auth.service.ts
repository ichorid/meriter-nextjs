import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserService } from '../../domain/services/user.service';
import { CommunityService } from '../../domain/services/community.service';
import { User } from '../../../../../../libs/shared-types/dist/index';
import { signJWT } from '../../common/helpers/jwt';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../../domain/models/community/community.schema';
import type { Community } from '../../domain/models/community/community.schema';
import { JwtService } from '../common/utils/jwt-service.util';
import * as crypto from 'crypto';

interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly communityService: CommunityService,
    private readonly configService: ConfigService,
    @InjectModel(CommunitySchemaClass.name)
    private communityModel: Model<CommunityDocument>,
  ) {}

  private isFakeDataMode(): boolean {
    return process.env.FAKE_DATA_MODE === 'true';
  }

  // Telegram authentication methods removed: Telegram is fully disabled in this project.

  async authenticateFakeUser(fakeUserId?: string): Promise<{
    user: User;
    hasPendingCommunities: boolean;
    jwt: string;
  }> {
    if (!this.isFakeDataMode()) {
      throw new Error('Fake data mode is not enabled');
    }

    const authId =
      fakeUserId ||
      `fake_user_dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    this.logger.log(`Creating or updating fake user ${authId}...`);

    // Generate username and display name from the fake user ID
    const sessionNumber = fakeUserId
      ? fakeUserId.split('_').pop()?.substring(0, 6) || 'dev'
      : 'dev';
    const username = `fakedev_${sessionNumber}`;
    const displayName = `Fake Dev User ${sessionNumber}`;

    const user = await this.userService.createOrUpdateUser({
      authProvider: 'fake',
      authId,
      username,
      firstName: 'Fake',
      lastName: 'Dev',
      displayName,
      avatarUrl: undefined,
    });

    if (!user) {
      throw new Error('Failed to create fake user');
    }

    this.logger.log(`Fake user ${authId} created/updated successfully`);

    // Ensure user is added to base communities
    await this.userService.ensureUserInBaseCommunities(user.id);

    // Generate JWT
    const jwtSecret = this.configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      this.logger.error(
        'JWT_SECRET is not configured. Cannot generate JWT token.',
      );
      throw new Error('JWT secret not configured');
    }

    const jwtToken = signJWT(
      {
        uid: user.id,
        authProvider: 'fake',
        authId,
        communityTags: user.communityTags || [],
      },
      jwtSecret,
      '365d',
    );

    this.logger.log(`JWT generated for fake user ${authId}`);

    return {
      user: JwtService.mapUserToV1Format(user),
      hasPendingCommunities: (user.communityTags?.length || 0) > 0,
      jwt: jwtToken,
    };
  }

  async authenticateFakeSuperadmin(fakeUserId?: string): Promise<{
    user: User;
    hasPendingCommunities: boolean;
    jwt: string;
  }> {
    if (!this.isFakeDataMode()) {
      throw new Error('Fake data mode is not enabled');
    }

    const authId =
      fakeUserId ||
      `fake_superadmin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    this.logger.log(`Creating or updating fake superadmin user ${authId}...`);

    // Generate username and display name from the fake user ID
    const sessionNumber = fakeUserId
      ? fakeUserId.split('_').pop()?.substring(0, 6) || 'admin'
      : 'admin';
    const username = `fakesuperadmin_${sessionNumber}`;
    const displayName = `Fake Superadmin ${sessionNumber}`;

    const user = await this.userService.createOrUpdateUser({
      authProvider: 'fake',
      authId,
      username,
      firstName: 'Fake',
      lastName: 'Superadmin',
      displayName,
      avatarUrl: undefined,
    });

    if (!user) {
      throw new Error('Failed to create fake superadmin user');
    }

    // Set globalRole to superadmin
    await this.userService.updateGlobalRole(user.id, 'superadmin');

    // Re-fetch user to get updated role
    const updatedUser = await this.userService.getUser(user.id);
    if (!updatedUser) {
      throw new Error('Failed to retrieve fake superadmin user');
    }

    this.logger.log(`Fake superadmin user ${authId} created/updated successfully with superadmin role`);

    // Ensure user is added to base communities
    await this.userService.ensureUserInBaseCommunities(updatedUser.id);

    // Generate JWT
    const jwtSecret = this.configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      this.logger.error(
        'JWT_SECRET is not configured. Cannot generate JWT token.',
      );
      throw new Error('JWT secret not configured');
    }

    const jwtToken = signJWT(
      {
        uid: updatedUser.id,
        authProvider: 'fake',
        authId,
        communityTags: updatedUser.communityTags || [],
      },
      jwtSecret,
      '365d',
    );

    this.logger.log(`JWT generated for fake superadmin user ${authId}`);

    return {
      user: JwtService.mapUserToV1Format(updatedUser),
      hasPendingCommunities: (updatedUser.communityTags?.length || 0) > 0,
      jwt: jwtToken,
    };
  }

  async authenticateGoogle(code: string): Promise<{
    user: User;
    hasPendingCommunities: boolean;
    isNewUser: boolean;
    jwt: string;
  }> {
    this.logger.log('Authenticating with Google OAuth code');

    const clientId = process.env.OAUTH_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.OAUTH_GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    let callbackUrl =
      process.env.OAUTH_GOOGLE_REDIRECT_URI ||
      process.env.OAUTH_GOOGLE_CALLBACK_URL ||
      process.env.GOOGLE_REDIRECT_URI;

    if (!callbackUrl) {
      const domain =
        process.env.DOMAIN ||
        process.env.APP_URL?.replace(/^https?:\/\//, '') ||
        'localhost';
      const isDocker = process.env.NODE_ENV === 'production';
      const protocol =
        domain === 'localhost' && !isDocker
          ? 'http'
          : domain === 'localhost'
            ? 'http'
            : 'https';
      const port = domain === 'localhost' && !isDocker ? ':8002' : '';
      callbackUrl = `${protocol}://${domain}${port}/api/v1/auth/google/callback`;
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      this.logger.error(`Failed to exchange code for token: ${errorText}`);
      throw new Error('Failed to exchange authorization code for token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('Access token not received from Google');
    }

    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      this.logger.error(`Failed to get user info from Google: ${errorText}`);
      throw new Error('Failed to get user information from Google');
    }

    const googleUser = await userInfoResponse.json();
    this.logger.log(`Google user info received: ${googleUser.email}`);

    const googleId = googleUser.id;
    const email = googleUser.email;
    const firstName = googleUser.given_name || '';
    const lastName = googleUser.family_name || '';
    const displayName =
      googleUser.name || `${firstName} ${lastName}`.trim() || email;
    const avatarUrl = googleUser.picture;

    // Check if user already exists
    const existingUser = await this.userService.getUserByAuthId('google', googleId);
    const isNewUser = !existingUser;

    const user = await this.userService.createOrUpdateUser({
      authProvider: 'google',
      authId: googleId,
      username: email?.split('@')[0],
      firstName,
      lastName,
      displayName,
      avatarUrl,
    });

    if (!user) {
      throw new Error('Failed to create or update user');
    }

    await this.userService.ensureUserInBaseCommunities(user.id);

    const jwtSecret = this.configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      this.logger.error(
        'JWT_SECRET is not configured. Cannot generate JWT token.',
      );
      throw new Error('JWT secret not configured');
    }

    const jwtToken = signJWT(
      {
        uid: user.id,
        authProvider: 'google',
        authId: googleId,
        communityTags: user.communityTags || [],
      },
      jwtSecret,
      '365d',
    );

    this.logger.log(`JWT generated for Google user ${email}, isNewUser: ${isNewUser}`);

    return {
      user: JwtService.mapUserToV1Format(user),
      hasPendingCommunities: (user.communityTags?.length || 0) > 0,
      isNewUser,
      jwt: jwtToken,
    };
  }

  async authenticateYandex(code: string): Promise<{
    user: User;
    hasPendingCommunities: boolean;
    isNewUser: boolean;
    jwt: string;
  }> {
    this.logger.log('Authenticating with Yandex OAuth code');

    const clientId = process.env.OAUTH_YANDEX_CLIENT_ID;
    const clientSecret = process.env.OAUTH_YANDEX_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Yandex OAuth credentials not configured');
    }

    const tokenResponse = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      this.logger.error(`Failed to exchange Yandex code for token: ${errorText}`);
      throw new Error('Failed to exchange authorization code for token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('Access token not received from Yandex');
    }

    const userInfoResponse = await fetch('https://login.yandex.ru/info?format=json', {
      headers: {
        'Authorization': `OAuth ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      this.logger.error(`Failed to get user info from Yandex: ${errorText}`);
      throw new Error('Failed to get user information from Yandex');
    }

    const yandexUser = await userInfoResponse.json();
    this.logger.log(`Yandex user info received: ${yandexUser.default_email || yandexUser.login}`);

    const yandexId = yandexUser.id;
    const email = yandexUser.default_email || `${yandexUser.login}@yandex.ru`;
    const firstName = yandexUser.first_name || '';
    const lastName = yandexUser.last_name || '';
    const displayName = yandexUser.real_name || yandexUser.display_name || `${firstName} ${lastName}`.trim() || yandexUser.login;
    const avatarUrl = yandexUser.default_avatar_id 
      ? `https://avatars.yandex.net/get-yapic/${yandexUser.default_avatar_id}/islands-200`
      : undefined;

    // Check if user already exists
    const existingUser = await this.userService.getUserByAuthId('yandex', yandexId);
    const isNewUser = !existingUser;

    const user = await this.userService.createOrUpdateUser({
      authProvider: 'yandex',
      authId: yandexId,
      username: yandexUser.login || email?.split('@')[0],
      firstName,
      lastName,
      displayName,
      avatarUrl,
    });

    if (!user) {
      throw new Error('Failed to create or update user');
    }

    await this.userService.ensureUserInBaseCommunities(user.id);

    const jwtSecret = this.configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      this.logger.error('JWT_SECRET is not configured. Cannot generate JWT token.');
      throw new Error('JWT secret not configured');
    }

    const jwtToken = signJWT(
      {
        uid: user.id,
        authProvider: 'yandex',
        authId: yandexId,
        communityTags: user.communityTags || [],
      },
      jwtSecret,
      '365d',
    );

    this.logger.log(`JWT generated for Yandex user ${email}, isNewUser: ${isNewUser}`);

    return {
      user: JwtService.mapUserToV1Format(user),
      hasPendingCommunities: (user.communityTags?.length || 0) > 0,
      isNewUser,
      jwt: jwtToken,
    };
  }

  /**
   * Authenticate user with any OAuth provider
   * Supports multiple providers: google, github, etc.
   * Provider data comes from Passport strategy validation
   */
  async authenticateWithProvider(providerUser: {
    provider: string;
    providerId: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string;
    avatarUrl?: string;
  }): Promise<{
    user: User;
    hasPendingCommunities: boolean;
    jwt: string;
  }> {
    this.logger.log(
      `Authenticating user with provider: ${providerUser.provider}`,
    );

    const {
      provider,
      providerId,
      email,
      firstName,
      lastName,
      displayName,
      avatarUrl,
    } = providerUser;

    // Create provider-specific ID (e.g., google_123456, github_789012)
    // const authId = `${provider}_${providerId}`;

    // Find or create user by provider ID
    let user = await this.userService.getUserByAuthId(provider, providerId);

    if (!user) {
      // Create new user
      user = await this.userService.createOrUpdateUser({
        authProvider: provider,
        authId: providerId,
        username: email?.split('@')[0],
        firstName,
        lastName,
        displayName,
        avatarUrl,
      });
    } else {
      // Update existing user
      user = await this.userService.createOrUpdateUser({
        authProvider: provider,
        authId: providerId,
        username: email?.split('@')[0],
        firstName,
        lastName,
        displayName,
        avatarUrl,
      });
    }

    if (!user) {
      throw new Error('Failed to create or update user');
    }

    // Ensure user is added to base communities
    await this.userService.ensureUserInBaseCommunities(user.id);

    // Generate JWT
    const jwtSecret = this.configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      this.logger.error(
        'JWT_SECRET is not configured. Cannot generate JWT token.',
      );
      throw new Error('JWT secret not configured');
    }

    const jwtToken = signJWT(
      {
        uid: user.id,
        authProvider: provider,
        authId: providerId,
        communityTags: user.communityTags || [],
      },
      jwtSecret,
      '365d',
    );

    this.logger.log(`JWT generated for ${provider} user ${email}`);

    return {
      user: JwtService.mapUserToV1Format(user),
      hasPendingCommunities: (user.communityTags?.length || 0) > 0,
      jwt: jwtToken,
    };
  }

  async getCurrentUser(reqUser: any): Promise<User> {
    this.logger.log(
      `Getting current user for reqUser:`,
      JSON.stringify(reqUser, null, 2),
    );

    const userId = reqUser?.id;
    this.logger.log(`Looking up user with id: ${userId}`);

    if (!userId) {
      this.logger.error('No user id found in reqUser');
      throw new Error('No user id found in request user');
    }

    const user = await this.userService.getUserById(userId);

    if (!user) {
      this.logger.error(`User not found for id: ${userId}`);
      throw new Error('User not found');
    }

    this.logger.log(`User found:`, user.id);
    return JwtService.mapUserToV1Format(user);
  }

  private verifyTelegramAuth(
    data: TelegramAuthData,
    botToken: string,
  ): boolean {
    const { hash, ...fields } = data;

    const dataCheckString = Object.keys(fields)
      .sort()
      .map((key) => `${key}=${(fields as any)[key]}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const hmac = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const hashValid = hmac === hash;
    const authDate = fields.auth_date;
    const currentTime = Math.floor(Date.now() / 1000);
    const timeValid = currentTime - authDate < 86400; // 24 hours

    return hashValid && timeValid;
  }

  private verifyTelegramWebAppData(
    initData: string,
    botToken: string,
  ): { valid: boolean; user?: any } {
    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      urlParams.delete('hash');

      if (!hash) {
        return { valid: false };
      }

      const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      if (calculatedHash !== hash) {
        return { valid: false };
      }

      const authDate = parseInt(urlParams.get('auth_date') || '0');
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - authDate >= 86400) {
        return { valid: false };
      }

      const userJson = urlParams.get('user');
      if (!userJson) {
        return { valid: false };
      }

      const user = JSON.parse(userJson);
      return { valid: true, user };
    } catch (error) {
      this.logger.error('Error verifying Telegram Web App data:', error);
      return { valid: false };
    }
  }

  private async discoverUserCommunities(userId: string): Promise<number> {
    // Telegram-based community discovery is disabled
    return 0;
  }
}
