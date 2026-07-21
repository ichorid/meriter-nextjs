import {
  isProposalsWindowOpen,
  isThreadWaveOpen,
  resolveProposalsCloseAt,
} from '../src/domain/common/document-voting-thread.util';

describe('document-voting-thread timing helpers', () => {
  const hours = 48;
  const extendMs = hours * 3600 * 1000;

  it('resolveProposalsCloseAt uses explicit proposalsCloseAt when set', () => {
    const closeAt = new Date('2026-01-03T00:00:00Z');
    expect(
      resolveProposalsCloseAt(
        { proposalsCloseAt: closeAt, createdAt: new Date('2026-01-01T00:00:00Z') },
        hours,
      ).toISOString(),
    ).toBe(closeAt.toISOString());
  });

  it('resolveProposalsCloseAt falls back to createdAt + duration for legacy threads', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    expect(
      resolveProposalsCloseAt({ createdAt }, hours).toISOString(),
    ).toBe(new Date(createdAt.getTime() + extendMs).toISOString());
  });

  it('isProposalsWindowOpen is false after proposalsCloseAt', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(createdAt.getTime() + extendMs + 1000);
    expect(isProposalsWindowOpen({ createdAt }, hours, now)).toBe(false);
  });

  it('isThreadWaveOpen respects extended waveEndsAt', () => {
    const waveEndsAt = new Date('2026-01-05T00:00:00Z');
    expect(isThreadWaveOpen({ waveEndsAt, status: 'open' }, new Date('2026-01-04T00:00:00Z'))).toBe(
      true,
    );
    expect(isThreadWaveOpen({ waveEndsAt, status: 'open' }, new Date('2026-01-06T00:00:00Z'))).toBe(
      false,
    );
  });
});
