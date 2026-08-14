import { TRPCError } from '@trpc/server';
import { uzzAppRouter } from '../src/adapters/trpc/handlers/uzz-app.router';

function context(userId: string | null, facade: Record<string, jest.Mock>) {
  return {
    req: {}, res: {}, user: userId ? { id: userId } : null,
    userService: { getUserById: jest.fn() }, uzzFacade: facade,
    configService: { get: jest.fn() }, emailLoginLinkService: { sendLoginLink: jest.fn() },
    redeemUzzMagicLinkUseCase: { execute: jest.fn() }, authService: { authenticateFakeUser: jest.fn() },
    cookieManager: { establishUzzJwtAuth: jest.fn(), logoutUzzJwt: jest.fn() },
  } as any;
}

describe('UZZ tRPC adapter boundary', () => {
  it('keeps the catalog public while protecting private procedures', async () => {
    const facade = { listCatalog: jest.fn().mockResolvedValue([{ id: 'listing-1' }]) };
    const caller = uzzAppRouter.createCaller(context(null, facade));

    await expect(caller.lots.list({ communityId: 'community-1' })).resolves.toEqual([{ id: 'listing-1' }]);
    await expect(caller.deals.list({ communityId: 'community-1' })).rejects.toMatchObject<Partial<TRPCError>>({ code: 'UNAUTHORIZED' });
  });

  it('passes notification flags and the authenticated admin to the facade', async () => {
    const facade = { updateSettings: jest.fn().mockResolvedValue({ notifyDealClosed: false }) };
    const caller = uzzAppRouter.createCaller(context('admin-1', facade));

    await caller.settings.update({
      commandId: 'command-123', communityId: 'community-1',
      patch: { notifyDealClosed: false },
    });

    expect(facade.updateSettings).toHaveBeenCalledWith({
      commandId: 'command-123', communityId: 'community-1', adminId: 'admin-1',
      patch: { notifyDealClosed: false },
    });
  });

  it('forwards expired deal deadlines to the use case without Zod time checks', async () => {
    const facade = {
      requestDeal: jest.fn().mockResolvedValue({ id: 'deal-1' }),
      acceptDeal: jest.fn().mockResolvedValue({ id: 'deal-1' }),
    };
    const caller = uzzAppRouter.createCaller(context('buyer-1', facade));
    const requestedDeadlineAt = new Date('2026-08-14T09:59:59.000Z');
    const agreedDeadlineAt = new Date('2026-08-14T10:04:59.000Z');

    await caller.deals.request({
      commandId: 'command-expired-deadline',
      communityId: 'community-1',
      lotId: 'listing-1',
      bankId: 'right-1',
      requestMessage: 'Need help',
      requestedDeadlineAt,
    });
    await caller.deals.accept({
      commandId: 'command-expired-accept',
      dealId: 'deal-1',
      expectedNominalRub: 500,
      agreedDeadlineAt,
    });

    expect(facade.requestDeal).toHaveBeenCalledWith(
      expect.objectContaining({ requestedDeadlineAt }),
    );
    expect(facade.acceptDeal).toHaveBeenCalledWith(
      expect.objectContaining({ agreedDeadlineAt }),
    );
  });

  it('forwards an omitted deal deadline as null', async () => {
    const facade = { requestDeal: jest.fn().mockResolvedValue({ id: 'deal-1' }) };
    const caller = uzzAppRouter.createCaller(context('buyer-1', facade));

    await caller.deals.request({
      commandId: 'command-omitted-deadline',
      communityId: 'community-1',
      lotId: 'listing-1',
      bankId: 'right-1',
      requestMessage: 'Need help',
    });

    expect(facade.requestDeal).toHaveBeenCalledWith(
      expect.objectContaining({ requestedDeadlineAt: null }),
    );
  });
});
