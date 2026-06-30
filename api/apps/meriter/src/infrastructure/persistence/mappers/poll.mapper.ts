import type { PollSnapshot } from '../../../domain/ports/poll.persistence.port';

/** Lean Mongoose poll document shape (plain fields). */
export type PollDocumentShape = PollSnapshot;

function clonePollSnapshot(snapshot: PollSnapshot): PollSnapshot {
  return {
    ...snapshot,
    options: snapshot.options.map((option) => ({ ...option })),
    metrics: { ...snapshot.metrics },
  };
}

export function mapPollDocumentToSnapshot(doc: PollDocumentShape): PollSnapshot {
  return clonePollSnapshot(doc);
}

export function mapPollSnapshotToDocument(snapshot: PollSnapshot): PollDocumentShape {
  return clonePollSnapshot(snapshot);
}
