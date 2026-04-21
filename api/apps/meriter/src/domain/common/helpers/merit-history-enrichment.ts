/**
 * Batch enrichment for Merit History (global wallet transaction rows).
 * Maps referenceType + referenceId → publication / community / poll / counterparty metadata.
 * Bounded queries per page (no per-row N+1).
 */

import type { Connection } from 'mongoose';

/** Mongoose `connection.db` — avoids duplicate `mongodb` package `Db` types in webpack. */
export type MeritHistoryMongoDb = NonNullable<Connection['db']>;

export type MeritHistoryEnrichmentPayload = {
  publicationId?: string;
  publicationTitle?: string | null;
  communityId?: string | null;
  communityName?: string | null;
  pollId?: string;
  pollQuestion?: string | null;
  counterpartyUserId?: string;
  counterpartyDisplayName?: string | null;
  meritTransferId?: string;
  eventPublicationId?: string | null;
};

const PUBLICATION_REF_TYPES = new Set<string>([
  'publication_vote',
  'project_appreciation',
  'investment',
  'investment_distribution',
  'investment_pool_return',
  'tappalka_show_cost',
  'publication_creation',
  'publication_post_cost',
  'forward_proposal',
  'publication_withdrawal',
]);

const COMMUNITY_REF_TYPES = new Set<string>([
  'tappalka_reward',
  'community_starting_merits',
  'project_payout',
  'project_distribution',
]);

const POLL_REF_TYPES = new Set<string>(['poll_creation', 'poll_cast']);

function pickDisplayName(user: unknown, fallbackId: string): string {
  if (user && typeof user === 'object') {
    const u = user as { displayName?: string; username?: string };
    if (u.displayName?.trim()) return u.displayName.trim();
    if (u.username?.trim()) return u.username.trim();
  }
  return fallbackId;
}

type PublicationLean = { id: string; title?: string | null; communityId?: string | null };

async function loadPublicationsMap(db: MeritHistoryMongoDb, ids: Set<string>): Promise<Map<string, PublicationLean>> {
  const map = new Map<string, PublicationLean>();
  if (ids.size === 0) return map;
  const docs = await db
    .collection('publications')
    .find({ id: { $in: [...ids] } })
    .project({ id: 1, title: 1, communityId: 1 })
    .toArray();
  for (const d of docs) {
    if (d?.id) {
      map.set(String(d.id), {
        id: String(d.id),
        title: (d as { title?: string }).title ?? null,
        communityId: (d as { communityId?: string }).communityId ?? null,
      });
    }
  }
  return map;
}

async function loadPollsMap(
  db: MeritHistoryMongoDb,
  ids: string[],
): Promise<Map<string, { id: string; question?: string | null; communityId?: string | null }>> {
  const map = new Map<string, { id: string; question?: string | null; communityId?: string | null }>();
  if (ids.length === 0) return map;
  const docs = await db
    .collection('polls')
    .find({ id: { $in: [...new Set(ids)] } })
    .project({ id: 1, question: 1, communityId: 1 })
    .toArray();
  for (const d of docs) {
    if (d?.id) {
      map.set(String(d.id), {
        id: String(d.id),
        question: (d as { question?: string }).question ?? null,
        communityId: (d as { communityId?: string }).communityId ?? null,
      });
    }
  }
  return map;
}

function mergePayload(
  base: Map<string, MeritHistoryEnrichmentPayload | null>,
  txId: string,
  patch: MeritHistoryEnrichmentPayload,
): void {
  const prev = base.get(txId);
  const merged: MeritHistoryEnrichmentPayload = { ...(prev ?? {}), ...patch };
  base.set(txId, merged);
}

