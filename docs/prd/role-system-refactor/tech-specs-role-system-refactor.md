# Технические спецификации: Рефакторинг системы ролей

> Детальное описание изменений в коде для реализации PRD "Individual-First модель"

---

## 1. Изменения в моделях данных

### 1.1. UserCommunityRole — удаление viewer

**Файл:** `api/apps/meriter/src/common/schemas/user-community-role.schema.ts`

```typescript
// БЫЛО:
export enum CommunityRole {
  SUPERADMIN = 'superadmin',
  LEAD = 'lead',
  PARTICIPANT = 'participant',
  VIEWER = 'viewer',
}

// СТАЛО:
export enum CommunityRole {
  SUPERADMIN = 'superadmin',
  LEAD = 'lead',
  PARTICIPANT = 'participant',
  // VIEWER удалён
}
```

### 1.2. Схема Community — без изменений

Структура сообщества остаётся прежней. Типы `global` и `team` сохраняются.

### 1.3. Схема Invite — на удаление

**Файл:** `api/apps/meriter/src/common/schemas/invite.schema.ts`

Весь файл помечается как deprecated или удаляется. Коллекция в MongoDB архивируется.

---

## 2. Миграция данных

### 2.1. Скрипт миграции viewer → participant

**Файл:** `api/apps/meriter/src/migrations/migrate-viewers-to-participants.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserCommunityRole } from '../common/schemas/user-community-role.schema';

@Injectable()
export class MigrateViewersService {
  private readonly logger = new Logger(MigrateViewersService.name);

  constructor(
    @InjectModel(UserCommunityRole.name)
    private readonly userCommunityRoleModel: Model<UserCommunityRole>,
  ) {}

  async migrate(): Promise<{ updated: number }> {
    this.logger.log('Starting migration: viewer → participant');
    
    const result = await this.userCommunityRoleModel.updateMany(
      { role: 'viewer' },
      { $set: { role: 'participant' } },
    );

    this.logger.log(`Migration complete. Updated ${result.modifiedCount} records`);
    
    return { updated: result.modifiedCount };
  }

  async rollback(): Promise<void> {
    // На случай отката — но лучше не откатывать, 
    // т.к. нет способа отличить "бывших viewer" от "настоящих participant"
    this.logger.warn('Rollback not recommended for this migration');
  }
}
```

### 2.2. Скрипт архивации инвайтов

```typescript
// Переименовать коллекцию invites → invites_archived
// Или экспортировать в JSON для истории
db.invites.aggregate([
  { $out: 'invites_archived' }
]);
```

---

## 3. Изменения в сервисах

### 3.1. AuthService — убрать инвайты из регистрации

**Файл:** `api/apps/meriter/src/modules/auth/auth.service.ts`

```typescript
// БЫЛО:
async register(data: RegisterDto): Promise<User> {
  const user = await this.userService.create(data);
  
  if (data.inviteCode) {
    await this.inviteService.processInvite(user.id, data.inviteCode);
  } else {
    await this.userService.ensureUserInBaseCommunities(user.id);
  }
  
  return user;
}

// СТАЛО:
async register(data: RegisterDto): Promise<User> {
  // 1. Создать пользователя
  const user = await this.userService.create(data);
  
  // 2. Добавить во все глобальные сообщества как participant
  await this.userService.ensureUserInBaseCommunities(user.id);
  
  // 3. Начислить стартовые мериты (100 глобальных)
  await this.walletService.creditStartingMerits(user.id, 100);
  
  return user;
}
```

**RegisterDto — убрать inviteCode:**
```typescript
// БЫЛО:
export class RegisterDto {
  name: string;
  about: string;
  avatar?: string;
  contacts?: string;
  inviteCode?: string; // УБРАТЬ
}

// СТАЛО:
export class RegisterDto {
  name: string;
  about: string;
  avatar?: string;
  contacts?: string;
  // inviteCode удалён
}
```

### 3.2. UserService — изменить ensureUserInBaseCommunities

**Файл:** `api/apps/meriter/src/modules/users/users.service.ts`

