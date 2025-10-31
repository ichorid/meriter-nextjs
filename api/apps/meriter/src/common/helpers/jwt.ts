import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
  uid: string;
  telegramId: string;
  communityTags: string[];
}

/**
 * Sign a JWT token
 * @param payload - The payload to encode
 * @param secret - The secret key
 * @param expiration - Expiration time (e.g., '365d', '7d', '1h')
 * @returns The signed JWT token
 */
export function signJWT(payload: JwtPayload, secret: string, expiration: string): string {
  return jwt.sign(payload, secret, { expiresIn: expiration });
}

/**
 * Verify a JWT token
 * @param token - The JWT token to verify
 * @param secret - The secret key
 * @returns The decoded payload
 */
export function verifyJWT(token: string, secret: string): any {
  return jwt.verify(token, secret);
}
