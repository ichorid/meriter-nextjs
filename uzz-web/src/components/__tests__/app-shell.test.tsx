import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { community, logoutHandlers, pathname, linkStatus, configState } = vi.hoisted(() => ({
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
  linkStatus: { linked: true, email: 'a@b.c' as string | null },
  configState: { fakeDataMode: true },
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
        useQuery: () => ({ data: linkStatus, isLoading: false, isError: false, refetch: vi.fn() }),
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
  config: { development: configState },
}));

import { AppShell } from '@/components/app-shell';
import ProfilePage from '@/app/profile/page';

describe('AppShell admin discovery', () => {
  beforeEach(() => {
    community.isUzzAdmin = false;
    pathname.value = '/catalog';
    configState.fakeDataMode = true;
    linkStatus.linked = true;
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

describe('AppShell identity gate', () => {
  beforeEach(() => {
    community.isUzzAdmin = false;
    community.loggedIn = true;
    pathname.value = '/';
    configState.fakeDataMode = false;
    linkStatus.linked = false;
    linkStatus.email = 'ruslan@example.com';
  });

  it('blocks the personal hub until Telegram is linked', () => {
    render(<AppShell><p>скрытый контент</p></AppShell>);

    expect(screen.getByRole('heading', { name: 'Привяжите Telegram' })).toBeVisible();
    expect(screen.queryByText('скрытый контент')).not.toBeInTheDocument();
  });
});

describe('ProfilePage admin entry and logout', () => {
  beforeEach(() => {
    community.isUzzAdmin = false;
    pathname.value = '/profile';
    logoutHandlers.onError = undefined;
    configState.fakeDataMode = true;
    linkStatus.linked = true;
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
