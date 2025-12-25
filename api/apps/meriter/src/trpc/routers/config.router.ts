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
    
    // Debug: Log environment variables to verify they're loaded
    // Try both ConfigService and process.env as fallback
    const oauthGoogleEnabled = configService.get<string>('OAUTH_GOOGLE_ENABLED') || process.env.OAUTH_GOOGLE_ENABLED;
    const authnEnabled = configService.get<string>('AUTHN_ENABLED') || process.env.AUTHN_ENABLED;
    console.log('[config.getConfig] Environment check:', {
      'configService.OAUTH_GOOGLE_ENABLED': configService.get('OAUTH_GOOGLE_ENABLED'),
      'process.env.OAUTH_GOOGLE_ENABLED': process.env.OAUTH_GOOGLE_ENABLED,
      'configService.AUTHN_ENABLED': configService.get('AUTHN_ENABLED'),
      'process.env.AUTHN_ENABLED': process.env.AUTHN_ENABLED,
      'final oauthGoogleEnabled': oauthGoogleEnabled,
      'final authnEnabled': authnEnabled,
    });
    
    // Get BOT_USERNAME from environment (optional)
    const botUsername = configService.get<string>('BOT_USERNAME')?.trim() || null;

    // OAuth provider flags - read from environment variables via ConfigService, fallback to process.env
    const oauth = {
      google: (configService.get<string>('OAUTH_GOOGLE_ENABLED') || process.env.OAUTH_GOOGLE_ENABLED) === 'true',
      yandex: (configService.get<string>('OAUTH_YANDEX_ENABLED') || process.env.OAUTH_YANDEX_ENABLED) === 'true',
      vk: (configService.get<string>('OAUTH_VK_ENABLED') || process.env.OAUTH_VK_ENABLED) === 'true',
      telegram: (configService.get<string>('OAUTH_TELEGRAM_ENABLED') || process.env.OAUTH_TELEGRAM_ENABLED) === 'true',
      apple: (configService.get<string>('OAUTH_APPLE_ENABLED') || process.env.OAUTH_APPLE_ENABLED) === 'true',
      twitter: (configService.get<string>('OAUTH_TWITTER_ENABLED') || process.env.OAUTH_TWITTER_ENABLED) === 'true',
      instagram: (configService.get<string>('OAUTH_INSTAGRAM_ENABLED') || process.env.OAUTH_INSTAGRAM_ENABLED) === 'true',
      sber: (configService.get<string>('OAUTH_SBER_ENABLED') || process.env.OAUTH_SBER_ENABLED) === 'true',
      mailru: (configService.get<string>('OAUTH_MAILRU_ENABLED') || process.env.OAUTH_MAILRU_ENABLED) === 'true',
    };

    // AUTHN (WebAuthn/Passkey) flag
    const authn = {
      enabled: (configService.get<string>('AUTHN_ENABLED') || process.env.AUTHN_ENABLED) === 'true',
    };

    // Feature flags - use ConfigService for consistency
    const features = {
      analytics: configService.get<string>('ENABLE_ANALYTICS') === 'true' || configService.get<string>('NEXT_PUBLIC_ENABLE_ANALYTICS') === 'true',
      debug: configService.get<string>('ENABLE_DEBUG') === 'true' || configService.get<string>('NEXT_PUBLIC_ENABLE_DEBUG') === 'true',
      commentVoting: configService.get<string>('ENABLE_COMMENT_VOTING') === 'true' || configService.get<string>('NEXT_PUBLIC_ENABLE_COMMENT_VOTING') === 'true',
      commentImageUploads: configService.get<string>('ENABLE_COMMENT_IMAGE_UPLOADS') === 'true' || configService.get<string>('NEXT_PUBLIC_ENABLE_COMMENT_IMAGE_UPLOADS') === 'true',
      loginInviteForm: configService.get<string>('ENABLE_LOGIN_INVITE_FORM') === 'true' || configService.get<string>('NEXT_PUBLIC_ENABLE_LOGIN_INVITE_FORM') === 'true',
    };

    return {
      botUsername,
      oauth,
      authn,
      features,
    };
  }),
});

