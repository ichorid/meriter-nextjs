import { smartBack } from '../navigation-helpers';

describe('smartBack', () => {
  const push = jest.fn();
  const back = jest.fn();
  const router = { push, back, replace: jest.fn() } as unknown as Parameters<typeof smartBack>[0];

  const originalHistory = window.history;

  afterEach(() => {
    push.mockClear();
    back.mockClear();
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: originalHistory,
    });
  });

  it('uses router.back when history has a previous entry', () => {
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { length: 3 },
    });

    smartBack(router, '/meriter/projects');

    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('falls back to push when history length is 1', () => {
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { length: 1 },
    });

    smartBack(router, '/meriter/communities/abc');

    expect(back).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/meriter/communities/abc');
  });
});
