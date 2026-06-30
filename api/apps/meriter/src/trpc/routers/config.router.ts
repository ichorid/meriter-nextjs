import { router, publicProcedure } from '../trpc';

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
    const botUsername = ((configService.get as any)('bot.username') as string | undefined)?.trim() || null;

    // OAuth provider flags - read from typed ConfigService
    const oauth = {
      google: ((configService.get as any)('oauth.google.enabled') ?? false) as boolean,
      yandex: ((configService.get as any)('oauth.yandex.enabled') ?? false) as boolean,
      vk: ((configService.get as any)('oauth.vk.enabled') ?? false) as boolean,
      telegram: ((configService.get as any)('oauth.telegram.enabled') ?? false) as boolean,
      apple: ((configService.get as any)('oauth.apple.enabled') ?? false) as boolean,
      twitter: ((configService.get as any)('oauth.twitter.enabled') ?? false) as boolean,
      instagram: ((configService.get as any)('oauth.instagram.enabled') ?? false) as boolean,
      sber: ((configService.get as any)('oauth.sber.enabled') ?? false) as boolean,
      mailru: ((configService.get as any)('oauth.mailru.enabled') ?? false) as boolean,
    };

    // AUTHN (WebAuthn/Passkey) flag
    const authn = {
      enabled: ((configService.get as any)('authn.enabled') ?? false) as boolean,
    };

    // SMS authentication flag
    const sms = {
      enabled: ((configService.get as any)('sms.enabled') ?? false) as boolean,
    };

    // Feature flags - use typed ConfigService
    const features = {
      analytics: ((configService.get as any)('features.analytics') ?? false) as boolean,
      debug: ((configService.get as any)('features.debug') ?? false) as boolean,
      commentVoting: ((configService.get as any)('features.commentVoting') ?? false) as boolean,
      commentImageUploads: ((configService.get as any)('features.commentImageUploadsEnabled') ?? false) as boolean,
      loginInviteForm: ((configService.get as any)('features.loginInviteForm') ?? false) as boolean,
    };

    return {
      botUsername,
      oauth,
      authn,
      sms,
      features,
    };
  }),
});

