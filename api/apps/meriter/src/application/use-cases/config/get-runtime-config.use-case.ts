import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';
import {
  PERMISSION_GATES_PORT,
  PermissionGatesPort,
} from '../../../domain/ports/permission-gates.port';

export type PublicRuntimeConfig = {
  botUsername: string | null;
  devFakeAuthEnabled: boolean;
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

/**
 * BC-12 inv-17: public SPA bootstrap config — typed ConfigService paths only; no secrets.
 * inv-19: commentVoting feature flag delegates to PermissionGatesPort (V-07 closure).
 */
@Injectable()
export class GetRuntimeConfigUseCase {
  constructor(
    private readonly configService: ConfigService<AppConfig>,
    @Inject(PERMISSION_GATES_PORT)
    private readonly permissionGates: PermissionGatesPort,
  ) {}

  execute(): PublicRuntimeConfig {
    const botUsername =
      this.configService.get<string | undefined>('bot.username')?.trim() || null;

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
      commentVoting: this.permissionGates.isCommentVotingEnabled(),
      commentImageUploads: this.configService.get(
        'features.commentImageUploadsEnabled',
        false,
      ),
      loginInviteForm: this.configService.get('features.loginInviteForm', false),
    } satisfies PublicRuntimeConfig['features'];

    return {
      botUsername,
      devFakeAuthEnabled:
        (this.configService.get('dev')?.fakeDataMode ?? false) ||
        (this.configService.get('dev')?.testAuthMode ?? false),
      oauth,
      authn,
      sms,
      phone,
      email,
      features,
    };
  }
}

export function createGetRuntimeConfigUseCase(deps: {
  configService: ConfigService<AppConfig>;
  permissionGates: PermissionGatesPort;
}): GetRuntimeConfigUseCase {
  return new GetRuntimeConfigUseCase(deps.configService, deps.permissionGates);
}