```typescript
// БЫЛО:
async ensureUserInBaseCommunities(userId: string): Promise<void> {
  const baseCommunities = ['future-vision', 'marathon-of-good', 'team-projects', 'support'];
  
  for (const slug of baseCommunities) {
    const community = await this.communityService.findBySlug(slug);
    if (!community) continue;
    
    const existingRole = await this.getUserRoleInCommunity(userId, community.id);
    
    if (!existingRole) {
      // Назначаем viewer
      await this.assignRole(userId, community.id, 'viewer');
    }
    
    await this.walletService.ensureWallet(userId, community.id);
  }
}

// СТАЛО:
async ensureUserInBaseCommunities(userId: string): Promise<void> {
  const baseCommunities = ['future-vision', 'marathon-of-good', 'team-projects', 'support'];
  
  for (const slug of baseCommunities) {
    const community = await this.communityService.findBySlug(slug);
    if (!community) continue;
    
    const existingRole = await this.getUserRoleInCommunity(userId, community.id);
    
    if (!existingRole) {
      // ИЗМЕНЕНИЕ: Назначаем participant вместо viewer
      await this.assignRole(userId, community.id, 'participant');
    }
    
    await this.walletService.ensureWallet(userId, community.id);
  }
}
```

### 3.3. UserService — новые методы

```typescript
/**
 * Пригласить пользователя в команду
 * Доступно только для lead сообщества
 */
async inviteToTeam(
  inviterId: string,
  targetUserId: string,
  communityId: string,
): Promise<void> {
  // 1. Проверить, что inviter — lead в этом сообществе
  const inviterRole = await this.getUserRoleInCommunity(inviterId, communityId);
  if (inviterRole !== 'lead' && inviterRole !== 'superadmin') {
    throw new ForbiddenException('Only leads can invite to team');
  }
  
  // 2. Проверить, что сообщество — team (не global)
  const community = await this.communityService.findById(communityId);
  if (community.type !== 'team') {
    throw new BadRequestException('Can only invite to team communities');
  }
  
  // 3. Проверить, что target ещё не в сообществе
  const targetRole = await this.getUserRoleInCommunity(targetUserId, communityId);
  if (targetRole) {
    throw new BadRequestException('User is already a member of this community');
  }
  
  // 4. Назначить роль participant
  await this.assignRole(targetUserId, communityId, 'participant');
  
  // 5. Создать кошелёк
  await this.walletService.ensureWallet(targetUserId, communityId);
  
  // 6. Добавить в списки
  await this.communityService.addMember(communityId, targetUserId);
  await this.addCommunityToUser(targetUserId, communityId);
  
  // 7. (Опционально) Отправить уведомление
  // await this.notificationService.sendInviteNotification(targetUserId, communityId, inviterId);
}

/**
 * Назначить пользователя лидом сообщества
 * Доступно только для superadmin
 */
async assignLead(
  adminId: string,
  targetUserId: string,
  communityId: string,
): Promise<void> {
  // 1. Проверить, что admin — superadmin
  const admin = await this.findById(adminId);
  if (admin.globalRole !== 'superadmin') {
    throw new ForbiddenException('Only superadmins can assign leads');
  }
  
  // 2. Проверить существование сообщества
  const community = await this.communityService.findById(communityId);
  if (!community) {
    throw new NotFoundException('Community not found');
  }
  
  // 3. Назначить роль lead
  await this.assignRole(targetUserId, communityId, 'lead');
  
  // 4. Убедиться что есть кошелёк
  await this.walletService.ensureWallet(targetUserId, communityId);
  
  // 5. Добавить в списки (если ещё не добавлен)
  await this.communityService.addMember(communityId, targetUserId);
  await this.addCommunityToUser(targetUserId, communityId);
  
  // 6. Логировать действие
  this.logger.log(`Admin ${adminId} assigned ${targetUserId} as lead in ${communityId}`);
}

/**
 * Получить сообщества, где пользователь — lead
 */
async getLeadCommunities(userId: string): Promise<Community[]> {
  const roles = await this.userCommunityRoleModel.find({
    userId,
    role: 'lead',
  });
  
  const communityIds = roles.map(r => r.communityId);
  return this.communityService.findByIds(communityIds);
}

/**
 * Получить сообщества, куда можно пригласить конкретного пользователя
 * (где текущий — lead, а целевой — не участник)
 */
async getInvitableCommunities(
  currentUserId: string,
  targetUserId: string,
): Promise<Community[]> {
  // Сообщества, где текущий — lead
  const leadCommunities = await this.getLeadCommunities(currentUserId);
  
  // Сообщества, где целевой уже участник
  const targetMemberships = await this.userCommunityRoleModel.find({
    userId: targetUserId,
  });
  const targetCommunityIds = new Set(targetMemberships.map(m => m.communityId.toString()));
  
  // Фильтруем
  return leadCommunities.filter(
    c => !targetCommunityIds.has(c.id.toString()) && c.type === 'team'
  );
}
```

