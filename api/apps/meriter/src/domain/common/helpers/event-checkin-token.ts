import { createHmac, timingSafeEqual } from 'crypto';

export interface EventCheckInPayload {
  publicationId: string;
  userId: string;
  exp: number;
}

function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = 4 - (s.length % 4);
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + (pad < 4 ? '='.repeat(pad) : '');
  return Buffer.from(b64, 'base64');
}

export function signEventCheckInToken(secret: string, payload: EventCheckInPayload): string {
  const body = JSON.stringify(payload);
  const sig = createHmac('sha256', secret).update(body).digest();
  return `${b64url(Buffer.from(body, 'utf8'))}.${b64url(sig)}`;
}

export function verifyEventCheckInToken(
  secret: string,
  token: string,
  nowMs: number,
): EventCheckInPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const bodyBuf = b64urlDecode(parts[0]);
    const sigBuf = b64urlDecode(parts[1]);
    const expected = createHmac('sha256', secret).update(bodyBuf).digest();
    if (sigBuf.length !== expected.length || !timingSafeEqual(sigBuf, expected)) {
      return null;
    }
    const parsed = JSON.parse(bodyBuf.toString('utf8')) as EventCheckInPayload;
    if (
      !parsed ||
      typeof parsed.publicationId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (parsed.exp < nowMs) return null;
    return parsed;
  } catch {
    return null;
  }
}
