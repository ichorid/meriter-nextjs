# Передача заслуг

Функционал прямой передачи заслуг между участниками на платформе Meriter / «Формула Будущего».

**Статус**: Черновик — на согласование CEO и CTO  
**Дата**: Апрель 2026

---

## Оглавление

1. [Общая концепция](#1-общая-концепция)  
2. [Текущее состояние](#2-текущее-состояние)  
3. [Новый механизм: передача заслуг](#3-новый-механизм-передача-заслуг)  
4. [Диалог передачи](#4-диалог-передачи)  
5. [Правила маршрутизации](#5-правила-маршрутизации)  
6. [Точки входа](#6-точки-входа)  
7. [Раздел «Переданные заслуги» в сообществе](#7-раздел-переданные-заслуги-в-сообществе)  
8. [Раздел «Заслуги» в профиле пользователя](#8-раздел-заслуги-в-профиле-пользователя)  
9. [Связь с ивентами](#9-связь-с-ивентами)  
10. [Влияние на существующий функционал](#10-влияние-на-существующий-функционал)  
11. [Данные для реализации](#11-данные-для-реализации)  
12. [Реестр фич и задач](#12-реестр-фич-и-задач)  
13. [Порядок реализации](#13-порядок-реализации)  
14. [Зависимости](#14-зависимости)

---

## 1\. Общая концепция

### Зачем нужна передача заслуг

Сейчас на платформе есть два способа начислить кому-то мериты: проголосовать за его пост или (для админа) начислить из воздуха через список участников. Нет способа для обычного участника сказать «Вася, спасибо, ты молодец» и подкрепить это заслугами из своего кошелька.

Передача заслуг — это прямой перевод заслуг от одного участника другому с обязательным комментарием «за что». Каждая передача оставляет публичный след: запись в сообществе и в профилях обоих участников.

### Две кнопки в списке участников

После реализации в списке участников каждого сообщества/проекта будут **две** кнопки рядом с каждым участником:

| Кнопка | Кто видит | Что делает |
| :---- | :---- | :---- |
| «Начислить заслуги» (существующая) | Только админ | Генерирует заслуги из воздуха (эмиссия) |
| **«Передать заслуги»** (новая) | Все участники | Переводит заслуги из кошелька отправителя |

---

## 2\. Текущее состояние

### Что есть сейчас

- **Админская кнопка «Начислить заслуги»** в списке участников — создаёт заслуги из воздуха, зачисляет на кошелёк участника в сообществе. Видна только админу.  
- **Голосование за посты** — перевод заслуг через механику голосования (квота или кошелёк → рейтинг поста → бенефициар при снятии).  
- **Нет** механизма прямой передачи заслуг от участника к участнику.  
- **Нет** публичного лога передач.  
- **Нет** раздела «полученные/переданные заслуги» в профиле.

---

## 3\. Новый механизм: передача заслуг

### Суть

Участник A переводит заслуги участнику B. Обязательно указывает: сколько, за что (комментарий), из какого кошелька.

### Основные правила

1. **Комментарий обязателен** — нельзя передать заслуги молча. Это формирует культуру благодарности и прозрачности.  
     
2. **Источник — кошелёк отправителя**. Заслуги не создаются из воздуха (это прерогатива админа). Отправитель тратит свои.  
     
3. **Каждая передача — публичная запись.** Видна в сообществе (раздел «Переданные заслуги») и в профилях обоих участников.

---

## 4\. Диалог передачи

При нажатии «Передать заслуги» открывается диалог:

| Поле | Описание | Обязательное |
| :---- | :---- | :---- |
| Получатель | Предзаполнен (тот, на чью кнопку нажали) | Да |
| Количество | Сколько заслуг передать | Да |
| Комментарий | За что начисляются заслуги | Да |
| Источник | Выбор кошелька, из которого списать | Да |
| Назначение | Куда зачислить получателю | Зависит от источника |

### Логика выбора источника и назначения

| Источник (кошелёк отправителя) | Назначение (кошелёк получателя) | Конвертация |
| :---- | :---- | :---- |
| Кошелёк сообщества / проекта | Кошелёк того же сообщества / проекта | 1:1, без конвертации |
| Глобальный кошелёк | **Выбор**: глобальный кошелёк получателя **или** кошелёк сообщества/проекта получателя | 1:1 |

Если отправитель выбирает глобальный кошелёк как источник, ему доступен выбор: зачислить получателю на глобальный или на кошелёк сообщества/проекта. Локальные заслуги (сообщества/проекта) — только на соответствующий кошелёк, без вариантов.

### Валидация

- Количество \> 0  
- У отправителя достаточно заслуг на выбранном кошельке  
- Комментарий не пустой  
- Получатель — участник того же сообщества/проекта (для локальных заслуг)

---

## 5\. Правила маршрутизации

### ![][image1]

---

## 6\. Точки входа

Кнопка «Передать заслуги» появляется в нескольких местах. Механизм один и тот же — отличается только контекст (какое сообщество/проект, какой получатель).

### 6.1 Список участников сообщества

В существующем списке участников сообщества у каждого пользователя появляется кнопка «Передать заслуги» (видна всем участникам сообщества).

Контекст: кошелёк этого сообщества или глобальный.

### 6.2 Список участников проекта

Аналогично — кнопка у каждого участника проекта.

Контекст: кошелёк этого проекта или глобальный.

### 6.3 Список участников ивента (RSVP)

В списке участников ивента — та же кнопка. При нажатии → тот же диалог, но дополнительно **создаётся автокомментарий** под постом-ивентом (описано в ТЗ «Ивенты»).

Контекст: кошелёк сообщества/проекта, к которому привязан ивент, или глобальный.

---

## 7\. Раздел «Переданные заслуги» в сообществе

### Где находится

Новый раздел в навигации внутри сообщества (и проекта): **«Переданные заслуги»**.

### Что отображается

Лента записей о передачах заслуг внутри этого сообщества/проекта. Сортировка: новые — сверху.

### Запись в ленте

| Элемент | Описание |
| :---- | :---- |
| Отправитель | Аватар \+ имя |
| Получатель | Аватар \+ имя |
| Количество | «+25 заслуг» |
| Источник | «из кошелька сообщества» / «из глобального кошелька» |
| Назначение | «на кошелёк сообщества» / «на глобальный кошелёк» |
| Комментарий | «За организацию субботника» |
| Дата и время | Когда передача произошла |

### Кто видит

Все участники сообщества/проекта. Передачи заслуг — публичны внутри контекста.

---

## 8\. Раздел «Заслуги» в профиле пользователя

### Где находится

В профиле пользователя (дашборд) появляется раздел **«Заслуги»** (или «Переданные заслуги»).

### Две вкладки

**Входящие** — заслуги, которые пользователь получил от других.

**Исходящие** — заслуги, которые пользователь передал другим.

### Запись

| Элемент | Описание |
| :---- | :---- |
| Контрагент | Кто передал (входящие) / кому передал (исходящие) |
| Количество | «+25 заслуг» / «−25 заслуг» |
| Источник → Назначение | «Глобальный → кошелёк сообщества "Экологи"» |
| Комментарий | «За организацию субботника» |
| Сообщество/проект | В контексте какого сообщества произошла передача |
| Дата | Когда |

### Кто видит

Профиль пользователя видим в соответствии с текущими правилами видимости профилей. Раздел «Заслуги» — часть профиля.

---

## 9\. Связь с ивентами

Передача заслуг используется в ивентах как механизм начисления заслуг участникам ивента. При начислении в контексте ивента:

1. Выполняется стандартная передача заслуг  
2. Создаётся запись в «Переданные заслуги» сообщества/проекта  
3. Создаётся запись в профилях обоих участников  
4. **Дополнительно**: создаётся автокомментарий под постом-ивентом

Это единственное отличие от обычной передачи заслуг.

---

## 10\. Влияние на существующий функционал

### Что меняется

| Область | Изменение |
| :---- | :---- |
| **Список участников** | Новая кнопка «Передать заслуги» у каждого участника (видна всем) |
| **Кошельки** | Новая операция: прямой перевод между кошельками |
| **Внутри сообщества** | Новый раздел «Переданные заслуги» |
| **Внутри проекта** | Новый раздел «Переданные заслуги» |
| **Профиль пользователя** | Новый раздел «Заслуги» (входящие / исходящие) |
| **Комментарии** | Автокомментарии (только в контексте ивентов) |

### Что НЕ меняется

- Админская кнопка «Начислить заслуги» (эмиссия) — остаётся как есть  
- Голосование за посты — без изменений  
- Логика кошельков (квота, кошелёк, глобальный) — без изменений, добавляется только новый тип операции  
- Инвестирование, майнинг, таполка — без изменений

---

## 11\. Данные для реализации

### Новая модель: запись передачи заслуг (MeritTransfer)

| Поле | Тип | Описание |
| :---- | :---- | :---- |
| id | TransferId | Уникальный идентификатор |
| senderId | UserId | Кто передал |
| receiverId | UserId | Кто получил |
| amount | number | Количество заслуг |
| comment | string | Обязательный комментарий Комент все таки на уровне базы и api лучше оставить опциональным, как показывает опыт — так гибче. А обязательность накладывать в клиенте |
| sourceWalletType | enum | `'community'` / `'project'` / `'global'` |
| sourceContextId | CommunityId? | ID сообщества/проекта (для локальных кошельков) |
| targetWalletType | enum | `'community'` / `'project'` / `'global'` |
| targetContextId | CommunityId? | ID сообщества/проекта (для локальных кошельков) |
| communityContextId | CommunityId | В контексте какого сообщества/проекта произошла передача |
| eventPostId | PostId? | Если передача в контексте ивента — ссылка на пост-ивент |
| createdAt | Date | Дата и время |

### Изменения в существующих моделях

Нет изменений в существующих моделях. MeritTransfer — отдельная коллекция. Операция со списанием/зачислением идёт через существующую логику кошельков (дебет отправителя, кредит получателя).

### Автокомментарий (для ивентов)

Обычный комментарий с доп. полями:

| Поле | Тип | Описание |
| :---- | :---- | :---- |
| isAutoComment | boolean | true |
| meritTransferId | TransferId | Ссылка на запись передачи |

---

## 12\. Реестр фич и задач

| \# | Фича / задача | Описание | Приоритет |
| :---- | :---- | :---- | :---- |
| MT1 | Механизм передачи заслуг | Бэкенд: дебет/кредит, валидация, создание записи MeritTransfer | Критический |
| MT2 | Диалог передачи | UI: получатель, количество, комментарий, выбор кошелька (источник \+ назначение) | Критический |
| MT3 | Кнопка в списке участников сообщества | «Передать заслуги» у каждого участника, видна всем | Критический |
| MT4 | Кнопка в списке участников проекта | То же, в контексте проекта | Критический |
| MT5 | Раздел «Переданные заслуги» в сообществе | Лента записей: кто, кому, сколько, за что | Критический |
| MT6 | Раздел «Переданные заслуги» в проекте | То же, в контексте проекта | Критический |
| MT7 | Раздел «Заслуги» в профиле | Две вкладки: входящие / исходящие | Критический |
| MT8 | Автокомментарий для ивентов | При передаче в контексте ивента — автокомментарий под постом | Высокий |

---

## 13\. Порядок реализации

| Этап | Задачи | Оценка |
| :---- | :---- | :---- |
| Модель данных | MeritTransfer, API | 0.5 дня |
| Бэкенд: механизм передачи | Валидация, дебет/кредит, маршрутизация, создание записи | 1.5 дня |
| UI: диалог передачи | Форма, выбор кошелька, валидация на клиенте | 1 день |
| UI: кнопки в списках участников | Сообщества \+ проекты | 0.5 дня |
| UI: раздел в сообществе/проекте | Лента «Переданные заслуги» | 1 день |
| UI: раздел в профиле | Входящие / исходящие | 1 день |
| Автокомментарий (для ивентов) | При передаче в контексте ивента | 0.5 дня |
| Тестирование | Все сценарии, граничные случаи | 1 день |
| **Итого** |  | **\~7 рабочих дней** |

### Рекомендуемый порядок

1. MT1 → MT2 → MT3 → MT4 (базовый механизм \+ UI)  
2. MT5 → MT6 → MT7 (разделы отображения)  
3. MT8 (интеграция с ивентами — после реализации ивентов)

---

## 14\. Зависимости

![][image2]

### Что зависит от этой фичи

Фича «Ивенты» (начисление заслуг участникам ивента) использует механизм передачи заслуг как базовый.

---

*Документ для утверждения: Руслан (CEO), Вадим (CTO)*  
*Последнее обновление: Апрель 2026*  


[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnAAAAGFCAIAAADyxlnDAABX4UlEQVR4Xu2d+59Uxbnuz190zjKaY1C3mriRmC2bnSBRQJMDkYx4iVzkHMBINoNiFAQvGRGvmERHtzG2GhWMOA60BEUEhrvAAMJwaVByMZedn87rerKevFO1uqdnWDNM9zx8vp/51HpXraq3alW9z6rVTdf/SJL/KYQQQoiz5H/EJiGEEEL0FwmqEEIIUQASVCGEEKIAJKhCCCFEAUhQhRBCiAKQoAohhBAFIEEVQgghCkCCKoQQQhSABFUIIYQoAAmqEEIIUQASVCGEEKIAJKhCCCFEAUhQhRBCiALot6B++MGGM59X/v7ffz5+7Mh/vfh8nKG5eeM3pb/+5Y+nT52ITwkhhBjJ9ENQL7roa6+/9sruXdvnzp1j6Rfan/vjHz5bsGB+nLOJmTTp2sOH9ktQhRBCBPRDUM98fsoU1FtMVm2puvF36y0R529Krrvuu4cO7pOgCiGECOiHoJp27vtkV2D8y5//8PlnleXLl9pZzxd/+vyn996DPG+veTM4axazL1hwp632/vbXP9lfS996y00mVMiwbetHP/rRrUc+PfDff/ti185tNNpV69d3fLz5g/L6Dp+ZJVulPDTls/zf+Ppl5qEd/vmL319//USz8EJgh1a12a1Yy2MPDeXye8jpsdX578+c+uz0Scvw17/80RyzxLXXXmOnWKOlv/e96+Hh2nfWsAor35xhdUxbwhR6x/atVpol2FHWez5tjWJRln7qqcd5CN/guR3S89yiDLv2qqvGWFssbT1vPYwS8KDAbAAdeOedc629dmjttWuDbhFCCAHqFdRx48ZaSF23riOwm1aZGPz61/+1e9f2KVO+b+Hb1MUWrKY9XlDvv+9eC9mQrrlz50BQv/jTmffee+fb3/73g917Lb9ZTJ+6tm1++VcvWgnvv9+5+q3XzT59ektn51orf+zYf7M8P5j6/QP799hVPnNr608s58kTPZbBgr65+v7760xKx4wZ/eEHGx57rM3yLHvg/k/27uSFUCM7hFetrQuOHj00b96cpUt+aqppad9MK9NExeqaN+//Hj92xOqywp944jF7wrB2WYHWCeYhMpuHaNfatW/DkyTVdUtv/mijFWXYKXhopyxtZVo55uTDDy3r6Tl8U8uNduqF9udM86xXLY/ZrW/tFKqwhPmA9+303C6n55ZGfivKDu/76WLrnJkzb7f0hg3rrS1W/oPLl5pGIkOS3uKX/qsdzxbswB//eN6Zzyto45aPN71aehmZhRBCBNQrqBZS/56tLD1Y7b315ms4hKDGl6MErgWNRx99ZO07q5E2YfjD709PmDA+SdXXVlGW2Pi79f5yq8XWVZZYufJRW/zByMxY3WJFhcxw9YONZZNtXwhcxaKNdjgwadK1OJwzZ/aZz09Nu3EqM1g5zz77VBK98jXB69r2salXR8dvWaB5iASWkuw0n7ZTSD+w9D5TMlaEtazVYml7IrH+pJ0NfPLJlSbA6MwaniM/ivLFeuxm8bkHlyNP7r3G6j8wCiGEAPUKau0Vqq3VcFi/oJqw/b33C0aEcmikrWL/8z/v8pfbguzIp93XXz/pdxvW21kY+xRUW/sGtcAeCKr5b63gIUrj961smbtrZ5ctspNIUK29ECrz1jw09yyzeYiz/t2srx2nLG2rz+Atep+CuuT+e3ft3AYfzFjDczzrkEBQly9bsnPHVluqekG1NkLdvavG9Jt+uPqt109VjlW7uUIIIeoV1KS+LyXVL6i2Qt265cuXw0E2aOScObOsLhMP2m0l9+cvfm8aYIkgc1JdUG1l6fXGX+gFNVjn4dDUkRmqrVCt8I83f4i0OWbumZrSwz5XqD+Y+n1b4P7850+zotqCapIGsaSg1vC82gr16JGDvI9+hWr3YsvHm5Cmqy+0P2dtxEenWqEKIUQN+iGotkZhbAUmeJWTx2bNmkFL/YJqi55TleN33DEThyYtOEWN5JIUGb797X/fv2+3OWAJltmnoK5c+ejf/von+vzg8qXvvfcOLvSCamV+snfnQw8+gEN8Z4dnUc6HH2wwyfGCaodWOF/wWiHmnq046WGfgmqJm1putFW+PUDAXltQKYQU1BqeVxNUrKqRxwuq3RFbiCNNV/F9KxglqEIIUYN+COpFef8PlW9fkQFf2eX3XDzz5s2xUP7wQ8u4Kv3rX/5oma0EU1OsjUz5Nn+0sfTKr77x9ctMwEyfrBaW8PxzP7fyeYjM+FLSj350q8kSvpSUpHpQLr9ndsvz8eYPOjvXmjDboamdyT8utDz+4YBf7XnssTZr18HuvTyFuszb9ud/YcrHLyWtWvWkFe4LMffMSR7itXbXts1Jtpq33rv22mvsWju1YcN6XGt28xCX3PfTxfwm0f333fvFn85ABc1uXll3IZs9i9ihGZPeX0rynlvasmFFa3/PfH5q4cIFlrYlrNnNB2upteWXv1hlfbJj+9Z16zrwnSN8f8rcNldtaY6Osntkd8Qc8At3IYQQpB+Ces6xtaBpbWyPgY5yeVcgwSvfgDrdqx/TSBNyrMKFEEIMZxpGUG1htOnD3+WufXP5cil5/NPYfpbUEFTzsH736mf/vt0SVCGEGP40gKCuWPGzP/7hs1dLv46/wTT0/D3vS7Pm4Rd/OmMexvmFEEKMEBpAUIUQQojhjwRVCCGEKAAJqhBCCFEAElQhhBCiACSoQgghRAFIUIUQQogCkKAKIYQQBSBBFUIIIQpAgiqEEEIUgARVCCGEKIA+BPWiiy4cM+Zfr7rqSiGEEGKEYML39a9fGmtibaoK6qWXXnLxxef+t3OFEEKIc8Ill4z61reujO3VyBdUU9Mrr/xGbBdCCCFGDhdccJ4JYmzPJUdQL7roQtPkCy74SnxKCCGEGFGYIJosxvaYHEG94orLY6MQQggxMjFZrEdTcwR11Ki+LxNCCCFGCKam9XxHKUdQv/KVJDYKIYQQI5Pzzz/vqqv6/nZSjqAKIYQQwiNBFUIIIQpAgiqEEEIUgARVCCGEKAAJqhBCCFEAElQhhBCiACSoQgghRAFIUIUQQogCkKAKIYQQBSBBFUIIIQpAgiqEEEIUgARVCCGEKIDBFdQJE67p2r67cvr3oKWlJc4jhBBCNAFDIahMm6a2PboiziaEEEI0OkMnqIalcVje8EH3oSOWaF3UWnr1NZw1o+VHoud4BUY7azltaYsELuFZU2jLzPJZDpbCVheutX+WQOFWDs6atNvlqN3KxLWWB5egFsq/FYXLeYn9tXRQtRBCiBHLkAqqaZWpXaBVEDB/lZdMyw8xiwXVErmCaiVDIC0bldKMqJGCCt/iy7GMzhVUg/lxOVRWCCGEGDpB5eKPi07YvewBLCiRriaoKDlXEbnS9bWg3iRaocavoKGjuYLq19O+KCGEEGLoBJUEgkoob15QLUEh9IIKe66gmh3l+BVkLKioha+gKeq1BdULsARVCCEEOQeCapoUr0r9G1QvqMwZCCoy5woq15HBK1+WQxXER7m+OlxVTVAnRK98eZUQQogRzjkQVGDKhP9LQ4nqSv+DjWnbwtaF9heSRkUMBJWX4HI7xf+cw7OoHUa+qi2lXyYKqjZNhcXy1xDUJHtRDD+1PBVCCEEGV1CFEEKIEYIEVQghhCgACaoQQghRABJUIYQQogAkqEIIIUQBSFCFEEKIApCgCiGEEAUgQRVCCCEKQIIqhBBCFMBQCCp+scj/rLwQQgjRZEhQzyVTpk6Z9sNpsV00Cldf/W933nlXbG96bvvRbSsff0KjVwiPBPWcMXHSxK1dO8d8s+8bIIYzhz49tmjRPbG9udn44aZ9Bw7dOE2CKsQ/kaCeMw4fOV5sn3D/uyGG2xVY7X7fniaDW/MGg9maf/TYyTj/2TBjxozLL78stp892BwitveXYydO37N4cWwXYiTTqILqN26zkuNN3IY/3YeOWtyM7QMj2Kt1iOEePufQh8EG2/xhSyJsPQRGj77ClmsTJ02MLxkwNp537dkf22vAPZQC9zzBHkoDxhq7ZVvXuHFj41NCjGQaW1AR47yaMrLDaBHk4OEj3EUOW7EiJ3d887uwcVM5RqV4mza/K2pXuj0cKvIl9ynwc+fNfb693VsYrwNl8vvN0RPk5PZ2aCC3luOed34Du9yKcFO4+7rHKzQWZ5Yn3lDP3wJUVy2a1yBoO+1WXcXtlOd3rsWOe/AQnY8O4bW+33BV7jMHmsbqLEPQCt5uth397AuJ7+ZZwnFoC8F6dIs+cxkNe9ClmDXw3/cVRw5nDfoz6ECABwi+7M29KVaOYeX42uOKgK8LN6icblTMs1aOtcj7w5xCDCsaW1CD8GFpBF9McrNXE9TWbBPypLdkWoEorR5BtQSDrBfUIF7k8vAjbcuWL/cWH5g80C0k4Im1As5DM+wQ19JVevVuxzpqANvLiloyHWXCMwBBhT8DFlQ0kJ1ghwyvqNd7zsbaX941BHFezn5DoihB7U613xcyZeqUzvUbgpLPhnImqMaB7k+XPrB81KgL42yETvoZUU6fOBM32s3zPZ8cYLewr3z3cuiiH+KRPHPmzIOHe+hP7k2B/5gRfVaEbveJciaomFa8PMmbj0IMH4ZaUFuzh9Y6qRadMdWD2eXnns3MtnSf8FxBZQhO0ikK35gN5dcWVGRmdZj5SFTqEFT45i1eSzyM+NAb7yTSho9lSe/34T4nWkRXWwoVVCRq3LIawCU+GSTRusdXgb+5fdXqnpN8vzE6FyKoGJm+EOapBnqmTizzlm07AuOOXZ/ExZKW9KkicYLKu0wH2G8YJ/TZ331OEGSIB5LR/uJLtm7mYe5NKWfPQL78ahUxZyyovhxA/4UYhgy1oBYFpnow2XwcRIhpzRNUxBofrRhZGBFYVJxtQvb2iYE4ySQBkpMbhgJSQb3bW3ztxAc1CGoQKFFjcC3jkW8pW8RY5iMd28gube396IM7yENLB4Jayd71DUBQeV/YEB9wk6xFOMsbQQLHYPT9xt5gNsZleE4gqEjDJS+oS5Yus2Ltr/fNuPba7/Z5x/uF96rP5WmSPT7iQtzooF1oS3f27AjQCb73AM5WE1RT06eeXsXD3JtCN1AOb0RuRbwXPb0FFeOKAzLILMQwpLEFlXGWRi+opfRdUyyoudKVuKWbL4rl8yoEiEDYcIiAlRuGAkxNVz7+hLfkegUjuq6aoHanL7e9uiOcISc9YYsoMOgin8BZlN9afYXaln4ShnLg4abNW1FReUCCyqLYCbGgdmULcdbOayvZJ2q+Ib7fUGbQIhhRMowI6OhM3GXLM/uOOWianX1r9Rr0QCCoN99yc+m1N7zlLCmncmjS9Urp1fhsTCl7rYrmmPNstScYmcjZFr0sAbmCatJuxU6ffhMtuTeFbqAcFFKtIuaMBdUKl6CKBqKxBTXJlAwTsit9/2lpxuVcQUUi8AeXMHxwknMCM4wyQCTp+hXl4CzCQRyGYiww7dqzb/LkybTQZw9blGSCmrjlCBUucW87LTN8ZoxD81lOLD9eh8rpmgAFevnBHawmqFxtlJ2gol4WUgPvEjvBiwQq8mfL6ZdrkIBXuAXsBN9vHAx0piv9uB2XY2wkfQlqJVvXciSQ1Wve9hpz9rz0q1fmzZ8X23PB7UCaSoZWBNrDLgrOBqIFkCcYye0vvhT8b5lqN8W7wSERV8S7jLO8vJJ9diBBFQ1EwwtqkgYUP3sr6dskr3OwAIZC2jFjGS5ZPuazv5bBmlVj5rOi2Lca2PrjwYce4aEPTABlMppQUJPMqyC4sEWMXyX3v1koEvSNOtriXvmyTC8/iI8sDQV6QaUmlfsvqIFLvhNQF++FPzshfTFLbYDnC1sXIkAH/UZBpf8sE01DTgqq7wrebrQa5XhBvXHatH0HDvX5VnaQgJoG0D1a2MOcEWx14saJt6Nj/UieOGnizt37gm8d594UzIug6rgizlZP4p7qEgmqaCgaVVCbgEWL7vn06InY3kzYguZcKc2QcejTY3W+mB0M2rKPn70leDIrBLuPHe91dh86Gp+KwWMKH62q4Z+lkuhxSoiGQ4J6Llnx2Mr/N/f/xfbmYOoPbty2fVdsbyb+49vj1nasGwm/Hzl9+k07du5dvebt+FRMnYIqRJMhQRWDhcnMDTdcH9tF0yNBFSOToRBUIYQQoumRoAohhBAFIEEVQgghCkCCKoQQQhSABFUIIYQogKEQVH3LVwghRNMjQRVCCCEKQIIqhhT8Gk4l+t1EIYRodCSoYkipZL+IK2ozY8aM2CiEGM40tqDyB7X1mywNgf/BfVGb8oYP6t9wBlx++WXNNBH8L+xX3E69QgxbGlVQy9l+lh68SyR4o4jtR5JsXw4GdG584R3jHKaF0xiXV3tLibO+HO7E4otC7eiQoCIWUsk26AgCCjL7rU74A2++N9jermyrkKD/0Us+PPmK6hE85PT9xs7kb53z1S4rghtoI43d6a6lpXQTWcsQd5Hf18UbW9Otv9mNJKneHNrp5HCG3r5SejXY4KUa3D6oNhgwSKADk957GeGmIM0tengWm9UQSHi1aVJ/h2NjOGvpzt37Jk6amERznFX4Tw1wqiXdrBCD0H+UwOERbB4AYzAyYUTD2WrSkv6LY04uwchk7XFFIJj4gJczknRlGwExlLErAEZ7d7YNJarDDTKO9JycP//H1r1btnXVOaJEf2lUQeWgCYyshQGCAoORx3jN6dT+wguW8EPWDlk4smEExzUSP3ZRlGUOZiDV4t2OdYw+dBgBFGkvA229t9purSmoOIvCuzJBtQQvYY2IPiwHnsPoaw9AM32/oXzUjvaiKIYMVoSziA6lbGtV3LJSb0FlB+JyxiM7ixtkOd9avYZelXpvpo1uQZrNsTxI+A4czmA8gAPdny59YHmcJwAdG9sDMGCSbGCgezlfkt57s3OQMCeHceJGDs/6aUJnetxG97lwYzjTVFNWGDmqWUhr711vMcWSbP9BDKGudFc4GFkp3UvSKcCGIOHnI9ubZKOdh/ULagDGfFKlItxodKmfepwpqBRThpfgbK5Lfu5U3Ns7E9TfvLHauvfYidPBpraiKIZOUBkdVj7+ZExHR2dsNEaPviIuMKnyURwDQRIJqmEhmLGAgYBgHtLInJawC2uHA9CabfGNgD4h25+VGXwkIqyUsy6gfkFFTvMWk9ZObdq8tSvTv+DaxHURewOTlvljUGNg9J4jBLArACoKJj+Kwi0r9RbUrt7bcOIUSg6qZvlxyUjnNocND7CA/vAjbfEgXP32O0ZgbH/hxc5179vfwjMb5saHH23hlDl56szHW7fHDpMbbrjernru+Rc2bNyEEuI8xDozGBhJnqAi6Hvt9PeIRgqqDTyvRh7coNw+B1OmTtm7r3vs2Kv7FFQ/xzHyk95PEhjkwdTzQ4ItzR0bPjIEheSqVz1wjntYUbWewVUc23CGvQ3Pc12ioCICsGoI6vPt7cdPfrZsed/PZ2IADJ2gVouGA6Nfgrpk6TJzwP4iFgTzBARBvCd7CkZEi+vKBSMe2gZLqfcCC3bMeZTMSZI765IqgspQi6sQejCR2rIH8K7sIYbFxoKKnOVsMZQbYgj6zfcS8J63pMuC1t6flaKiWFDhcykS1O7er+5xKijTw6DDknktm4Paac8NYcMKtgLL03q2la3xzOGZkO2g7sdbyW39XUnfLmDgsQNxv6yKXEHlhb6ilryN66thsX7+/B/bUpUvJFEjM8AZP/gr2Wo4FtTgdlfcxun0ma0LimW3BIHCl1l7pvDaoMDcinInPiZ10ntsc2pzDtYQVMtssLEGFqbWvXypLgqnUQW1J+8lEqIz0l5QsTbFaEYs8OMMxIKKnLyw9vzhVa3pQ7SPHX5WY0p45zmdqkWcXEFFutx7hYoSvKCWU21jXf7axHUReyPwLQY1BsZAUCGfgaCaPQhPKAq3LBDU4F74kgMjyw8ElRWxOd3uIyg2fDhTTgXVgmD9H3fV6CIPBowfGEnvPsFNiQXV3yMaceuRE8XiFGI9zuIG1e7zWbNmr3hsZZK+F501ew4K97eVkytuo284xnAw2Ii3s3V+zLNFQeakt3qV+nqX48HET6pUlNszbJEf2zBijtPiuwiYZVP6BiJxtfzHt8e9+trrNpase9tW/HNuimJpVEHFtOFAbH/hhaS6oGLI4hKMRQxEZPCfoWK4t7o3lpg2OBuP3YBS+phfbZqh9rb0TZrlRLdQjbp6f9LJq+oUVD7wBoKaZF6xNBSOiMBycC0K93E2IO63JK0Is9dPbwYRXxE7tiuVUuQvRYJazY1KtiKZUPdnqCyHCfRVHMKGGy/96pXYWAgYMEk2MHBHOF8SN4/8veN95yRKIkFFNtwLP1ArdaxQY8p5gsrp43O2ZPKDSpmOh5Avkz77+ch5lNQUVCuHl/cJ50JuRZj4KArZkAFng7Hdky5weehdIt3pMhqdwBskhoZGFdTEvbni0GQgSHoLKoYpJhtjAca0n5wYnTCyFo51XF57CiFPtRHM2kvZ67W2dDXG/Ij1ld7ffqpTUGmMBRU5mUYVPsCxXt8b1WC3MycDhDci8AUVJVlEYKvZ4QQBwt8L3jK0vRK9cAuCTm5z6E8p1e/+BvdmAgMGafRVUkVQYUe/cZT6ScR4nTtNfJ8XJaiJGwaV7OG1xb1bpm9J79HVFn2UQLufj16BMLBZmh+TtZvjc1bcE3a1ivzER+s4nYOxDfUNKvJVJ9nLGBTuaxFDQAML6jAkGP2ivyDqxXYhasAVam2CKATp8gI8/Gk4h0caEtQiwbNnbBdCDB51Cmqj0+L+I5AYnkhQiwEvc6SmQgw9TS+ofMsdnxLDiqEQVCGEEKLpkaAKIYQQBSBBFUIIIQpAgiqEEEIUgARVCCGEKIChENSR8C1fIYQQIxwJqhBCCFEAElQhhBCiACSoQgghRAFIUIUYpowefcUtt94W24UQw5NGFVRss8ANH7B9mxDNBCbOsROn13asu27idXGGXPx+RA3H3Xcvnjhp4rhxYx9+pO3yyy9L0p+DZ+iY4PbJEQPA+tZ62BKzZs+ZPv2mOIM4SxpVUIOtnUCwPRPktpTud51km0nx53bx67uV3huWcR8lWoK9qKrt2YSzvhzofbD/FGpHhwQVsZBKtn2b34aMmX24LPfeYBxGtrcr274t6H/0EtsVVFT754gDl5DZCqTndIM7WPmKkBnZ0JO+i1rSTbja0u3qfC3M7He5in1rPvw4OdJzEgLTJ3UKqv/9W9yUJBtRMPqNTThZ2PP+BuFaeIuzcBvlT3DbLLL2XG6cNm3fgUO2Ln/woUfsMQLGaoIaTJYkdXL2HXPQFj+pMa4qbvL6jqVX/L1cjth4AmJy1dO9wF9LP+OKAFwKjLwcM73iZihaYX/ZFaBG3LO+tR62fp4xY0bHe52jRl3IikQhDLWg2j32975PJlTZzI9DxNNdZT9UDCwUiKvask1DSan3lo0c1khU6gjifgTjqmqCSjglcs8ClMZDP59jQUUIgBsQ1Anprt2w+JDnq0a2JJM3H4wCcgNud7r/IozoWB/4aleEBP76vsKF1fqc7Y2JgyA4efpMbKzGMMm8e/f+3Xv2e8vJU2cmT54ctxoEgbVSU8AgqOx/GHPvrw/xbdkG9byKg5w32v4Gkwv4kZDLxg82W7i/7Ue3HTzcw1vfkyeo/mmAE6SU7XycuKdJ3yKO7cBnnCV+ivnyc8/WSZ8VcWoEV/lW4JAjnyGOAcdfmxv3krQTfrfxI3s4O1H5/KmnVwU1irNk6ASVk3zl40/GdHR0xkbDHqniApP+C6rx1uo1jBHx8DUP/Wz30cQurBbZPVYFaufoD2YRy/SwUh/XPDXmczDNkNO8paBu2rzVR7cgFrCL2BtmiWemJzfg+m63a9tSTfWqjIoYxZJsSFhplNK4+YwmMaXq+87efffieBQZ73aWf/HL5wKjjbrXXn9j2GZ+5plnd+76hBPHIuD69zfGTSbTp99kV6U38RRKiPMQ6+13O9ah52msdn95a6hkNAbi1NV7B+wAP8Vinm9vP37yM5vyGz/cZMoKY0+eoGKMwchRzfGcZA2Bb7wcQy6JfMZZ4gdqUnMC1k/uVawoqJHEgtqWvQnzntcQ1CDuGbb0h45+evTE3HlzgxrFWTJ0guoj7NnTL0FdsnSZOWB/MbByZxEnG+A0Dp7vaoNB351qGywY1khzWGN2oWSGmGqxJnc+M8jiKgiqYQnGmq7sIYbFxoKKnOVsVRdPy4BqAZfdTkH1Pca57T2vpIt+hBKkg7piQUVOkBuAmgwMVDZ53vx5cZ6Y3Ngd05K9CPWdzJEAcBP9yGzJtuSsJqiVdEz6ilrdS6lqgxzMmDGj+9DRUaMutIhf+5VvKXsFTWAMBDV3yCWui3woCMqkV7UnIGvMBfoHfEwIKqp2y1qyxxcKKh22Sw4e/scUqCaoQdwzo/Wt9bD1843TptlTS7XlihgwjSqoVmAcUqsJasV9+IGB5XWO+RkjUBTSGKld6XN3bbFJUq+snFgbAGov9V4FMsT4KefJnc9Ic5ohDuJyL6jwpJLFER8+fLqcrVBhpD0GNSLNzoy73WshK/I1EoZj3CZ/yheSuJeNyBzf/eYDPfbqa6+PH19VhGJun3H72o51sT2Awdr+8vbl3l8/XDm6qgkq8vDGYbQjnVR/aqxBT56gtvZ+YgOc8kk2JuFSPB/L2YvTYHDCN7YI1JiASe/OqU05fXzMrcgbPWwRZzquembVqi4XUasJahz3xGDTqIKKUcL5g2/5xpEdCUx+P7AwlJHBrm3NPu/kdGU5GKk422cQxyCuNsFQe1v60MrZznnS5d6V+dFfYz4HgopyYkGFVywNhftIR0FF4XEAIrkBl93ufaPA+4ra0ucJX6APXuV0ec1TjJ7ACschGtvnvWgCxo//zsu/fjW2F0KL+xiSNyv3/mKU4hJ2ew1BRYEoHKOdZ3NlozY9eYIKeywhDAh0jw7klul9ZoE9vbfyrjEBJ6Svo1hpDdBLaHtuRW3ZU4jleWv1GvsbTA3fdRj/rBcexr0Rxz0x2DSqoA5P/GQbOVBQhTiHeEGtQZxtADJ/buEDkBhuSFCLBE+Fsb25kaCK4UCslLmYFDW6oDacwyMHCWqRjMwnRwmqGA7UKaiNTin6/ocYPkhQhRBCiAIYCkEVQgghmh4JqhBCCFEAElQhhBCiACSoQgghRAEMhaDqS0lCCCGaHgmqEEIIUQASVCGEEKIARq6g4qcyh5tXQgghGhQJ6vDySoxkRo++4pZbb4vtQoiGoFEFtdoeFPUjQRXDDcyUYydOr+1Yd93E6+IMuTT0lgxz582d9sNp9iSxZOmyq6/+N7Ns2rwVP62HGTocfk1wYevCG2643tx78KGHtYeoqEFTCWp3urN3Kd2tzP9IfXe6MXWww1Elb89hlNmS7aKMNC4HsNTfFuw1RvhLv7QzZ50VYTsq7zlozbZxZsN9ab43sGkUe8MXCLrcJlyA13on6ZtvI68VAwAzBT15pOfk5ZdfFueJqVNQW9M93nGz/K+rcwBQujBCghuKWuIhgfEQKJ+/vMbPuI8bN3bLtq6JkybOn/9ja2+cwcZYPGX8sKfzuXOhks44cyxoL8pkV7NFGN7I1uU2m7tn8eL2F1+yxG/eWG2usiIhAoZaUP1Yr4dqs7GaoHIOtKXbgqJq7wY8wfzHCrWU7fiNMpHg/GS04mTL1blqlLOtRpNsg0nWTiOEbQAVdWU7nqIhMPJpwBvRG/7aIAr7UBKfpcPeSRTuXw+U3W6aAcGDBTl5+kxsrEbTZ969e//uPfu95eSpM5MnT477E8QPQ3EeAjVFGoMwyFDJ29qBA7gt23TTjw2e5WxKeg+J2oL6xpurTUdNUHfu3hePHJQZX17OtgdvzdtmPHGjHTMOCfgWSKaXYX/WEpXeTwPHTpw2WbUnAHN1UvU7IkY4QyeonPMrH38ypqOjMzYa1V6wVBNUGjHZAmFAHEHcZwhAHvy1Qzu1afPWwRNU/+RLYzKginhtEApRvg9wcVwLFDQ4DAIu+ifJE9TEyW0NQb377sXxzTXe7Sz/4pfPBUYbDK+9/sYIzPzMM8/u3PUJZ8qJyufr398YdyaZPv0mu6r05RPhKZQQ5yFefqCOQQYOJ+JHRSyo/izGGGZN/YK6bPny4yc/S9KVH1eoKB89kDucODhLVbaXiQUVkw6n2PAagmp2CwJ0Hjpqwj933ty1HeuC6oQgQyeotbWhv0D8kC5QUN/tWGcWHxE4e3N1Lo1lYWDy5Aqqn8ac8wOoqDtbkcN/2gNBxeWsBYl+CWps9771ZAv6GoIq6gEzpZK+7336mWfiDLkEg7wauYJqt4zXcigS+OOflsySK6geX1FtQTXaVqyYNXuOKdarr73+H98eF5xtyV63tLjXthyEpSqCyknHFsFV/PW+5Qoq7Gyv2Vc8tnLWrNnm3iuv/sZcjWsUAjStoGKyoWpmw1TBhMTkKaWvfC3B52LL5gWVsy5X5/qMZbGgsnYYmR5AReX03RcbAiOv8ka7vJQ+KDBGsBZe5Q/9gzxhB/pakvpWqKIe0MMmLePH1xKhgNtn3F7PssnrHO4UbjqHeiyoSTqP8KzGnByKfnIFl3B49ymotWnNXlO3ZR98Jk5QvZH4kexbZFc9s2qVn3rVBBV5vKAKUSfNKahefjjrStlnpTg7+445yI+iKKi+wMS9Tc3VubJ7wM8lFlQfxaBzODuAirqzFSpawZwIGeyNxC1M7SziIxsLAkHFLWPoAW3pJ3Z0EoUj9CCDBPUsGT/+Oy//+tXYXgheUHEfcZcpTsEHB0nvYYC5g3L85ArmdTCQBqBJnDKonZVimJXTD+NRxQT3biaY5ijKC2pr+u0N7201QUUeCaoYAI0qqLl4CekTP3mEaHq8oPYLzF9v8Y96jQJaIYEUg4oEtd78QjQ0AxbUJF2u+cNGFNSzab4QdSJBrTe/EA3NiFUUvOwNngmEGAyaSlCFEEKIc8VQCKoQQgjR9EhQhRBCiAKQoAohhBAFIEEVQgghCkCCKoQQQhSABFUIIYQoAAmqEEIMLuPHX/OztpH1n4AffOjhO++8K7Y3N0MkqPqVVyHEyGTMN6/sXPf+9h174lNNzBNPPn3o02OLFt0Tn2piJKhCNB4zZsyIjWJ4sndfd+f6DdW2dm5iWhe1Hj12MrY3MY0qqMEPduunxcSIwkb7vPnzYnsNLr/8Mv00/Dnh2PFT9yxeHNubHnuG2PjhpomTJsanmpVmEFS/CZoQIwGbUCcqn2/8YHN8qhqN+Iv2TYCJyq49+yZPnhyfGgk8s2rViHqYaHhB9SXj9+5xyA0UzXjw8D/2H8VmiogsZsROin5n0HK2mSg2SQ3KD35e3NIogbVjBVBO9y7FKZ9GojXdTpKFc2GNs2iC36lUiBiMZHCg+9OlDyyP8wTUL6gY5BioGJ9+5HOK8dAX25VtsIqRjBnBKeDfJJXcHr3IYIk9nxzABOT+rLv37vfztzvbIdzPl9hJP22TyElWjTbCiM7Evqq5AcHPX55lc6px14IFz7e3B0YW4n0uZRunM9GaLRWQv8beBkFD2F3sBDa5lG0Lja7jWTQz2DIk9zAIsEnavf6uwQimTJ3SuX6DtzQ3QyeonP8nT59huk+6qmxhyB/c571MsoHIQ06At1avgR1zD0MBl1s2m7FG0ntQsig/KP3oTyJBJSgHhaM62DE0eRYJDkp4a3Y0PC42Sb2Ku8g4eaofXarMjZ7ZBtKWbTsC4/Sbb4kHDGhNt1vxxHlygYChhDjuAx9wE6edidv0G0ZLc7T7aM6JaRPt3Y51uARVl9IHXz9/KQas1PLH4uSnbRI56SlnklnJ9lf3b7/82UBQg/lbjSBogNo+s4cZYVBXXA7xXlXyBJU95ruC5ZfqE1Q4FgRYlAljvHWuWfrsomZiiAS1cCiofgKbxd886BYGDcZWKZWxFY89ZmlLYK5CNZPeqs/5Exj9mOZwJD4nRqFdzgcCuIehD8+XLF1Gh3Foeewv5oYQ1eCwxPJ01KgL4zwBXoRq052+IwEUVFqC+BholX8C5szitcxGRQHlVD5RlP01WbVy/ATn/MWLpVL0ZJlEzw01BBU6wZwQAy8VnLaWWNi60E7B4Vb3himYv9Ww/CsffyIwopk4y5DC8MWzSe970aegwiuW42MXe9t3EcsM+pN9FQhqboANygycvPba7/bZRc1EYwtq4h6ik7z73ZY+I9uwsAGHCWOJ59tf5LWVdCpi/vhxTDCTkfajP4kEtZS9VPGjkDMz6S2oFjIsg398M6OpO2csixUiBkP32InT48aNjc/mUqegWjaKYm7cL6dvaJk/0KpAUHGKosj5EgtqV/qu2OyWQFzGfOG0RYKT2k89EDhZQ1C73VvrUrY4Q/m8nIJqUxWOeUFFgfUsv26+5ebSa28ERrrnfaaTPhD5SgOt8nivvKD62AUjCgwuZycECtqnoMIldh3ycwAkVZrfxDS8oPpbiIHIWYE0BJVDv9UJKmc15k8wyUEwKP2Y9rMa/sANPwo5M5Ns/GHoW8gwu5+QeL5DLbEbQngQ6L///e/Fp6oxafLkhx9pi+0BkCukcwW1rffnZD7gJtErX6RhtNHOs5gjyMb50p3qFmexF1TOFE6iWF280U/bJHLSL6RiQfW+ldMHF/SJ1zZM9noEdfz472ze0jV27NW0oHyGI3rCzvHdDrdRadxk4r3KFVQGqNxy6hTU3ADrE0laKdPGsuXL6xl1TUPDCyqoZG94MAIoTokbK8DSnZ3vc8LEefjuIh6UwTRmvADmEi7EOyIKKgtkIT3ZRy+BoKJwZGCxQgwxGK42gH1k5zD20TOJtAoTkyXASKnA2OasQTY+iQaxHlOvWnUl95YSM7R+QW1LnwnYRpTvS+NDcDlbVQeCirP1CKpxpOdk+4sv8RJWRD74cLPvFnS7r6hOQUXaC6qvhZl916Gl7ITagkpLUKCvxXfIjdOm7TtwqJ7PI5qGRhXURqHsVqhCiGFLoNwF8s67nfsPHL7l1tuSPA0OFKuZsHYdPnI8tjcxEtTBRYIqREMweIJqLGxdtGvPvtjexKx/f+PajnVjvtm3wDQTEtTBRYIqREMwqIIqRggSVCGEEKIAJKhCCCFEAUhQhRBCiAKQoAohhBAFIEEVQgghCkCCKoQQQhSABFUIIYQoAAmqEEIIUQASVCGEEKIABiio559/XmwUQgghRiYmiwMU1Asv/GpsFEIIIUYmX/vaV8eM+dfYHpAjqGPGXHHeef8rtgshhBAjDRNEk8WLLup7r7pcQf3Xf/mXi2K7EEIIMdK49NKL61meJrmCmnx5/SVXXvmN2C6EEEKMHC644CsmiLE9l3xBTVJNvfjir8V2IYQQYiRwySWjvvWtvr+LRKoKapK++x09+hujRv1vfe9XCCHECOGCC84z4cOb3no+OiW1BFUIIYQQdSJBFUIIIQpAgiqEEEIUgARVCCGEKAAJqhBCCFEAElQhhBCiACSoQgghRAFIUIUQQogCkKAKIYQQBSBBFUIIIQpAgiqEEEIUgARVCCGEKAAJqhBCCFEAElQhhBCiACSoQgghRAFIUIUQQogCkKAKIYQQBSBBFUIIIQpAgiqEEEIUgARVCCGEKAAJqhBCCFEAElQhhBCiACSoQgghRAEMa0FdfM+iP/z+NNKff1ZZsGB+nMdobV3wxZ8+/++/ffHEE4/FZ4UQQoghoB+COv2mH5480fPoo49449//+8+HD+2fNOnaOP/Zc9FFXzONNKU0Hnl4eZyBrH1ntXny1FOPx6eEEEKIIaAfgnrddd89dHDfT++9xxtNxsxop+L8Q8nba96UoAohhDiHSFCFEEKIAihSUMeMGf2XP//hzTdeu+qqMRt/t97SF130NbNfe+01ULtbb51+sHvvf//tiyR9nfvFnz7v6Tl8U8uNKMosDz+0zIwzZ95uh0hbBpy1xO/PnAo+Rv35z5/u2vbx9ddP3PTh76yK0iu/mjNn1uFD++9etNBKu+fu1j9/8fufPfKg5fzG1y/7xS+eaW39SVDvfT9dfPJED2q0wk9VjqOK6Tf9cN26Drs8sMMrO4QDlqBX1kxr8ooVP0vSvtq1c9uqVU9avVaRXfLkkyuDoszV48eO/PEPn6Gov/7ljx9sLFvXWRdZGkZjUet/orpbb7np9KkT7C4hhBDDin4LqulWAAXVtOTjzR+arFr6B1O/f/TIwf/8z7twLZePWErCaPIQrG6hGbAgbRlwyjTGDs3IzCYtJkimfCwWVTyw9L4d27fCDTN2dPwW+Z9/7udxvVYg02ggqmDmwB54ZQl6teT+e0048cDxaullPDeAM5+fMleDopC2y5HHxLhcfs8Szz77FLsIbNv6UdK7c4QQQgw3+i2o1VaoEyaMt6WVP2siZ0suZgO7d22/446ZMJo8wGgLQVvPJVUE1YTKznrpAi+0/5LC4wXVLqew2UIZwmYq+9u33wzqBYGg3nbbzb/8xSr4A+oR1L17ds6aNYP12pqSSpmkighXUZSv3Wez1bN1ji152S5j0qRrrdNYtQRVCCGGJ4UJKs7ef9+9PGUit/ad1cxmamfL1s0fbeT7TK4UV6160qToRz+6NVdQoVWxoJZe+VWfgrpw4YI//uEzE/vOzrWWDupFLYGgWjl/++uf1q/vYEV9Cupdd8031bdD1mvGzz+rsIRAUHNXqL95/ZUzn1dsWf/znz/tV7dz5sy2HmDVElQhhBieFCaolrb16LPPPsVTdsgXp1Q7U01Tmv/zf25InLDZyqxr28dffsgaCeqpyjF84hgL6qOPPmLKh49pvaBOv+mHtkDEq+AxY0bv2L711dLLH36wAS+Bfb2oJRBU8/CJJx4zGb7++knIX1tQLSdWkIkT1H2f7PriT2dgxCE+jq0mqNYKE9E1q9+whLXCr1CffvqJLR9vYtUSVCGEGJ70Q1BNBY8ePbRy5aPeaKHfjBBI/6UkE0iuRO3Qsr38qxdthWp2S0MFTYrw5SBbk5nemICZdvI7Pvf9dLFlOHxoPwoxjbRDM/ra7UITm2uvvcb0ElXMmzfH/LEVLfNYsUc+7aY6ol5+M8j+nvn8FBavM2fefvJET2vrT5JUlc0+d+4c2pEfDwR2iKIswaKmTPm+Nd8eKax117kvJd1++21WI5awKOrhh5ZZHmu4Nd8abulx48baw8EL7c9Z/l07uyx9/fWTu7ZttucJ67Fvf/vfk6xDqv26hRBCiHNLPwTVor+tokwATMO+973r77hj5tYtX77JNPh685e/XGWCYdls7bVgwZ1Jtq5CNuR8/bVXkmxNCazMjzd/gJUZ8Glb8/lD75JJ0fFjR6w6UzU79dnpk6biO3dsDTy3FSrTvt5qNVqeJPvc11aNtHssT+CkLU/95aaC1ti/p60zTTVLUEWQ/8inB9C9N09vsVW1SemOHVtNWU3CY7eDBgohhDjn9ENQhzM1/h/qL37xTGw8S0zIoYJCCCEEaBJBxbd+3n33H/9DJsH/2zl66NFHH/lo0+/i/GfPm2+8FhuFEEKMWJpBUINXrzBed913d2zfevjQfrwyFUIIIQaVZhBUIYQQ4pwjQRVCCCEKQIIqhBBCFIAEVQghhCgACaoQQghRABJUIYQQogAkqEIIIUQBSFCFEEKIApCgCiGEEAUgQRVCCCEKoJagjhnzr6NHf/1rX/vf559/XnxWCCGEaD5M8kz4Lr30YhPBiy66MM5QjaqCeumll1x88Ze7lgohhBAjkEsuGfWtb10Z26uRI6gmyFbEBRd8JT4lhBBCjChMEOtcp+YIarrI1dpUCCGE+J8XX/w1k8XYHpMjqFdccXlsFEIIIUYmJov1LFJzBPWrX9XLXiGEEOIffPWr59ezSM0R1K+YnkZGIYQQYmRy/vnnXXVV399OyhFUIYQQQngkqEIIIUQBSFCFEEKIApCgCiGEEAUgQRVCCCEKQIIqhBBCFIAEVQghhCgACaoQQghRAEMhqBMmXNO1fXfp1dfiU0IIIURzIEEduYwadeF99y+5/PLL4lMjk1mz5/ysbcX48dfEp4QQok8aVVDXdqx7+50OpK38znXvL/jJT+Js9dBzvFLe8EFs9zz8SJtV4fnFL9vjbIXT8V7nicrnldO/NydbF7XGGQbMzFl3HDzcY5oan2pc7rt/6etvvGXjgZa3Vv8W9+uNN1fP+b9zaPe30saSK2HJseOn4pKFEKJPGlVQTWBOnjqDtCmNSU7boyvibPWQK6jdh460tLTw0Jy3KjzxJYOBqemat9fe9qPbbpw2bcw3+75V9fPOu537DxyO7Y2LPRysf39j8ORh95G3zDqTDxD+VtolzD969BWd6zdM/cGNcflCCFGbRhXUg4eP7Nqzb/LkyRYBP/jwY1tVUFBNCLEi8fnvvnux/b3l1ttWPLZyydJldtW4cWNt3bny8SeNufPmMieMR3pOPvf8C5ZAZp614Bsod1xykgb3efPnmRv/9dKvmdNqsQzPrFpl9td+86YvBD6bdjLi13Cjzgb6szHHTpy+7/77Y/twwxpb58ix5lijbFTYeGDzTVD56LPy8Sf8vatWsg2qjR9u6rMDhRAioIEFdfWat20tMn36TRY0qXMWNC2q2lmzvPzrV6lPFlXtEK9PzRlzyeIply/eN7+mYWaejQU1LtmMpqNm6T501Jy5a8EC5LRaLNxbCQcP99hZqrgVCJ8/PXqCAlzNjfob6J2M2buve8rUKTy0y+1CpK1nKtmKn73kl3HITMdg5CLedyZeHgAUaKX1ayRUk70Yy2Ydu7ZjnVVhowLGAQhqEnWOEELUQwML6hNPPv18e/uy5cstjELnbpw2bd+BQ1u7dloGW4Da8m7+/B8jv0XVj7d2zZgxIy4qN8QHr3xJrqAGJUPj17+/0dK3z7jdEpA9SA7e3C59YDk+uhs79urNW7q279hjaTt14OARawWLCtwYWANjxo//jlVqVdNil+/55ADqsgZC/5BA59hfNtwyQ0eZSJyr1kXsTxNUXMV+y+3tGtSQvQBrkfHMqlXHT35mowJGCuqs2XN2793v+6dGyUePneRjkBBC1MnQCSpXKnjLGtDR0RkbjWpv3kxQLViboljEtKUq4rVx8tSZw0eO21nDlmuMmBZVcwUyqRLi+yWocc7LL7/MYvrO3fvMDa4XrRYrFhnMwpWTrSzN7d9t/MieD4JyAjcG1sAYXzvAE48ZrVfhsx16aUycM3YWl1NQLRtrNye5nLU0PtEcgKDecMP1NgCee/6FDRs3YTDEeTw9x0+teGzl7Dvm7Nqz38u8PazYtVb797//PZ+/hqD2FP0VMCHESGDoBLVa8BoYEFSLoSYwDz/SRkG11cmHH23hFzjtFPLX0JvcEH82gjr1B1OtvdBI86FPQbX16913LzaZtEs63lvvv3wUC+oAGhhjtZtK+a/4ohPs77sd68xhCqpvLGWGPeaXqnxgqrj3wxRaL6hxthrUkL0A78CnR0/A2O1e+QbUKFmCKoQYAI0tqDxEvE4lttL+4kswru1Yt/zBB5GuoTe5gnrwcM/MmTPjzPUIqlkohDNn3VFbUM3nfQcOrXz8CdiPHT/l16mBoA6sgbmY5PivYllF1i54aOVgDcqVaNL7CYB6Q0HlStTTkn7+ykviFWpr9kK4BpMmT+ZDQw2sKPab3Tj+j6ABCOrYsVdv7do5fvx34lNCCFGDphJUW9vZos3SN99y8333L7E137x5dyJDrDf8lu+RnpN4qegF5tiJ0xs/3PTkU888+thjN9xwfVCRLycuuf2FF05UPn/zrdVLli77ZL95evzpZ56x6nIFdeKkiXgzbIUsvvde73MSCWq/GlgbK+SZVav8oW8XpLQt+zA1SZ8G0OFWCyWKgmrNCVzFJVyD5gpqOX3D7C8ZMKamrYvuRhofS+NbRdUE1brRbvquPfs6e/8/1CTV42LHqhBihNBUgpp8+XWbayw+4r3f/UseYIZYb7B+8u8JvYcv//pVWyzitWRuRTVKNu1c8/Za01RT5RdfetmiNsQmV1CT9ItL23fsiX1OIkFN+tPA2mzZ1mXwMGiXX3qiLnjOQw/qLbu3vri84rrUCyqzsTfOEvwPVP+93NJrb+CuVRNU7z9VH7S/+BK/6iWEEPXTqIIqzhIsdvv7Cwat6VeWvKXkvo7U6JgwN9/vXQghhgwJ6shl4qSJv3ljtX7Llyx9YPmuPfsWti6KTwkhRJ9IUIUQQogCGApBFUIIIZoeCaoQQghRABJUIYQQogAkqEIIIUQBDIWg6ktJQgghmh4JqhBCCFEAElTxT8aPv+ZnbStmzZ4Tn+oTu8qutRLiU0IIMRKQoIp/cuz4qfvuX8LDt1b/dtLkyUgv+MlPbp9xO9Lc6yb4IVy71kqIixVCiJGABFX8g6k/uLFz/Qa/Aa3/JWG/n0y1H8K1a62E/v6coRBCNAcNLKgM8T7Wi4FhWrjxw02Ts/UoqCaoSfW9z6wEK6fatvBCCNHENLCglrINxRjrubUIapyQ7kKapFudYC0V7BvDZRY3WuGWKcyGXVMI7THmj8/J9nJ/FYgTfl/e/sJIJ+FzpbeffgsXbP+CnHEVTLdmm4xW641cpkydsndfd2AcgKAaVo7f+EUIIUYIjS2oCPexoELbICGWBwk75bWKG4ohgd3cIFqWh3t+dblNtmtDf1AU2mtFedmzU63pJuHQ5ha3t6h3nu9RsQ/ahHSvNwrqu9nHltTU2oLqe6Mady1YcPTYycA4MEG1cqy02C6EEM3N0AkqV1orH38ypqOjMzYaNV4emlpAJGJBteo2bd4aSIjXuSTVUVwFQbVLgkUtZOlsBBUJZkBREFSuieEGJJM52TTW7gXVZ4PP3slYUHN7IwBeBcaBCWrwJkAIIUYIQyeo1eLvwPBaFQiqHRrUpKT3l2iC9WLiBNVLmhmR82wElYtRUk1Q7RKfrZItKPkE4AW1NXtdXEnfA1tOv6gNBDXujVwkqEIIcZY0qqDiNSbSXlDNCKGFhKBqaIlfoXo9gLzZodcPps9GUFF7kC0QVLrHhIfiREH12skValA+BTXojaBwz/jx39natXPs2Ku98fjJzx586JEk3Y18/fsbb5w2jaeqCaqVYOVYafEpIYRobhpVULuzzzuTSFC5pIOEYFGYZN9CwlksH3E55A0qCO1sdR98no2gJqlvQcO9oGL5CLsZg4pa3CesFFTLjyeJCelXk/oU1KA3amA5Z86c6S0HD/cc6Tn5q5dLGz/cdPLUmVGjLoS9c937GzZu2rVnX/D/UA0rodgbLYQQjUJDCmr8ghTKAZWljiIB4TEWti6EznWlH+iyNMobhBCZefYsBTXJhLySfX0XgkoLL/e1V9IvHvvWAZRfyr5O3OcKNe6NGsyf/+P2F1/qXdTd+w4csoqOnTi9es07tHuXghfFVoKVE5QshBAjgUYV1KA0Ew8u9YY5wSvfarSm/7vGWyjYg8f+A4ffebeTK9F+YVfZtVZCfEoIIUYCDSmoDU2dgnpOWNi6aNeefUsfWB6f6hO7yq61EuJTQggxEpCgCiGEEAUwFIIqhBBCND0SVCGEEKIAJKhCCCFEAUhQhRBCiAKQoAohhBAFMBSCqm/5CiGEaHokqEIIIUQBSFCFEEKIApCgCiGEEAXQqILqf7PeSq7z9+uFEEKIQaLhBRU/jRtnEEIIIYaSxhZUv4lpku45w1r83izYFo2bdSfpdmZ+DzLuh4rLsT0cfr+eV3Ej0mqUsl3VKtkupLWBV93ZTuaxS8iD1qEPuQUbN3fzy3S2t5Luk8qrkBOnLA9b5NMxbb13ckVvo5dg8b/yPyHbIy/oIvrJQnwbYed+c8gAzy3Biugkn6L8iOK2d9Xu7/Dch0AI0XwMtaBayAtCam0oIQGIrVQjEAsqqvZuMF6zZKgCBdX+MpTjbGu63zj8oT2GkoaKaryF9l4RaknSe09TlAPNgM9egQhqh5/BqaS3HkPk+nw+SHo/TOA1QDVBJawo9yxoyzaEZzk1BNUSgaDaX1qsIvazbyPvL28rqxNCiEFi6ASVGrny8SdjOjo6Y6MxevQVcYFJGluhCt4YCyrCOjNAL5Pqgvpux7pApBG77e9bq9f4omIoqFSsOA8IvAK1BdVObdq8FT77xSgxozlfqb44ptgk2QKuhuQDcxKl0Tf/KFBNMlERujr2M+mPoELIvaBaJ/AQ1/r2smd4f83i8wshxOAxdIJaLdAPDCxWEHYZtc9eUEvpCs+7Cim1cnJV0MNojqIoPDG5RVUTVJMQakxtQZ19xxzLGawgqZoUVNyO3Xv31/AQQM+snEAa+WyE54agOQUKKkrwglpOF6xslL82yRPUoBOEEGLwaGxBDaQrFlS/okIasbWGoEJTWRFkI6migh6vc9CDOA9AXYGxmqBW0s9ZkQE+26l4XYjaUTLcKPVenFFQYW+r45Uvb1yuIKFD2tKPWmNBRfmxn0ndgsrLA0FFyXBpQvTKl+X4pwfahRBi8GhsQU2ysI7oGQtq4uTHC0wNQcVZhnjqWf2CGsh8LlBuZH7zrdVJTUGlVxQJNsS3DrWb3Uua2SkquNwX6IUtl1L6eJGbjYKKihKnXpZAmj3mlbV+QYXDgaAmmVe4hLrrdZ19BScpukIIMXg0qqCKoaHPxwghhBBAgipqUco+dRZCCFEbCarIB69V/ataIYQQNZCgCiGEEAUwFIIqhBBCND0SVCGEEKIAJKhCCCFEAUhQhRBCiAIYCkHVl5KEEEI0PRJUIf7B4nvvve/+JZdffll8SgwZP2tbMX78P37FTIjGQoIqxD84fOT43Xcvju1iKNm+Y0/nuvfHfLPvwCTEcEOCKsSXzJx1x5tvrR416sL41MDAsK+kO5/HZ0U17rt/ybHjp5559tn4lBDDnEYVVIQqMJx/Gw+/N+SJ84hzzowZM7oPHY3tA8bv0yD6yz2LF5umxnYhhjkNLKjcwMvSw+QX8h5+pM2er6dPv2nl40/Omj0nSQWVO6voh+aHjImTJuLlrd0Iux1xhoCnnl517MTp2D5guImeGACTJ0/etWff6NFXxKeEGM40vKAmWfkT0k2toay50lXqvT8o035PN+7URm+5d2nuJqYem//7Dhy6cdo0W+t0vNeJl4fVBLWcbuaapLWjLmxYhsy8ij4HtWPfNBTIJuOU9QOiuT+buP1QGevtbynb3A2ncHmX2182cLJP2HV2IfdQ8/vEWVEo3069tXoNjNi1bUK6uakl0FjeX9belm54HtTI24et7mg3gTSZtBtht8MWoMFVAVu7dm7e0hUYK9muq9xiD+8bcJb1dmWbusPtCenWdQcPHzFa053pKuk+dBixdohe5RKWI4Fdh8xsKbsuiXa+K7kteCvZrny5TvYLP2x4E/F+pS3arQ8OdKf7FfJ2By0qZbvNe99A0CLyfHv7XQsWxHYhhjNDLag2eYJXoLVhoA/wgorYHWTgrCaBwHi1sFPVzsKOWmoL6u0zbrfwnbgdOpMqgsoEMqAuc5hGhJ6k95tDH3pyfSZwIDjbX0FtdduUwsmgllwgioGRgTVxbnh4NyGoSLBGOlxbUDFgaLerfrfxowcfeuhE5XNT1uCqAD+cQNwQr4JJWj4yeNGC3kxwG9YmaVtmz74jV1D9SECZdgrN5OWeQH68oKL8ak72Cz9syk5QYeQI8bejLdtPPrdFHOSVTPVJ0KI+7UIMZ4ZOUKmRKx9/MqajozM2GtVe+zAC+sdkj481tDA0J5GgBmcZ0RggEKqCWjxjx169d1/3lKlT+lyhen1i9KSWJC6a+8Da6hQOdhRII4ExONtfQfUd6ENnbbyTBBX5REAsqAjQSW9hy3WDXWHrXX8WK9S1Hes+PXpi7ry5wVUBsaDGDaFm4BCuTsjeB8DILvWlfTkGWhflCqofCUnWFpbsa6cPHA8omVXDt2pOxkXVwA8bCqpvJoxl99BTu0UwvtuxLr77QYv6tAsxnBk6QY3n0tkQR8Ck93snH2sAYg3c8CHPz/ngEpSDANGnoBqr17zzfHt766K7O95bf8/iLz/D+zKY1hRU0qegetBML5nl3q9VEY/6K6h2avYdc2JBrR+7BKWV3O5vfQqqbwU7AQ7AQ1jaqggqpJTda0z9wVS7EfZMYzfCbkdwScyGjZu279jjLbmC6m8HtcorFhvojV+OgfoENSg5sCeRzPh7hMFfzcm4qBrUL6i8WbVbBKMNrXiKVRPO0mtv3HzLzbFdiOFMUwlq8K41mLqY87gKCgo7AlAQiQgrqkdQY74MppGg5gqDD0+M5j60kZbsFTclM/BtwIJq+ZcsXQY3qkW6PkH5VgiLpcwE8hNckvTuBLM8s2oVD5Mq/YbXHujn+Gyd/Orlki1kvYWd7C3QDBwy7YcNO40tYpMxkAJBzW1RqfeH/Z7gpvhBXk7Xi9WcBAcPH/nt2vfiYgNqCyoHm3ee06dai+ibH6i4MG7p2LFXb97SNX78dwK7EMOcphLUtnQNivCKWIOq+bYZYaI7/fZKAEoop98MqmTfRrG/rIVxpF/kCipg1awrsLAE2vFRXOB5JXW+Jf2AyuhKv8/SX0HFtewxXFLNpQDvIZxJ3Ht+q25h60LefXhVSf93JuIv6mWNXkGDenODdSW7rWcjqOPGjd2yrcv+eiOHE3sscY3lY4HvQDYTo4XXBuMQ0Fta2FifP3ApENT4Wm8Pnl2CbNXIFVRWxIGUpH7CGMzuwCsKapI2wfdnrqC2v/jSkZ6TgVGI4U+jCurZEDy2n00gLpBAS3JBT/qYODCZbxQq7pXDYLP8wQdXPv5EbB8kbNTZejG2Dyrvdqxrf+GF2F4PXgUHlVtuvW3/gcPvvPvl9/uEaCxGoqAGzjSQoCLbyBFUvxgabMZ888q9+7qn/uDG+NRgcE4EdfuOPTdOmxbb62HIBNWk1AT1th/dFp8SYpgzEgV1eFKnoI4E8Kp5ODzlNBOjRl14Nj+QO2SCKkTjIkEVQgghCmAoBFUIIYRoeiSoQgghRAFIUIUQQogCkKAKIYQQBSBBFUIIIQpgKARV3/IVQgjR9EhQxQjlzjvvuvrqf4vtDc3Kx5+Y9sMB/nTDMOfBhx62WxbbhRg+SFDFSGTRonsOfXostjc03OI+PtUEPPHk0813y0STIUEVw4UJ0Z7eg8fRYyfj32RvdNpffAmbBjYrdssG/FvEQgwBjSqoXW7vjmH+Y7b0s9geaD6GTFAnTpq48cNN1faub1CsUTt37ws2zGky7JZZG62l8SkhhgMNLKgMvi3ZptZJtP+atwRbl9CIfcRg5L5XzMZ9uAJ7LsdOnH7q6VUd73V2Hzo6Y8aM4Gx3ugU00n3ue0ULXaqk25xhTzGeLae7YCZu+zbA7dtQfovb3fM3b6w+0nOynvjrq/aV5uJzMnM53fYc+7Xldj4tvi7cSvqM8cOu8zeURja/nt+bfb69fe68ud7ibzH7kwMDY4CDBM3xv23Lu1lxA48Nr6RtRyuSdMOylvQfKiq5Df6QE+l+tciwR4R9Bw7Fdg9GCwr09cK3SjYXgvZamr+rbMbAK14LmI1tr6Q3FBOWe7d1pzs++X0peLuRxh2Jn5U/PXrCbl9gFGKY0AyCivLtbyndsTmpsoFMqfe+zUwzQXFqdduPM/AxUQ1+gmVqapo6atSFQYbubHvzJN1IC4lKpqloBd1jopTuJYlES7azJiWHZbZkm3gTdAKMZbdHzfz5P8Zmk32+IUTVCJ3WsbXvIHP6jrJK0b3sfJyF/3YIr6xFZpx9xxw7bMkejxhhobVeUJEBCZTD2003atC5fsOUqVO8BfE9ye4CSrAy4QBagZwcY2warkJOJnznt6bbvvYpqC2pgsYDuJ4WJV9uHt5joy62ezDCrTSUzzFmafhmTr61ek3ibg3OIiduRGBku5jAWbbd0jhVrimoHKK+6zAekAHs3ddtt89bhBg+DLWgtmZPuHWCyBvjBZWR1xNPRUxUrgAYpxAaqp3lnGcErMbtM25HRKtU2cUz196Vrr2smW15u2cnmX4kmaAigViGSxiOA8FjYEKCXYTbYStUU9Y33lwd10hKTlApFdWoJqh0DzEUZfIq+I+/rAIdxdvanS5WGKx569kzTCBz0A8x5WzTbOKvasu2vG5LXwbwb9K7aUjDE3Y+m+BvTWt9ggq5QkX9bVGSvh2p/XiUOEEtp6t81JtU2SYPzoDE3UGc9W1HQwJBZdvrEVQ/RNF2+MOOJX7iCzHcGGpBLYou95aJEwwTlfaWTFBxiJnsS8CkxeRHiCGMCNQ5H0yrYUHtwYcewcu3+MuWPdk6IOn9YAFPciOFt5cyQU0y580fBLskL/QgSJXSpeGSpctYuC1Mzc9x48Zu2dZV++MohHgSZ/Cwe31HUbrYkKCZ8BDNoRoh2iLuI6DjQlaElsKIZno/424MsAzXXvtdb/HDhhUlWVvY7RwMLActhWQmvR87/GisLah2d7rS56qe9JFuAC2yUffU06tiewAcXti6EB3r9T7ODA95K9F2ajCKaskWu0lvQfVtr/T1yjcYorXbvn3Hnj57Q4hzRQMLajyvutMPKRHBvfyAtnSpATd84EOYKLnVmAf2pD5BXb3mnefb21sX3d3x3vp4uYDAkfR+oQdVgD8+lAOGHlxO9+Czd7iliqC+27HO7L69r7z6m1dfe33W7Dl87VwN3yct7oPqXHxOdlS5DkFlkI0FddPmregT3zm4hEbfRXVSeu2Nm2+52Vt8CaXspS583r13PxseCyq8ojj5fi5nL4qhWDUE9a3Va3BD0bT+tmjUqAvXv79x+vSb4lMB5VQF7b63pB/Gw+d45AC03fBt94KKbmGfsIE4i8xoFO9+rqAiHdz92B/Qfeio3b7YLsRwoKkEtce9NapE3+bwglp2L4Qx8+EklYBgeZHUJ6gxvtV83IYnSdozlWyFivLpFSJXV/ZCGEXxbCldOzK6JXlhEdGKFcXd1Sel4gSVDfFn8RyDa7vdZ6hwtSX9TJH3C8GaZ72R/Vknpj2r17ztLT6IlzJB9bVTRyEDMKLJ6GecZT+X3Af2fQoqu47PCv1qEV45xPYYzAu6wfHDkTkh+wy1zX1kzoagUTB6n5HTC6pve5+Ciiaz6/w8jbEL63l0EOKc0FSCiqmI2VhyX+GBsZJJY7d7GUVQAiIO40vZfZfHK0G/CGoHpextKlQBqgN9pT8IN4x6aBHSjFMssKWKoDJQxt3VJ3TSd1E1qgmq708ApfRlBreJ2dgz6CXcX3YCjEi3Zq/QfY9Vw5Z0wTt5PySgGa3uBQBa5OWnkj0G8dDTlb68ZZO9oAY5W9NHCg4Mqguuoj81WoRva2/Z1hWfiim7L1J5QcVQYV04ZD93u2/5ckig7cEIQdsfXfHlK3pfcm7bURdL9kOU/lR6PzXaLcv9up8Qw4RGFdSzwS9Hkmz2xtmGM43iczn6+k8NBqb6A+PwkeNFDUjqLvAyXxtIV2zvFw8+9Mjxk589s6rvD1AHA/+QB/icURtr+MHD/X48termzbsztgsxTBiJgtoEVPK+MDwMGbaCOuabV67tWPcf3x4Xn2osduzcu3rN2yNh0bb+/Y1r+/rUX4hziwS1wcBLtoZQ02QYC6oQQhTOUAiqEEII0fRIUIUQQogCkKAKIYQQBSBBFUIIIQpAgiqEEEIUgARVCCGEKAAJqvgn48df87O2FbNmz4lPiUZhYevCB5Yti+1CiMFmiAS1/p+PEeeQznXvb9+xp/YWNGKYc/uM2/cfODwSfupBiOGGBLVpwc8TtqXbn9XzK8RTf3Bj5/oNo0dfEZ8SjcWECdd89PG2cePGxqeEEINHYwsqfjaoHrUYmfC3y+v5ZaWnnl4VbzknGpRjx0/pbgoxxDS2oB48/OUeILmbVFSyDTFa3VbeAD/nTbHh5X6bFGw/Ah1iCTzLq/irin5DEmyKEhTFerlwxFn8mHg1J8vRbi34VXHY+UPk5Wyn68TtL2YW72TtnwCcMnXK3n3dgdHvTFJxG/KwY9GQeCMRtA71VrL9W4DPBp/xG/FBi1hpxW0v4/utnG3Al+ukr4gZaoCctX8ds+R2ZMO6P+m9c47/lXz2Cav2UwANmeA2FwIcbxjGrA5j1ZeMu8yObXG72oHNW7oMbxFCDDaNLaiIv23pBpNJb61q6b1/Z/A7sXbI8NedbkuOSxDikfC6i6usBAQ4kzRoOWqEoO7eux9VQBuoFgzTKNM7mfTenSNwMkkDNxI92XZguBxpSiYFFWfhJM+iCbUF9a4FC44eOxkYfVG+EwJBhb3Ue4d29CEdoK7E8taaPkwELTIj9j/3d8pXV44E1TtJwWvrvS12DFQfGdpfeKFGTgoqmsZhhvuLcjh+eB9ZezkSVJbs+w050cPlbB9WqwLjDdfGglp2+wyCtR3rDhzUmxshhpShE1Q+hp88fYbpPqmxtDI7YpkFI/9oz1Dl41SgVW1uM8i2bGVDHfUXdru93hgoN23e2pUuTA3oaGu6cOTlDIUMjiwqcLK2oJJyb8mEkRrGs+hnCgxKg9JU60bgiyUUA9wLGNmioCGBoPpD365Y3lrdOwZc5c8mbmsdX105ElTvZCnbVqxPQUWG2B5DQS25/QkoqL4o1p64jXvLdQsq4U2xa23IoSIbbxxyOItEMHJye1IIMagMkaAOBj5sIdIhslCMfeZAq7zOQQKZqPTeDTsIx5bBqkE4o4LaIYIpAx/OBv6g5MBYW1DhD4gFlWpRTgUVCspnBR4avr25+GKJWZYsXWYe2l+eLbtno4r7dDYQVO+5b2bQn6iahXh58xXVFtTYSdhxbVwjmZAuK4M+rwYElXVRUIM2chR5e1K935JIUCHYhE7aiHpr9RqMNw4kehW0ovTaGxJUIYaYRhVURBkfdyBjPub6SFq/oLb1/iguCMdW6ezZd2CtYIUgYcbn21/4UmtTB1qy97os2RM4WUNQW9xbay44agtqS7pYp6BuSlfSSe/25nLzLTd3HzoaGK1wi+CogpWyqKAhgaBWE6pY3nIFtZwt8XFJbUGNnZyQvShmF/kaPeW6P4yAdFldremjGwWVK1QIIUZmfLmvyDckiQSVcovxgwKt8HIqySwK7e1OX3sEI8fYsHHT9h17vEUIMdg0qqBSYHjIkFqPoCJIQRi6s1ejXv8Y1FAyjAjiPoYCK+q373R4fxjcrZAgc/2CCqVEupK3QqWTCLUoxwsqnjOQobagJmlLZ86c6S2olM8HMNYpqDgba2osbxSnJGsR7g7a25Y+39QQ1GpO4myfgoqbjsx9fobq70I1QcXZuOH1Cyod7kkX2fDQjyIvqCgnFtRjJ063rfhnFUKIIaBRBTVYACG44G8lW7P6IBVHnK5sgctQ5QUVZ3EKgbKSvbuLBdWueq/zfS+ovii6BA8DHaohqIn7qiofIHwbGf3Lbj3nBZWF1yOo8+f/uP3Fl7yl0vt7pzDWKaiJe4XOcpIqgspm8hSvtSawFn9zK5mOxk5Cg1FOn4KapN2OAoPbGoBhwLooqPTHV8SG85L6BZUjc2HrQpwKBBVd7W9KMHJGjbpw34FDN06bRosQYghoVEEdsfgwWiwWhfcfOHzLrbfFpwYVilN/CXRIEOtSW23HdiHEoCJBbTAGT1CTL38GdtGuPfuWPrA8PjV4DFhQRS7P/vw5LoWFEEOJBLXBGFRBPSdIUIUQzYEEVQghhCgACaoQQghRABJUIYQQogAkqEIIIUQBSFCFEEKIApCgCiGEEAUgQRVCCCEKQIIqhBBCFIAEVQghhCiAAQrq+eefFxuFEEKIkYnJ4gAF9ZJLRsVGIYQQYmRisvj1r18a2wNyBHXMmCvOO+9/xXYhhBBipGGCaLJ40UUXxqcCcgTVLvvWt8ZccIFe/AohhBjpXHXVlfWoaZIrqMall15y5ZXfiO1CCCHEyOGCC75ighjbc8kX1CTV1Isv/lpsF0IIIUYCl1wy6lvf6vu7SKSqoAJb544Z86+24BVCCCFGCCZ89XwLKaAPQRVCCCFEPUhQhRBCiAKQoAohhBAFIEEVQgghCkCCKoQQQhSABFUIIYQoAAmqEEIIUQASVCGEEKIAJKhCCCFEAUhQhRBCiAL4/5dyWJVlSVklAAAAAElFTkSuQmCC>