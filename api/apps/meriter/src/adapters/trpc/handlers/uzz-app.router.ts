import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../../../trpc/trpc';
import { EmailAuthDisabledError } from '../../../application/use-cases/auth/send-email-login-link.use-case';
import { FakeAuthDisabledError } from '../../../application/use-cases/auth/establish-session.use-case';
import {
  UzzIdentityConflictError,
  UzzConflictError,
  UzzForbiddenError,
  UzzInvalidTokenError,
  UzzNotFoundError,
  UzzRateLimitedError,
  UzzValidationError,
} from '../../../domain/uzz/errors';

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
        try {
          const result = await ctx.redeemUzzMagicLinkUseCase.execute({
            token: input.token,
            ip: resolveClientIp(ctx.req),
          });
          ctx.cookieManager.establishUzzJwtAuth(ctx.res, result.jwt, ctx.req);
          await ctx.uzzService.recordLoginEmail(result.user.id, result.email);
          return { user: result.user, isNewUser: result.isNewUser };
        } catch (error) {
          if (error instanceof UzzRateLimitedError) {
            throw new TRPCError({
              code: 'TOO_MANY_REQUESTS',
              message: 'Too many login attempts',
            });
          }
          if (error instanceof UzzIdentityConflictError) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Email identity conflicts with another account',
            });
          }
          if (error instanceof UzzInvalidTokenError) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Invalid or expired login link',
            });
          }
          throw error;
        }
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
          title: z.string().max(120),
          description: z.string().max(2000).optional(),
          priceRub: z.number(),
          deliveryMode: z.enum(['online', 'offline', 'both']),
          locationText: z.string().max(160).optional(),
          durationText: z.string().max(120).optional(),
          availabilityText: z.string().max(500).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return executeUzz(() =>
          ctx.createListingUseCase.execute({
            communityId: input.communityId,
            authorId: ctx.user.id,
            title: input.title,
            description: input.description ?? '',
            priceRub: input.priceRub,
            deliveryMode: input.deliveryMode,
            locationText: input.locationText ?? '',
            durationText: input.durationText ?? '',
            availabilityText: input.availabilityText ?? '',
            now: new Date(),
          }),
        );
      }),
    update: protectedProcedure
      .input(
        z.object({
          lotId: z.string().min(1),
          title: z.string().max(120).optional(),
          description: z.string().max(2000).optional(),
          priceRub: z.number().optional(),
          deliveryMode: z.enum(['online', 'offline', 'both']).optional(),
          locationText: z.string().max(160).optional(),
          durationText: z.string().max(120).optional(),
          availabilityText: z.string().max(500).optional(),
          active: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { lotId, ...patch } = input;
        return executeUzz(() =>
          ctx.updateListingUseCase.execute({
            listingId: lotId,
            actorId: ctx.user.id,
            ...patch,
          }),
        );
      }),
    list: publicProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return executeUzz(() => ctx.listCatalogUseCase.execute(input));
      }),
    myLots: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return executeUzz(() =>
          ctx.listCatalogUseCase.execute({
            communityId: input.communityId,
            authorId: ctx.user.id,
          }),
        );
      }),
    canBuy: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return executeUzz(() =>
          ctx.checkPurchaseGateUseCase.execute({
            communityId: input.communityId,
            buyerId: ctx.user.id,
          }),
        );
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
      const result = await ctx.startTelegramLinkUseCase.execute({
        userId: ctx.user.id,
      });
      const botUsername = ctx.configService.get('bot')?.username;
      return {
        ...result,
        deepLink: botUsername
          ? `https://t.me/${botUsername}?start=uzz_link_${result.token}`
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

function resolveClientIp(request: {
  ip?: string;
  socket?: { remoteAddress?: string };
}): string {
  return request.ip || request.socket?.remoteAddress || 'unknown';
}

async function executeUzz<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof UzzValidationError) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: error.code });
    }
    if (error instanceof UzzForbiddenError) {
      throw new TRPCError({ code: 'FORBIDDEN', message: error.code });
    }
    if (error instanceof UzzNotFoundError) {
      throw new TRPCError({ code: 'NOT_FOUND', message: error.code });
    }
    if (error instanceof UzzConflictError) {
      throw new TRPCError({ code: 'CONFLICT', message: error.code });
    }
    throw error;
  }
}
