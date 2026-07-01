import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AUTH_PROVIDER_PORT } from '../../domain/ports/auth-provider.port';
import { SMS_OTP_PROVIDER_PORT } from '../../domain/ports/sms-otp-provider.port';
import { EMAIL_LOGIN_LINK_PORT } from '../../domain/ports/email-login-link.port';
import { MAGIC_LINK_AUTH_PORT } from '../../domain/ports/magic-link-auth.port';

import { AuthProviderService } from './auth-provider.service';
import { SmsProviderService } from './sms-otp-provider.service';
import { EmailLoginLinkService } from './email-login-link.service';
import { AuthMagicLinkService } from './magic-link-auth.service';

import {
  CommunitySchemaClass,
  CommunitySchema,
} from '../../domain/models/community/community.schema';
import {
  PasskeyChallenge,
  PasskeyChallengeSchema,
} from '../../domain/models/auth/passkey-challenge.schema';
import { SmsOtp, SmsOtpSchema } from '../../domain/models/auth/sms-otp.schema';
import {
  AuthMagicLink,
  AuthMagicLinkSchema,
} from '../../domain/models/auth/auth-magic-link.schema';
import { DomainModule } from '../../domain.module';
import { TelegramInfrastructureModule } from '../telegram/telegram.module';

@Module({
  imports: [
    DomainModule,
    TelegramInfrastructureModule,
    MongooseModule.forFeature([
      { name: CommunitySchemaClass.name, schema: CommunitySchema },
      { name: PasskeyChallenge.name, schema: PasskeyChallengeSchema },
      { name: SmsOtp.name, schema: SmsOtpSchema },
      { name: AuthMagicLink.name, schema: AuthMagicLinkSchema },
    ]),
  ],
  providers: [
    AuthProviderService,
    SmsProviderService,
    EmailLoginLinkService,
    AuthMagicLinkService,
    { provide: AUTH_PROVIDER_PORT, useExisting: AuthProviderService },
    { provide: SMS_OTP_PROVIDER_PORT, useExisting: SmsProviderService },
    { provide: EMAIL_LOGIN_LINK_PORT, useExisting: EmailLoginLinkService },
    { provide: MAGIC_LINK_AUTH_PORT, useExisting: AuthMagicLinkService },
  ],
  exports: [
    AuthProviderService,
    SmsProviderService,
    EmailLoginLinkService,
    AuthMagicLinkService,
    AUTH_PROVIDER_PORT,
    SMS_OTP_PROVIDER_PORT,
    EMAIL_LOGIN_LINK_PORT,
    MAGIC_LINK_AUTH_PORT,
  ],
})
export class InfrastructureAuthModule {}
