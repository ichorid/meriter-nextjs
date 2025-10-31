export class PublicationContent {
  private static readonly MAX_LENGTH = 10000;
  private static readonly MIN_LENGTH = 1;

  private constructor(private readonly value: string) {}

  static create(content: string): PublicationContent {
    if (!content || typeof content !== 'string') {
      throw new Error('Publication content is required');
    }

    const trimmed = content.trim();

    if (trimmed.length < PublicationContent.MIN_LENGTH) {
      throw new Error('Publication content is too short');
    }

    if (trimmed.length > PublicationContent.MAX_LENGTH) {
      throw new Error(`Publication content exceeds maximum length of ${PublicationContent.MAX_LENGTH} characters`);
    }

    return new PublicationContent(trimmed);
  }

  getValue(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  length(): number {
    return this.value.length;
  }
}
