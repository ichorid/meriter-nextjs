export const URL = process.env.APP_URL || 'https://meriter.ru';

export const BOT_USERNAME = process.env.BOT_USERNAME || 'meriterbot';

export const BOT_TOKEN = process.env.BOT_TOKEN || '';

export const BOT_URL = 'https://api.telegram.org/bot' + BOT_TOKEN;

export const WELCOME_LEADER_MESSAGE = `Добро пожаловать в Меритерру!

Добавьте этого бота (@${BOT_USERNAME}) в один из чатов, в котором являетесь администратором. Для этого кликните на заголовок <b>этого</b> чата, далее на кнопку "еще"/"more", а затем на "добавить в группу"/"add to group" и выберите сообщество, в которое будет добавлен бот.`;

export const LEADER_MESSAGE_AFTER_ADDED = `Бот добавлен в сообщество {username}. Пройдите <a href="${
  URL + '/mt/manage'
}">по этой ссылке</a> чтобы авторизоваться, а затем - задать его ценности и настройки. `;

export const WELCOME_USER_MESSAGE = `Добро пожаловать в Меритерру! Пройдите <a href="${URL}/auth/{authJWT}">по этой ссылке для авторизации</a> `;
export const AUTH_USER_MESSAGE = `Пройдите <a href="${URL}/auth/{authJWT}">по этой ссылке, чтобы продолжить</a> `;
export const ADDED_PUBLICATION_REPLY = `Сообщение добавлено на сайт ${URL}/mt/{link}. Перейдите, чтобы оставить своё мнение и узнать, что думают другие`;
export const MERITERRA_INCOMMING_FROM_COMMUNITY = `Добавлена публикация от {communityName}: ${URL}/mt/meriterra/{link}\n--\n{text}`;
export const MARKET_INCOMMING_FROM_COMMUNITY = `Добавлено объявление от {communityName}: ${URL}/mt/market/{link}\n--\n{text}`;
export const ADDED_EXTERNAL_PUBLICATION_ADMIN_REPLY =
  'Публикация от имени всего сообщества добавлена в глобальный рейтинг заслуг {link} \n\nЧем больше баллов ("меритов") сообщество наберет в общем рейтинге, тем выше будут котироваться заслуги сообщества при их обмене на товары, услуги, голосованиях.';
export const ADDED_EXTERNAL_PUBLICATION_PENDING_REPLY = `Публикация доступна для рейтингования здесь ${URL}/mt/{link}. Она будет одобрена для окончательной публикации, после того как администратор в ответ на это сообщение напишет "одобрить"`;

export const APPROVED_PEDNDING_WORDS = ['одобрить'];

export const MERITERRA_HASHTAG = 'заслуга';
export const MERITERRA_SLUG = 'merit';
export const MERITERRA_TG_CHAT_ID = process.env.MERITERRA_TG_CHAT_ID || '-1001243037875';
export const MARKET_HASHTAG = 'услуга';
export const MARKET_SLUG = 'market';
export const MARKET_TG_CHAT_ID = process.env.MARKET_TG_CHAT_ID || '-1001445555084';

//export const stoplist = ["биткоин", "евро", "доллар", "йена", "фунт", "эфир"];

export const WELCOME_COMMUNITY_TEXT1 = `В нашем сообществе действует учет заслуг. 

Любое сообшение здесь с одним из перечисленых хэштегов будет размещено в общем рейтинге. Важные сообщения больше не потеряются, а вклад их авторов будет учтен.

{hashtags}

<b>Специальные хэштеги</b>
#услуга
Чтобы разместить предложение или запрос услуги/товара/ресурса <b>от имени сообщества</b> на <a href="${URL}/mt/${MARKET_SLUG}">общей доске возможностей</a>

#заслуга
Возможность разместить отчет <b>от имени сообщества</b> <a href="${URL}/mt/${MERITERRA_SLUG}">в глобальном рейтинге заслуг</a>. 
Отчет должен относится к уже совершенным делам, представляющим общественную пользу, способным вдохоновить других.
Чем выше в рейтинге окажутся отчеты сообщества, тем больше участники получат меритов, которые можно обменять на услуги других сообществ и людей.


`;

export const WELCOME_COMMUNITY_TEXT = `В нашем сообществе действует учет заслуг. 

Любое сообшение здесь с одним из перечисленых хэштегов будет размещено в общем рейтинге: 

${URL}/mt/c/{linkCommunity}

Важные сообщения больше не потеряются, а вклад их авторов будет учтен.

{hashtags}



`;
