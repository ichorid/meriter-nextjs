import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { community, logoutHandlers, pathname } = vi.hoisted(() => ({
  community: {
    communityId: 'community-1',
    isUzzAdmin: false,
    loggedIn: true,
    sessionLoading: false,
    sessionExpired: false,
    sessionUnreachable: false,
  },
  logoutHandlers: {
    onError: undefined as ((err: { message?: string }) => void) | undefined,
  },
  pathname: { value: '/profile' },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/use-uzz-community', () => ({
  useUzzCommunityId: () => community,
}));

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    identity: {
      getLinkStatus: {
        useQuery: () => ({ data: { linked: true, email: 'a@b.c' }, isLoading: false, isError: false, refetch: vi.fn() }),
      },
      startTelegramLink: { useMutation: () => ({ isPending: false, mutate: vi.fn(), data: undefined }) },
    },
    deals: {
      list: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
    },
    auth: {
      me: { useQuery: () => ({ data: { displayName: 'Анна', communityName: 'Пилот' }, isLoading: false, isError: false, refetch: vi.fn() }) },
      logout: {
        useMutation: (options?: { onError?: (err: { message?: string }) => void }) => {
          logoutHandlers.onError = options?.onError;
          return {
            isPending: false,
            mutate: () => logoutHandlers.onError?.({ message: 'UNAUTHORIZED' }),
          };
        },
      },
    },
  },
}));

vi.mock('@/config', () => ({
  config: { development: { fakeDataMode: true } },
}));

import { AppShell } from '@/components/app-shell';
import ProfilePage from '@/app/profile/page';

describe('AppShell admin discovery', () => {
  beforeEach(() => {
    community.isUzzAdmin = false;
    pathname.value = '/catalog';
  });

  it('hides the admin mobile entry for non-admins', () => {
    render(<AppShell><p>контент</p></AppShell>);

    expect(screen.queryByRole('link', { name: 'Настройки платформы' })).not.toBeInTheDocument();
  });

  it('shows Настройки платформы in mobile navigation for admins only', () => {
    community.isUzzAdmin = true;
    render(<AppShell><p>контент</p></AppShell>);

    const mobileNav = screen.getAllByRole('navigation').at(-1);
    expect(mobileNav).toBeTruthy();
    expect(mobileNav).toHaveTextContent('Настройки платформы');
    expect(mobileNav!.querySelector('a[href="/admin"]')).toHaveAttribute('href', '/admin');
  });
});

describe('ProfilePage admin entry and logout', () => {
  beforeEach(() => {
    community.isUzzAdmin = false;
    pathname.value = '/profile';
    logoutHandlers.onError = undefined;
  });

  it('shows Настройки платформы in profile for admins and hides it for others', () => {
    const { rerender } = render(<ProfilePage />);
    expect(screen.queryByRole('heading', { name: 'Аккаунт' })?.parentElement?.querySelector('a[href="/admin"]')).toBeNull();

    community.isUzzAdmin = true;
    rerender(<ProfilePage />);
    const profileAdmin = screen.getByRole('heading', { name: 'Аккаунт' }).parentElement?.querySelector('a[href="/admin"]');
    expect(profileAdmin).toHaveTextContent('Настройки платформы');
    expect(profileAdmin).toHaveAttribute('href', '/admin');
  });

  it('surfaces a logout failure in a visible alert', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    await user.click(screen.getByRole('button', { name: 'Выйти' }));

    const alert = screen.getByRole('alert');
    expect(alert).toBeVisible();
    expect(alert).toHaveTextContent('Нужно войти по ссылке из письма');
  });
});
