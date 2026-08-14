import { describe, expect, it } from 'vitest';
import { parseDealFlash } from '@/lib/flash-message';

function params(query: string) {
  return new URLSearchParams(query);
}

describe('parseDealFlash', () => {
  it('accepts only known requested+feeSource pairs', () => {
    expect(parseDealFlash(params('requested=1&feeSource=local'))).toBe(
      'Заявка отправлена. Зарезервирована 1 заслуга с кошелька сообщества.',
    );
    expect(parseDealFlash(params('requested=1&feeSource=global'))).toBe(
      'Заявка отправлена. Зарезервирована 1 заслуга с общего кошелька.',
    );
  });

  it('ignores arbitrary requested values and unknown fee sources', () => {
    expect(parseDealFlash(params('requested=evil'))).toBeNull();
    expect(parseDealFlash(params('requested=1&feeSource=evil'))).toBeNull();
    expect(parseDealFlash(params('requested=1'))).toBeNull();
    expect(parseDealFlash(params(''))).toBeNull();
  });

  it('does not interpolate raw query strings into the message', () => {
    const message = parseDealFlash(params('requested=1&feeSource=local&extra=<script>'));
    expect(message).not.toMatch(/<script>|evil/i);
    expect(message).toBe(
      'Заявка отправлена. Зарезервирована 1 заслуга с кошелька сообщества.',
    );
  });
});
