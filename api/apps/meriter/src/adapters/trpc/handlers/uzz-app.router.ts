import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  uzzProtectedProcedure as protectedProcedure,
  uzzPublicProcedure as publicProcedure,
  uzzRouter as router,
} from '../../../trpc/uzz-trpc';
import { EmailAuthDisabledError } from '../../../application/use-cases/auth/send-email-login-link.use-case';
import { EmailDeliveryUnavailableError } from '../../../infrastructure/auth/email-login-link.service';
import { FakeAuthDisabledError } from '../../../application/use-cases/auth/establish-session.use-case';
import {
  UzzConflictError,
  UzzIdentityConflictError,
  UzzInvalidTokenError,
  UzzRateLimitedError,
} from '../../../domain/uzz/errors';
import { executeUzz } from './uzz-error-mapper';

const optionalDealDeadlineInput = z.coerce.date().nullable().optional();
const commandIdInput = z.string().uuid();

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
            clientIp: resolveTrustedClientIp(ctx.req),
          });
        } catch (error) {
          if (error instanceof UzzRateLimitedError) {
            throw toUzzRateLimitTrpcError(error);
          }
          if (error instanceof EmailDeliveryUnavailableError) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error.code,
            });
          }
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
            ip: resolveTrustedClientIp(ctx.req),
          });
          ctx.cookieManager.establishUzzJwtAuth(ctx.res, result.jwt, ctx.req);
          return { user: result.user, isNewUser: result.isNewUser };
        } catch (error) {
          if (error instanceof UzzRateLimitedError) {
            throw toUzzRateLimitTrpcError(error);
          }
          if (error instanceof UzzIdentityConflictError) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Email identity conflicts with another account',
            });
          }
          if (error instanceof UzzConflictError) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Invalid or expired login link',
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
      const boot = await ctx.uzzFacade.bootstrap(ctx.user.id);
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
    return ctx.uzzFacade.bootstrap(ctx.user.id);
  }),

  settings: router({
    get: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return ctx.uzzFacade.getSettings({
          communityId: input.communityId, userId: ctx.user.id,
        });
      }),
    update: protectedProcedure
      .input(
        z.object({
          commandId: commandIdInput,
          communityId: z.string().min(1),
          patch: z
            .object({
              emissionThreshold: z.number().int().optional(),
              initialHops: z.number().int().optional(),
              demurrageRubPerDay: z.number().int().optional(),
              nominalFloorRub: z.number().int().optional(),
              minimumListingsToBuy: z.number().int().optional(),
              purchaseGateMode: z.enum(['nudge', 'require_min_lots']).optional(),
              requestTtlHours: z.number().int().optional(),
              fulfillmentTtlDays: z.number().int().optional(),
              confirmationTtlDays: z.number().int().optional(),
              notifyRightEmitted: z.boolean().optional(),
              notifyRequestLifecycle: z.boolean().optional(),
              notifyDealProgress: z.boolean().optional(),
              notifyDealClosed: z.boolean().optional(),
            })
            .default({}),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return executeUzz(() => ctx.uzzFacade.updateSettings({
          commandId: input.commandId, communityId: input.communityId,
          adminId: ctx.user.id, patch: input.patch,
        }));
      }),
  }),

  banks: router({
    listMine: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return ctx.uzzFacade.listMyRights(ctx.user.id, input.communityId);
      }),
    listAwaitingNominal: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return ctx.uzzFacade.listRightsForAdmin(
          input.communityId, ctx.user.id, ['awaiting_nominal'],
        );
      }),
    listHolding: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return ctx.uzzFacade.listRightsForAdmin(
          input.communityId, ctx.user.id, ['holding'],
        );
      }),
    setNominal: protectedProcedure
      .input(
        z.object({
          commandId: commandIdInput,
          bankId: z.string().min(1),
          nominalRub: z.number().int().positive(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return executeUzz(() => ctx.uzzFacade.assignRightNominal({
          commandId: input.commandId, rightId: input.bankId,
          adminId: ctx.user.id, nominalRub: input.nominalRub,
        }));
      }),
    checkEmission: protectedProcedure
      .input(z.object({ publicationId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await ctx.uzzFacade.assertCanTriggerEmission(input.publicationId, ctx.user.id);
        return ctx.uzzFacade.maybeEmitRight(input.publicationId);
      }),
  }),

  lots: router({
    create: protectedProcedure
      .input(
        z.object({
          commandId: commandIdInput,
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
          ctx.uzzFacade.createListing({
            commandId: input.commandId,
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
          commandId: commandIdInput,
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
        const { commandId, lotId, ...patch } = input;
        return executeUzz(() =>
          ctx.uzzFacade.updateListing({
            commandId,
            listingId: lotId,
            actorId: ctx.user.id,
            ...patch,
          }),
        );
      }),
    list: publicProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return executeUzz(() => ctx.uzzFacade.listCatalog(input));
      }),
    myLots: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return executeUzz(() =>
          ctx.uzzFacade.listCatalog({
            communityId: input.communityId,
            authorId: ctx.user.id,
          }),
        );
      }),
    canBuy: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return executeUzz(() =>
          ctx.uzzFacade.checkPurchaseGate({
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
          commandId: commandIdInput,
          communityId: z.string().min(1),
          lotId: z.string().min(1),
          bankId: z.string().min(1),
          requestMessage: z.string().trim().min(1).max(1000),
          requestedDeadlineAt: optionalDealDeadlineInput,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return executeUzz(() =>
          ctx.uzzFacade.requestDeal({
            commandId: input.commandId,
            communityId: input.communityId,
            buyerId: ctx.user.id,
            listingId: input.lotId,
            exchangeRightId: input.bankId,
            requestMessage: input.requestMessage,
            requestedDeadlineAt: input.requestedDeadlineAt ?? null,
          }),
        );
      }),
    accept: protectedProcedure
      .input(z.object({
        commandId: commandIdInput,
        dealId: z.string().min(1),
        expectedNominalRub: z.number().int().positive(),
        agreedDeadlineAt: optionalDealDeadlineInput,
      }))
      .mutation(async ({ ctx, input }) => {
        return executeUzz(() => ctx.uzzFacade.acceptDeal({
          commandId: input.commandId,
          dealId: input.dealId,
          sellerId: ctx.user.id,
          expectedNominalRub: input.expectedNominalRub,
          agreedDeadlineAt: input.agreedDeadlineAt ?? null,
        }));
      }),
    reject: protectedProcedure
      .input(z.object({ commandId: commandIdInput, dealId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return executeUzz(() => ctx.uzzFacade.rejectDeal({
          commandId: input.commandId, dealId: input.dealId, sellerId: ctx.user.id,
        }));
      }),
    complete: protectedProcedure
      .input(z.object({ commandId: commandIdInput, dealId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return executeUzz(() => ctx.uzzFacade.markDealCompleted({
          commandId: input.commandId, dealId: input.dealId, sellerId: ctx.user.id,
        }));
      }),
    close: protectedProcedure
      .input(z.object({ commandId: commandIdInput, dealId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return executeUzz(() => ctx.uzzFacade.closeDeal({
          commandId: input.commandId, dealId: input.dealId, buyerId: ctx.user.id,
        }));
      }),
    cancel: protectedProcedure
      .input(z.object({ commandId: commandIdInput, dealId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return executeUzz(() => ctx.uzzFacade.cancelDeal({
          commandId: input.commandId, dealId: input.dealId, buyerId: ctx.user.id,
        }));
      }),
    thank: protectedProcedure
      .input(
        z.object({
          commandId: commandIdInput,
          dealId: z.string().min(1),
          comment: z.string().max(1000).optional(),
          merits: z.number().int().nonnegative().max(10_000).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return executeUzz(() => ctx.uzzFacade.sendDealThanks({
          commandId: input.commandId, dealId: input.dealId,
          actorUserId: ctx.user.id, comment: input.comment ?? '', merits: input.merits ?? 0,
        }));
      }),
    list: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          mineOnly: z.boolean().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        return ctx.uzzFacade.listDeals(input.communityId, ctx.user.id);
      }),
    adminList: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return ctx.uzzFacade.listOpenDeals(input.communityId, ctx.user.id);
      }),
    adminClose: protectedProcedure
      .input(z.object({ commandId: commandIdInput, dealId: z.string().min(1), reason: z.string().trim().min(10).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        return executeUzz(() => ctx.uzzFacade.adminResolveDeal({
          commandId: input.commandId, dealId: input.dealId, adminId: ctx.user.id,
          outcome: 'close', reason: input.reason,
        }));
      }),
    adminCancel: protectedProcedure
      .input(z.object({ commandId: commandIdInput, dealId: z.string().min(1), reason: z.string().trim().min(10).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        return executeUzz(() => ctx.uzzFacade.adminResolveDeal({
          commandId: input.commandId, dealId: input.dealId, adminId: ctx.user.id,
          outcome: 'cancel', reason: input.reason,
        }));
      }),
  }),

  identity: router({
    getLinkStatus: protectedProcedure.query(async ({ ctx }) => {
      return ctx.uzzFacade.getLinkStatus(ctx.user.id);
    }),
    startTelegramLink: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await ctx.uzzFacade.startTelegramLink({
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
        const balances = await ctx.uzzFacade.getFeeBalances(ctx.user.id, input.communityId);
        return {
          communityId: input.communityId,
          localBalance: balances.localBalance,
          globalBalance: balances.globalBalance,
          totalBalance: balances.totalBalance,
          mode: balances.mode,
          canPayFee: balances.totalBalance >= 1,
        };
      }),
  }),

  ledger: router({
    list: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          limit: z.number().int().positive().max(50).optional(),
          cursor: z.object({ createdAt: z.coerce.date(), id: z.string().min(1) }).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        return ctx.uzzFacade.listLedger({
          communityId: input.communityId, viewerId: ctx.user.id, mineOnly: false,
          limit: input.limit, cursor: input.cursor,
        });
      }),
    listMine: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          limit: z.number().int().positive().max(50).optional(),
          cursor: z.object({ createdAt: z.coerce.date(), id: z.string().min(1) }).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        return ctx.uzzFacade.listLedger({
          communityId: input.communityId, viewerId: ctx.user.id, mineOnly: true,
          limit: input.limit, cursor: input.cursor,
        });
      }),
  }),

  deeds: router({
    list: protectedProcedure
      .input(z.object({ communityId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return ctx.uzzFacade.listDeeds(ctx.user.id, input.communityId);
      }),
  }),
});

export type UzzAppRouter = typeof uzzAppRouter;

export function resolveTrustedClientIp(request: {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers?: Record<string, unknown>;
}): string {
  return request.ip || request.socket?.remoteAddress || 'unknown';
}

export function toUzzRateLimitTrpcError(error: UzzRateLimitedError): TRPCError {
  return new TRPCError({
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many login attempts',
    cause: error,
  });
}
