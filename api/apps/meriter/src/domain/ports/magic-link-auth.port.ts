export const MAGIC_LINK_AUTH_PORT = Symbol('MAGIC_LINK_AUTH_PORT');

export type RedeemMagicLinkResult = {
  channel: 'sms' | 'email';
  target: string;
  linkToUserId?: string;
};

export type MagicLinkAuthPort = {
  redeem(token: string): Promise<RedeemMagicLinkResult | null>;
};
