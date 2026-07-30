import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import type { Context } from '../context';

function actor(ctx: Context) {
  return {
    userId: ctx.user!.id,
    globalRole: ctx.user!.globalRole ?? null,
  };
}

/**
 * YouGile integration management (variant A2). Lead/superadmin only —
 * authorization enforced inside ManageYougileIntegrationUseCase.
 */
export const yougileRouter = router({
  getStatus: protectedProcedure
    .input(z.object({ communityId: z.string() }))
    .query(async ({ ctx, input }) =>
      ctx.manageYougile.getStatus(input.communityId, actor(ctx)),
    ),

  getDashboard: protectedProcedure
    .input(z.object({ communityId: z.string() }))
    .query(async ({ ctx, input }) =>
      ctx.manageYougile.getDashboard(input.communityId, actor(ctx)),
    ),

  connect: protectedProcedure
    .input(
      z.object({
        communityId: z.string(),
        login: z.string().email().max(320),
        password: z.string().min(1).max(200),
        companyId: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.manageYougile.connect(
        input.communityId,
        {
          login: input.login.trim(),
          password: input.password,
          companyId: input.companyId,
        },
        actor(ctx),
      ),
    ),

  discoverCompanies: protectedProcedure
    .input(
      z.object({
        communityId: z.string(),
        login: z.string().email().max(320),
        password: z.string().min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.manageYougile.discoverCompanies(
        input.communityId,
        input.login.trim(),
        input.password,
        actor(ctx),
      ),
    ),

  getBoards: protectedProcedure
    .input(z.object({ communityId: z.string() }))
    .query(async ({ ctx, input }) =>
      ctx.manageYougile.listBoards(input.communityId, actor(ctx)),
    ),

  getColumns: protectedProcedure
    .input(z.object({ communityId: z.string(), boardId: z.string() }))
    .query(async ({ ctx, input }) =>
      ctx.manageYougile.listColumns(input.communityId, input.boardId, actor(ctx)),
    ),

  configure: protectedProcedure
    .input(
      z.object({
        communityId: z.string(),
        boardId: z.string(),
        boardTitle: z.string().max(200),
        columnId: z.string(),
        columnTitle: z.string().max(200),
        targetCommunityId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.manageYougile.configure(input, actor(ctx)),
    ),

  importDone: protectedProcedure
    .input(
      z.object({
        communityId: z.string(),
        // Each imported task costs up to 2 extra YouGile API calls;
        // the cap respects the 50 req/min company budget.
        limit: z.number().int().min(1).max(25).default(20),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.manageYougile.importDoneTasks(
        input.communityId,
        input.limit,
        actor(ctx),
      ),
    ),

  disconnect: protectedProcedure
    .input(z.object({ communityId: z.string() }))
    .mutation(async ({ ctx, input }) =>
      ctx.manageYougile.disconnect(input.communityId, actor(ctx)),
    ),
});
