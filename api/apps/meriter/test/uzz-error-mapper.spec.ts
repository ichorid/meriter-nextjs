import { TRPCError } from '@trpc/server';
import { executeUzz } from '../src/adapters/trpc/handlers/uzz-error-mapper';
import { UzzForbiddenError } from '../src/domain/uzz/errors';

describe('executeUzz', () => {
  it('maps a domain error even when webpack breaks instanceof', async () => {
    const cause = new UzzForbiddenError('DEAL_COUNTERPARTY_IDENTITY_REQUIRED');
    Object.setPrototypeOf(cause, Error.prototype);

    await expect(
      executeUzz(async () => {
        throw cause;
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'DEAL_COUNTERPARTY_IDENTITY_REQUIRED',
    });
    expect(cause instanceof UzzForbiddenError).toBe(false);
  });

  it('maps numeric Mongo duplicate keys instead of leaking INTERNAL_SERVER_ERROR', async () => {
    const cause = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

    await expect(
      executeUzz(async () => {
        throw cause;
      }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(
      executeUzz(async () => {
        throw cause;
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'UZZ_CONCURRENT_MODIFICATION',
    });
  });
});
