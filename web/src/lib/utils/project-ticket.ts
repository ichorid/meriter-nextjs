export function ticketHasWorkAccepted(pub: {
  ticketActivityLog?: Array<{ action?: string }>;
}): boolean {
  return (pub.ticketActivityLog ?? []).some((e) => e.action === 'work_accepted');
}
