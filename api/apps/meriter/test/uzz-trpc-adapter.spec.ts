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
});
