export class CommunityId {
  private constructor(private readonly value: string) { }

  static fromString(id: string): CommunityId {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid community ID');
    }
    return new CommunityId(id);
  }

  getValue(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: CommunityId): boolean {
    return this.value === other.value;
  }
}
