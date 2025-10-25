export class WalletId {
  private constructor(private readonly value: string) {}

  static generate(): WalletId {
    const uuid = require('uuid').v4();
    return new WalletId(uuid);
  }

  static fromString(id: string): WalletId {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid wallet ID');
    }
    return new WalletId(id);
  }

  getValue(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: WalletId): boolean {
    return this.value === other.value;
  }
}
