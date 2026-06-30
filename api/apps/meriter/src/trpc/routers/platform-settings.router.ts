import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { GLOBAL_ROLE_SUPERADMIN } from '../../domain/common/constants/roles.constants';

const UpdatePlatformSettingsSchema = z.object({
  welcomeMeritsGlobal: z.number().int().min(0),
});

const UpdateFutureVisionTagsSchema = z.object({
  tags: z.array(z.string()),
});

const UpdateDecree809Schema = z.object({
  enabled: z.boolean(),
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

  updateFutureVisionTags: protectedProcedure
    .input(UpdateFutureVisionTagsSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can update future vision tags',
        });
      }
      return await ctx.platformSettingsService.updateFutureVisionTags(input.tags);
    }),

  updateDecree809Enabled: protectedProcedure
    .input(UpdateDecree809Schema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can update decree 809 setting',
        });
      }
      return await ctx.platformSettingsService.updateDecree809Enabled(
        input.enabled,
      );
    }),

  getSuggestedValueTags: protectedProcedure
    .input(
      z
        .object({
          threshold: z.number().int().min(1).max(1000).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can load suggested value tags',
        });
      }
      return ctx.valueTagsSuggestionService.getSuggested(input?.threshold);
    }),
});
