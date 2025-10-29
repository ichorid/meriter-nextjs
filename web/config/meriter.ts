// Legacy configuration file - now uses centralized config
// This file is kept for backward compatibility
// New code should use the centralized config system from @/config

import { config } from '@/config';

// Re-export from centralized config for backward compatibility
export const URL = config.app.url;
export const BOT_USERNAME = config.telegram.botUsername;
export const BOT_TOKEN = config.telegram.botToken || "";
export const BOT_URL = config.telegram.botUrl;

export const WELCOME_LEADER_MESSAGE = config.messages.welcomeLeader;
export const LEADER_MESSAGE_AFTER_ADDED = `Бот добавлен в сообщество {username}. Пройдите <a href="https://t.me/${config.telegram.botUsername}?startapp=login">по этой ссылке</a> чтобы авторизоваться и настроить сообщество.`;
export const WELCOME_USER_MESSAGE = config.messages.welcomeUser;
export const AUTH_USER_MESSAGE = config.messages.authUser;
export const ADDED_PUBLICATION_REPLY = config.messages.addedPublicationReply;
export const ADDED_EXTERNAL_PUBLICATION_PENDING_REPLY = `Публикация доступна для рейтингования здесь https://t.me/${config.telegram.botUsername}?startapp=publication&id={link}. Она будет одобрена для окончательной публикации, после того как администратор в ответ на это сообщение напишет "одобрить"`;

export const APPROVED_PEDNDING_WORDS = config.messages.approvedPendingWords;

export const WELCOME_COMMUNITY_TEXT1 = `В нашем сообществе действует учет заслуг. 

Любое сообшение здесь с одним из перечисленых хэштегов будет размещено в общем рейтинге. Важные сообщения больше не потеряются, а вклад их авторов будет учтен.

{hashtags}

`;

export const WELCOME_COMMUNITY_TEXT = `В нашем сообществе действует учет заслуг. 

Любое сообшение здесь с одним из перечисленых хэштегов будет размещено в общем рейтинге: 

https://t.me/${BOT_USERNAME}?startapp=community&id={linkCommunity}

Важные сообщения больше не потеряются, а вклад их авторов будет учтен.

{hashtags}



`;