### 3.4. CommunityService — создание команды пользователем

**Файл:** `api/apps/meriter/src/modules/communities/communities.service.ts`

```typescript
/**
 * Создать команду (локальное сообщество) от имени пользователя
 */
async createTeamByUser(
  userId: string,
  data: CreateTeamDto,
): Promise<Community> {
  // 1. Проверить лимиты (опционально)
  // const userTeamsCount = await this.countUserLeadCommunities(userId);
  // if (userTeamsCount >= MAX_TEAMS_PER_USER) {
  //   throw new BadRequestException('Team limit reached');
  // }
  
  // 2. Создать сообщество
  const community = await this.create({
    name: data.name,
    description: data.description,
    avatar: data.avatar,
    type: 'team',
    // Дефолтные настройки для team
    settings: {
      postFee: 1,
      commentFee: 0.1,
      canWithdrawMerits: true,
      canVoteSelf: false,
      tappalkaEnabled: false,
      quotaEnabled: false,
      // ... остальные настройки по умолчанию
    },
  });
  
  // 3. Назначить создателя lead
  await this.userService.assignRole(userId, community.id, 'lead');
  
  // 4. Создать кошелёк
  await this.walletService.ensureWallet(userId, community.id);
  
  // 5. Добавить в списки
  await this.addMember(community.id, userId);
  await this.userService.addCommunityToUser(userId, community.id);
  
  return community;
}
```

**CreateTeamDto:**
```typescript
export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  avatar?: string;
}
```

### 3.5. PermissionService — удалить проверки viewer

**Файл:** `api/apps/meriter/src/common/permissions/permission-rule-engine.ts`

Удалить все правила для `viewer`. Примеры изменений:

```typescript
// БЫЛО:
const defaultRules: PermissionRule[] = [
  // ... 
  { role: 'viewer', action: 'VIEW_COMMUNITY', allowed: true },
  { role: 'viewer', action: 'POST_PUBLICATION', allowed: false },
  { role: 'viewer', action: 'VOTE', allowed: false },
  // специальные правила для viewer в МД
  { 
    role: 'viewer', 
    action: 'VOTE', 
    allowed: true, 
    condition: { communitySlug: 'marathon-of-good', source: 'quota' } 
  },
  // ...
];

// СТАЛО:
const defaultRules: PermissionRule[] = [
  // Все правила для viewer УДАЛЕНЫ
  // Остаются только правила для: superadmin, lead, participant
  { role: 'superadmin', action: '*', allowed: true },
  { role: 'lead', action: 'POST_PUBLICATION', allowed: true },
  { role: 'lead', action: 'VOTE', allowed: true },
  // ...
  { role: 'participant', action: 'POST_PUBLICATION', allowed: true },
  { role: 'participant', action: 'VOTE', allowed: true },
  { role: 'participant', action: 'COMMENT', allowed: true },
  // ...
];
```

---

## 4. Изменения в роутерах

### 4.1. communities.router.ts — добавить createTeam

```typescript
// Добавить процедуру
createTeam: protectedProcedure
  .input(z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(1000).optional(),
    avatar: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    return ctx.communityService.createTeamByUser(ctx.user.id, input);
  }),
```

### 4.2. users.router.ts — добавить новые процедуры

