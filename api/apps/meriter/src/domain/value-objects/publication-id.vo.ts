export class PublicationId {
  private constructor(private readonly value: string) {}

  static generate(): PublicationId {
    const { uid } = require('uid');
    return new PublicationId(uid());
  }

  static fromString(id: string): PublicationId {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid publication ID');
    }
    return new PublicationId(id);
  }

  getValue(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: PublicationId): boolean {
    return this.value === other.value;
  }
}
