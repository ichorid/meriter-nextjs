# План миграции данных: Рефакторинг системы ролей

> Детальный план миграции существующих данных при переходе на Individual-First модель

---

## 1. Подготовка к миграции

### 1.1. Backup

```bash
# MongoDB backup
mongodump --uri="mongodb://..." --out=/backup/pre-migration-$(date +%Y%m%d)

# Или через mongosh
use meriter
db.usercommunityroles.find().forEach(doc => printjson(doc)) > backup_roles.json
db.invites.find().forEach(doc => printjson(doc)) > backup_invites.json
```

### 1.2. Анализ текущих данных

Выполнить перед миграцией:

```javascript
// Подсчёт viewer по сообществам
db.usercommunityroles.aggregate([
  { $match: { role: 'viewer' } },
  { $group: { _id: '$communityId', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);

// Общее количество viewer
db.usercommunityroles.countDocuments({ role: 'viewer' });

// Пользователи, которые только viewer (нет других ролей)
db.usercommunityroles.aggregate([
  { $group: { 
    _id: '$userId', 
    roles: { $addToSet: '$role' },
    count: { $sum: 1 }
  }},
  { $match: { roles: { $eq: ['viewer'] } } },
  { $count: 'onlyViewers' }
]);

// Неиспользованные инвайты
db.invites.countDocuments({ used: false });
```

### 1.3. Точка отката

Сохранить mapping для возможного отката:

```javascript
// Создать коллекцию с информацией о миграции
db.migration_log.insertOne({
  name: 'viewer_to_participant',
  date: new Date(),
  status: 'started',
  originalViewerCount: db.usercommunityroles.countDocuments({ role: 'viewer' })
});
```

---

## 2. Миграция ролей: viewer → participant

### 2.1. Основная миграция

```javascript
// Миграция в MongoDB Shell
use meriter;

// Начать транзакцию (если поддерживается)
const session = db.getMongo().startSession();
session.startTransaction();

try {
  // Обновить все viewer на participant
  const result = db.usercommunityroles.updateMany(
    { role: 'viewer' },
    { $set: { role: 'participant' } }
  );
  
  print(`Updated ${result.modifiedCount} records`);
  
  // Записать в лог
  db.migration_log.updateOne(
    { name: 'viewer_to_participant' },
    { 
      $set: { 
        status: 'completed',
        modifiedCount: result.modifiedCount,
        completedAt: new Date()
      }
    }
  );
  
  session.commitTransaction();
  print('Migration completed successfully');
  
} catch (error) {
  session.abortTransaction();
  print('Migration failed: ' + error);
  throw error;
} finally {
  session.endSession();
}
```

### 2.2. Верификация миграции

```javascript
// Проверить что viewer не осталось
const remainingViewers = db.usercommunityroles.countDocuments({ role: 'viewer' });
print(`Remaining viewers: ${remainingViewers}`);
assert(remainingViewers === 0, 'Migration incomplete: viewers still exist');

// Проверить распределение ролей
db.usercommunityroles.aggregate([
  { $group: { _id: '$role', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);
```

### 2.3. NestJS миграция (альтернатива)

Если нужно запускать через NestJS:

```typescript
// api/apps/meriter/src/migrations/migrate-viewers.migration.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserCommunityRole } from '../common/schemas/user-community-role.schema';

@Injectable()
export class MigrateViewersMigration {
  private readonly logger = new Logger(MigrateViewersMigration.name);

  constructor(
    @InjectModel(UserCommunityRole.name)
    private readonly roleModel: Model<UserCommunityRole>,
  ) {}

  async up(): Promise<void> {
    this.logger.log('Starting viewer → participant migration');

    const beforeCount = await this.roleModel.countDocuments({ role: 'viewer' });
    this.logger.log(`Found ${beforeCount} viewer records`);

    const result = await this.roleModel.updateMany(
      { role: 'viewer' },
      { $set: { role: 'participant' } },
    );

    this.logger.log(`Migration complete. Modified: ${result.modifiedCount}`);

    // Verify
    const afterCount = await this.roleModel.countDocuments({ role: 'viewer' });
    if (afterCount > 0) {
      throw new Error(`Migration incomplete. Remaining viewers: ${afterCount}`);
    }

    this.logger.log('Verification passed. No viewers remaining.');
  }

  async down(): Promise<void> {
    this.logger.warn('Rollback not recommended - cannot distinguish former viewers');
  }
}
```

---

## 3. Миграция стартовых меритов

### 3.1. Проверка существующих пользователей

Некоторые пользователи могли зарегистрироваться без стартовых меритов (как viewer). Нужно проверить и начислить если необходимо:

```javascript
// Найти пользователей без глобальных меритов
// (Предполагая что у глобальных сообществ есть общий merId)

db.wallets.aggregate([
  // Группируем по userId для глобального сообщества
  { $match: { communityType: 'global' } }, // или по конкретным communityId
  { $group: { 
    _id: '$userId',
    totalMerits: { $sum: '$balance' },
    walletCount: { $sum: 1 }
  }},
  { $match: { totalMerits: { $lte: 0 } } }
]);
```

