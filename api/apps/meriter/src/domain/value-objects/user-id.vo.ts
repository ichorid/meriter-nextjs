export class UserId {
  private constructor(private readonly value: string) {}

  static fromTelegramId(telegramId: string): UserId {
    if (!telegramId || typeof telegramId !== 'string') {
      throw new Error('Invalid Telegram ID');
    }
    return new UserId(telegramId);
  }

  static fromString(id: string): UserId {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid user ID');
    }
    return new UserId(id);
  }

  getValue(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }
}
