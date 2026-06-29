import { TelegramAuthDataSchema, TelegramWebAppDataSchema } from '@meriter/shared-types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../../../trpc/trpc';
import { pickProceduresRouter } from '../community-pick-procedures';
import { usersRouter } from '../../../trpc/routers/users.router';
import { communitiesRouter } from '../../../trpc/routers/communities.router';
import { publicationsRouter } from './publications-procedures.handler';
import { votesRouter } from '../../../trpc/routers/votes.router';
import { pollsRouter } from '../../../trpc/routers/polls.router';
import { walletsRouter } from '../../../trpc/routers/wallets.router';
import { documentsRouter } from '../../../trpc/routers/documents.router';
import { documentVariantsRouter } from '../../../trpc/routers/document-variants.router';
import { eventsRouter } from '../../../trpc/routers/events.router';
import { projectRouter } from '../../../trpc/routers/project.router';
import { configRouter } from '../../../trpc/routers/config.router';
import { uploadsRouter } from '../../../trpc/routers/uploads.router';
import { meritTransferRouter } from '../../../trpc/routers/merit-transfer.router';
import { commentsRouter } from '../../../trpc/routers/comments.router';
import { ResolveTelegramCommunityUseCase } from '../../../application/use-cases/communities/resolve-telegram-community.use-case';
import { GetCommunityByTelegramChatIdUseCase } from '../../../application/use-cases/communities/get-community-by-telegram-chat-id.use-case';
import { AuthenticateTelegramCommunityUseCase } from '../../../application/use-cases/auth/authenticate-telegram-community.use-case';
import { AuthenticateTelegramWebAppCommunityUseCase } from '../../../application/use-cases/auth/authenticate-telegram-webapp-community.use-case';
import { AuthenticateFakeCommunityUseCase } from '../../../application/use-cases/auth/authenticate-fake-community.use-case';
import { EnsureTelegramCommunityMemberUseCase } from '../../../application/use-cases/communities/ensure-telegram-community-member.use-case';
import { SeedCommunityWebDevUseCase } from '../../../application/use-cases/dev/seed-community-web-dev.use-case';
import {
  isDevCommunityId,
  resolveDevCommunityId,
} from '../../../domain/common/constants/community-web-dev.constants';
import { GLOBAL_ROLE_SUPERADMIN } from '../../../domain/common/constants/roles.constants';
import { CommunitySchemaClass } from '../../../domain/models/community/community.schema';

/**
 * Whitelisted tRPC surface for `@meriter/community-web`.
 * Mounted at `/trpc/community` — never exposes full-app routers (tappalka, platformDev, etc.).
 */