### 3.2. Начисление недостающих меритов

```javascript
// Начислить 100 меритов тем, у кого меньше
// Это сложная операция, лучше делать через приложение

// Псевдокод логики:
// 1. Получить список userId с balance < 100
// 2. Для каждого: creditMerits(userId, 100 - currentBalance, 'migration_starter_merits')
```

---

## 4. Архивация инвайтов

### 4.1. Создать архивную коллекцию

```javascript
// Скопировать все инвайты в архив
db.invites.aggregate([
  { $out: 'invites_archived' }
]);

// Добавить метаданные
db.invites_archived.updateMany(
  {},
  { $set: { archivedAt: new Date(), archivedReason: 'role_system_refactor_v2' } }
);
```

### 4.2. Опционально: удалить оригинальную коллекцию

```javascript
// Только после верификации что архив создан
db.invites_archived.countDocuments(); // Должен совпадать с оригиналом

// Удалить или переименовать
db.invites.renameCollection('invites_deprecated');
// или
// db.invites.drop();
```

---

## 5. Порядок выполнения миграции

### 5.1. Чеклист перед миграцией

- [ ] Backup БД создан
- [ ] Анализ данных выполнен (количество viewer, invites)
- [ ] Код приложения готов (enum без viewer, сервисы обновлены)
- [ ] Тестовая миграция на dev/staging прошла успешно
- [ ] Время даунтайма согласовано (если нужно)

### 5.2. Последовательность

```
1. Maintenance mode ON (опционально)
   │
   ▼
2. Backup production БД
   │
   ▼
3. Миграция viewer → participant
   │
   ▼
4. Верификация миграции ролей
   │
   ▼
5. Архивация инвайтов
   │
   ▼
6. Деплой нового кода
   │
   ▼
7. Smoke тесты
   │
   ▼
8. Maintenance mode OFF
   │
   ▼
9. Мониторинг ошибок
```

### 5.3. Время выполнения (оценка)

| Этап | Время |
|------|-------|
| Backup | 5-10 мин |
| Миграция ролей | 1-5 мин (зависит от объёма) |
| Верификация | 2 мин |
| Архивация инвайтов | 2 мин |
| Деплой | 5-10 мин |
| Smoke тесты | 10 мин |
| **Общее** | **30-45 мин** |

---

## 6. Откат (если что-то пошло не так)

### 6.1. Откат ролей

```javascript
// ВНИМАНИЕ: Это приведёт к тому, что ВСЕ participant станут viewer
// Нет способа отличить "бывших viewer" от "настоящих participant"
// Используйте только если миграция критически сломала систему

// НЕ РЕКОМЕНДУЕТСЯ - только для критических случаев
// db.usercommunityroles.updateMany(
//   { role: 'participant' },
//   { $set: { role: 'viewer' } }
// );
```

### 6.2. Восстановление из backup

```bash
# Полное восстановление из backup
mongorestore --uri="mongodb://..." /backup/pre-migration-YYYYMMDD

# Или восстановление только коллекции ролей
mongorestore --uri="mongodb://..." --collection=usercommunityroles /backup/pre-migration-YYYYMMDD/meriter/usercommunityroles.bson
```

### 6.3. Откат кода

```bash
# Вернуться на предыдущую версию
git checkout <previous-commit>
# Или откатить деплой через CI/CD
```

---

## 7. Мониторинг после миграции

### 7.1. Метрики для отслеживания

```javascript
// Запросы для мониторинга

// 1. Количество пользователей по ролям
db.usercommunityroles.aggregate([
  { $group: { _id: '$role', count: { $sum: 1 } } }
]);

// 2. Новые регистрации (проверить что получают participant)
db.users.find({ createdAt: { $gte: new Date(Date.now() - 3600000) } }); // Последний час

// 3. Ошибки авторизации (если логируются)
db.logs.find({ 
  level: 'error', 
  message: /permission|role|auth/i,
  timestamp: { $gte: new Date(Date.now() - 3600000) }
});
```

### 7.2. Алерты

Настроить алерты на:
- Появление `viewer` в ролях (не должно быть)
- Ошибки авторизации выше нормы
- Ошибки при создании команд
- Ошибки при приглашении

---

## 8. Коммуникация

### 8.1. Внутренняя

- Уведомить команду о времени миграции
- Подготовить runbook для поддержки

### 8.2. Пользователям (опционально)

Если нужно уведомить пользователей о изменениях:

```markdown
Уважаемые пользователи!

Мы обновили систему ролей на платформе:

✅ Теперь все пользователи имеют полный доступ сразу после регистрации
✅ Инвайт-коды больше не нужны
✅ Любой пользователь может создать свою команду

Если у вас были ограничения — они сняты автоматически.

Приятного использования!
```

---

## 9. Post-migration cleanup

После успешной миграции (через 1-2 недели):

1. Удалить deprecated код инвайтов
2. Удалить архив инвайтов (или оставить для истории)
3. Удалить migration_log записи
4. Обновить документацию
5. Закрыть связанные задачи
