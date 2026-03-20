import * as jwt from 'jsonwebtoken';

export const COMMUNITY_INVITE_JWT_TYP = 'community_invite_v1';

export function signCommunityInviteToken(
  communityId: string,
  secret: string,
  expiresIn: jwt.SignOptions['expiresIn'] = '90d',
): string {
  return jwt.sign(
    { typ: COMMUNITY_INVITE_JWT_TYP, cid: communityId },
    secret,
    { expiresIn },
  );
}

export function verifyCommunityInviteToken(token: string, secret: string): string {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid token payload');
  }
  const d = decoded as { typ?: string; cid?: string };
  if (
    d.typ !== COMMUNITY_INVITE_JWT_TYP ||
    typeof d.cid !== 'string' ||
    d.cid.length < 1
  ) {
    throw new Error('Invalid community invite');
  }
  return d.cid;
}
