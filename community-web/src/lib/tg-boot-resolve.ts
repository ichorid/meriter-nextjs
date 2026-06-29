export type TelegramCommunityOption = {
  communityId: string;
  name: string;
  telegramChatId: string;
};

export type TelegramChatLookup = {
  communityId?: string;
  isFrozen?: boolean;
} | null;

export type TgBootResolution =
  | { type: 'redirect'; path: string }
  | { type: 'pick'; communities: TelegramCommunityOption[] }
  | { type: 'no_community' }
  | { type: 'frozen' };

/**
 * Resolve Mini App entry target without guessing when the user belongs to several TG communities.
 * Explicit context: start_param community id, post deep link with group chat, or group chat id in initData.
 * Otherwise: list membership (0 / 1 / many).
 */
export async function resolveTelegramBootContext(input: {
  startParam: string | null;
  chatId: string | null;
  devCommunityId?: string | null;
  fetchByTelegramChatId: (chatId: string) => Promise<TelegramChatLookup>;
  listForTelegramUser: () => Promise<TelegramCommunityOption[]>;
}): Promise<TgBootResolution> {
  const startParam = input.startParam?.trim() || null;
  const chatId = input.chatId?.trim() || null;

  if (startParam?.startsWith('post:')) {
    const postId = startParam.slice('post:'.length).trim();
    if (postId && chatId) {
      const byChat = await input.fetchByTelegramChatId(chatId);
      if (byChat?.isFrozen) {
        return { type: 'frozen' };
      }
      if (byChat?.communityId) {
        return { type: 'redirect', path: `/c/${byChat.communityId}/posts/${postId}` };
      }
    }
  }

  if (startParam && !startParam.includes(':')) {
    return { type: 'redirect', path: `/c/${startParam}/me` };
  }

  if (chatId) {
    const byChat = await input.fetchByTelegramChatId(chatId);
    if (byChat?.isFrozen) {
      return { type: 'frozen' };
    }
    if (byChat?.communityId) {
      return { type: 'redirect', path: `/c/${byChat.communityId}/me` };
    }
  }

  const list = await input.listForTelegramUser();
  if (list.length === 0) {
    if (input.devCommunityId) {
      return { type: 'redirect', path: `/c/${input.devCommunityId}/me` };
    }
    return { type: 'no_community' };
  }
  if (list.length === 1) {
    return { type: 'redirect', path: `/c/${list[0]!.communityId}/me` };
  }
  return { type: 'pick', communities: list };
}
