export type MeritHistoryEnrichment = {
  publicationId?: string;
  publicationTitle?: string | null;
  communityId?: string | null;
  communityName?: string | null;
  pollId?: string;
  pollQuestion?: string | null;
  counterpartyUserId?: string;
  counterpartyDisplayName?: string | null;
  meritTransferId?: string;
  meritTransferComment?: string | null;
  eventPublicationId?: string | null;
  telegramChatId?: string;
  telegramMessageId?: number;
};

export type MeritHistoryRowInput = {
  type: string;
  description?: string | null;
  referenceType?: string | null;
  meritHistoryEnrichment?: MeritHistoryEnrichment | null;
};

const REF_TYPE_LABELS: Record<string, string> = {
  publication_vote: 'Голос за публикацию',
  telegram_vote_mirror: 'Голос в Telegram-чате',
  vote_vote: 'Голос',
  vote: 'Голос',
  comment_vote: 'Голос за комментарий',
  project_appreciation: 'Благодарность проекту',
  investment: 'Инвестиция',
  investment_distribution: 'Распределение инвестиций',
  investment_pool_return: 'Возврат из инвестиционного пула',
  tappalka_show_cost: 'Показ в таппалке',
  tappalka_reward: 'Награда таппалки',
  publication_creation: 'Создание публикации',
  publication_post_cost: 'Публикация поста',
  poll_creation: 'Создание опроса',
  poll_cast: 'Голос в опросе',
  forward_proposal: 'Предложение пересылки',
  publication_withdrawal: 'Вывод с публикации',
  comment_withdrawal: 'Вывод с комментария',
  vote_withdrawal: 'Вывод голоса',
  community_wallet_topup: 'Пополнение кошелька сообщества',
  project_topup: 'Пополнение проекта',
  project_investment: 'Инвестиция в проект',
  project_payout: 'Выплата по проекту',
  project_distribution: 'Распределение по проекту',
  demo_seed: 'Демо-данные',
  demo_seed_balance: 'Демо-баланс',
  fake_data_add: 'Тестовое начисление',
  admin_add_merits: 'Начисление администратором',
};

export function formatMeritHistoryLine(row: MeritHistoryRowInput): string {
  const rt = row.referenceType?.trim() || '';
  const desc = row.description?.trim() || '';
  const en = row.meritHistoryEnrichment;
  const commName = en?.communityName?.trim();

  if (rt === 'merit_transfer') {
    const cp = en?.counterpartyDisplayName?.trim() || 'участника';
    const comment = en?.meritTransferComment?.trim();
    const incoming = row.type === 'deposit';
    const base = incoming ? `Перевод от ${cp}` : `Перевод для ${cp}`;
    return comment ? `${base}: ${comment}` : base;
  }

  if (rt === 'telegram_vote_mirror') {
    const title = en?.publicationTitle?.trim();
    if (row.type === 'deposit') {
      return title ? `Голос в чате за «${title}»` : 'Заслуги за голос в Telegram-чате';
    }
    return title ? `Списание за голос против «${title}»` : 'Списание за голос против поста в чате';
  }

  if (rt === 'publication_vote') {
    const title = en?.publicationTitle?.trim();
    if (title) {
      return row.type === 'deposit'
        ? `Голос за «${title}»`
        : `Голос против «${title}»`;
    }
  }

  if (rt === 'community_starting_merits') {
    return commName
      ? `Приветственные заслуги (${commName})`
      : 'Приветственные заслуги сообщества';
  }

  if (rt === 'welcome_merits') {
    return 'Приветственные заслуги';
  }

  if (rt === 'project_topup') {
    return desc.toLowerCase().includes('donation')
      ? 'Пожертвование в проект'
      : 'Пополнение проекта участником';
  }

  if (rt === 'investment_pool_return' && desc.toLowerCase().includes('remainder')) {
    return 'Возврат остатка инвестиционного пула';
  }

  if (rt === 'publication_creation') {
    const mentionsBirzha =
      /birzha/i.test(desc) ||
      desc.includes('\u0411\u0438\u0440\u0436') ||
      desc.includes('\u0431\u0438\u0440\u0436');
    return mentionsBirzha ? 'Публикация на Бирже' : 'Создание публикации';
  }

  const mapped = REF_TYPE_LABELS[rt];
  if (mapped) {
    if (rt === 'community_wallet_topup' && commName) {
      return `${mapped} (${commName})`;
    }
    if (rt === 'project_investment' && commName) {
      return `${mapped} (${commName})`;
    }
    return mapped;
  }

  if (desc) return desc;
  return rt || 'Операция';
}

import { buildTelegramMessageLink } from '@/lib/telegram-message-link';

export function meritHistoryMessageLink(
  en: MeritHistoryEnrichment | null | undefined,
): { chatId: string; messageId: number; label: string } | null {
  if (!en?.telegramChatId || en.telegramMessageId == null) return null;
  if (!buildTelegramMessageLink(en.telegramChatId, en.telegramMessageId)) return null;
  const title = en.publicationTitle?.trim();
  return {
    chatId: en.telegramChatId,
    messageId: en.telegramMessageId,
    label: title ? `Сообщение «${title}»` : 'Сообщение в чате',
  };
}
