import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { GLOBAL_ROLE_SUPERADMIN } from '../../domain/common/constants/roles.constants';
import { PLATFORM_WIPE_EXTRA_PASSWORD } from '../../domain/common/constants/platform-dev.constants';

/**
 * Destructive / demo tooling. Superadmin only. No environment gate — misuse on production wipes data.
 * Future optional kill-switch: MERITER_DISABLE_PLATFORM_WIPE (not implemented).
 */
export const platformDevRouter = router({
  wipeUserContent: protectedProcedure
    .input(z.object({ wipePassword: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can wipe the platform',
        });
      }
      if (input.wipePassword !== PLATFORM_WIPE_EXTRA_PASSWORD) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Invalid wipe password',
        });
      }
      return ctx.platformWipeService.wipeUserContentAndLocalData();
    }),

  seedDemoWorld: protectedProcedure
    .input(z.object({ force: z.boolean().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can seed demo data',
        });
      }
      return ctx.platformDemoSeedService.seedDemoWorld({
        force: input?.force ?? false,
      });
    }),
});
