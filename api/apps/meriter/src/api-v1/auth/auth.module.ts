import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DomainModule } from '../../domain.module';
import { CommunitySchemaClass, CommunitySchema } from '../../domain/models/community/community.schema';
import { PasskeyChallenge, PasskeyChallengeSchema } from '../../domain/models/auth/passkey-challenge.schema';
import { GoogleStrategy } from './strategies/google.strategy';

// Conditionally import GoogleStrategy only if Google OAuth is configured
// Google is one of many possible auth providers - it's optional
function getGoogleStrategy() {
  // Check if Google OAuth is explicitly disabled
  const enabled = process.env.OAUTH_GOOGLE_ENABLED;
  if (enabled === 'false' || enabled === '0') {
    return null; // Explicitly disabled
  }

  const clientID = process.env.OAUTH_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GOOGLE_CLIENT_SECRET;
  // Support both OAUTH_GOOGLE_REDIRECT_URI and OAUTH_GOOGLE_CALLBACK_URL
  const callbackURL = process.env.OAUTH_GOOGLE_REDIRECT_URI
    || process.env.OAUTH_GOOGLE_CALLBACK_URL
    || process.env.GOOGLE_REDIRECT_URI;

  // Only register GoogleStrategy if all credentials are present
  // If OAUTH_GOOGLE_ENABLED is 'true', require credentials; otherwise allow auto-detection
  if (enabled === 'true') {
    // Explicitly enabled - require all credentials
    if (!clientID || !clientSecret || !callbackURL) {
      return null;
    }
  } else if (!clientID || !clientSecret || !callbackURL) {
    // Not explicitly enabled and credentials missing - skip
    return null;
  }

  // All credentials present - use strategy
  return GoogleStrategy;
}

const GoogleStrategy = getGoogleStrategy();

@Module({
  imports: [
    DomainModule,
    PassportModule,
    MongooseModule.forFeature([
      { name: CommunitySchemaClass.name, schema: CommunitySchema },
      { name: PasskeyChallenge.name, schema: PasskeyChallengeSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Conditionally register GoogleStrategy only if Google OAuth is configured
    ...(GoogleStrategy ? [GoogleStrategy] : []),
  ],
  exports: [AuthService],
})
export class AuthModule { }