```typescript
// Пригласить в команду
inviteToTeam: protectedProcedure
  .input(z.object({
    targetUserId: z.string(),
    communityId: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    return ctx.userService.inviteToTeam(
      ctx.user.id,
      input.targetUserId,
      input.communityId
    );
  }),

// Назначить лидом (только superadmin)
assignLead: protectedProcedure
  .input(z.object({
    targetUserId: z.string(),
    communityId: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    return ctx.userService.assignLead(
      ctx.user.id,
      input.targetUserId,
      input.communityId
    );
  }),

// Получить сообщества для приглашения
getInvitableCommunities: protectedProcedure
  .input(z.object({
    targetUserId: z.string(),
  }))
  .query(async ({ ctx, input }) => {
    return ctx.userService.getInvitableCommunities(
      ctx.user.id,
      input.targetUserId
    );
  }),

// Получить мои сообщества где я lead
getMyLeadCommunities: protectedProcedure
  .query(async ({ ctx }) => {
    return ctx.userService.getLeadCommunities(ctx.user.id);
  }),
```

### 4.3. invites.router.ts — deprecated/удаление

```typescript
// Вариант 1: Пометить deprecated
/** @deprecated Invite system removed in v2.0 */
export const invitesRouter = router({
  // Все процедуры возвращают ошибку
  create: protectedProcedure.mutation(() => {
    throw new Error('Invite system has been deprecated');
  }),
  use: protectedProcedure.mutation(() => {
    throw new Error('Invite system has been deprecated');
  }),
});

// Вариант 2: Полностью удалить файл и ссылки на него
```

---

## 5. Изменения во Frontend

### 5.1. Убрать инвайт-код из регистрации

**Файл:** `web/src/features/auth/components/RegisterForm.tsx`

```tsx
// БЫЛО:
<FormField
  name="inviteCode"
  label="Код приглашения (опционально)"
  placeholder="Введите код, если есть"
/>

// СТАЛО:
// Поле полностью удалено
```

**Файл:** `web/src/features/auth/schemas/register.schema.ts`

```typescript
// БЫЛО:
export const registerSchema = z.object({
  name: z.string().min(2),
  about: z.string().min(10),
  inviteCode: z.string().optional(),
});

// СТАЛО:
export const registerSchema = z.object({
  name: z.string().min(2),
  about: z.string().min(10),
  // inviteCode удалён
});
```

### 5.2. Профиль — кнопка "Создать команду"

**Файл:** `web/src/features/profile/components/ProfileActions.tsx`

```tsx
import { useCreateTeam } from '@/hooks/useCreateTeam';
import { CreateTeamDialog } from './CreateTeamDialog';

export function ProfileActions({ isOwnProfile }: { isOwnProfile: boolean }) {
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  
  if (!isOwnProfile) return null;
  
  return (
    <div className="flex gap-2">
      <Button onClick={() => setShowCreateTeam(true)}>
        Создать команду
      </Button>
      
      <CreateTeamDialog 
        open={showCreateTeam} 
        onClose={() => setShowCreateTeam(false)} 
      />
    </div>
  );
}
```

**Файл:** `web/src/features/profile/components/CreateTeamDialog.tsx`

```tsx
import { useCreateTeam } from '@/hooks/useCreateTeam';

interface CreateTeamDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateTeamDialog({ open, onClose }: CreateTeamDialogProps) {
  const createTeam = useCreateTeam();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  const handleSubmit = async () => {
    await createTeam.mutateAsync({ name, description });
    onClose();
    // Показать toast "Команда создана"
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Создать команду</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Input
            label="Название команды"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Моя крутая команда"
          />
          
          <Textarea
            label="Описание (опционально)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Расскажите о команде..."
          />
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button 
            onClick={handleSubmit} 
            loading={createTeam.isLoading}
            disabled={!name.trim()}
          >
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 5.3. Профиль другого пользователя — кнопка "Пригласить"

**Файл:** `web/src/features/profile/components/OtherProfileActions.tsx`

```tsx
import { useInvitableCommunities } from '@/hooks/useInvitableCommunities';
import { useInviteToTeam } from '@/hooks/useInviteToTeam';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface OtherProfileActionsProps {
  targetUserId: string;
}

