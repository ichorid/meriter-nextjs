/** Persistent vote panel (inline keyboard under #hashtag posts). */

export type VotePanelMetrics = {
  upMerits: number;
  downMerits: number;
};

export type VotePanelRecipient = {
  displayName: string;
  isNomination: boolean;
  nominatorDisplayName?: string;
};

export function buildVotePanelMessageText(recipient: VotePanelRecipient): string {
  if (recipient.isNomination && recipient.nominatorDisplayName) {
    return (
      `Начислить заслуги: ${recipient.displayName}\n` +
      `(номинация от ${recipient.nominatorDisplayName})`
    );
  }
  return `Поддержите пост — заслуги: ${recipient.displayName}`;
}

export function buildVotePanelKeyboard(
  publicationId: string,
  metrics: VotePanelMetrics,
): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} {
  const up = Math.max(0, Math.round(metrics.upMerits));
  const down = Math.max(0, Math.round(metrics.downMerits));
  return {
    inline_keyboard: [
      [
        { text: `+1 — ${up}`, callback_data: `vp:${publicationId}:up:1` },
        { text: '+3', callback_data: `vp:${publicationId}:up:3` },
        { text: '+5', callback_data: `vp:${publicationId}:up:5` },
      ],
      [
        { text: 'Своя сумма', callback_data: `vp:${publicationId}:up:custom` },
        { text: `Против — ${down}`, callback_data: `vp:${publicationId}:down:1` },
      ],
    ],
  };
}

export type ParsedVotePanelCallback =
  | { publicationId: string; direction: 'up' | 'down'; amount: number }
  | { publicationId: string; direction: 'up'; custom: true };

export function parseVotePanelCallback(data: string): ParsedVotePanelCallback | null {
  const parts = data.split(':');
  if (parts[0] !== 'vp' || !parts[1] || !parts[2]) {
    return null;
  }
  const publicationId = parts[1];
  const direction = parts[2] === 'down' ? 'down' : 'up';
  const amountToken = parts[3];
  if (amountToken === 'custom') {
    if (direction !== 'up') {
      return null;
    }
    return { publicationId, direction: 'up', custom: true };
  }
  const amount = Number.parseInt(amountToken ?? '', 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return { publicationId, direction, amount };
}

export function metricsFromPublicationDoc(doc: {
  metrics?: { upvotes?: number; downvotes?: number };
} | null | undefined): VotePanelMetrics {
  return {
    upMerits: doc?.metrics?.upvotes ?? 0,
    downMerits: doc?.metrics?.downvotes ?? 0,
  };
}
