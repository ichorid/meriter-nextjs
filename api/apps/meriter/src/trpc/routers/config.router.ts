import { router, publicProcedure } from '../trpc';
import { AppConfig } from '../../config/configuration';

export const configRouter = router({
  /**
   * Get public configuration
   */
  getConfig: publicProcedure.query(async ({ ctx }) => {
    // Use ConfigService from context instead of process.env
    // ConfigService properly loads .env files via NestJS ConfigModule
    if (!ctx.configService) {
      throw new Error('ConfigService is not available in context');
    }
    const configService = ctx.configService;
    
    // Get BOT_USERNAME from environment (optional)
    const botUsername = configService.get('bot.username')?.trim() || null;

    // OAuth provider flags - read from typed ConfigService
    const oauth = {
      google: configService.get('oauth.google.enabled', false),
      yandex: configService.get('oauth.yandex.enabled', false),
      vk: configService.get('oauth.vk.enabled', false),
      telegram: configService.get('oauth.telegram.enabled', false),
      apple: configService.get('oauth.apple.enabled', false),
      twitter: configService.get('oauth.twitter.enabled', false),
      instagram: configService.get('oauth.instagram.enabled', false),
      sber: configService.get('oauth.sber.enabled', false),
      mailru: configService.get('oauth.mailru.enabled', false),
    };

    // AUTHN (WebAuthn/Passkey) flag
    const authn = {
      enabled: configService.get('authn.enabled', false),
    };

    // Feature flags - use typed ConfigService
    const features = {
      analytics: configService.get('features.analytics', false),
      debug: configService.get('features.debug', false),
      commentVoting: configService.get('features.commentVoting', false),
      commentImageUploads: configService.get('features.commentImageUploadsEnabled', false),
      loginInviteForm: configService.get('features.loginInviteForm', false),
    };

    return {
      botUsername,
      oauth,
      authn,
      features,
    };
  }),
});

