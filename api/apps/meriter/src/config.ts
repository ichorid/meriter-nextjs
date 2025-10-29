export const URL = process.env.APP_URL || 'https://meriter.pro';

export const BOT_USERNAME = process.env.BOT_USERNAME || 'meriterbot';

export const BOT_TOKEN = process.env.BOT_TOKEN || '';

export const BOT_URL = 'https://api.telegram.org/bot' + BOT_TOKEN;

export const WELCOME_LEADER_MESSAGE = `Добро пожаловать в Меритер!

Добавьте этого бота (@${BOT_USERNAME}) в один из чатов, в котором являетесь администратором. Для этого кликните на заголовок <b>этого</b> чата, далее на кнопку "еще"/"more", а затем на "добавить в группу"/"add to group" и выберите сообщество, в которое будет добавлен бот.`;

export const LEADER_MESSAGE_AFTER_ADDED = `Бот добавлен в сообщество {username}. Пройдите <a href="https://t.me/${BOT_USERNAME}?startapp=login">по этой ссылке</a> чтобы авторизоваться и настроить сообщество.`;

export const WELCOME_USER_MESSAGE = `Добро пожаловать в Меритер! Войдите через приложение: https://t.me/${BOT_USERNAME}?startapp=login`;
export const AUTH_USER_MESSAGE = `Войдите через приложение: https://t.me/${BOT_USERNAME}?startapp=login`;
export const ADDED_PUBLICATION_REPLY = `Сообщение добавлено в приложение https://t.me/${BOT_USERNAME}?startapp={encodedLink}. Перейдите, чтобы оставить своё мнение и узнать, что думают другие`;
export const ADDED_EXTERNAL_PUBLICATION_PENDING_REPLY = `Публикация доступна для рейтингования здесь https://t.me/${BOT_USERNAME}?startapp={encodedLink}. Она будет одобрена для окончательной публикации, после того как администратор в ответ на это сообщение напишет "одобрить"`;

export const APPROVED_PEDNDING_WORDS = ['одобрить'];

//export const stoplist = ["биткоин", "евро", "доллар", "йена", "фунт", "эфир"];

export const WELCOME_COMMUNITY_TEXT1 = `В нашем сообществе действует учет заслуг. 

Любое сообшение здесь с одним из перечисленых хэштегов будет размещено в общем рейтинге. Важные сообщения больше не потеряются, а вклад их авторов будет учтен.

{hashtags}

`;

export const WELCOME_COMMUNITY_TEXT = `В нашем сообществе действует учет заслуг. 

Любое сообшение здесь с одним из перечисленых хэштегов будет размещено в общем рейтинге: 

https://t.me/${BOT_USERNAME}?startapp={encodedCommunityLink}

Важные сообщения больше не потеряются, а вклад их авторов будет учтен.

{hashtags}

<b>💡 Подсказка:</b> Чтобы указать получателя заслуг, используйте /ben:@username в начале сообщения. Например: "/ben:@john #value"

`;