export const communityAppRouter = router({
  auth: router({
    logout: protectedProcedure.mutation(async ({ ctx }) => {
      ctx.cookieManager.logoutCommunityJwt(ctx.res, ctx.req);
      return { message: 'Logged out successfully' };
    }),
    authenticateTelegram: publicProcedure
      .input(TelegramAuthDataSchema)
      .mutation(async ({ ctx, input }) => {
        const useCase = new AuthenticateTelegramCommunityUseCase(
          ctx.authService,
          ctx.cookieManager,
          ctx.configService,
        );
        return useCase.execute(input, ctx.res, ctx.req);
      }),
    authenticateTelegramWebApp: publicProcedure
      .input(TelegramWebAppDataSchema)
      .mutation(async ({ ctx, input }) => {
        const ensureTelegramMember = new EnsureTelegramCommunityMemberUseCase({
          communityModel: ctx.connection.model(CommunitySchemaClass.name),
          communityService: ctx.communityService,
          userCommunityRoleService: ctx.userCommunityRoleService,
          walletService: ctx.walletService,
        });
        const useCase = new AuthenticateTelegramWebAppCommunityUseCase(
          ctx.authService,
          ctx.cookieManager,
          ctx.configService,
          ensureTelegramMember,
        );
        return useCase.execute(input, ctx.res, ctx.req);
      }),
    authenticateFake: publicProcedure
      .input(
        z
          .object({
            persona: z.enum(['lead', 'participant']).optional(),
          })
          .optional(),
      )
      .mutation(async ({ ctx, input }) => {
        const useCase = new AuthenticateFakeCommunityUseCase(
          ctx.authService,
          ctx.cookieManager,
          ctx.configService,
          ctx.userService,
          ctx.userCommunityRoleService,
          ctx.walletService,
        );
        return useCase.execute(input ?? {}, ctx.req, ctx.res);
      }),
  }),

  users: pickProceduresRouter(usersRouter, ['getMe']),

  communities: pickProceduresRouter(
    communitiesRouter,
    ['getById', 'getFeed', 'getHubFeedTabCounts', 'update', 'getMembers'],
    {
      resolveForTelegramUser: protectedProcedure.query(async ({ ctx }) => {
        const useCase = new ResolveTelegramCommunityUseCase({
          userService: ctx.userService,
          userCommunityRoleService: ctx.userCommunityRoleService,
          communityModel: ctx.connection.model(CommunitySchemaClass.name),
          configService: ctx.configService,
        });
        return useCase.execute(ctx.user.id);
      }),
      listForTelegramUser: protectedProcedure.query(async ({ ctx }) => {
        const useCase = new ResolveTelegramCommunityUseCase({
          userService: ctx.userService,
          userCommunityRoleService: ctx.userCommunityRoleService,
          communityModel: ctx.connection.model(CommunitySchemaClass.name),
          configService: ctx.configService,
        });
        return useCase.listForUser(ctx.user.id);
      }),
      getByTelegramChatId: protectedProcedure
        .input(z.object({ telegramChatId: z.string().min(1) }))
        .query(async ({ ctx, input }) => {
          const useCase = new GetCommunityByTelegramChatIdUseCase({
            communityModel: ctx.connection.model(CommunitySchemaClass.name),
          });
          return useCase.execute(input.telegramChatId);
        }),
    },
  ),

  publications: pickProceduresRouter(publicationsRouter, [
    'getById',
    'create',
    'update',
    'delete',
    'restore',
    'listPendingTelegramModeration',
    'approveTelegramModeration',
    'rejectTelegramModeration',
  ]),

  votes: pickProceduresRouter(votesRouter, [
    'create',
    'createWithComment',
    'getByPublicationId',
    'withdrawFromVote',
  ]),

  comments: pickProceduresRouter(commentsRouter, [
    'getByPublicationId',
    'create',
  ]),

  polls: pickProceduresRouter(pollsRouter, [
    'getById',
    'getByCommunity',
    'create',
    'update',
    'delete',
    'cast',
    'getResults',
    'getMyCasts',
  ]),

  wallets: pickProceduresRouter(walletsRouter, [
    'getByCommunity',
    'getBalance',
    'getQuota',
    'getQuotaBatch',
    'getTransactions',
    'getCommunityMeritHistory',
    'getMeritHistoryDashboard',
  ]),

  documents: pickProceduresRouter(documentsRouter, [
    'listByCommunity',
    'getById',
    'getOfficialByType',
  ]),

  documentVariants: pickProceduresRouter(documentVariantsRouter, [
    'listByDocument',
    'propose',
  ]),

  events: pickProceduresRouter(eventsRouter, [
    'createEvent',
    'updateEvent',
    'deleteEvent',
    'getEventsByCommunity',
    'attend',
    'unattend',
    'getInvitePreview',
    'createInviteLink',
    'attendViaInvite',
  ]),

  project: pickProceduresRouter(projectRouter, ['list', 'getById', 'create', 'join']),

  meritTransfer: pickProceduresRouter(meritTransferRouter, [
    'create',
    'getByCommunity',
    'getByUser',
  ]),

  config: pickProceduresRouter(configRouter, ['getConfig']),

  dev: router({
    reseedDevData: protectedProcedure
      .input(z.object({ communityId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        SeedCommunityWebDevUseCase.assertAllowed(ctx.configService, {
          explicit: true,
        });

        const fakeDataMode = ctx.configService.get('dev')?.fakeDataMode ?? false;
        const testAuthMode = ctx.configService.get('dev')?.testAuthMode ?? false;
        if (!fakeDataMode && !testAuthMode) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Dev re-seed requires FAKE_DATA_MODE or TEST_AUTH_MODE',
          });
        }

        const devCommunityId = resolveDevCommunityId(
          process.env.COMMUNITY_WEB_DEV_COMMUNITY_ID,
        );
        if (!isDevCommunityId(input.communityId) || input.communityId !== devCommunityId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Re-seed is only allowed for the dev community',
          });
        }

        const isLead = await ctx.communityService.isUserAdmin(
          input.communityId,
          ctx.user.id,
        );
        if (!isLead && ctx.user.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only the community lead can re-seed demo data',
          });
        }

        return ctx.seedCommunityWebDevUseCase.execute({
          explicit: true,
          forceContent: true,
          ifMissingOnly: false,
        });
      }),
  }),

  uploads: pickProceduresRouter(uploadsRouter, ['uploadImage', 'uploadAvatar']),
});

export type CommunityAppRouter = typeof communityAppRouter;
