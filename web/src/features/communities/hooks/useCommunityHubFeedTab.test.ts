import { act, renderHook } from '@testing-library/react';
import { useCommunityHubFeedTab } from './useCommunityHubFeedTab';

const replaceMock = jest.fn();
let searchParamsGet = jest.fn((key: string) => (key === 'feedTab' ? null : null));
let searchParamsToString = jest.fn(() => '');

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/meriter/communities/c1',
  useSearchParams: () => ({
    get: (key: string) => searchParamsGet(key),
    toString: () => searchParamsToString(),
  }),
}));

const ALL = ['posts', 'projects', 'events', 'birzha'] as const;

describe('useCommunityHubFeedTab', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    replaceMock.mockClear();
    searchParamsGet = jest.fn((key: string) => (key === 'feedTab' ? null : null));
    searchParamsToString = jest.fn(() => '');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('switches activeTab immediately without waiting for router.replace', () => {
    const { result } = renderHook(() => useCommunityHubFeedTab(ALL));

    act(() => {
      result.current.setActiveTab('events');
    });

    expect(result.current.activeTab).toBe('events');
    expect(result.current.isTabVisited('events')).toBe(true);
    expect(replaceMock).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(120);
    });

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      '/meriter/communities/c1?feedTab=events',
      { scroll: false },
    );
  });

  it('coalesces rapid clicks into a single URL replace for the last tab', () => {
    const { result } = renderHook(() => useCommunityHubFeedTab(ALL));

    act(() => {
      result.current.setActiveTab('events');
      result.current.setActiveTab('birzha');
      result.current.setActiveTab('projects');
    });

    expect(result.current.activeTab).toBe('projects');

    act(() => {
      jest.advanceTimersByTime(120);
    });

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      '/meriter/communities/c1?feedTab=projects',
      { scroll: false },
    );
  });

  it('does not snap back to an intermediate URL while a newer local tab is pending', () => {
    searchParamsGet = jest.fn((key: string) => (key === 'feedTab' ? null : null));
    const { result, rerender } = renderHook(() => useCommunityHubFeedTab(ALL));

    act(() => {
      result.current.setActiveTab('events');
      result.current.setActiveTab('birzha');
    });
    expect(result.current.activeTab).toBe('birzha');

    // Soft-nav for the first click lands first
    searchParamsGet = jest.fn((key: string) => (key === 'feedTab' ? 'events' : null));
    searchParamsToString = jest.fn(() => 'feedTab=events');
    act(() => {
      rerender();
    });

    expect(result.current.activeTab).toBe('birzha');

    // Final URL catches up
    searchParamsGet = jest.fn((key: string) => (key === 'feedTab' ? 'birzha' : null));
    searchParamsToString = jest.fn(() => 'feedTab=birzha');
    act(() => {
      rerender();
    });

    expect(result.current.activeTab).toBe('birzha');
  });

  it('skips sanitize replace when enableSanitize is false', () => {
    searchParamsGet = jest.fn((key: string) => (key === 'feedTab' ? 'birzha' : null));
    searchParamsToString = jest.fn(() => 'feedTab=birzha');

    renderHook(() =>
      useCommunityHubFeedTab(['posts'], { enableSanitize: false }),
    );

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(replaceMock).not.toHaveBeenCalled();
  });
});
