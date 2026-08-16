import { resolveSessionCookieSecure } from '../src/infrastructure/auth/cookie-manager';

describe('UZZ session cookie Secure flag', () => {
  it('is not Secure on HTTP so localhost can store the cookie', () => {
    expect(resolveSessionCookieSecure(false)).toBe(false);
  });

  it('is Secure on HTTPS', () => {
    expect(resolveSessionCookieSecure(true)).toBe(true);
  });
});
