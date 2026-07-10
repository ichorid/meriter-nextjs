import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { resolvePersonalWalletFromMap } from '@/lib/utils/wallet';

describe('resolvePersonalWalletFromMap', () => {
  const map = new Map([
    [GLOBAL_COMMUNITY_ID, { communityId: GLOBAL_COMMUNITY_ID, balance: 42 }],
    ['local-team', { communityId: 'local-team', balance: 7 }],
  ]);

  it('uses global wallet for priority hubs', () => {
    const result = resolvePersonalWalletFromMap(map, {
      id: 'md-id',
      typeTag: 'marathon-of-good',
    });
    expect(result).toEqual({ balance: 42, communityId: 'md-id' });
  });

  it('uses global wallet for projects', () => {
    const result = resolvePersonalWalletFromMap(map, {
      id: 'proj-id',
      isProject: true,
    });
    expect(result).toEqual({ balance: 42, communityId: 'proj-id' });
  });

  it('uses community wallet for local teams', () => {
    const result = resolvePersonalWalletFromMap(map, {
      id: 'local-team',
      typeTag: 'team',
    });
    expect(result).toEqual({ balance: 7, communityId: 'local-team' });
  });
});
