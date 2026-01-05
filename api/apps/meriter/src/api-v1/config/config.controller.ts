import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiResponseHelper } from '../common/helpers/api-response.helper';

type PublicRuntimeConfig = {
  botUsername: string | null;
  oauth: {
    google: boolean;
    yandex: boolean;
    vk: boolean;
    telegram: boolean;
    apple: boolean;
    twitter: boolean;
    instagram: boolean;
    sber: boolean;
    mailru: boolean;
  };
  authn: {
    enabled: boolean;
  };
  sms: {
    enabled: boolean;
  };
  phone: {
    enabled: boolean;
  };
  email: {
    enabled: boolean;
  };
  features: {
    analytics: boolean;
    debug: boolean;
    commentVoting: boolean;
    commentImageUploads: boolean;
    loginInviteForm: boolean;
  };
};

@Controller('api/v1/config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) { }

  /**
   * Public runtime config for the SPA bootstrap.
   * Intentionally unauthenticated.
   */
  @Get()
  getConfig(): { success: true; data: PublicRuntimeConfig } {
    const botUsername = this.configService.get<string | undefined>('bot.username')?.trim() || null;

    const oauth = {
      google: this.configService.get('oauth.google.enabled', false),
      yandex: this.configService.get('oauth.yandex.enabled', false),
      vk: this.configService.get('oauth.vk.enabled', false),
      telegram: this.configService.get('oauth.telegram.enabled', false),
      apple: this.configService.get('oauth.apple.enabled', false),
      twitter: this.configService.get('oauth.twitter.enabled', false),
      instagram: this.configService.get('oauth.instagram.enabled', false),
      sber: this.configService.get('oauth.sber.enabled', false),
      mailru: this.configService.get('oauth.mailru.enabled', false),
    } satisfies PublicRuntimeConfig['oauth'];

    const authn = {
      enabled: this.configService.get('authn.enabled', false),
    } satisfies PublicRuntimeConfig['authn'];

    const sms = {
      enabled: this.configService.get('sms.enabled', false),
    } satisfies PublicRuntimeConfig['sms'];

    const phone = {
      enabled: this.configService.get('phone.enabled', false),
    } satisfies PublicRuntimeConfig['phone'];

    const email = {
      enabled: this.configService.get('email.enabled', false),
    } satisfies PublicRuntimeConfig['email'];

    const features = {
      analytics: this.configService.get('features.analytics', false),
      debug: this.configService.get('features.debug', false),
      commentVoting: this.configService.get('features.commentVoting', false),
      commentImageUploads: this.configService.get('features.commentImageUploadsEnabled', false),
      loginInviteForm: this.configService.get('features.loginInviteForm', false),
    } satisfies PublicRuntimeConfig['features'];

    return ApiResponseHelper.successResponse({
      botUsername,
      oauth,
      authn,
      sms,
      phone,
      email,
      features,
    });
  }
}


