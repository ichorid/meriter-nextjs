import {
  isLegacyCommunityInviteJwtToken,
  signCommunityInviteToken,
  verifyCommunityInviteToken,
} from '../src/common/helpers/community-invite-jwt';

describe('community-invite-jwt', () => {
  const secret = 'test-secret';

  describe('isLegacyCommunityInviteJwtToken', () => {
    it('detects JWT-shaped tokens', () => {
      const token = signCommunityInviteToken('comm-1', secret);
      expect(isLegacyCommunityInviteJwtToken(token)).toBe(true);
    });

    it('returns false for short opaque tokens', () => {
      expect(isLegacyCommunityInviteJwtToken('x7Kp2mNqWx3aB9cD')).toBe(false);
    });
  });

  describe('verifyCommunityInviteToken', () => {
    it('round-trips legacy payload fields', () => {
      const token = signCommunityInviteToken('comm-1', secret, {
        parentCommunityId: 'parent-1',
        inviterUserId: 'user-1',
        inviterIsAdmin: false,
      });
      expect(verifyCommunityInviteToken(token, secret)).toEqual({
        communityId: 'comm-1',
        parentCommunityId: 'parent-1',
        inviterUserId: 'user-1',
        inviterIsAdmin: false,
      });
    });
  });
});
