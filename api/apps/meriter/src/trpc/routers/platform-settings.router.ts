import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { GLOBAL_ROLE_SUPERADMIN } from '../../domain/common/constants/roles.constants';

const UpdatePlatformSettingsSchema = z.object({
  welcomeMeritsGlobal: z.number().int().min(0),
});

export const platformSettingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.platformSettingsService.get();
  }),

  update: protectedProcedure
    .input(UpdatePlatformSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can update platform settings',
        });
      }
      return await ctx.platformSettingsService.update(input);
    }),
});
