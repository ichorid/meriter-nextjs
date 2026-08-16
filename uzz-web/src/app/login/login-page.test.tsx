import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { replace, meState } = vi.hoisted(() => ({
  replace: vi.fn(),
  meState: { data: undefined as { id: string } | undefined },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { invalidate: vi.fn() } } }),
    auth: {
      me: { useQuery: () => ({ data: meState.data, isLoading: false, error: null }) },
      sendEmailLoginLink: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      authenticateFake: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import LoginPage from './page';

function setNext(next: string) {
  window.history.replaceState({}, '', `/login?next=${encodeURIComponent(next)}`);
}

describe('LoginPage post-login navigation', () => {
  beforeEach(() => {
    replace.mockReset();
    meState.data = { id: 'user-1' };
    sessionStorage.clear();
    window.history.replaceState({}, '', '/login');
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it.each([
    ['//evil.test', '/'],
    ['/\\evil.test', '/'],
    ['/%5c%5cevil.test', '/'],
    ['/%255c%255cevil.test', '/'],
    ['https://evil.test', '/'],
    ['javascript:alert(1)', '/'],
    ['/deals?requested=1', '/deals?requested=1'],
  ])('routes next=%s to %s without throwing', (input, expected) => {
    setNext(input);
    expect(() => render(<LoginPage />)).not.toThrow();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(expected);
  });
});
