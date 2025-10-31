export const URL = process.env.APP_URL || 'https://meriter.pro';

export const BOT_USERNAME = process.env.BOT_USERNAME || 'meriterbot';

export const BOT_TOKEN = process.env.BOT_TOKEN || '';

export const BOT_URL = 'https://api.telegram.org/bot' + BOT_TOKEN;

export const WELCOME_LEADER_MESSAGE = `Добро пожаловать в Меритер\!

Добавьте этого бота (@${BOT_USERNAME}) в один из чатов, в котором являетесь администратором. Для этого кликните на заголовок этого чата, далее на кнопку "еще"/"more", а затем на "добавить в группу"/"add to group" и выберите сообщество, в которое будет добавлен бот.`;

export const LEADER_MESSAGE_AFTER_ADDED = `Бот добавлен в сообщество {username}\. Авторизуйтесь и настройте сообщество: [Web](${URL}) [App](https://t.me/${BOT_USERNAME}?startapp=setup)`;

export const WELCOME_USER_MESSAGE = `Добро пожаловать в Меритер\! Войдите: [Web](${URL}/meriter/login) [App](https://t.me/${BOT_USERNAME}?startapp=login)`;
export const AUTH_USER_MESSAGE = `Авторизация: [Web](${URL}/meriter/login) [App](https://t.me/${BOT_USERNAME}?startapp=login)`;
export const ADDED_PUBLICATION_REPLY = `Сообщение добавлено: {dualLinks}\\. Перейдите, чтобы оставить своё мнение и узнать, что думают другие`;
export const ADDED_EXTERNAL_PUBLICATION_PENDING_REPLY = `Публикация доступна для рейтингования: {dualLinks}\\. Она будет одобрена для окончательной публикации, после того как администратор в ответ на это сообщение напишет "одобрить"`;

export const APPROVED_PEDNDING_WORDS = ['одобрить'];

//export const stoplist = ["биткоин", "евро", "доллар", "йена", "фунт", "эфир"];

export const WELCOME_COMMUNITY_TEXT1 = `В нашем сообществе действует учет заслуг\\. 

Любое сообшение здесь с одним из перечисленых хэштегов будет размещено в общем рейтинге\\. Важные сообщения больше не потеряются, а вклад их авторов будет учтен\\.

{hashtags}

`;

export const WELCOME_COMMUNITY_TEXT = `В нашем сообществе действует учет заслуг\\. 

Любое сообшение здесь с одним из перечисленых хэштегов будет размещено в общем рейтинге: 

{dualLinksCommunity}

Важные сообщения больше не потеряются, а вклад их авторов будет учтен\\.

{hashtags}

💡 Подсказка: Чтобы указать получателя заслуг, используйте /ben:@username в начале сообщения. Например: "/ben:@john #value"

`;
