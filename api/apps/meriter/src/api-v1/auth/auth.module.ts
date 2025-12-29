import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthProviderService } from './auth.service';
import { SmsProviderService } from './sms-provider.service';
import { DomainModule } from '../../domain.module';
import { ApiV1CommonModule } from '../common/common.module';
import { CommunitySchemaClass, CommunitySchema } from '../../domain/models/community/community.schema';
import { PasskeyChallenge, PasskeyChallengeSchema } from '../../domain/models/auth/passkey-challenge.schema';
import { SmsOtp, SmsOtpSchema } from '../../domain/models/auth/sms-otp.schema';

// Conditionally import GoogleStrategy only if Google OAuth is configured
// Google is one of many possible auth providers - it's optional
// Note: This function runs at module load time, before DI is available.
// We use process.env directly here as ConfigService is not available at module definition time.
// The actual strategy constructor will use ConfigService via DI.
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

  // All credentials present - try to load strategy
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleStrategy } = require('./strategies/google.strategy');
    return GoogleStrategy;
  } catch (_e) {
    // Strategy file doesn't exist or has errors - skip it
    return null;
  }
}

const GoogleStrategy = getGoogleStrategy();

@Module({
  imports: [
    DomainModule,
    ApiV1CommonModule,
    PassportModule,
    MongooseModule.forFeature([
      { name: CommunitySchemaClass.name, schema: CommunitySchema },
      { name: PasskeyChallenge.name, schema: PasskeyChallengeSchema },
      { name: SmsOtp.name, schema: SmsOtpSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthProviderService,
    SmsProviderService,
    // Conditionally register GoogleStrategy only if Google OAuth is configured
    ...(GoogleStrategy ? [GoogleStrategy] : []),
  ],
  exports: [AuthProviderService],
})
export class AuthModule { }
