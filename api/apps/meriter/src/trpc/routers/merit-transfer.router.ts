import { z } from 'zod';
import { Logger } from '@nestjs/common';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { MeritTransferCreateProcedureInputSchema } from '@meriter/shared-types';
import { PaginationInputSchema } from '../../common/schemas/pagination.schema';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { isMultiObrazPilotDream } from '../../domain/common/helpers/pilot-dream-policy';

const pilotMeritTransferLog = new Logger('PilotDreamMutations');
import type { UserService } from '../../domain/services/user.service';
import type { CommunityService } from '../../domain/services/community.service';
import type { Community } from '../../domain/models/community/community.schema';
import type {
  MeritTransferListResult,
  MeritTransferRecord,
} from '../../domain/services/merit-transfer.service';

type MeritTransferListItemEnriched = MeritTransferRecord & {
  senderDisplayName: string;
  receiverDisplayName: string;
};

export type MeritTransferWalletContextMeta = {
  id: string;
  name: string;
  isProject: boolean;
};

type MeritTransferListItemApi = MeritTransferListItemEnriched & {
  sourceWalletContext?: MeritTransferWalletContextMeta;
  targetWalletContext?: MeritTransferWalletContextMeta;
};

function communityToWalletContextMeta(c: Community): MeritTransferWalletContextMeta {
  const name = (c.name ?? '').trim() || c.id;
  const isProject = Boolean(c.isProject) || c.typeTag === 'project';
  return { id: c.id, name, isProject };
}

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

async function enrichMeritTransferWalletContexts(
  communityService: CommunityService,
  rows: MeritTransferListItemEnriched[],
): Promise<MeritTransferListItemApi[]> {
  const contextIds = new Set<string>();
  for (const r of rows) {
    if (r.sourceWalletType !== 'global' && r.sourceContextId) {
      contextIds.add(r.sourceContextId);
    }
    if (r.targetWalletType !== 'global' && r.targetContextId) {
      contextIds.add(r.targetContextId);
    }
  }
  const metaById = new Map<string, MeritTransferWalletContextMeta>();
  const communities = await communityService.listCommunitiesByIds([...contextIds]);
  for (const c of communities) {
    metaById.set(c.id, communityToWalletContextMeta(c));
  }

  return rows.map((r) => ({
    ...r,
    sourceWalletContext:
      r.sourceWalletType !== 'global' && r.sourceContextId
        ? metaById.get(r.sourceContextId)
        : undefined,
    targetWalletContext:
      r.targetWalletType !== 'global' && r.targetContextId
        ? metaById.get(r.targetContextId)
        : undefined,
  }));
}

async function enrichMeritTransfersForApi(
  userService: UserService,
  communityService: CommunityService,
  result: MeritTransferListResult,
): Promise<{
  data: MeritTransferListItemApi[];
  pagination: MeritTransferListResult['pagination'];
}> {
  const withUsers = await enrichMeritTransferList(userService, result);
  const data = await enrichMeritTransferWalletContexts(communityService, withUsers.data);
  return { pagination: withUsers.pagination, data };
}

export const meritTransferRouter = router({
  create: protectedProcedure
    .input(MeritTransferCreateProcedureInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.receiverId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'senderId and receiverId must differ',
        });
      }

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

      const ctxCommunity = await ctx.communityService.getCommunity(input.communityContextId);
      const pilotCfg = ctx.configService.get('pilot', { infer: true }) ?? {
        mode: false,
        hubCommunityId: undefined as string | undefined,
      };
      if (
        ctxCommunity?.isProject &&
        isMultiObrazPilotDream(ctxCommunity, pilotCfg.hubCommunityId)
      ) {
        pilotMeritTransferLog.warn(
          JSON.stringify({
            event: 'pilot_server_mutation_rejected',
            mutation: 'merit_transfer_in_pilot_context',
            projectId: input.communityContextId,
            pilotContext: 'multi-obraz',
          }),
        );
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Merit transfers are disabled for pilot dreams',
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
      return enrichMeritTransfersForApi(ctx.userService, ctx.communityService, raw);
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
      return enrichMeritTransfersForApi(ctx.userService, ctx.communityService, raw);
    }),
});
