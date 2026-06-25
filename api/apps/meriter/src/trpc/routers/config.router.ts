import { router, publicProcedure } from '../trpc';
import { createGetRuntimeConfigUseCase } from '../../application/use-cases/config/get-runtime-config.use-case';
import type { PermissionGatesPort } from '../../domain/ports/permission-gates.port';

export const configRouter = router({
  /**
   * Get public configuration
   */
  getConfig: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.configService) {
      throw new Error('ConfigService is not available in context');
    }
    if (!ctx.permissionRuleEngine) {
      throw new Error('PermissionRuleEngine is not available in context');
    }

    const runtimeConfig = createGetRuntimeConfigUseCase({
      configService: ctx.configService,
      permissionGates: ctx.permissionRuleEngine as PermissionGatesPort,
    }).execute();

    return {
      botUsername: runtimeConfig.botUsername,
      devFakeAuthEnabled: runtimeConfig.devFakeAuthEnabled,
      oauth: runtimeConfig.oauth,
      authn: runtimeConfig.authn,
      sms: runtimeConfig.sms,
      phone: runtimeConfig.phone,
      email: runtimeConfig.email,
      features: runtimeConfig.features,
    };
  }),
});
