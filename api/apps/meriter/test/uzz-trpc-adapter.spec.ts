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
      commandId: '11111111-1111-4111-8111-111111111111', communityId: 'community-1',
      patch: { notifyDealClosed: false },
    });

    expect(facade.updateSettings).toHaveBeenCalledWith({
      commandId: '11111111-1111-4111-8111-111111111111', communityId: 'community-1', adminId: 'admin-1',
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
      commandId: '22222222-2222-4222-8222-222222222222',
      communityId: 'community-1',
      lotId: 'listing-1',
      bankId: 'right-1',
      requestMessage: 'Need help',
      requestedDeadlineAt,
    });
    await caller.deals.accept({
      commandId: '33333333-3333-4333-8333-333333333333',
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

  it('forwards shared wallet totals from the facade without recomputing', async () => {
    const facade = {
      getFeeBalances: jest.fn().mockResolvedValue({
        localBalance: 5,
        globalBalance: 0,
        totalBalance: 5,
        mode: 'shared',
      }),
    };
    const caller = uzzAppRouter.createCaller(context('buyer-1', facade));

    await expect(caller.wallet.getBalance({ communityId: 'community-1' })).resolves.toEqual({
      communityId: 'community-1',
      localBalance: 5,
      globalBalance: 0,
      totalBalance: 5,
      mode: 'shared',
      canPayFee: true,
    });
    expect(facade.getFeeBalances).toHaveBeenCalledWith('buyer-1', 'community-1');
  });

  it('forwards ledger cursor pagination without skip', async () => {
    const cursor = { createdAt: new Date('2026-08-14T00:00:00.000Z'), id: 'led-029' };
    const facade = {
      listLedger: jest.fn().mockResolvedValue({
        items: [{ id: 'led-030' }],
        nextCursor: null,
      }),
    };
    const caller = uzzAppRouter.createCaller(context('user-1', facade));

    await expect(
      caller.ledger.listMine({ communityId: 'community-1', limit: 30, cursor }),
    ).resolves.toEqual({ items: [{ id: 'led-030' }], nextCursor: null });
    expect(facade.listLedger).toHaveBeenCalledWith({
      communityId: 'community-1',
      viewerId: 'user-1',
      mineOnly: true,
      limit: 30,
      cursor,
    });
  });

  it('rejects ledger pages larger than 50', async () => {
    const caller = uzzAppRouter.createCaller(context('user-1', { listLedger: jest.fn() }));

    await expect(
      caller.ledger.listMine({ communityId: 'community-1', limit: 51 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('forwards an omitted deal deadline as null', async () => {
    const facade = { requestDeal: jest.fn().mockResolvedValue({ id: 'deal-1' }) };
    const caller = uzzAppRouter.createCaller(context('buyer-1', facade));

    await caller.deals.request({
      commandId: '44444444-4444-4444-8444-444444444444',
      communityId: 'community-1',
      lotId: 'listing-1',
      bankId: 'right-1',
      requestMessage: 'Need help',
    });

    expect(facade.requestDeal).toHaveBeenCalledWith(
      expect.objectContaining({ requestedDeadlineAt: null }),
    );
  });

  it('treats an empty deadline string as omitted', async () => {
    const facade = { requestDeal: jest.fn().mockResolvedValue({ id: 'deal-1' }) };
    const caller = uzzAppRouter.createCaller(context('buyer-1', facade));

    await caller.deals.request({
      commandId: '55555555-5555-4555-8555-555555555555',
      communityId: 'community-1',
      lotId: 'listing-1',
      bankId: 'right-1',
      requestMessage: 'Need help',
      requestedDeadlineAt: '' as unknown as Date,
    });

    expect(facade.requestDeal).toHaveBeenCalledWith(
      expect.objectContaining({ requestedDeadlineAt: null }),
    );
  });

  it('sets the UZZ cookie from fake login without returning the jwt', async () => {
    const ctx = context(null, {});
    (ctx.configService.get as jest.Mock).mockReturnValue({ fakeDataMode: true });
    (ctx.authService.authenticateFakeUser as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
      jwt: 'secret-jwt',
    });
    const caller = uzzAppRouter.createCaller(ctx);

    await expect(caller.auth.authenticateFake({})).resolves.toEqual({ user: { id: 'user-1' } });
    expect(ctx.cookieManager.establishUzzJwtAuth).toHaveBeenCalledWith(
      ctx.res, 'secret-jwt', ctx.req,
    );
  });
});