export async function enrichMeritHistoryTransactions(
  walletOwnerUserId: string,
  transactions: ReadonlyArray<{
    id: string;
    referenceType?: string | null;
    referenceId?: string | null;
  }>,
  deps: {
    db: MeritHistoryMongoDb | undefined;
    batchFetchUsers: (userIds: string[]) => Promise<Map<string, unknown>>;
  },
): Promise<Map<string, MeritHistoryEnrichmentPayload | null>> {
  const out = new Map<string, MeritHistoryEnrichmentPayload | null>();
  for (const tx of transactions) {
    out.set(tx.id, null);
  }

  const { db, batchFetchUsers } = deps;
  if (!db || transactions.length === 0) {
    return out;
  }

  const meritTransferIds: string[] = [];
  const publicationDirectByTx = new Map<string, string>();
  const voteLookupIds: string[] = [];
  const voteVoteByTx = new Map<string, string>();
  const withdrawalVoteByTx = new Map<string, string>();
  const communityDirectByTx = new Map<string, string>();
  const pollDirectByTx = new Map<string, string>();

  for (const tx of transactions) {
    const rt = tx.referenceType?.trim() || '';
    const rid = tx.referenceId?.trim() || '';
    if (!rid) continue;

    if (rt === 'merit_transfer') {
      meritTransferIds.push(rid);
      continue;
    }
    if (PUBLICATION_REF_TYPES.has(rt)) {
      publicationDirectByTx.set(tx.id, rid);
      continue;
    }
    if (rt === 'vote_vote') {
      voteVoteByTx.set(tx.id, rid);
      voteLookupIds.push(rid);
      continue;
    }
    if (rt === 'vote_withdrawal' || rt === 'comment_withdrawal') {
      withdrawalVoteByTx.set(tx.id, rid);
      voteLookupIds.push(rid);
      continue;
    }
    if (COMMUNITY_REF_TYPES.has(rt)) {
      communityDirectByTx.set(tx.id, rid);
      continue;
    }
    if (POLL_REF_TYPES.has(rt)) {
      pollDirectByTx.set(tx.id, rid);
      continue;
    }
    if (rt === 'vote' || rt === 'comment_vote') {
      voteVoteByTx.set(tx.id, rid);
      voteLookupIds.push(rid);
    }
  }

  const uniqueMtIds = [...new Set(meritTransferIds)];
  const meritDocs =
    uniqueMtIds.length > 0
      ? await db
          .collection('merit_transfers')
          .find({ id: { $in: uniqueMtIds } })
          .project({
            id: 1,
            senderId: 1,
            receiverId: 1,
            eventPostId: 1,
            communityContextId: 1,
          })
          .toArray()
      : [];

  const meritByTransferId = new Map<string, (typeof meritDocs)[0]>();
  for (const m of meritDocs) {
    if (m?.id) meritByTransferId.set(String(m.id), m);
  }

  const uniqueVoteIds = [...new Set(voteLookupIds)];
  let voteDocs =
    uniqueVoteIds.length > 0
      ? await db
          .collection('votes')
          .find({ id: { $in: uniqueVoteIds } })
          .project({ id: 1, targetType: 1, targetId: 1 })
          .toArray()
      : [];

  const nestedVoteIds = voteDocs
    .filter((v) => v?.targetType === 'vote' && v.targetId)
    .map((v) => String(v.targetId));

  if (nestedVoteIds.length > 0) {
    const nested = await db
      .collection('votes')
      .find({ id: { $in: [...new Set(nestedVoteIds)] } })
      .project({ id: 1, targetType: 1, targetId: 1 })
      .toArray();
    voteDocs = voteDocs.concat(nested);
  }

  const voteById = new Map<string, (typeof voteDocs)[0]>();
  for (const v of voteDocs) {
    if (v?.id) voteById.set(String(v.id), v);
  }

  const voteToPublicationId = new Map<string, string>();
  for (const v of voteDocs) {
    if (!v?.id || v.targetType !== 'publication' || !v.targetId) continue;
    voteToPublicationId.set(String(v.id), String(v.targetId));
  }
  for (const v of voteDocs) {
    if (!v?.id || v.targetType !== 'vote' || !v.targetId) continue;
    const inner = voteById.get(String(v.targetId));
    if (inner?.targetType === 'publication' && inner.targetId) {
      voteToPublicationId.set(String(v.id), String(inner.targetId));
    }
  }

  const publicationIds = new Set<string>();
  for (const pid of publicationDirectByTx.values()) {
    publicationIds.add(pid);
  }
  for (const m of meritDocs) {
    if (m.eventPostId) publicationIds.add(String(m.eventPostId));
  }
  for (const vid of voteVoteByTx.values()) {
    const p = voteToPublicationId.get(vid);
    if (p) publicationIds.add(p);
  }
  for (const vid of withdrawalVoteByTx.values()) {
    const p = voteToPublicationId.get(vid);
    if (p) publicationIds.add(p);
  }

  const publicationsMap = await loadPublicationsMap(db, publicationIds);

  const pollIds = [...new Set([...pollDirectByTx.values()])];
  const pollsMap = await loadPollsMap(db, pollIds);

  const communityIds = new Set<string>();
  for (const cid of communityDirectByTx.values()) {
    communityIds.add(cid);
  }
  for (const m of meritDocs) {
    if (m.communityContextId) communityIds.add(String(m.communityContextId));
  }
  for (const p of publicationsMap.values()) {
    if (p.communityId) communityIds.add(String(p.communityId));
  }
  for (const pl of pollsMap.values()) {
    if (pl.communityId) communityIds.add(String(pl.communityId));
  }

  const communityDocs =
    communityIds.size > 0
      ? await db
          .collection('communities')
          .find({ id: { $in: [...communityIds] } })
          .project({ id: 1, name: 1 })
          .toArray()
      : [];

  const communityNameById = new Map<string, string>();
  for (const c of communityDocs) {
    if (c?.id) communityNameById.set(String(c.id), String((c as { name?: string }).name ?? ''));
  }

  const counterpartyIds = new Set<string>();
  for (const m of meritDocs) {
    if (!m?.senderId || !m?.receiverId) continue;
    const cp = m.senderId === walletOwnerUserId ? m.receiverId : m.senderId;
    counterpartyIds.add(String(cp));
  }

  const usersMap =
    counterpartyIds.size > 0
      ? await batchFetchUsers([...counterpartyIds])
      : new Map<string, unknown>();

  function attachPublication(txId: string, publicationId: string): void {
    const pub = publicationsMap.get(publicationId);
    const cid = pub?.communityId ? String(pub.communityId) : null;
    mergePayload(out, txId, {
      publicationId,
      publicationTitle: pub?.title ?? null,
      communityId: cid,
      communityName: cid ? communityNameById.get(cid) ?? null : null,
    });
  }

  for (const [txId, pid] of publicationDirectByTx) {
    if (publicationsMap.has(pid)) attachPublication(txId, pid);
  }

  for (const [txId, vid] of voteVoteByTx) {
    const pid = voteToPublicationId.get(vid);
    if (pid && publicationsMap.has(pid)) attachPublication(txId, pid);
  }

  for (const [txId, vid] of withdrawalVoteByTx) {
    const pid = voteToPublicationId.get(vid);
    if (pid && publicationsMap.has(pid)) attachPublication(txId, pid);
  }

  for (const m of meritDocs) {
    if (!m?.id) continue;
    const cp = m.senderId === walletOwnerUserId ? m.receiverId : m.senderId;
    const cpName = pickDisplayName(usersMap.get(String(cp)), String(cp));
    const mid = String(m.id);
    const txs = transactions.filter(
      (t) =>
        t.referenceType === 'merit_transfer' &&
        t.referenceId != null &&
        String(t.referenceId) === mid,
    );
    const eventPid = m.eventPostId ? String(m.eventPostId) : null;
    const ctxCid = m.communityContextId ? String(m.communityContextId) : null;

    for (const tx of txs) {
      const payload: MeritHistoryEnrichmentPayload = {
        meritTransferId: String(m.id),
        counterpartyUserId: String(cp),
        counterpartyDisplayName: cpName,
        communityId: ctxCid,
        communityName: ctxCid ? communityNameById.get(ctxCid) ?? null : null,
        eventPublicationId: eventPid,
      };
      if (eventPid && publicationsMap.has(eventPid)) {
        const pub = publicationsMap.get(eventPid)!;
        payload.publicationId = eventPid;
        payload.publicationTitle = pub.title ?? null;
        const pcid = pub.communityId ? String(pub.communityId) : null;
        payload.communityId = pcid;
        payload.communityName = pcid ? communityNameById.get(pcid) ?? null : null;
      }
      mergePayload(out, tx.id, payload);
    }
  }

  for (const [txId, cid] of communityDirectByTx) {
    mergePayload(out, txId, {
      communityId: cid,
      communityName: communityNameById.get(cid) ?? null,
    });
  }

  for (const [txId, pollId] of pollDirectByTx) {
    const pl = pollsMap.get(pollId);
    const pcid = pl?.communityId ? String(pl.communityId) : null;
    mergePayload(out, txId, {
      pollId,
      pollQuestion: pl?.question ?? null,
      communityId: pcid,
      communityName: pcid ? communityNameById.get(pcid) ?? null : null,
    });
  }

  return out;
}
