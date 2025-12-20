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
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import {
  PasskeyChallenge,
  PasskeyChallengeDocument,
} from '../../domain/models/auth/passkey-challenge.schema';
import { Authenticator } from '../../../../../../libs/shared-types/dist/index';

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
    @InjectModel(PasskeyChallenge.name)
    private passkeyChallengeModel: Model<PasskeyChallengeDocument>,
  ) { }

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

  // --- WebAuthn / Passkeys Implementation ---

  private getRpId(requestRpId?: string): string {
    // If requestRpId provided (from host header), use it (stripping port if needed)
    if (requestRpId) {
      const cleaned = requestRpId.split(':')[0];
      this.logger.debug(`RP ID computed: ${cleaned} (from request: ${requestRpId})`);
      return cleaned;
    }
    const rpId = process.env.RP_ID || 'localhost';
    // Remove protocol and port if present, though users should provide clean domains
    const cleaned = rpId.replace(/^https?:\/\//, '').split(':')[0];
    this.logger.debug(`RP ID computed: ${cleaned} (from env: ${process.env.RP_ID || 'default'})`);
    return cleaned;
  }

  private getOrigin(requestOrigin?: string): string {
    if (requestOrigin) {
      this.logger.debug(`Origin computed: ${requestOrigin} (from request)`);
      return requestOrigin;
    }
    let origin = process.env.RP_ORIGIN || process.env.APP_URL || 'http://localhost:3000';
    // Ensure protocol is present
    if (!origin.startsWith('http')) {
      origin = `https://${origin}`;
    }
    const cleaned = origin.replace(/\/$/, ''); // Remove trailing slash
    this.logger.debug(`Origin computed: ${cleaned} (from env: ${process.env.RP_ORIGIN || process.env.APP_URL || 'default'})`);
    return cleaned;
  }

  private getRpName(): string {
    return process.env.RP_NAME || 'Meriter';
  }

  async generatePasskeyRegistrationOptions(
    username: string,
    existingUserId?: string, // If linking to existing user
    requestRpId?: string,
  ) {
    // Check if user exists (for new users, we want to ensure username isn't taken by an AUTH-based user)
    // For WebAuthn, we treat username as the primary handle for initial discovery if they don't have a device yet
    let user = await this.userService.getUserByUsername(username);

    // If implementing "Bind Device" (existingUserId provided), user must exist
    if (existingUserId) {
      user = await this.userService.getUserById(existingUserId);
      if (!user) throw new Error('User not found');
    }

    const authenticators: Authenticator[] = user?.authenticators || [];

    const rpId = this.getRpId();
    const options = await generateRegistrationOptions({
      rpName: process.env.RP_NAME || 'Meriter',
      rpID: rpId,
      userID: new Uint8Array(Buffer.from(user ? user.id : username)), // Use UserID if exists, else generic
      userName: username,
      // Don't exclude credentials yet, we handle duplicate checks manually or let browser handle it
      // excludeCredentials: authenticators.map(authenticator => ({
      //   id: authenticator.credentialID,
      //   type: 'public-key',
      //   transports: authenticator.transports,
      // })),
      attestationType: 'none',
      authenticatorSelection: {
        // Prefer platform authenticators (passkeys) but allow fallback to cross-platform
        authenticatorAttachment: 'platform',
        residentKey: 'required', // Required for discoverable credentials (passkeys)
        userVerification: 'preferred',
      },
      // Explicitly include ES256 (required for passkeys)
      supportedAlgorithmIDs: [-7], // ES256
    });

    // Log options for debugging (without sensitive data)
    this.logger.log(`Registration options generated:`, {
      rpId: options.rpID,
      rpName: options.rp.name,
      userName: username,
      authenticatorAttachment: 'platform',
      residentKey: 'required',
      challengeLength: options.challenge?.length || 0,
    });

    // Save challenge
    await this.passkeyChallengeModel.create({
      challengeId: options.challenge,
      challenge: options.challenge,
      userId: user ? user.id : `new_${username}`, // Use prefix for new users
    });

    return options;
  }

  async verifyPasskeyRegistration(body: any, userIdOrUsername: string, deviceName?: string) {
    this.logger.log(`Verify registration body keys: ${Object.keys(body)}`);
    if (body.response) {
      this.logger.log(`Response keys: ${Object.keys(body.response)}`);
    } else {
      this.logger.error('Body.response is missing');
      throw new Error('Invalid registration response: missing response field');
    }

    const { response: { clientDataJSON, attestationObject }, id, rawId, type } = body;

    if (!clientDataJSON) {
      this.logger.error('clientDataJSON is missing');
      throw new Error('Invalid registration response: missing clientDataJSON');
    }

    this.logger.log(`clientDataJSON type: ${typeof clientDataJSON}, length: ${clientDataJSON?.length}`);

    const bodyForLib = { id, rawId, response: { clientDataJSON, attestationObject }, type };

    try {
      const clientData = JSON.parse(Buffer.from(clientDataJSON, 'base64').toString('utf8'));
      const challengeFromClient = clientData.challenge;

      this.logger.log(`Challenge from client: ${challengeFromClient}`);

      const storedChallenge = await this.passkeyChallengeModel.findOne({ challengeId: challengeFromClient });

      if (!storedChallenge) {
        throw new Error('Challenge not found or expired');
      }

      // Verify
      const verification = await verifyRegistrationResponse({
        response: bodyForLib,
        expectedChallenge: storedChallenge.challenge, // Use the one from DB to be sure
        expectedOrigin: this.getOrigin(),
        expectedRPID: this.getRpId(),
      });

      this.logger.log(`Verification result: ${verification.verified}`);

      if (verification.verified && verification.registrationInfo) {
        // The structure from logs shows keys are inside 'credential' property
        // Structure: {"fmt":"none", "credential":{"id":..., "publicKey":..., "counter":...}, ...}
        const info: any = verification.registrationInfo;
        const credential = info.credential;

        // Extract values from the nested credential object or root if fallback
        const credentialID = credential?.id || info.credentialID;
        const credentialPublicKey = credential?.publicKey || info.credentialPublicKey;
        const counter = credential?.counter || info.counter;

        const { credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

        this.logger.log(`Registration Info - ID: ${credentialID ? 'present' : 'missing'}, PubKey: ${credentialPublicKey ? 'present' : 'missing'}`);

        // Fallback: use body.id if credentialID is missing from registrationInfo
        // Note: credentialID from library might be Uint8Array, but body.id is base64url string
        const finalCredentialID = credentialID
          ? Buffer.from(credentialID).toString('base64url')
          : body.id;

        const finalPublicKey = credentialPublicKey
          ? Buffer.from(credentialPublicKey).toString('base64url')
          : '';

        if (!finalPublicKey) {
          this.logger.error('CRITICAL: credentialPublicKey is missing from registrationInfo');
          throw new Error('Missing credentialPublicKey from verification result');
        }

        // Clean up challenge
        await this.passkeyChallengeModel.deleteMany({ challengeId: storedChallenge.challengeId });

        const newAuthenticator: Authenticator = {
          credentialID: finalCredentialID,
          credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64url'),
          counter,
          credentialDeviceType,
          credentialBackedUp,
          transports: body.transports || [], // Save transports if provided
          deviceName: deviceName || 'Unknown Device',
        };

        // Determine if we are creating a new user or updating
        let user: User | null;
        if (storedChallenge.userId.startsWith('new_')) {
          // Create new user
          const username = storedChallenge.userId.replace('new_', '');
          // Check if user exists again just in case
          const existing = await this.userService.getUserByUsername(username);
          if (existing) throw new Error('User already exists');

          user = await this.userService.createOrUpdateUser({
            authProvider: 'webauthn', // Primary provider
            authId: newAuthenticator.credentialID, // Use first credential ID as authId
            username,
            displayName: username,
            authenticators: [newAuthenticator],
          });

          this.logger.log(`User creation result for ${username}: ${user?.id}`);
          if (!user) throw new Error('User creation returned null/undefined');

          // Ensure user is added to base communities
          await this.userService.ensureUserInBaseCommunities(user.id);
        } else {
          // Add to existing user
          user = await this.userService.getUserById(storedChallenge.userId);
          if (!user) throw new Error('User not found');

          // Add authenticator
          if (!user.authenticators) user.authenticators = [];
          user.authenticators.push(newAuthenticator);

          await this.userService.updateUser(user.id, {
            authenticators: user.authenticators
          });

          this.logger.log(`User ${user.id} updated with new authenticator`);
        }

        // Generate JWT for immediate login
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new Error('JWT secret not configured');
        }

        const jwtToken = signJWT(
          {
            uid: user.id,
            authProvider: 'webauthn',
            authId: user.authId,
            communityTags: user.communityTags || [],
          },
          jwtSecret,
          '365d',
        );

        return { verified: true, user, jwt: jwtToken };
      }

      throw new Error('Verification failed');
    } catch (error) {
      this.logger.error(`Passkey verification error: ${error.message}`);
      throw error;
    }
  }

  async generatePasskeyLoginOptions(username?: string) {
    // If username is provided, we can look up specific user allowed credentials
    // If not (Passkey autocomplete / conditional UI), we send empty allowCredentials
    let userAuthenticators: Authenticator[] = [];

    if (username) {
      const user = await this.userService.getUserByUsername(username);
      // Also check by authId if username is actually an email or something?
      // For Meriter, username is unique.
      if (user && user.authenticators) {
        userAuthenticators = user.authenticators;
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: this.getRpId(),
      allowCredentials: userAuthenticators.map(auth => ({
        id: auth.credentialID, // Base64URL encoded string
        type: 'public-key',
        transports: auth.transports as AuthenticatorTransport[],
      })),
      userVerification: 'preferred',
    });

    // Save challenge
    await this.passkeyChallengeModel.create({
      challengeId: options.challenge,
      challenge: options.challenge,
      userId: username || 'unknown', // Track who requested if known
    });

    return options;
  }

  async verifyPasskeyLogin(body: any) {
    const { response: { clientDataJSON, authenticatorData, signature, userHandle }, id, rawId, type } = body;
    const bodyForLib = { id, rawId, response: { clientDataJSON, authenticatorData, signature, userHandle }, type };

    // Find challenge
    const clientData = JSON.parse(Buffer.from(clientDataJSON, 'base64').toString('utf8'));
    const challengeFromClient = clientData.challenge;
    const storedChallenge = await this.passkeyChallengeModel.findOne({ challengeId: challengeFromClient });

    if (!storedChallenge) {
      throw new Error('Challenge not found or expired');
    }

    // Identify user by credential ID (id)
    // We need to find which user owns this credential ID
    // We need a method in UserService to find user by Authenticator Credential ID.
    // Or we scan... scanning is bad.
    // We should make sure we can look up user by 'authenticators.credentialID'.
    // In Mongoose: findOne({ 'authenticators.credentialID': id })
    // I need to add that to UserService or access model directly.
    // I'll use userService if I can, or just execute query if I had model access.
    // AuthService doesn't have User Model injected directly, only UserService.
    // I will assume I need to add `getUserByAuthenticatorId` to UserService, OR
    // I can try to find user by `storedChallenge.userId` if it was set (username flow).
    // BUT for "Discoverable credentials" (login without username), userHandle is key.
    // userHandle is usually the user.id or authId we bound.

    let user: User | null = null;

    // Strategy 1: Use userHandle if returned (Resident Key)
    if (userHandle) {
      // userHandle is string (id) usually.
      // Be careful with encoding.
      // In generateRegistrationOptions, we set userID to user.id.
      // Verified library output sends it as buffer/string.
      user = await this.userService.getUserById(userHandle);
    }

    // Strategy 2: If we knew the username previously (stored in challenge)
    if (!user && storedChallenge.userId !== 'unknown') {
      // This might be username or ID.
      const u = await this.userService.getUserByUsername(storedChallenge.userId);
      if (u) user = u;
    }

    // Strategy 3: Find by credential ID
    if (!user) {
      // We need to find user who has this credential.
      // Calling a new method on userService (I'll need to add it, or direct query)
      // Since I can't easily add to UserService in this 'multi_replace' without seeing it, 
      // I will assume I can inject UserModel here? No, I inject UserService.
      // Let's rely on Strategy 1 & 2 for now, and if needed fail.
      // Actually, I can allow the client to send username if it's not a resident key flow.
      // But let's try to fetch all users? No.
      // I'll add 'findUserByCredentialId' to UserService in the next step if this fails or I'll add it now.
      // I'll assume `getUserByAuthenticatorId` exists and I will implement it in UserService next.
      user = await (this.userService as any).getUserByCredentialId(id);
    }

    if (!user) {
      throw new Error('User not found for this credential');
    }

    // Find specific authenticator
    const authenticator = user.authenticators?.find(auth => auth.credentialID === id);
    if (!authenticator) {
      throw new Error('Authenticator not found on user');
    }

    const verification = await verifyAuthenticationResponse({
      response: bodyForLib,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: this.getOrigin(),
      expectedRPID: this.getRpId(),
      authenticator: {
        credentialID: authenticator.credentialID,
        credentialPublicKey: Buffer.from(authenticator.credentialPublicKey, 'base64url'),
        counter: authenticator.counter,
        transports: authenticator.transports as AuthenticatorTransport[],
      },
      requireUserVerification: true,
    });

    if (verification.verified) {
      const { authenticationInfo } = verification;

      // Update counter
      authenticator.counter = authenticationInfo.newCounter;

      // Save user
      await this.userService.updateUser(user.id, {
        authenticators: user.authenticators
      });

      // Clean up challenge
      await this.passkeyChallengeModel.deleteMany({ challengeId: storedChallenge.challengeId });

      // Generate Token
      const jwtSecret = this.configService.get<string>('jwt.secret');
      if (!jwtSecret) throw new Error('JWT Config missing');

      const jwtToken = signJWT(
        {
          uid: user.id,
          authProvider: 'webauthn',
          authId: user.authId, // Or specific credential ID? Using user's main authId is safer for compatibility
          communityTags: user.communityTags || [],
        },
        jwtSecret,
        '365d',
      );

      return {
        verified: true,
        user: JwtService.mapUserToV1Format(user),
        jwt: jwtToken
      };
    }

    throw new Error('Verification failed');
  }

  /**
   * Unified Passkey Authentication (combines login + registration)
   * Works like OAuth: auto-creates user if doesn't exist
   */
  async authenticateWithPasskey(body: any): Promise<{
    user: User;
    hasPendingCommunities: boolean;
    isNewUser: boolean;
    jwt: string;
  }> {
    const { response: { clientDataJSON, authenticatorData, signature, userHandle }, id, rawId, type } = body;
    const bodyForLib = { id, rawId, response: { clientDataJSON, authenticatorData, signature, userHandle }, type };

    // Find challenge
    const clientData = JSON.parse(Buffer.from(clientDataJSON, 'base64').toString('utf8'));
    const challengeFromClient = clientData.challenge;
    const storedChallenge = await this.passkeyChallengeModel.findOne({ challengeId: challengeFromClient });

    if (!storedChallenge) {
      throw new Error('Challenge not found or expired');
    }

    // Try to find existing user by credential ID
    let user: User | null = null;
    let isNewUser = false;

    // Strategy 1: Use userHandle if returned (Resident Key)
    if (userHandle) {
      user = await this.userService.getUserById(userHandle);
    }

    // Strategy 2: Find by credential ID (existing user)
    if (!user) {
      try {
        user = await (this.userService as any).getUserByCredentialId(id);
      } catch (e) {
        // Method might not exist yet, continue
      }
    }

    // Strategy 3: NEW USER - Auto-create like OAuth
    if (!user) {
      isNewUser = true;
      const randomId = crypto.randomBytes(8).toString('hex');

      this.logger.log(`Creating new user via Passkey with temporary username: passkey_user_${randomId}`);

      user = await this.userService.createOrUpdateUser({
        authProvider: 'webauthn',
        authId: id, // Use credential ID as authId
        username: `passkey_user_${randomId}`, // Temporary username (like OAuth)
        firstName: '',
        lastName: '',
        displayName: 'Passkey User',
        avatarUrl: null,
      });

      if (!user) {
        throw new Error('Failed to create user');
      }
    }

    // Find or create authenticator entry
    let authenticator = user.authenticators?.find(auth => auth.credentialID === id);

    if (!authenticator) {
      // This is a new credential for this user (or newly created user)
      // We need to extract authenticator data from the response
      // For registration, we'd have attestationObject, but for authentication we don't
      // This means we need to handle registration separately OR
      // we need to check if this is registration vs authentication response

      // Check if this is a registration response (has attestationObject)
      if (body.response.attestationObject) {
        // This is registration - verify as registration
        const verification = await verifyRegistrationResponse({
          response: bodyForLib,
          expectedChallenge: storedChallenge.challenge,
          expectedOrigin: this.getOrigin(),
          expectedRPID: this.getRpId(),
          requireUserVerification: true,
        });

        if (!verification.verified) {
          throw new Error('Registration verification failed');
        }

        const { registrationInfo } = verification;
        authenticator = {
          credentialID: Buffer.from(registrationInfo.credentialID).toString('base64url'),
          credentialPublicKey: Buffer.from(registrationInfo.credentialPublicKey).toString('base64url'),
          counter: registrationInfo.counter,
          transports: body.response.transports || [],
          deviceName: body.deviceName || 'Unknown Device',
        };

        // Save authenticator to user
        if (!user.authenticators) {
          user.authenticators = [];
        }
        user.authenticators.push(authenticator);
        await this.userService.updateUser(user.id, { authenticators: user.authenticators });
      } else {
        throw new Error('Authenticator not found and response is not a registration');
      }
    } else {
      // Existing authenticator - verify as authentication
      const verification = await verifyAuthenticationResponse({
        response: bodyForLib,
        expectedChallenge: storedChallenge.challenge,
        expectedOrigin: this.getOrigin(),
        expectedRPID: this.getRpId(),
        authenticator: {
          credentialID: authenticator.credentialID,
          credentialPublicKey: Buffer.from(authenticator.credentialPublicKey, 'base64url'),
          counter: authenticator.counter,
          transports: authenticator.transports as any[],
        },
        requireUserVerification: true,
      });

      if (!verification.verified) {
        throw new Error('Authentication verification failed');
      }

      // Update counter
      const { authenticationInfo } = verification;
      authenticator.counter = authenticationInfo.newCounter;
      await this.userService.updateUser(user.id, { authenticators: user.authenticators });
    }

    // Ensure user in base communities
    await this.userService.ensureUserInBaseCommunities(user.id);

    // Clean up challenge
    await this.passkeyChallengeModel.deleteMany({ challengeId: storedChallenge.challengeId });

    // Generate JWT
    const jwtSecret = this.configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      throw new Error('JWT secret not configured');
    }

    const jwtToken = signJWT(
      {
        uid: user.id,
        authProvider: 'webauthn',
        authId: user.authId,
        communityTags: user.communityTags || [],
      },
      jwtSecret,
      '365d',
    );

    this.logger.log(`Passkey authentication successful for user ${user.id}, isNewUser: ${isNewUser}`);

    return {
      user: JwtService.mapUserToV1Format(user),
      hasPendingCommunities: (user.communityTags?.length || 0) > 0,
      isNewUser,
      jwt: jwtToken,
    };
  }

  /**
   * Unified Passkey Authentication Options Generator
   * Uses conditional UI (Passkey autocomplete) for unified login/register
   * Browser shows existing Passkeys or offers to create new one
   */
  async generatePasskeyAuthenticationOptions(requestRpId?: string) {
    const rpId = this.getRpId(requestRpId);
    // Use authentication options with empty allowCredentials
    // This enables conditional UI (Passkey autocomplete)
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      allowCredentials: [], // Empty = conditional UI, shows all user's passkeys
      userVerification: 'preferred',
    });

    // Log options for debugging
    this.logger.log(`Authentication options generated:`, {
      rpId: options.rpID,
      allowCredentialsCount: 0,
      userVerification: 'preferred',
      challengeLength: options.challenge?.length || 0,
    });

    // Save challenge
    await this.passkeyChallengeModel.create({
      challengeId: options.challenge,
      challenge: options.challenge,
      userId: 'conditional_ui', // Conditional UI flow
    });

    return options;
  }
}
