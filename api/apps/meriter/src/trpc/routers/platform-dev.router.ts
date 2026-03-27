import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { GLOBAL_ROLE_SUPERADMIN } from '../../domain/common/constants/roles.constants';
import { PLATFORM_WIPE_EXTRA_PASSWORD } from '../../domain/common/constants/platform-dev.constants';
import {
  DATABASE_DUMP_VERSION,
  DATABASE_RESTORE_CONFIRM_TOKEN,
} from '../../domain/common/constants/platform-database-dump.constants';
import type { MeriterDatabaseDumpV1 } from '../../domain/services/platform-database-dump.service';

const databaseDumpSchema = z.object({
  version: z.literal(DATABASE_DUMP_VERSION),
  exportedAt: z.string(),
  databaseName: z.string(),
  collections: z.record(z.string(), z.array(z.unknown())),
});

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

  exportDatabaseDump: protectedProcedure
    .input(z.object({ wipePassword: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can export a database dump',
        });
      }
      if (input.wipePassword !== PLATFORM_WIPE_EXTRA_PASSWORD) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Invalid wipe password',
        });
      }
      const dump = await ctx.platformDatabaseDumpService.exportAll();
      return { json: JSON.stringify(dump) };
    }),

  restoreDatabaseDump: protectedProcedure
    .input(
      z.object({
        wipePassword: z.string(),
        confirmPhrase: z.literal(DATABASE_RESTORE_CONFIRM_TOKEN),
        dumpJson: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can restore a database dump',
        });
      }
      if (input.wipePassword !== PLATFORM_WIPE_EXTRA_PASSWORD) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Invalid wipe password',
        });
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(input.dumpJson) as unknown;
      } catch {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Dump file is not valid JSON',
        });
      }
      const checked = databaseDumpSchema.safeParse(parsed);
      if (!checked.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid Meriter database dump format',
        });
      }
      return ctx.platformDatabaseDumpService.restoreFromDump(
        checked.data as MeriterDatabaseDumpV1,
      );
    }),
});
