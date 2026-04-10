import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { MeritTransferCreateInputSchema } from '@meriter/shared-types';
import { PaginationInputSchema } from '../../common/schemas/pagination.schema';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import type { UserService } from '../../domain/services/user.service';
import type {
  MeritTransferListResult,
  MeritTransferRecord,
} from '../../domain/services/merit-transfer.service';

const MeritTransferCreateProcedureSchema = MeritTransferCreateInputSchema.omit({
  senderId: true,
});

type MeritTransferListItemEnriched = MeritTransferRecord & {
  senderDisplayName: string;
  receiverDisplayName: string;
};

async function enrichMeritTransferList(
  userService: UserService,
  result: MeritTransferListResult,
): Promise<{
  data: MeritTransferListItemEnriched[];
  pagination: MeritTransferListResult['pagination'];
}> {
  const ids = [...new Set(result.data.flatMap((r) => [r.senderId, r.receiverId]))];
  const names = await userService.getDisplayNamesByUserIds(ids);
  return {
    pagination: result.pagination,
    data: result.data.map((r) => ({
      ...r,
      senderDisplayName: names.get(r.senderId) ?? r.senderId,
      receiverDisplayName: names.get(r.receiverId) ?? r.receiverId,
    })),
  };
}

export const meritTransferRouter = router({
  create: protectedProcedure
    .input(MeritTransferCreateProcedureSchema)
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.userCommunityRoleService.getRole(
        ctx.user.id,
        input.communityContextId,
      );
      if (!role) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You must be a member of this community to transfer merits',
        });
      }

      return ctx.meritTransferService.create({
        ...input,
        senderId: ctx.user.id,
      });
    }),

  getByCommunity: protectedProcedure
    .input(
      z.object({
        communityId: z.string().min(1),
        ...PaginationInputSchema.shape,
      }),
    )
    .query(async ({ ctx, input }) => {
      const role = await ctx.userCommunityRoleService.getRole(ctx.user.id, input.communityId);
      if (!role) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You must be a member of this community to view merit transfers',
        });
      }

      const pagination = PaginationHelper.parseOptions(input);
      const page = pagination.page ?? 1;
      const limit = pagination.limit ?? 20;

      const raw = await ctx.meritTransferService.getByCommunityContext(input.communityId, {
        page,
        limit,
      });
      return enrichMeritTransferList(ctx.userService, raw);
    }),

  getByUser: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        /** Must not be named `direction` — TanStack useInfiniteQuery injects `direction: 'forward'|'backward'` into tRPC input. */
        transferDirection: z.enum(['incoming', 'outgoing']),
        ...PaginationInputSchema.shape,
      }),
    )
    .query(async ({ ctx, input }) => {
      const targetUser = await ctx.userService.getUser(input.userId);
      if (!targetUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const pagination = PaginationHelper.parseOptions(input);
      const page = pagination.page ?? 1;
      const limit = pagination.limit ?? 20;

      const raw = await ctx.meritTransferService.getByUser(input.userId, input.transferDirection, {
        page,
        limit,
      });
      return enrichMeritTransferList(ctx.userService, raw);
    }),
});
