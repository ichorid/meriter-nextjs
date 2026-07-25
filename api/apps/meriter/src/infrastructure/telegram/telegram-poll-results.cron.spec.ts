import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { Poll, type PollSnapshot } from '../../domain/aggregates/poll/poll.entity';
import type { CommunityService } from '../../domain/services/community.service';
import type { PollService } from '../../domain/services/poll.service';
import type { TgBotsService } from '../../domain/services/tg-bots.service';
import { TelegramPollResultsCron } from './telegram-poll-results.cron';

function makeExpiredPoll(overrides: Partial<PollSnapshot> = {}): Poll {
  const now = new Date();
  return Poll.fromSnapshot({
    id: 'poll-1',
    communityId: 'comm-1',
    authorId: 'user-1',
    question: 'Куда едем?',
    options: [
      { id: 'o1', text: 'Море', votes: 8, amount: 7, amountUp: 8, amountDown: 1, casterCount: 2 },
      { id: 'o2', text: 'Горы', votes: 1, amount: -2, amountUp: 1, amountDown: 3, casterCount: 1 },
    ],
    expiresAt: new Date(now.getTime() - 60 * 60 * 1000),
    isActive: true,
    metrics: { totalCasts: 5, casterCount: 3, totalAmount: 13 },
    settings: { quotaAllowed: false },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe('TelegramPollResultsCron', () => {
  let getExpiredUnannouncedPolls: jest.Mock;
  let finalizePollResultsAnnouncement: jest.Mock;
  let getCommunity: jest.Mock;
  let tgSendMessage: jest.Mock;
  let productMode: string;
  let cron: TelegramPollResultsCron;

  beforeEach(() => {
    getExpiredUnannouncedPolls = jest.fn().mockResolvedValue([]);
    finalizePollResultsAnnouncement = jest.fn().mockResolvedValue(undefined);
    getCommunity = jest.fn().mockResolvedValue({
      id: 'comm-1',
      name: 'Команда',
      telegramChatId: '-100123',
    });
    tgSendMessage = jest.fn().mockResolvedValue(555);
    productMode = 'telegram_mvp';

    const pollService = {
      getExpiredUnannouncedPolls,
      finalizePollResultsAnnouncement,
    } as unknown as PollService;
    const communityService = { getCommunity } as unknown as CommunityService;
    const tgBots = { tgSendMessage } as unknown as TgBotsService;
    const configService = {
      get: (key: string) => {
        if (key === 'app') return { productMode };
        if (key === 'bot') return { username: 'meriter_bot' };
        return undefined;
      },
    } as unknown as ConfigService<AppConfig>;

    cron = new TelegramPollResultsCron(
      pollService,
      communityService,
      tgBots,
      configService,
    );
  });

  it('does nothing when there are no expired unannounced polls', async () => {
    await cron.announceExpiredPollResults();
    expect(tgSendMessage).not.toHaveBeenCalled();
    expect(finalizePollResultsAnnouncement).not.toHaveBeenCalled();
  });

  it('sends results with deep-link button and stamps the poll', async () => {
    getExpiredUnannouncedPolls.mockResolvedValue([makeExpiredPoll()]);

    await cron.announceExpiredPollResults();

    expect(tgSendMessage).toHaveBeenCalledTimes(1);
    const call = tgSendMessage.mock.calls[0][0];
    expect(call.chat_id).toBe('-100123');
    expect(call.text).toContain('Голосование завершено');
    expect(call.text).toContain('Лидирует: «Море» (7 заслуг)');
    expect(call.text).toContain('• Горы: -2 (за 1, против 3)');
    expect(call.text).toContain('Участников: 3 · голосов: 5');
    expect(call.reply_markup.inline_keyboard[0][0].url).toBe(
      'https://t.me/meriter_bot?startapp=poll:poll-1',
    );
    expect(finalizePollResultsAnnouncement).toHaveBeenCalledWith('poll-1');
  });

  it('stamps without sending when community has no telegram chat', async () => {
    getExpiredUnannouncedPolls.mockResolvedValue([makeExpiredPoll()]);
    getCommunity.mockResolvedValue({ id: 'comm-1', name: 'Команда' });

    await cron.announceExpiredPollResults();

    expect(tgSendMessage).not.toHaveBeenCalled();
    expect(finalizePollResultsAnnouncement).toHaveBeenCalledWith('poll-1');
  });

  it('stamps without sending when community is frozen', async () => {
    getExpiredUnannouncedPolls.mockResolvedValue([makeExpiredPoll()]);
    getCommunity.mockResolvedValue({
      id: 'comm-1',
      name: 'Команда',
      telegramChatId: '-100123',
      telegramFrozenAt: new Date(),
    });

    await cron.announceExpiredPollResults();

    expect(tgSendMessage).not.toHaveBeenCalled();
    expect(finalizePollResultsAnnouncement).toHaveBeenCalledWith('poll-1');
  });

  it('stamps without sending outside telegram_mvp product mode', async () => {
    productMode = 'web';
    getExpiredUnannouncedPolls.mockResolvedValue([makeExpiredPoll()]);

    await cron.announceExpiredPollResults();

    expect(tgSendMessage).not.toHaveBeenCalled();
    expect(getCommunity).not.toHaveBeenCalled();
    expect(finalizePollResultsAnnouncement).toHaveBeenCalledWith('poll-1');
  });

  it('stamps even when telegram send fails', async () => {
    getExpiredUnannouncedPolls.mockResolvedValue([makeExpiredPoll()]);
    tgSendMessage.mockResolvedValue(null);

    await cron.announceExpiredPollResults();

    expect(finalizePollResultsAnnouncement).toHaveBeenCalledWith('poll-1');
  });

  it('continues processing remaining polls after a failure', async () => {
    const pollA = makeExpiredPoll({ id: 'poll-a' });
    const pollB = makeExpiredPoll({ id: 'poll-b' });
    getExpiredUnannouncedPolls.mockResolvedValue([pollA, pollB]);
    getCommunity
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({
        id: 'comm-1',
        name: 'Команда',
        telegramChatId: '-100123',
      });

    await cron.announceExpiredPollResults();

    expect(finalizePollResultsAnnouncement).toHaveBeenCalledTimes(1);
    expect(finalizePollResultsAnnouncement).toHaveBeenCalledWith('poll-b');
  });
});