export function OtherProfileActions({ targetUserId }: OtherProfileActionsProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: invitableCommunities } = useInvitableCommunities(targetUserId);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showAssignLeadDialog, setShowAssignLeadDialog] = useState(false);
  
  const hasTeamsToInvite = invitableCommunities && invitableCommunities.length > 0;
  const isSuperadmin = currentUser?.globalRole === 'superadmin';
  
  return (
    <div className="flex gap-2">
      {hasTeamsToInvite && (
        <Button 
          variant="outline" 
          onClick={() => setShowInviteDialog(true)}
        >
          Пригласить в команду
        </Button>
      )}
      
      {isSuperadmin && (
        <Button 
          variant="outline" 
          onClick={() => setShowAssignLeadDialog(true)}
        >
          Назначить лидом
        </Button>
      )}
      
      <InviteToTeamDialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        targetUserId={targetUserId}
        communities={invitableCommunities || []}
      />
      
      <AssignLeadDialog
        open={showAssignLeadDialog}
        onClose={() => setShowAssignLeadDialog(false)}
        targetUserId={targetUserId}
      />
    </div>
  );
}
```

### 5.4. Диалог приглашения в команду

**Файл:** `web/src/features/profile/components/InviteToTeamDialog.tsx`

```tsx
interface InviteToTeamDialogProps {
  open: boolean;
  onClose: () => void;
  targetUserId: string;
  communities: Community[];
}

