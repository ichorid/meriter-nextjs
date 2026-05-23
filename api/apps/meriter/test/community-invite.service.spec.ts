import { TestSetupHelper } from './helpers/test-setup.helper';
import { CommunityInviteService } from '../src/domain/services/community-invite.service';
import { CommunityService } from '../src/domain/services/community.service';
import {
  signCommunityInviteToken,
} from '../src/common/helpers/community-invite-jwt';
import { uid } from 'uid';

describe('CommunityInviteService', () => {
  let app: any;
  let testDb: any;
  let communityInviteService: CommunityInviteService;
  let communityService: CommunityService;
  const jwtSecret = 'test-jwt-secret';

  beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;
    communityInviteService = app.get(CommunityInviteService);
    communityService = app.get(CommunityService);
  }, 30000);

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  it('creates a short opaque invite token', async () => {
    const communityId = uid();
    await communityService.createCommunity({
      id: communityId,
      name: 'Invite Test Team',
      typeTag: 'team',
      votingRules: { allowedRoles: ['participant', 'lead'], canVoteForOwnPosts: false },
      postingRules: { allowedRoles: ['participant', 'lead'] },
    });

    const { token } = await communityInviteService.createInviteLink({
      communityId,
      inviterUserId: uid(),
      inviterIsAdmin: true,
    });

    expect(token).toBeDefined();
    expect(token.length).toBeLessThan(24);
    expect(token).not.toContain('.');
  });

  it('resolves DB-backed invite tokens', async () => {
    const communityId = uid();
    const inviterUserId = uid();
    await communityService.createCommunity({
      id: communityId,
      name: 'Resolve Test Team',
      typeTag: 'team',
      votingRules: { allowedRoles: ['participant', 'lead'], canVoteForOwnPosts: false },
      postingRules: { allowedRoles: ['participant', 'lead'] },
    });

    const { token } = await communityInviteService.createInviteLink({
      communityId,
      inviterUserId,
      inviterIsAdmin: false,
    });

    const invite = await communityInviteService.resolveInviteToken(token, jwtSecret);
    expect(invite).toMatchObject({
      communityId,
      inviterUserId,
      inviterIsAdmin: false,
    });
  });

  it('still resolves legacy JWT invite tokens', async () => {
    const communityId = uid();
    const token = signCommunityInviteToken(communityId, jwtSecret, {
      inviterUserId: uid(),
      inviterIsAdmin: true,
    });

    const invite = await communityInviteService.resolveInviteToken(token, jwtSecret);
    expect(invite.communityId).toBe(communityId);
    expect(invite.inviterIsAdmin).toBe(true);
  });

  it('returns invite preview for short tokens', async () => {
    const communityId = uid();
    await communityService.createCommunity({
      id: communityId,
      name: 'Preview Team',
      typeTag: 'team',
      votingRules: { allowedRoles: ['participant', 'lead'], canVoteForOwnPosts: false },
      postingRules: { allowedRoles: ['participant', 'lead'] },
    });

    const { token } = await communityInviteService.createInviteLink({
      communityId,
      inviterUserId: uid(),
      inviterIsAdmin: true,
    });

    const preview = await communityInviteService.getInvitePreview(token, jwtSecret);
    expect(preview).toEqual({
      communityId,
      communityName: 'Preview Team',
      isProject: false,
      avatarUrl: undefined,
    });
  });
});
