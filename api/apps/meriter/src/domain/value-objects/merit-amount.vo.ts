export type MeritSource = 'personal' | 'quota';

export class MeritAmount {
  private constructor(
    private readonly amount: number,
    private readonly source: MeritSource,
    private readonly currency: string
  ) {}

  static createPersonal(amount: number, currency: string): MeritAmount {
    if (amount < 0) {
      throw new Error('Personal merit amount cannot be negative');
    }
    return new MeritAmount(amount, 'personal', currency);
  }

  static createQuota(amount: number, currency: string): MeritAmount {
    if (amount < 0) {
      throw new Error('Quota merit amount cannot be negative');
    }
    return new MeritAmount(amount, 'quota', currency);
  }

  getAmount(): number {
    return this.amount;
  }

  getSource(): MeritSource {
    return this.source;
  }

  getCurrency(): string {
    return this.currency;
  }

  isPersonal(): boolean {
    return this.source === 'personal';
  }

  isQuota(): boolean {
    return this.source === 'quota';
  }

  add(other: MeritAmount): MeritAmount {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add merits of different currencies');
    }
    if (this.source !== other.source) {
      throw new Error('Cannot add different merit sources');
    }
    return new MeritAmount(this.amount + other.amount, this.source, this.currency);
  }

  subtract(other: MeritAmount): MeritAmount {
    if (this.currency !== other.currency) {
      throw new Error('Cannot subtract merits of different currencies');
    }
    if (this.source !== other.source) {
      throw new Error('Cannot subtract different merit sources');
    }
    const result = this.amount - other.amount;
    if (result < 0) {
      throw new Error('Insufficient merits');
    }
    return new MeritAmount(result, this.source, this.currency);
  }
}
