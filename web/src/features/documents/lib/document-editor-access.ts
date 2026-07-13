export type DocumentCreatorsMode = 'admins' | 'members';

export type DocumentEditorUser = {
  id?: string;
  globalRole?: string;
} | null | undefined;

export type DocumentEditorCommunity = {
  isAdmin?: boolean;
} | null | undefined;

export function isPlatformSuperadmin(user: DocumentEditorUser): boolean {
  return user?.globalRole === 'superadmin';
}

export function resolveUserRoleInCommunity(input: {
  user: DocumentEditorUser;
  communityId: string;
  userRoles: Array<{ communityId?: string; role?: string } | null | undefined>;
}): 'superadmin' | 'lead' | 'participant' | null {
  if (isPlatformSuperadmin(input.user)) {
    return 'superadmin';
  }
  const role = input.userRoles.find((r) => r?.communityId === input.communityId)?.role;
  if (role === 'lead' || role === 'participant') {
    return role;
  }
  return null;
}

export function resolveCanManageCollaborativeDocument(input: {
  user: DocumentEditorUser;
  community: DocumentEditorCommunity;
  docCreatedBy?: string | null;
  userRoleInCommunity: 'superadmin' | 'lead' | 'participant' | null;
}): boolean {
  if (!input.user?.id) {
    return false;
  }
  if (isPlatformSuperadmin(input.user)) {
    return true;
  }
  if (input.userRoleInCommunity === 'superadmin') {
    return true;
  }
  if (input.community?.isAdmin === true) {
    return true;
  }
  if (input.docCreatedBy != null && input.docCreatedBy === input.user.id) {
    return true;
  }
  return input.userRoleInCommunity === 'lead';
}

export function resolveIsCommunityMember(input: {
  user: DocumentEditorUser;
  userRoleInCommunity: 'superadmin' | 'lead' | 'participant' | null;
}): boolean {
  if (isPlatformSuperadmin(input.user)) {
    return true;
  }
  return input.userRoleInCommunity === 'lead' || input.userRoleInCommunity === 'participant';
}

export function resolveDocumentEditorAccess(input: {
  userId: string | undefined;
  canManageDocument: boolean;
  isCommunityMember: boolean;
  documentCreators: DocumentCreatorsMode;
}): { canUseGdocsEditor: boolean; canProposeDocumentVariants: boolean } {
  const signedIn = Boolean(input.userId);
  const canUseGdocsEditor = signedIn && input.canManageDocument;
  const canProposeDocumentVariants =
    signedIn &&
    input.isCommunityMember &&
    !input.canManageDocument &&
    input.documentCreators === 'members';
  return { canUseGdocsEditor, canProposeDocumentVariants };
}
