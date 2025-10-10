export interface IActor {
  domainName: string;
  uid: string;
  token: string;

  slug: string;

  identities: string[]; //telegramId://-18092344 phone://+79778752110 email://nickerlan0@gmail.com

  administrators: string[];

  profile: IDisplayProfile;

  profiles: IDisplayProfile[];

  tagRecords: {
    expiresAt: Date;
    createdAt: Date;
    value: string;
  }[];

  tags: string[];

  logs: {
    type: 'auth' | 'payment-success' | 'refund' | 'add-contact';
    record: string;
    ts: Date;
  }[];

  meta: Record<string, unknown>;

  deleted: boolean;
}

export interface IDisplayProfile {
  name?: string;
  description?: string;
  avatarUrl?: string;
  scope?: string;
}