export function InviteToTeamDialog({ 
  open, 
  onClose, 
  targetUserId, 
  communities 
}: InviteToTeamDialogProps) {
  const inviteToTeam = useInviteToTeam();
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  
  const handleInvite = async () => {
    if (!selectedCommunityId) return;
    
    await inviteToTeam.mutateAsync({
      targetUserId,
      communityId: selectedCommunityId,
    });
    
    onClose();
    // Toast: "Пользователь приглашён в команду"
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Выберите команду</DialogTitle>
          <DialogDescription>
            Пользователь будет добавлен как участник
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2">
          {communities.map((community) => (
            <div
              key={community.id}
              className={cn(
                "p-3 border rounded-lg cursor-pointer hover:bg-accent",
                selectedCommunityId === community.id && "border-primary bg-accent"
              )}
              onClick={() => setSelectedCommunityId(community.id)}
            >
              <div className="font-medium">{community.name}</div>
              {community.description && (
                <div className="text-sm text-muted-foreground">
                  {community.description}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button 
            onClick={handleInvite}
            loading={inviteToTeam.isLoading}
            disabled={!selectedCommunityId}
          >
            Пригласить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 5.5. Диалог назначения лидом (для суперадмина)

**Файл:** `web/src/features/profile/components/AssignLeadDialog.tsx`

```tsx
interface AssignLeadDialogProps {
  open: boolean;
  onClose: () => void;
  targetUserId: string;
}

export function AssignLeadDialog({ 
  open, 
  onClose, 
  targetUserId 
}: AssignLeadDialogProps) {
  const { data: allCommunities } = useAllCommunities(); // Для суперадмина — все
  const assignLead = useAssignLead();
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  
  const handleAssign = async () => {
    if (!selectedCommunityId) return;
    
    await assignLead.mutateAsync({
      targetUserId,
      communityId: selectedCommunityId,
    });
    
    onClose();
    // Toast: "Пользователь назначен лидом"
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Назначить лидом</DialogTitle>
          <DialogDescription>
            Выберите сообщество, в котором пользователь станет лидом
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[300px] overflow-y-auto space-y-2">
          {allCommunities?.map((community) => (
            <div
              key={community.id}
              className={cn(
                "p-3 border rounded-lg cursor-pointer hover:bg-accent",
                selectedCommunityId === community.id && "border-primary bg-accent"
              )}
              onClick={() => setSelectedCommunityId(community.id)}
            >
              <div className="flex items-center gap-2">
                <div className="font-medium">{community.name}</div>
                {community.type === 'global' && (
                  <Badge variant="secondary">Глобальное</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button 
            onClick={handleAssign}
            loading={assignLead.isLoading}
            disabled={!selectedCommunityId}
          >
            Назначить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 5.6. Хуки

**Файл:** `web/src/hooks/useCreateTeam.ts`

```typescript
import { trpc } from '@/lib/trpc';

export function useCreateTeam() {
  const utils = trpc.useUtils();
  
  return trpc.communities.createTeam.useMutation({
    onSuccess: () => {
      // Инвалидировать кэш сообществ
      utils.communities.getMyLeadCommunities.invalidate();
      utils.users.getMe.invalidate();
    },
  });
}
```

**Файл:** `web/src/hooks/useInviteToTeam.ts`

```typescript
export function useInviteToTeam() {
  const utils = trpc.useUtils();
  
  return trpc.users.inviteToTeam.useMutation({
    onSuccess: () => {
      utils.users.getInvitableCommunities.invalidate();
    },
  });
}
```

**Файл:** `web/src/hooks/useAssignLead.ts`

```typescript
export function useAssignLead() {
  return trpc.users.assignLead.useMutation();
}
```

**Файл:** `web/src/hooks/useInvitableCommunities.ts`

```typescript
export function useInvitableCommunities(targetUserId: string) {
  return trpc.users.getInvitableCommunities.useQuery(
    { targetUserId },
    { enabled: !!targetUserId }
  );
}
```

---

## 6. Удаление модуля инвайтов

### 6.1. Backend — файлы на удаление

```
api/apps/meriter/src/modules/invites/
├── invites.module.ts          # Удалить
├── invites.service.ts         # Удалить
├── invites.router.ts          # Удалить
├── dto/
│   ├── create-invite.dto.ts   # Удалить
│   └── use-invite.dto.ts      # Удалить
└── schemas/
    └── invite.schema.ts       # Удалить (или переместить в archived)
```

### 6.2. Убрать импорты invites

**Файл:** `api/apps/meriter/src/app.module.ts`

```typescript
// БЫЛО:
import { InvitesModule } from './modules/invites/invites.module';

@Module({
  imports: [
    // ...
    InvitesModule, // УБРАТЬ
  ],
})

// СТАЛО:
@Module({
  imports: [
    // InvitesModule удалён
  ],
})
```

### 6.3. Frontend — файлы на удаление

```
web/src/features/invites/      # Вся папка на удаление
web/src/hooks/useInvites.ts    # Удалить
```

---

## 7. Тестирование

### 7.1. Unit тесты для новых методов

```typescript
describe('UserService.inviteToTeam', () => {
  it('should add user to team as participant', async () => {
    // ...
  });
  
  it('should throw if inviter is not lead', async () => {
    // ...
  });
  
  it('should throw if user already in community', async () => {
    // ...
  });
  
  it('should throw if trying to invite to global community', async () => {
    // ...
  });
});

describe('UserService.assignLead', () => {
  it('should assign lead role', async () => {
    // ...
  });
  
  it('should throw if caller is not superadmin', async () => {
    // ...
  });
});

describe('CommunityService.createTeamByUser', () => {
  it('should create team and assign creator as lead', async () => {
    // ...
  });
});
```

### 7.2. Integration тесты

```typescript
describe('Registration flow', () => {
  it('should register user as participant in all global communities', async () => {
    const result = await register({ name: 'Test', about: 'Test user' });
    
    expect(result.user).toBeDefined();
    
    // Проверить роли
    const roles = await getUserRoles(result.user.id);
    expect(roles).toHaveLength(4); // 4 глобальных сообщества
    
    for (const role of roles) {
      expect(role.role).toBe('participant');
    }
  });
});
```

---

## 8. Порядок выполнения

### Фаза 1: Подготовка (1 день)
1. Создать скрипт миграции viewer → participant
2. Протестировать на dev-базе
3. Сделать backup production

### Фаза 2: Backend миграция (1-2 дня)
1. Запустить миграцию viewer → participant
2. Обновить enum CommunityRole
3. Обновить PermissionService (убрать viewer)
4. Обновить AuthService (убрать inviteCode)
5. Обновить UserService.ensureUserInBaseCommunities

### Фаза 3: Новый функционал Backend (2-3 дня)
1. Добавить CommunityService.createTeamByUser
2. Добавить UserService.inviteToTeam
3. Добавить UserService.assignLead
4. Добавить роутеры

### Фаза 4: Frontend (2-3 дня)
1. Убрать inviteCode из регистрации
2. Добавить CreateTeamDialog
3. Добавить InviteToTeamDialog
4. Добавить AssignLeadDialog
5. Обновить ProfilePage

### Фаза 5: Cleanup (1 день)
1. Deprecated/удалить модуль invites
2. Убрать UI инвайтов
3. Обновить документацию

### Фаза 6: Тестирование (1-2 дня)
1. E2E тесты новых flow
2. Регрессионное тестирование
3. UAT

**Общая оценка: 8-12 дней**
