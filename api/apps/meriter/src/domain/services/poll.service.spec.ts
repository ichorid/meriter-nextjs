import type { EventBus } from '../events/event-bus';
import type { PollCastRepository } from '../models/poll/poll-cast.repository';
import type {
  PollPersistencePort,
  PollSnapshot,
} from '../ports/poll.persistence.port';
import { PollService } from './poll.service';

function makeSnapshot(overrides: Partial<PollSnapshot> = {}): PollSnapshot {
  const now = new Date();
  return {
    id: 'poll-1',
    communityId: 'comm-1',
    authorId: 'user-1',
    question: 'Вопрос?',
    options: [
      { id: 'o1', text: 'Да', votes: 0, amount: 0, amountUp: 0, amountDown: 0, casterCount: 0 },
      { id: 'o2', text: 'Нет', votes: 0, amount: 0, amountUp: 0, amountDown: 0, casterCount: 0 },
    ],
    expiresAt: new Date(now.getTime() - 60 * 60 * 1000),
    isActive: true,
    metrics: { totalCasts: 0, casterCount: 0, totalAmount: 0 },
    settings: { quotaAllowed: false },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('PollService results announcement selection', () => {
  let findByFilter: jest.Mock;
  let findById: jest.Mock;
  let updateSnapshot: jest.Mock;
  let service: PollService;

  beforeEach(() => {
    findByFilter = jest.fn().mockResolvedValue([]);
    findById = jest.fn().mockResolvedValue(null);
    updateSnapshot = jest.fn().mockResolvedValue(undefined);
    const persistence = {
      findByFilter,
      findById,
      updateSnapshot,
    } as unknown as PollPersistencePort;
    service = new PollService(
      persistence,
      {} as unknown as PollCastRepository,
      {} as unknown as EventBus,
    );
  });

  it('getExpiredUnannouncedPolls selects only expired polls without resultsAnnouncedAt', async () => {
    const before = new Date();
    await service.getExpiredUnannouncedPolls();

    expect(findByFilter).toHaveBeenCalledTimes(1);
    const [filter, limit, skip] = findByFilter.mock.calls[0];
    const expiresLt = (filter.expiresAt as { $lt: Date }).$lt;
    expect(expiresLt).toBeInstanceOf(Date);
    expect(expiresLt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(filter.$or).toEqual([
      { resultsAnnouncedAt: null },
      { resultsAnnouncedAt: { $exists: false } },
    ]);
    expect(limit).toBe(50);
    expect(skip).toBe(0);
  });

  it('finalizePollResultsAnnouncement deactivates and stamps resultsAnnouncedAt', async () => {
    findById.mockResolvedValue(makeSnapshot());

    await service.finalizePollResultsAnnouncement('poll-1');

    expect(updateSnapshot).toHaveBeenCalledTimes(1);
    const [id, snapshot] = updateSnapshot.mock.calls[0];
    expect(id).toBe('poll-1');
    expect(snapshot.isActive).toBe(false);
    expect(snapshot.resultsAnnouncedAt).toBeInstanceOf(Date);
  });

  it('finalizePollResultsAnnouncement keeps already-inactive polls inactive and stamps them', async () => {
    findById.mockResolvedValue(makeSnapshot({ isActive: false }));

    await service.finalizePollResultsAnnouncement('poll-1');

    const [, snapshot] = updateSnapshot.mock.calls[0];
    expect(snapshot.isActive).toBe(false);
    expect(snapshot.resultsAnnouncedAt).toBeInstanceOf(Date);
  });

  it('finalizePollResultsAnnouncement is a no-op for missing polls', async () => {
    await service.finalizePollResultsAnnouncement('missing');
    expect(updateSnapshot).not.toHaveBeenCalled();
  });
});
