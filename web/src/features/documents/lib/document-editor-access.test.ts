import {
  resolveCanManageCollaborativeDocument,
  resolveDocumentEditorAccess,
  resolveIsCommunityMember,
  resolveUserRoleInCommunity,
} from './document-editor-access';

describe('resolveUserRoleInCommunity', () => {
  it('returns superadmin for platform superadmin without community role row', () => {
    expect(
      resolveUserRoleInCommunity({
        user: { id: 'u1', globalRole: 'superadmin' },
        communityId: 'c1',
        userRoles: [{ communityId: 'c1', role: 'participant' }],
      }),
    ).toBe('superadmin');
  });
});

describe('resolveCanManageCollaborativeDocument', () => {
  it('grants manage when user has global superadmin role', () => {
    expect(
      resolveCanManageCollaborativeDocument({
        user: { id: 'u1', globalRole: 'superadmin' },
        community: null,
        userRoleInCommunity: 'superadmin',
      }),
    ).toBe(true);
  });

  it('grants manage when community isAdmin is true (server-side superadmin/lead)', () => {
    expect(
      resolveCanManageCollaborativeDocument({
        user: { id: 'u1' },
        community: { isAdmin: true },
        userRoleInCommunity: 'participant',
      }),
    ).toBe(true);
  });

  it('denies manage for participant without admin signals', () => {
    expect(
      resolveCanManageCollaborativeDocument({
        user: { id: 'u1' },
        community: { isAdmin: false },
        userRoleInCommunity: 'participant',
      }),
    ).toBe(false);
  });
});

describe('resolveIsCommunityMember', () => {
  it('treats platform superadmin as community member for document flows', () => {
    expect(
      resolveIsCommunityMember({
        user: { id: 'u1', globalRole: 'superadmin' },
        userRoleInCommunity: 'superadmin',
      }),
    ).toBe(true);
  });
});

describe('resolveDocumentEditorAccess', () => {
  it('gives lead the gdocs editor, not participant propose canvas', () => {
    expect(
      resolveDocumentEditorAccess({
        userId: 'u1',
        canManageDocument: true,
        isCommunityMember: true,
        documentCreators: 'members',
      }),
    ).toEqual({
      canUseGdocsEditor: true,
      canProposeDocumentVariants: false,
    });
  });

  it('gives member participants propose access (unified editor, not lead manage)', () => {
    expect(
      resolveDocumentEditorAccess({
        userId: 'u1',
        canManageDocument: false,
        isCommunityMember: true,
        documentCreators: 'members',
      }),
    ).toEqual({
      canUseGdocsEditor: false,
      canProposeDocumentVariants: true,
    });
  });

  it('gives platform superadmin manage editor, not participant propose mode', () => {
    expect(
      resolveDocumentEditorAccess({
        userId: 'u1',
        canManageDocument: true,
        isCommunityMember: true,
        documentCreators: 'members',
      }),
    ).toEqual({
      canUseGdocsEditor: true,
      canProposeDocumentVariants: false,
    });
  });

  it('blocks participant propose when only admins may create variants', () => {
    expect(
      resolveDocumentEditorAccess({
        userId: 'u1',
        canManageDocument: false,
        isCommunityMember: true,
        documentCreators: 'admins',
      }),
    ).toEqual({
      canUseGdocsEditor: false,
      canProposeDocumentVariants: false,
    });
  });

  it('blocks propose for signed-out viewers', () => {
    expect(
      resolveDocumentEditorAccess({
        userId: undefined,
        canManageDocument: false,
        isCommunityMember: false,
        documentCreators: 'members',
      }),
    ).toEqual({
      canUseGdocsEditor: false,
      canProposeDocumentVariants: false,
    });
  });
});
