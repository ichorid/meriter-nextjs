export const DEMO_TAG = 'uzzHumanDemo' as const;
export const DEMO_EMAIL_DOMAIN = 'uzz-demo.invalid';
export const DEFAULT_DEMO_COMMUNITY_ID = 'a1000001-0000-4000-8000-000000000001';
export const MOCK_MARKER = '[мок]';

export function withMockMarker(text: string): string {
  const prefix = `${MOCK_MARKER} `;
  const trimmed = text.trim();
  return trimmed.startsWith(prefix) ? trimmed : `${prefix}${trimmed}`;
}

export type DemoPersona = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  telegramUserId: string;
  telegramUsername: string;
  bio: string;
  deedTitle: string;
  deedBody: string;
  listing: {
    id: string;
    title: string;
    description: string;
    priceRub: number;
    deliveryMode: 'online' | 'offline' | 'both';
    locationText: string;
    durationText: string;
    availabilityText: string;
  };
  rightId: string;
  publicationId: string;
  nominalRub: number;
};

const id = (n: number) => `a200000${n}-0000-4000-8000-00000000000${n}`;
const pub = (n: number) => `a210000${n}-0000-4000-8000-00000000000${n}`;
const right = (n: number) => `a220000${n}-0000-4000-8000-00000000000${n}`;
const listing = (n: number) => `a230000${n}-0000-4000-8000-00000000000${n}`;

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: id(1), firstName: 'Анна', lastName: 'Соколова', displayName: 'Анна Соколова',
    email: `anna.sokolova@${DEMO_EMAIL_DOMAIN}`, telegramUserId: '900000001', telegramUsername: 'anna_sokolova_demo',
    bio: 'Учу математику 7–9 классы. Живу в районе школы.',
    deedTitle: 'Разобрала с семиклассником дроби перед контрольной',
    deedBody: 'Два вечера сидели над обыкновенными дробями. На контрольной он написал на четыре.',
    listing: {
      id: listing(1), title: 'Репетиторство по математике, 7–9 класс',
      description: 'Разберём тему, с которой буксуете: дроби, уравнения, текстовые задачи. Онлайн или у меня на кухне.',
      priceRub: 800, deliveryMode: 'both', locationText: 'район школы / онлайн',
      durationText: '60 минут', availabilityText: 'будни после 17:00',
    },
    rightId: right(1), publicationId: pub(1), nominalRub: 800,
  },
  {
    id: id(2), firstName: 'Иван', lastName: 'Крылов', displayName: 'Иван Крылов',
    email: `ivan.krylov@${DEMO_EMAIL_DOMAIN}`, telegramUserId: '900000002', telegramUsername: 'ivan_krylov_demo',
    bio: 'Помогаю с переездами и сборкой мебели.',
    deedTitle: 'Помог соседке спустить диван с третьего этажа',
    deedBody: 'Лифт не работал. Вдвоём с братом спустили диван, ничего не поцарапали.',
    listing: {
      id: listing(2), title: 'Помощь с переездом по району',
      description: 'Коробки, мебель, аккуратный спуск по лестнице. Есть ремни и тележка.',
      priceRub: 1500, deliveryMode: 'offline', locationText: 'в пределах района',
      durationText: '2–3 часа', availabilityText: 'суббота и воскресенье',
    },
    rightId: right(2), publicationId: pub(2), nominalRub: 1500,
  },
  {
    id: id(3), firstName: 'Мария', lastName: 'Лебедева', displayName: 'Мария Лебедева',
    email: `maria.lebedeva@${DEMO_EMAIL_DOMAIN}`, telegramUserId: '900000003', telegramUsername: 'maria_lebedeva_demo',
    bio: 'Выгуливаю собак и присматриваю за цветами, когда хозяева уезжают.',
    deedTitle: 'Две недели поливала цветы у семьи в отпуске',
    deedBody: 'Зашла восемь раз. Фикус жив, письма сложила на стол.',
    listing: {
      id: listing(3), title: 'Выгул собаки на час',
      description: 'Спокойный час в парке. Подойдут собаки без агрессии к людям.',
      priceRub: 400, deliveryMode: 'offline', locationText: 'парк у школы',
      durationText: '60 минут', availabilityText: 'утро до уроков и вечер',
    },
    rightId: right(3), publicationId: pub(3), nominalRub: 400,
  },
  {
    id: id(4), firstName: 'Пётр', lastName: 'Орлов', displayName: 'Пётр Орлов',
    email: `petr.orlov@${DEMO_EMAIL_DOMAIN}`, telegramUserId: '900000004', telegramUsername: 'petr_orlov_demo',
    bio: 'Чиню велосипеды и мелочи по дому.',
    deedTitle: 'Поставил цепи и тормоза на велосипеды двору',
    deedBody: 'Трое ребят прикатили ржавые велики. Вечером все трое уже катались.',
    listing: {
      id: listing(4), title: 'Починка велосипеда',
      description: 'Цепь, тормоза, камера, регулировка. Запчасти ваши или подскажу, что купить.',
      priceRub: 600, deliveryMode: 'offline', locationText: 'двор / мой сарай',
      durationText: '1–2 часа', availabilityText: 'после школы',
    },
    rightId: right(4), publicationId: pub(4), nominalRub: 600,
  },
  {
    id: id(5), firstName: 'Ольга', lastName: 'Васильева', displayName: 'Ольга Васильева',
    email: `olga.vasilieva@${DEMO_EMAIL_DOMAIN}`, telegramUserId: '900000005', telegramUsername: 'olga_vasilieva_demo',
    bio: 'Помогаю с выбором вуза и документами.',
    deedTitle: 'Разобрала с девятиклассницей список колледжей',
    deedBody: 'Составили таблицу: сроки, экзамены, общежитие. Она подала в три места без паники.',
    listing: {
      id: listing(5), title: 'Консультация по поступлению',
      description: 'Разберём направления, сроки и что писать в заявлении. Без «гарантий зачисления».',
      priceRub: 700, deliveryMode: 'online', locationText: 'созвон',
      durationText: '45 минут', availabilityText: 'вт и чт вечером',
    },
    rightId: right(5), publicationId: pub(5), nominalRub: 700,
  },
  {
    id: id(6), firstName: 'Никита', lastName: 'Волков', displayName: 'Никита Волков',
    email: `nikita.volkov@${DEMO_EMAIL_DOMAIN}`, telegramUserId: '900000006', telegramUsername: 'nikita_volkov_demo',
    bio: 'Снимаю школьные события на телефон и монтирую короткие ролики.',
    deedTitle: 'Снял концерт хора и отдал ролик родителям в тот же вечер',
    deedBody: 'Две камеры, простой монтаж, без водяных знаков.',
    listing: {
      id: listing(6), title: 'Короткий ролик с мероприятия',
      description: 'Съёмка и монтаж до 60 секунд. Отдам на следующий день.',
      priceRub: 900, deliveryMode: 'both', locationText: 'школа / двор',
      durationText: 'съёмка + вечер монтажа', availabilityText: 'по договорённости',
    },
    rightId: right(6), publicationId: pub(6), nominalRub: 900,
  },
  {
    id: id(7), firstName: 'Елена', lastName: 'Морозова', displayName: 'Елена Морозова',
    email: `elena.morozova@${DEMO_EMAIL_DOMAIN}`, telegramUserId: '900000007', telegramUsername: 'elena_morozova_demo',
    bio: 'Пеку торты к дням рождения. Без мастики «как в Инстаграме», зато вкусно.',
    deedTitle: 'Испекла торт на день рождения соседского первоклассника',
    deedBody: 'Шоколад и сметанный крем. Унесли всё, кроме крошек.',
    listing: {
      id: listing(7), title: 'Домашний торт на день рождения',
      description: 'Торт на 8–10 человек. Заказ за три дня. Самовывоз.',
      priceRub: 1200, deliveryMode: 'offline', locationText: 'самовывоз',
      durationText: 'заказ за 3 дня', availabilityText: 'пятница–воскресенье',
    },
    rightId: right(7), publicationId: pub(7), nominalRub: 1200,
  },
  {
    id: id(8), firstName: 'Дарья', lastName: 'Новикова', displayName: 'Дарья Новикова',
    email: `daria.novikova@${DEMO_EMAIL_DOMAIN}`, telegramUserId: '900000008', telegramUsername: 'daria_novikova_demo',
    bio: 'Организую обмен помощью во дворе. Сама чаще заказываю, чем предлагаю.',
    deedTitle: 'Собрала дворовую ярмарку книг и никто не поругался из‑за очереди',
    deedBody: 'Таблички, очередь, чай. Книги разошлись, стол вернули чистым.',
    listing: {
      id: listing(8), title: 'Помощь с организацией дворовго сбора',
      description: 'Расписание, таблички, кто за чем следит. Сама не таскаю мебель.',
      priceRub: 500, deliveryMode: 'offline', locationText: 'наш двор',
      durationText: 'полдня', availabilityText: 'выходные',
    },
    rightId: right(8), publicationId: pub(8), nominalRub: 500,
  },
];

