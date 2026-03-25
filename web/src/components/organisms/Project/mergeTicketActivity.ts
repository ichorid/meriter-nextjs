export type MergedTicketActivityEntry =
  | {
      kind: 'ticket';
      at: string;
      label: string;
      actorName?: string;
    }
  | {
      kind: 'edit';
      at: string;
      label: string;
      actorName?: string;
    };

type TicketActivityLogEntry = {
  at: string;
  actorId: string;
  action: string;
  detail?: Record<string, unknown>;
  actor?: { id: string; name?: string };
};

type EditHistoryEntry = {
  editedAt: string;
  editedBy: string;
  editor?: { id: string; name?: string };
};

export type TicketActivityPublicationSlice = {
  ticketActivityLog?: TicketActivityLogEntry[];
  editHistory?: EditHistoryEntry[];
};

/** next-intl translator subset */
type ActivityT = (key: string, values?: Record<string, string>) => string;

export function mergeTicketActivity(
  publication: TicketActivityPublicationSlice,
  t: ActivityT,
): MergedTicketActivityEntry[] {
  const statusWord = (s: string) => {
    if (s === 'open') return t('statusOpen');
    if (s === 'in_progress') return t('statusInProgress');
    if (s === 'done') return t('statusDone');
    if (s === 'closed') return t('statusClosed');
    return s;
  };
  const describeTicketAction = (action: string, detail?: Record<string, unknown>) => {
    const d = detail ?? {};
    switch (action) {
      case 'status_changed': {
        const from = typeof d.from === 'string' ? statusWord(d.from) : '';
        const to = typeof d.to === 'string' ? statusWord(d.to) : '';
        return t('taskActivity_status_changed', { from, to });
      }
      case 'work_accepted':
        return t('taskActivity_work_accepted');
      case 'returned_for_revision': {
        const reason = typeof d.reason === 'string' ? d.reason : '';
        return t('taskActivity_returned_for_revision', { reason });
      }
      case 'assignee_set':
        return t('taskActivity_assignee_set');
      case 'ticket_updated':
        return t('taskActivity_ticket_updated');
      case 'assignee_declined': {
        const reason = typeof d.reason === 'string' ? d.reason : '';
        return t('taskActivity_assignee_declined', { reason });
      }
      default:
        return action;
    }
  };

  const ticketLog = publication.ticketActivityLog ?? [];
  const edits = publication.editHistory ?? [];
  const rows: MergedTicketActivityEntry[] = [];

  for (const e of ticketLog) {
    rows.push({
      kind: 'ticket',
      at: e.at,
      label: describeTicketAction(e.action, e.detail),
      actorName: e.actor?.name,
    });
  }
  for (const e of edits) {
    rows.push({
      kind: 'edit',
      at: e.editedAt,
      label: t('taskActivity_content_edited'),
      actorName: e.editor?.name,
    });
  }
  rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return rows;
}
