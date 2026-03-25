import * as jwt from 'jsonwebtoken';

export const COMMUNITY_INVITE_JWT_TYP = 'community_invite_v1';

export interface VerifiedCommunityInvite {
  communityId: string;
  /** When set, accept flow also adds the user to this parent community (project + team). */
  parentCommunityId?: string;
  /** Who created the link (audit). */
  inviterUserId?: string;
  /**
   * When true (default for legacy tokens), accept adds the user immediately.
   * When false (participant-generated link), accept creates a pending join request.
   */
  inviterIsAdmin: boolean;
}

export interface SignCommunityInviteOptions {
  parentCommunityId?: string;
  /** Current user id creating the link. */
  inviterUserId?: string;
  /** Lead/superadmin-created link → direct join on accept. */
  inviterIsAdmin?: boolean;
  expiresIn?: jwt.SignOptions['expiresIn'];
}

export function signCommunityInviteToken(
  communityId: string,
  secret: string,
  options?: SignCommunityInviteOptions,
): string {
  const payload: Record<string, string> = {
    typ: COMMUNITY_INVITE_JWT_TYP,
    cid: communityId,
  };
  if (options?.parentCommunityId) {
    payload.pcid = options.parentCommunityId;
  }
  if (options?.inviterUserId) {
    payload.iid = options.inviterUserId;
  }
  if (options?.inviterIsAdmin === false) {
    payload.iad = '0';
  } else {
    payload.iad = '1';
  }
  return jwt.sign(payload, secret, { expiresIn: options?.expiresIn ?? '90d' });
}

export function verifyCommunityInviteToken(token: string, secret: string): VerifiedCommunityInvite {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid token payload');
  }
  const d = decoded as { typ?: string; cid?: string; pcid?: string; iid?: string; iad?: string };
  if (
    d.typ !== COMMUNITY_INVITE_JWT_TYP ||
    typeof d.cid !== 'string' ||
    d.cid.length < 1
  ) {
    throw new Error('Invalid community invite');
  }
  const parentCommunityId =
    typeof d.pcid === 'string' && d.pcid.length > 0 ? d.pcid : undefined;
  const inviterUserId =
    typeof d.iid === 'string' && d.iid.length > 0 ? d.iid : undefined;
  const inviterIsAdmin = d.iad !== '0';
  return { communityId: d.cid, parentCommunityId, inviterUserId, inviterIsAdmin };
}