export type DemoDeal = {
  id: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  rightId: string;
  status: 'requested' | 'accepted' | 'closed' | 'cancelled';
  requestMessage: string;
  daysAgo: number;
  requestExpiresInHours: number;
  acceptedNominalRub: number | null;
  thanked: boolean;
  thanksComment?: string;
};

export const DEMO_DEALS: DemoDeal[] = [
  {
    id: 'a2400001-0000-4000-8000-000000000001',
    buyerId: id(8), sellerId: id(7), listingId: listing(7), rightId: right(7),
    status: 'closed', requestMessage: 'Торт на субботу, шоколад, без орехов — у племянника аллергия.',
    daysAgo: 12, requestExpiresInHours: 48, acceptedNominalRub: 1200, thanked: true,
    thanksComment: 'Торт съели за вечер. Спасибо, Елена.',
  },
  {
    id: 'a2400002-0000-4000-8000-000000000002',
    buyerId: id(3), sellerId: id(2), listingId: listing(2), rightId: right(2),
    status: 'accepted', requestMessage: 'Нужно перенести стеллаж и четыре коробки в соседний подъезд.',
    daysAgo: 2, requestExpiresInHours: 48, acceptedNominalRub: 1500, thanked: false,
  },
  {
    id: 'a2400003-0000-4000-8000-000000000003',
    buyerId: id(6), sellerId: id(1), listingId: listing(1), rightId: right(1),
    status: 'requested', requestMessage: 'Завтра контрольная по уравнениям. Можно вечером созвониться?',
    daysAgo: 0, requestExpiresInHours: 36, acceptedNominalRub: null, thanked: false,
  },
  {
    id: 'a2400004-0000-4000-8000-000000000004',
    buyerId: id(5), sellerId: id(3), listingId: listing(3), rightId: right(3),
    status: 'cancelled', requestMessage: 'Выгулять терьера в четверг утром — уезжаю на олимпиаду.',
    daysAgo: 8, requestExpiresInHours: 48, acceptedNominalRub: 400, thanked: false,
  },
  {
    id: 'a2400005-0000-4000-8000-000000000005',
    buyerId: id(4), sellerId: id(5), listingId: listing(5), rightId: right(5),
    status: 'requested', requestMessage: 'Хочу понять, куда подавать после девятого. Можете созвониться?',
    daysAgo: 3, requestExpiresInHours: -12, acceptedNominalRub: null, thanked: false,
  },
];
