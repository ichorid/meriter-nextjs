export type PollOptionView = {
  id: string;
  text: string;
  votes: number;
  amount: number;
  amountUp: number;
  amountDown: number;
  casterCount: number;
};

export type PollView = {
  id: string;
  communityId: string;
  authorId: string;
  question: string;
  description?: string | null;
  options: PollOptionView[];
  expiresAt: string;
  isActive: boolean;
  settings?: { quotaAllowed?: boolean };
  metrics?: {
    totalCasts?: number;
    casterCount?: number;
    totalAmount?: number;
  };
  permissions?: {
    canEdit?: boolean;
    canDelete?: boolean;
    canCast?: boolean;
  };
};

export function isPollExpired(poll: Pick<PollView, 'expiresAt'>): boolean {
  return new Date(poll.expiresAt).getTime() <= Date.now();
}

export function isPollFinished(poll: Pick<PollView, 'expiresAt' | 'isActive'>): boolean {
  return !poll.isActive || isPollExpired(poll);
}

export function optionUp(option: PollOptionView): number {
  return option.amountUp ?? option.amount ?? 0;
}

export function optionDown(option: PollOptionView): number {
  return option.amountDown ?? 0;
}

export function optionNet(option: PollOptionView): number {
  return optionUp(option) - optionDown(option);
}

export function leadingOption(options: PollOptionView[]): PollOptionView | null {
  if (options.length === 0) return null;
  return options.reduce((best, opt) => (optionNet(opt) > optionNet(best) ? opt : best));
}
