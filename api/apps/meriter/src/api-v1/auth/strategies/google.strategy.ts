import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';

/**
 * Google OAuth Strategy
 * 
 * One of many possible authentication providers.
 * Uses Passport Google OAuth20 strategy according to NestJS documentation.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(private configService: ConfigService<AppConfig>) {
    // Use configService parameter directly (not this.configService) before super()
    const clientID = configService.get('oauth.google.clientId');
    const clientSecret = configService.get('oauth.google.clientSecret');
    // Support both OAUTH_GOOGLE_REDIRECT_URI and GOOGLE_REDIRECT_URI
    const callbackURL = configService.get('oauth.google.redirectUri')
      || configService.get('GOOGLE_REDIRECT_URI');

    // This strategy should only be instantiated if credentials are present
    // AuthModule checks this before registering the strategy
    if (!clientID || !clientSecret || !callbackURL) {
      throw new Error(
        'Google OAuth credentials not configured. ' +
        'Set OAUTH_GOOGLE_CLIENT_ID, OAUTH_GOOGLE_CLIENT_SECRET, and OAUTH_GOOGLE_REDIRECT_URI. ' +
        'GoogleStrategy should not be registered if credentials are missing.'
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      accessType: 'offline',
      prompt: 'consent',
      // Pass state parameter through OAuth flow for return_url
      passReqToCallback: true,
    });

    // Now we can use this.logger after super()
    const logger = new Logger(GoogleStrategy.name);
    logger.log(`Google OAuth strategy initialized with callbackURL: ${callbackURL}`);
  }

  /**
   * Validate callback from Google OAuth
   * Called by Passport after successful OAuth flow
   * State parameter (with return_url) is available in req.query.state
   */
  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;
    
    // State parameter contains return_url - will be extracted in controller
    const state = req.query?.state;
    
    const user = {
      provider: 'google',
      providerId: id,
      email: emails[0]?.value,
      firstName: name?.givenName || '',
      lastName: name?.familyName || '',
      displayName: name?.displayName || emails[0]?.value,
      avatarUrl: photos[0]?.value,
      accessToken,
      refreshToken,
      state, // Pass state through for return_url extraction
    };

    this.logger.log(`Google OAuth validation successful for user: ${user.email}`);

    done(null, user);
  }
}

