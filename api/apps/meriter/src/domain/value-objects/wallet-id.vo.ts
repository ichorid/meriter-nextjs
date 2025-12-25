import { uid } from 'uid';

export class WalletId {
  private constructor(private readonly value: string) {}

  static fromString(value: string): WalletId {
    if (!value || typeof value !== 'string') {
      throw new Error('WalletId must be a non-empty string');
    }
    return new WalletId(value);
  }

  static generate(): WalletId {
    return new WalletId(uid());
  }

  getValue(): string {
    return this.value;
  }

  equals(other: WalletId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}