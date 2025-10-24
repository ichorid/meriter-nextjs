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
export const GLOBAL_FEED_INCOMMING_FROM_COMMUNITY = config.messages.globalFeedIncoming;
export const ADDED_EXTERNAL_PUBLICATION_ADMIN_REPLY =
    'Публикация от имени всего сообщества добавлена в глобальный рейтинг заслуг {link} \n\nЧем больше баллов ("меритов") сообщество наберет в общем рейтинге, тем выше будут котироваться заслуги сообщества при их обмене на товары, услуги, голосованиях.';
export const ADDED_EXTERNAL_PUBLICATION_PENDING_REPLY = `Публикация доступна для рейтингования здесь https://t.me/${config.telegram.botUsername}?startapp=publication&id={link}. Она будет одобрена для окончательной публикации, после того как администратор в ответ на это сообщение напишет "одобрить"`;

export const APPROVED_PEDNDING_WORDS = config.messages.approvedPendingWords;
export const GLOBAL_FEED_HASHTAG = config.messages.globalFeedHashtag;
export const GLOBAL_FEED_SLUG = config.messages.globalFeedSlug;
export const GLOBAL_FEED_TG_CHAT_ID = process.env.GLOBAL_FEED_TG_CHAT_ID || "-1001243037875";

export const WELCOME_COMMUNITY_TEXT1 = `В нашем сообществе действует учет заслуг. 

Любое сообшение здесь с одним из перечисленых хэштегов будет размещено в общем рейтинге. Важные сообщения больше не потеряются, а вклад их авторов будет учтен.

{hashtags}

<b>Специальные хэштеги</b>
#заслуга
Возможность разместить отчет <b>от имени сообщества</b> <a href="https://t.me/${BOT_USERNAME}?startapp=global-feed">в глобальном рейтинге заслуг</a>. 
Отчет должен относится к уже совершенным делам, представляющим общественную пользу, способным вдохоновить других.
Чем выше в рейтинге окажутся отчеты сообщества, тем больше участники получат меритов, которые можно обменять на услуги других сообществ и людей.


`;

export const WELCOME_COMMUNITY_TEXT = `В нашем сообществе действует учет заслуг. 

Любое сообшение здесь с одним из перечисленых хэштегов будет размещено в общем рейтинге: 

https://t.me/${BOT_USERNAME}?startapp=community&id={linkCommunity}

Важные сообщения больше не потеряются, а вклад их авторов будет учтен.

{hashtags}



`;
