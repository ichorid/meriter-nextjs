import { canUseWalletForVoting } from '@/components/organisms/VotingPopup/voting-utils';
import type { Community } from '@meriter/shared-types';

describe('canUseWalletForVoting', () => {
  const baseCommunity: Community = {
    id: 'c1',
    name: 'Community',
    createdAt: new Date().toISOString(),
    settings: {},
    hashtags: [],
    isActive: true,
  } as unknown as Community;

  it('returns false when walletBalance is 0', () => {
    expect(canUseWalletForVoting(0, baseCommunity)).toBe(false);
  });

  it('returns true when spendsMerits is undefined and walletBalance > 0', () => {
    const community = {
      ...baseCommunity,
      votingSettings: {},
    } as unknown as Community;
    expect(canUseWalletForVoting(10, community)).toBe(true);
  });

  it('returns true when spendsMerits is true and walletBalance > 0', () => {
    const community = {
      ...baseCommunity,
      votingSettings: { spendsMerits: true },
    } as unknown as Community;
    expect(canUseWalletForVoting(10, community)).toBe(true);
  });

  it('returns false when spendsMerits is false even if walletBalance > 0', () => {
    const community = {
      ...baseCommunity,
      votingSettings: { spendsMerits: false },
    } as unknown as Community;
    expect(canUseWalletForVoting(10, community)).toBe(false);
  });
});


