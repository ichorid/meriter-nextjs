import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../../../trpc/trpc';
import { EmailAuthDisabledError } from '../../../application/use-cases/auth/send-email-login-link.use-case';
import { FakeAuthDisabledError } from '../../../application/use-cases/auth/establish-session.use-case';

/**
 * Whitelisted tRPC surface for `@meriter/uzz-web`.
 * Mounted at `/trpc/uzz`.
 */
export const uzzAppRouter = router({
  auth: router({
    sendEmailLoginLink: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        const enabled = ctx.configService.get('email')?.enabled ?? false;
        if (!enabled) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: new EmailAuthDisabledError().message,
          });
        }
        const uzzBase = ctx.configService.get('app')?.uzzWebBaseUrl?.replace(/\/$/, '');
        try {
          return await ctx.emailLoginLinkService.sendLoginLink(input.email, {
            baseUrl: uzzBase,
            path: '/a',
            productLabel: 'Услуги за заслуги',
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to send link';
          throw new TRPCError({ code: 'BAD_REQUEST', message });
        }
      }),

    redeemEmailLoginLink: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const tokenResult = await ctx.authMagicLinkService.redeem(input.token);
        if (!tokenResult || tokenResult.channel !== 'email') {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired login link',
          });
        }

        if (tokenResult.linkToUserId) {
          const existing = await ctx.userService.getUserByAuthId(
            'email',
            tokenResult.target,
          );
          if (existing && existing.id !== tokenResult.linkToUserId) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Email already linked to another user',
            });
          }
          await ctx.userService.linkIdentity(
            tokenResult.linkToUserId,
            'email',
            tokenResult.target,
          );
          const user = await ctx.userService.getUserById(tokenResult.linkToUserId);
          if (!user) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
          }
          const authResult = await ctx.authService.authenticateEmail(tokenResult.target);
          ctx.cookieManager.establishUzzJwtAuth(ctx.res, authResult.jwt, ctx.req);
          await ctx.uzzService.recordLoginEmail(authResult.user.id, tokenResult.target);
          return { user: authResult.user, isNewUser: false };
        }

        const authResult = await ctx.authService.authenticateEmail(tokenResult.target);
        ctx.cookieManager.establishUzzJwtAuth(ctx.res, authResult.jwt, ctx.req);
        await ctx.uzzService.recordLoginEmail(authResult.user.id, tokenResult.target);
        return {
          user: authResult.user,
          isNewUser: authResult.isNewUser ?? false,
        };
      }),

    logout: protectedProcedure.mutation(async ({ ctx }) => {
      ctx.cookieManager.logoutUzzJwt(ctx.res, ctx.req);
      return { message: 'Logged out successfully' };
    }),

    me: protectedProcedure.query(async ({ ctx }) => {
      const user = await ctx.userService.getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      const boot = await ctx.uzzService.bootstrap(ctx.user.id);
      return {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        globalRole: user.globalRole,
        authProvider: user.authProvider,
        isUzzAdmin: boot.isUzzAdmin,
        communityId: boot.communityId,
        communityName: boot.communityName,
      };
    }),

    authenticateFake: publicProcedure
      .input(
        z
          .object({
            fakeUserId: z.string().optional(),
          })
          .optional(),
      )
      .mutation(async ({ ctx, input }) => {
        const fakeDataMode = ctx.configService.get('dev')?.fakeDataMode ?? false;
        const testAuthMode = ctx.configService.get('dev')?.testAuthMode ?? false;
        if (!fakeDataMode && !testAuthMode) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: new FakeAuthDisabledError().message,
          });
        }
        const result = await ctx.authService.authenticateFakeUser(
          input?.fakeUserId ?? ctx.req.cookies?.uzz_fake_user_id,
        );
        ctx.cookieManager.establishUzzJwtAuth(ctx.res, result.jwt, ctx.req);
        return { user: result.user, jwt: result.jwt };
      }),
  }),

  bootstrap: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uzzService.bootstrap(ctx.user.id);
  }),

  settings: router({
    get: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        await ctx.uzzService.assertCommunityParticipant(input.communityId, ctx.user.id);
        return ctx.uzzService.getOrCreateSettings(input.communityId);
      }),
    update: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          patch: z
            .object({
              emissionThreshold: z.number().positive().optional(),
              bankInitialHops: z.number().int().positive().optional(),
              demurrageRubPerDay: z.number().nonnegative().optional(),
              nominalFloorRub: z.number().nonnegative().optional(),
              minLotsToBuy: z.number().int().nonnegative().optional(),
              purchaseGate: z.enum(['nudge', 'require_min_lots']).optional(),
              bankTransferMode: z
                .enum(['escrow_until_close', 'on_accept_locked', 'on_close_only'])
                .optional(),
              dealRequestTtlHours: z.number().positive().optional(),
              dealFulfillmentDays: z.number().positive().optional(),
              notifyFlags: z
                .object({
                  bankEmitted: z.boolean().optional(),
                  dealRequested: z.boolean().optional(),
                  dealAccepted: z.boolean().optional(),
                  dealClosed: z.boolean().optional(),
                  demurrageDaily: z.boolean().optional(),
                  linkReminder: z.boolean().optional(),
                })
                .optional(),
            })
            .default({}),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await ctx.uzzService.assertCommunityAdmin(input.communityId, ctx.user.id);
        return ctx.uzzService.updateSettings(input.communityId, input.patch);
      }),
  }),

  banks: router({
    listMine: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return ctx.uzzService.listMyBanks(ctx.user.id, input.communityId);
      }),
    listAwaitingNominal: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        await ctx.uzzService.assertCommunityAdmin(input.communityId, ctx.user.id);
        return ctx.uzzService.adminListAwaitingNominal(input.communityId);
      }),
    listHolding: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        await ctx.uzzService.assertCommunityAdmin(input.communityId, ctx.user.id);
        return ctx.uzzService.adminListHolding(input.communityId);
      }),
    setNominal: protectedProcedure
      .input(
        z.object({
          bankId: z.string().min(1),
          nominalRub: z.number().positive(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const bank = await ctx.uzzService.getBankById(input.bankId);
        await ctx.uzzService.assertCommunityAdmin(bank.communityId, ctx.user.id);
        return ctx.uzzService.setBankNominal(input.bankId, input.nominalRub, ctx.user.id);
      }),
    checkEmission: protectedProcedure
      .input(z.object({ publicationId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await ctx.uzzService.assertCanTriggerEmission(input.publicationId, ctx.user.id);
        return ctx.uzzService.maybeEmitBankForPublication(input.publicationId);
      }),
  }),

  lots: router({
    create: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          title: z.string().min(1),
          description: z.string().optional(),
          priceRub: z.number().positive(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.uzzService.createLot({
          communityId: input.communityId,
          authorId: ctx.user.id,
          title: input.title,
          description: input.description,
          priceRub: input.priceRub,
        });
      }),
    update: protectedProcedure
      .input(
        z.object({
          lotId: z.string().min(1),
          title: z.string().min(1).optional(),
          description: z.string().optional(),
          priceRub: z.number().positive().optional(),
          active: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { lotId, ...patch } = input;
        return ctx.uzzService.updateLot(lotId, ctx.user.id, patch);
      }),
    list: publicProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return ctx.uzzService.listLots(input.communityId);
      }),
    myLots: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return ctx.uzzService.myLots(ctx.user.id, input.communityId);
      }),
    canBuy: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return ctx.uzzService.canBuy(ctx.user.id, input.communityId);
      }),
  }),

  deals: router({
    request: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          lotId: z.string().min(1),
          bankId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.uzzService.requestDeal({
          communityId: input.communityId,
          buyerId: ctx.user.id,
          lotId: input.lotId,
          bankId: input.bankId,
        });
      }),
    accept: protectedProcedure
      .input(z.object({ dealId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return ctx.uzzService.acceptDeal(input.dealId, ctx.user.id);
      }),
    reject: protectedProcedure
      .input(z.object({ dealId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return ctx.uzzService.rejectDeal(input.dealId, ctx.user.id);
      }),
    complete: protectedProcedure
      .input(z.object({ dealId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return ctx.uzzService.completeDeal(input.dealId, ctx.user.id);
      }),
    close: protectedProcedure
      .input(z.object({ dealId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return ctx.uzzService.closeDeal(input.dealId, ctx.user.id);
      }),
    cancel: protectedProcedure
      .input(z.object({ dealId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return ctx.uzzService.cancelDeal(input.dealId, ctx.user.id);
      }),
    thank: protectedProcedure
      .input(
        z.object({
          dealId: z.string().min(1),
          comment: z.string().max(2000).optional(),
          merits: z.number().int().nonnegative().max(10_000).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.uzzService.thankDeal(input.dealId, ctx.user.id, {
          comment: input.comment,
          merits: input.merits,
        });
      }),
    list: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          mineOnly: z.boolean().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        return ctx.uzzService.listDeals(input.communityId, ctx.user.id);
      }),
    adminList: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        await ctx.uzzService.assertCommunityAdmin(input.communityId, ctx.user.id);
        return ctx.uzzService.listOpenDeals(input.communityId);
      }),
    adminClose: protectedProcedure
      .input(z.object({ dealId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return ctx.uzzService.adminCloseDeal(input.dealId, ctx.user.id);
      }),
    adminCancel: protectedProcedure
      .input(z.object({ dealId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return ctx.uzzService.adminCancelDeal(input.dealId, ctx.user.id);
      }),
  }),

  identity: router({
    getLinkStatus: protectedProcedure.query(async ({ ctx }) => {
      return ctx.uzzService.getLinkStatus(ctx.user.id);
    }),
    startTelegramLink: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await ctx.uzzService.startTelegramLink(ctx.user.id);
      const botUsername = ctx.configService.get('bot')?.username;
      return {
        ...result,
        deepLink: botUsername
          ? `https://t.me/${botUsername}?start=uzz_link_${result.code}`
          : undefined,
      };
    }),
  }),

  wallet: router({
    getBalance: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const balances = await ctx.uzzService.getFeeBalances(
          ctx.user.id,
          input.communityId,
        );
        return {
          communityId: input.communityId,
          localBalance: balances.localBalance,
          globalBalance: balances.globalBalance,
          balance: balances.localBalance + balances.globalBalance,
          canPayFee: balances.localBalance >= 1 || balances.globalBalance >= 1,
        };
      }),
  }),

  ledger: router({
    list: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          limit: z.number().int().positive().max(100).optional(),
          skip: z.number().int().nonnegative().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        await ctx.uzzService.assertCommunityAdmin(input.communityId, ctx.user.id);
        return ctx.uzzService.listLedger(input.communityId, {
          limit: input.limit,
          skip: input.skip,
        });
      }),
    listMine: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          limit: z.number().int().positive().max(100).optional(),
          skip: z.number().int().nonnegative().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        return ctx.uzzService.listLedgerMine(ctx.user.id, input.communityId, {
          limit: input.limit,
          skip: input.skip,
        });
      }),
  }),

  deeds: router({
    list: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return ctx.uzzService.listDeeds(ctx.user.id, input.communityId);
      }),
  }),
});

export type UzzAppRouter = typeof uzzAppRouter;
