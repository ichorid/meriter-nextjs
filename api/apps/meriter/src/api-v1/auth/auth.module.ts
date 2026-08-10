import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from '../../adapters/rest/auth.controller';
import { DomainModule } from '../../domain.module';
import { ApiV1CommonModule } from '../common/common.module';
import { InfrastructureAuthModule } from '../../infrastructure/auth/infrastructure-auth.module';

function getGoogleStrategy() {
  const enabled = process.env.OAUTH_GOOGLE_ENABLED;
  if (enabled === 'false' || enabled === '0') {
    return null;
  }

  const clientID = process.env.OAUTH_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GOOGLE_CLIENT_SECRET;
  const callbackURL =
    process.env.OAUTH_GOOGLE_REDIRECT_URI ||
    process.env.OAUTH_GOOGLE_CALLBACK_URL ||
    process.env.GOOGLE_REDIRECT_URI;

  if (enabled === 'true') {
    if (!clientID || !clientSecret || !callbackURL) {
      return null;
    }
  } else if (!clientID || !clientSecret || !callbackURL) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleStrategy } = require('./strategies/google.strategy');
    return GoogleStrategy;
  } catch {
    return null;
  }
}

const GoogleStrategy = getGoogleStrategy();

@Module({
  imports: [
    DomainModule,
    ApiV1CommonModule,
    PassportModule,
    InfrastructureAuthModule,
  ],
  controllers: [AuthController],
  providers: [...(GoogleStrategy ? [GoogleStrategy] : [])],
  exports: [InfrastructureAuthModule],
})
export class AuthModule {}
