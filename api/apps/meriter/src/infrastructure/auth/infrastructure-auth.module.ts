import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AUTH_PROVIDER_PORT } from '../../domain/ports/auth-provider.port';
import { SMS_OTP_PROVIDER_PORT } from '../../domain/ports/sms-otp-provider.port';
import { EMAIL_OTP_PROVIDER_PORT } from '../../domain/ports/email-otp-provider.port';
import { MAGIC_LINK_AUTH_PORT } from '../../domain/ports/magic-link-auth.port';

import { AuthProviderService } from './auth-provider.service';
import { SmsProviderService } from './sms-otp-provider.service';
import { EmailProviderService } from './email-otp-provider.service';
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
import { EmailOtp, EmailOtpSchema } from '../../domain/models/auth/email-otp.schema';
import {
  AuthMagicLink,
  AuthMagicLinkSchema,
} from '../../domain/models/auth/auth-magic-link.schema';
import { DomainModule } from '../../domain.module';

@Module({
  imports: [
    DomainModule,
    MongooseModule.forFeature([
      { name: CommunitySchemaClass.name, schema: CommunitySchema },
      { name: PasskeyChallenge.name, schema: PasskeyChallengeSchema },
      { name: SmsOtp.name, schema: SmsOtpSchema },
      { name: EmailOtp.name, schema: EmailOtpSchema },
      { name: AuthMagicLink.name, schema: AuthMagicLinkSchema },
    ]),
  ],
  providers: [
    AuthProviderService,
    SmsProviderService,
    EmailProviderService,
    AuthMagicLinkService,
    { provide: AUTH_PROVIDER_PORT, useExisting: AuthProviderService },
    { provide: SMS_OTP_PROVIDER_PORT, useExisting: SmsProviderService },
    { provide: EMAIL_OTP_PROVIDER_PORT, useExisting: EmailProviderService },
    { provide: MAGIC_LINK_AUTH_PORT, useExisting: AuthMagicLinkService },
  ],
  exports: [
    AuthProviderService,
    SmsProviderService,
    EmailProviderService,
    AuthMagicLinkService,
    AUTH_PROVIDER_PORT,
    SMS_OTP_PROVIDER_PORT,
    EMAIL_OTP_PROVIDER_PORT,
    MAGIC_LINK_AUTH_PORT,
  ],
})
export class InfrastructureAuthModule {}
