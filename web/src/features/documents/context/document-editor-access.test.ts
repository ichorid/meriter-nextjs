import { resolveDocumentEditorAccess } from './DocumentCanvasFocusContext';

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
