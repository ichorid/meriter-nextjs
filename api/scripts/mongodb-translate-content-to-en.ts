#!/usr/bin/env ts-node
/**
 * TZ-2: Translate Russian (Cyrillic) user-facing content in MongoDB to English.
 *
 * - Idempotent: skips strings without Cyrillic.
 * - User names: transliteration (cyrillic-to-translit-js); long text: Google Translate (google-translate-api-x).
 * - Slugs: unchanged unless slug contains Cyrillic; then ASCII kebab-case from translated name, unique in categories.
 * - platform_settings.decree809Tags: preserved verbatim (code list).
 * - HTML (about_articles.content): text nodes only.
 *
 * Usage:
 *   pnpm exec ts-node scripts/mongodb-translate-content-to-en.ts [--dry-run] [--inventory-only]
 *
 * Environment:
 *   MONGO_URL or MONGODB_URI (default: mongodb://localhost:27017/meriter)
 */

import { MongoClient, type Db, type Document } from 'mongodb';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { translate } from 'google-translate-api-x';
import { parse, type HTMLElement, type TextNode } from 'node-html-parser';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cyrillicToTranslitFactory = require('cyrillic-to-translit-js') as () => {
  transform: (input: string, spaceReplacement?: string) => string;
};

dotenv.config({ path: join(__dirname, '../.env') });
dotenv.config({ path: join(__dirname, '../.env.local') });
dotenv.config({ path: join(__dirname, '../../.env') });
dotenv.config({ path: join(__dirname, '../../.env.local') });

const MONGO_URL =
  process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/meriter';

const CYR = /[А-Яа-яЁё]/;
const OBJECT_ID_HEX = /^[a-f0-9]{24}$/i;

function hasCyrillic(s: string): boolean {
  return CYR.test(s);
}

function isLikelyObjectId(s: string): boolean {
  return OBJECT_ID_HEX.test(s);
}

const translit = cyrillicToTranslitFactory();

function transliteratePersonField(s: string, mode: 'display' | 'username'): string {
  if (!hasCyrillic(s)) return s;
  const sep = mode === 'username' ? '_' : ' ';
  let out = translit.transform(s, sep);
  if (mode === 'username') {
    out = out
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    if (!out) out = 'user';
    return out.slice(0, 48);
  }
  return out.trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function translateRuToEnPlain(text: string, dryRun: boolean): Promise<string> {
  if (!hasCyrillic(text)) return text;
  /** dryRun only skips DB writes elsewhere; translation still runs so previews are accurate. */
  void dryRun;
  const maxLen = 4500;
  const parts: string[] = [];
  for (let i = 0; i < text.length; ) {
    let end = Math.min(i + maxLen, text.length);
    if (end < text.length) {
      const nl = text.lastIndexOf('\n', end);
      if (nl > i + 80) end = nl + 1;
    }
    const chunk = text.slice(i, end);
    i = end;
    if (!hasCyrillic(chunk)) {
      parts.push(chunk);
      continue;
    }
    let lastErr: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await sleep(120 + attempt * 200);
        const res = await translate(chunk, { from: 'ru', to: 'en' });
        parts.push(res.text);
        lastErr = undefined;
        break;
      } catch (e) {
        lastErr = e;
        await sleep(1000 * (attempt + 1));
      }
    }
    if (lastErr) throw lastErr;
  }
  return parts.join('');
}

async function translateHtmlContent(html: string, dryRun: boolean): Promise<string> {
  if (!hasCyrillic(html)) return html;
  void dryRun;
  const root = parse(html) as HTMLElement;
  const textNodes: TextNode[] = [];
  const walk = (node: HTMLElement) => {
    for (const c of node.childNodes) {
      if (c.nodeType === 3) textNodes.push(c as TextNode);
      else if (c.nodeType === 1) walk(c as HTMLElement);
    }
  };
  walk(root);
  for (const tn of textNodes) {
    const raw = tn.rawText;
    if (hasCyrillic(raw)) {
      tn.rawText = await translateRuToEnPlain(raw, dryRun);
    }
  }
  return root.toString();
}

function slugifyAscii(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96) || 'item';
}

async function ensureUniqueCategorySlug(
  db: Db,
  base: string,
  excludeId: string | undefined,
  dryRun: boolean,
): Promise<string> {
  let slug = slugifyAscii(base);
  if (dryRun) return slug;
  let n = 0;
  for (;;) {
    const q: Document = { slug };
    if (excludeId) q.id = { $ne: excludeId };
    const exists = await db.collection('categories').findOne(q);
    if (!exists) return slug;
    n += 1;
    slug = `${slugifyAscii(base)}-${n}`;
    if (n > 500) throw new Error('Could not allocate unique category slug');
  }
}

type Stats = { collection: string; scanned: number; updated: number; skipped: number };

function logStats(s: Stats) {
  console.log(
    `[${s.collection}] scanned=${s.scanned} updated=${s.updated} skipped(no-op)=${s.skipped}`,
  );
}

async function translateDeep(
  value: unknown,
  dryRun: boolean,
  opts: { preserveStrings?: Set<string> } = {},
): Promise<unknown> {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (opts.preserveStrings?.has(value)) return value;
    if (!hasCyrillic(value)) return value;
    if (isLikelyObjectId(value)) return value;
    return translateRuToEnPlain(value, dryRun);
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const v of value) {
      out.push(await translateDeep(v, dryRun, opts));
    }
    return out;
  }
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (
        (k.endsWith('Id') || k === 'id' || k.endsWith('ID')) &&
        typeof v === 'string' &&
        isLikelyObjectId(v)
      ) {
        out[k] = v;
        continue;
      }
      out[k] = await translateDeep(v, dryRun, opts);
    }
    return out;
  }
  return value;
}

async function run(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const inventoryOnly = process.argv.includes('--inventory-only');

  const client = new MongoClient(MONGO_URL);
  try {
    await client.connect();
  } catch (e) {
    console.error('Failed to connect to MongoDB. Set MONGO_URL or MONGODB_URI to a valid connection string.');
    console.error(e);
    process.exit(1);
  }

  console.log(`Connected. dryRun=${dryRun} inventoryOnly=${inventoryOnly}`);

  const db = client.db();

  const ps = await db.collection('platform_settings').findOne({ id: 'platform' });
  const decree809Tags = new Set<string>(Array.isArray(ps?.decree809Tags) ? ps.decree809Tags : []);

  /** Strings in platform_settings that are decree codes — do not translate */
  const preservePlatformStrings = new Set<string>([...decree809Tags]);

  async function invSample(collName: string, fields: string[]) {
    const total = await db.collection(collName).estimatedDocumentCount();
    const or = fields.map((f) => ({ [f]: { $regex: CYR } }));
    const withCyr =
      or.length === 0 ? 0 : await db.collection(collName).countDocuments({ $or: or });
    console.log(`[inventory] ${collName}: docs≈${total} withCyrillic≈${withCyr} (${fields.join(',')})`);
  }

  if (inventoryOnly) {
    await invSample('users', ['displayName']);
    await invSample('communities', ['name']);
    await invSample('publications', ['content', 'title']);
    await invSample('comments', ['content']);
    await invSample('votes', ['comment']);
    await invSample('polls', ['question']);
    await invSample('notifications', ['message', 'title']);
    await invSample('categories', ['name']);
    await invSample('about_articles', ['content', 'title']);
    await client.close();
    return;
  }

  // --- users
  {
    const coll = 'users';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    const cur = db.collection(coll).find({});
    for await (const doc of cur) {
      st.scanned += 1;
      const id = doc.id as string;
      const $set: Document = {};

      if (typeof doc.displayName === 'string' && hasCyrillic(doc.displayName)) {
        $set.displayName = transliteratePersonField(doc.displayName, 'display');
      }
      if (typeof doc.firstName === 'string' && hasCyrillic(doc.firstName)) {
        $set.firstName = transliteratePersonField(doc.firstName, 'display');
      }
      if (typeof doc.lastName === 'string' && hasCyrillic(doc.lastName)) {
        $set.lastName = transliteratePersonField(doc.lastName, 'display');
      }
      if (typeof doc.username === 'string' && hasCyrillic(doc.username)) {
        $set.username = transliteratePersonField(doc.username, 'username');
      }
      const profile = doc.profile as Record<string, unknown> | undefined;
      if (profile && typeof profile === 'object') {
        const p = { ...profile };
        if (typeof p.bio === 'string' && hasCyrillic(p.bio)) {
          p.bio = await translateRuToEnPlain(p.bio, dryRun);
        }
        if (typeof p.about === 'string' && hasCyrillic(p.about)) {
          p.about = await translateRuToEnPlain(p.about, dryRun);
        }
        const loc = p.location as Record<string, unknown> | undefined;
        if (loc && typeof loc === 'object') {
          if (typeof loc.region === 'string' && hasCyrillic(loc.region)) {
            loc.region = await translateRuToEnPlain(loc.region, dryRun);
          }
          if (typeof loc.city === 'string' && hasCyrillic(loc.city)) {
            loc.city = await translateRuToEnPlain(loc.city, dryRun);
          }
          p.location = loc;
        }
        const contacts = p.contacts as Record<string, unknown> | undefined;
        if (contacts && typeof contacts === 'object') {
          for (const key of Object.keys(contacts)) {
            const v = contacts[key];
            if (typeof v === 'string' && hasCyrillic(v)) {
              contacts[key] = await translateRuToEnPlain(v, dryRun);
            }
          }
          p.contacts = contacts;
        }
        if (typeof p.educationalInstitution === 'string' && hasCyrillic(p.educationalInstitution)) {
          p.educationalInstitution = await translateRuToEnPlain(p.educationalInstitution, dryRun);
        }
        if (JSON.stringify(p) !== JSON.stringify(profile)) {
          $set.profile = p;
        }
      }
      const auth = doc.authenticators as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(auth)) {
        let changed = false;
        const next = await Promise.all(
          auth.map(async (a) => {
            const d = typeof a.deviceName === 'string' && hasCyrillic(a.deviceName);
            if (!d) return a;
            changed = true;
            return {
              ...a,
              deviceName: transliteratePersonField(a.deviceName as string, 'display'),
            };
          }),
        );
        if (changed) $set.authenticators = next;
      }

      if (Object.keys($set).length === 0) {
        st.skipped += 1;
        continue;
      }
      if (typeof $set.username === 'string' && !dryRun) {
        const clash = await db.collection(coll).findOne({
          username: $set.username,
          id: { $ne: id },
        });
        if (clash) {
          $set.username = `${$set.username}_${id.slice(0, 8)}`;
        }
      }
      if (!dryRun) {
        await db.collection(coll).updateOne({ _id: doc._id }, { $set, $currentDate: { updatedAt: true } });
      }
      st.updated += 1;
      console.log(`[${coll}] ${id} fields=${Object.keys($set).join(',')}`);
    }
    logStats(st);
  }

  // --- communities
  {
    const coll = 'communities';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    for await (const doc of db.collection(coll).find({})) {
      st.scanned += 1;
      const id = doc.id as string;
      const $set: Document = {};
      if (typeof doc.name === 'string' && hasCyrillic(doc.name)) {
        $set.name = await translateRuToEnPlain(doc.name, dryRun);
      }
      if (typeof doc.description === 'string' && hasCyrillic(doc.description)) {
        $set.description = await translateRuToEnPlain(doc.description, dryRun);
      }
      if (Array.isArray(doc.hashtags)) {
        const nh = await Promise.all(
          (doc.hashtags as string[]).map(async (h) => {
            if (!hasCyrillic(h)) return h;
            return translateRuToEnPlain(h, dryRun);
          }),
        );
        if (JSON.stringify(nh) !== JSON.stringify(doc.hashtags)) $set.hashtags = nh;
      }
      const hd = doc.hashtagDescriptions as Record<string, string> | undefined;
      if (hd && typeof hd === 'object') {
        const o: Record<string, string> = { ...hd };
        let ch = false;
        for (const k of Object.keys(o)) {
          if (hasCyrillic(o[k])) {
            o[k] = await translateRuToEnPlain(o[k], dryRun);
            ch = true;
          }
        }
        if (ch) $set.hashtagDescriptions = o;
      }
      if (typeof doc.futureVisionText === 'string' && hasCyrillic(doc.futureVisionText)) {
        $set.futureVisionText = await translateRuToEnPlain(doc.futureVisionText, dryRun);
      }
      if (typeof doc.rejectionMessage === 'string' && hasCyrillic(doc.rejectionMessage)) {
        $set.rejectionMessage = await translateRuToEnPlain(doc.rejectionMessage, dryRun);
      }
      if (Array.isArray(doc.futureVisionTags)) {
        const tags = await Promise.all(
          (doc.futureVisionTags as string[]).map(async (t) => {
            if (decree809Tags.has(t)) return t;
            if (!hasCyrillic(t)) return t;
            return translateRuToEnPlain(t, dryRun);
          }),
        );
        if (JSON.stringify(tags) !== JSON.stringify(doc.futureVisionTags)) $set.futureVisionTags = tags;
      }
      const settings = doc.settings as Record<string, unknown> | undefined;
      if (settings && typeof settings === 'object') {
        const merged = (await translateDeep(settings, dryRun)) as Record<string, unknown>;
        if (JSON.stringify(merged) !== JSON.stringify(settings)) {
          $set.settings = merged;
        }
      }

      if (Object.keys($set).length === 0) {
        st.skipped += 1;
        continue;
      }
      if (!dryRun) {
        await db.collection(coll).updateOne({ _id: doc._id }, { $set, $currentDate: { updatedAt: true } });
      }
      st.updated += 1;
      console.log(`[${coll}] ${id}`);
    }
    logStats(st);
  }

  // --- publications
  {
    const coll = 'publications';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    for await (const doc of db.collection(coll).find({})) {
      st.scanned += 1;
      const $set: Document = {};
      const strFields = [
        'title',
        'description',
        'content',
        'authorDisplay',
        'impactArea',
        'stage',
      ] as const;
      for (const f of strFields) {
        const v = doc[f];
        if (typeof v === 'string' && hasCyrillic(v)) {
          $set[f] = await translateRuToEnPlain(v, dryRun);
        }
      }
      for (const arr of ['hashtags', 'valueTags', 'beneficiaries', 'methods', 'helpNeeded'] as const) {
        const a = doc[arr];
        if (Array.isArray(a)) {
          const n = await Promise.all(
            (a as string[]).map(async (x) =>
              typeof x === 'string' && hasCyrillic(x) ? translateRuToEnPlain(x, dryRun) : x,
            ),
          );
          if (JSON.stringify(n) !== JSON.stringify(a)) $set[arr] = n;
        }
      }
      const log = doc.ticketActivityLog as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(log)) {
        const nl = await Promise.all(
          log.map(async (entry) => {
            const d = entry.detail;
            if (d && typeof d === 'object') {
              const nd = await translateDeep(d, dryRun);
              if (JSON.stringify(nd) !== JSON.stringify(d)) return { ...entry, detail: nd };
            }
            if (typeof entry.action === 'string' && hasCyrillic(entry.action)) {
              return { ...entry, action: await translateRuToEnPlain(entry.action, dryRun) };
            }
            return entry;
          }),
        );
        if (JSON.stringify(nl) !== JSON.stringify(log)) $set.ticketActivityLog = nl;
      }

      if (Object.keys($set).length === 0) {
        st.skipped += 1;
        continue;
      }
      if (!dryRun) {
        await db.collection(coll).updateOne({ _id: doc._id }, { $set, $currentDate: { updatedAt: true } });
      }
      st.updated += 1;
      console.log(`[${coll}] ${doc.id}`);
    }
    logStats(st);
  }

  // --- comments
  {
    const coll = 'comments';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    for await (const doc of db.collection(coll).find({})) {
      st.scanned += 1;
      if (typeof doc.content !== 'string' || !hasCyrillic(doc.content)) {
        st.skipped += 1;
        continue;
      }
      const content = await translateRuToEnPlain(doc.content, dryRun);
      if (!dryRun) {
        await db.collection(coll).updateOne(
          { _id: doc._id },
          { $set: { content }, $currentDate: { updatedAt: true } },
        );
      }
      st.updated += 1;
      console.log(`[${coll}] ${doc.id}`);
    }
    logStats(st);
  }

  // --- votes
  {
    const coll = 'votes';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    for await (const doc of db.collection(coll).find({})) {
      st.scanned += 1;
      if (typeof doc.comment !== 'string' || !hasCyrillic(doc.comment)) {
        st.skipped += 1;
        continue;
      }
      const comment = await translateRuToEnPlain(doc.comment, dryRun);
      if (!dryRun) {
        await db.collection(coll).updateOne(
          { _id: doc._id },
          { $set: { comment }, $currentDate: { updatedAt: true } },
        );
      }
      st.updated += 1;
    }
    logStats(st);
  }

  // --- polls
  {
    const coll = 'polls';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    for await (const doc of db.collection(coll).find({})) {
      st.scanned += 1;
      const $set: Document = {};
      if (typeof doc.question === 'string' && hasCyrillic(doc.question)) {
        $set.question = await translateRuToEnPlain(doc.question, dryRun);
      }
      if (typeof doc.description === 'string' && hasCyrillic(doc.description)) {
        $set.description = await translateRuToEnPlain(doc.description, dryRun);
      }
      if (Array.isArray(doc.options)) {
        const opts = await Promise.all(
          (doc.options as Array<{ id: string; text: string }>).map(async (o) => ({
            ...o,
            text:
              typeof o.text === 'string' && hasCyrillic(o.text)
                ? await translateRuToEnPlain(o.text, dryRun)
                : o.text,
          })),
        );
        if (JSON.stringify(opts) !== JSON.stringify(doc.options)) $set.options = opts;
      }
      if (Object.keys($set).length === 0) {
        st.skipped += 1;
        continue;
      }
      if (!dryRun) {
        await db.collection(coll).updateOne({ _id: doc._id }, { $set, $currentDate: { updatedAt: true } });
      }
      st.updated += 1;
      console.log(`[${coll}] ${doc.id}`);
    }
    logStats(st);
  }

  // --- categories
  {
    const coll = 'categories';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    for await (const doc of db.collection(coll).find({})) {
      st.scanned += 1;
      const $set: Document = {};
      const id = doc.id as string;
      const name = doc.name as string;
      if (typeof name === 'string' && hasCyrillic(name)) {
        const newName = await translateRuToEnPlain(name, dryRun);
        $set.name = newName;
        const slug = doc.slug as string;
        if (typeof slug === 'string' && hasCyrillic(slug)) {
          $set.slug = await ensureUniqueCategorySlug(db, newName, id, dryRun);
        }
      }
      if (Object.keys($set).length === 0) {
        st.skipped += 1;
        continue;
      }
      if (!dryRun) {
        await db.collection(coll).updateOne({ _id: doc._id }, { $set, $currentDate: { updatedAt: true } });
      }
      st.updated += 1;
      console.log(`[${coll}] ${id}`);
    }
    logStats(st);
  }

  // --- about_categories
  {
    const coll = 'about_categories';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    for await (const doc of db.collection(coll).find({})) {
      st.scanned += 1;
      const $set: Document = {};
      if (typeof doc.title === 'string' && hasCyrillic(doc.title)) {
        $set.title = await translateRuToEnPlain(doc.title, dryRun);
      }
      if (typeof doc.description === 'string' && hasCyrillic(doc.description)) {
        $set.description = await translateRuToEnPlain(doc.description, dryRun);
      }
      if (Object.keys($set).length === 0) {
        st.skipped += 1;
        continue;
      }
      if (!dryRun) {
        await db.collection(coll).updateOne({ _id: doc._id }, { $set, $currentDate: { updatedAt: true } });
      }
      st.updated += 1;
      console.log(`[${coll}] ${doc.id}`);
    }
    logStats(st);
  }

  // --- about_articles
  {
    const coll = 'about_articles';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    for await (const doc of db.collection(coll).find({})) {
      st.scanned += 1;
      const $set: Document = {};
      if (typeof doc.title === 'string' && hasCyrillic(doc.title)) {
        $set.title = await translateRuToEnPlain(doc.title, dryRun);
      }
      if (typeof doc.content === 'string' && hasCyrillic(doc.content)) {
        $set.content = await translateHtmlContent(doc.content, dryRun);
      }
      if (Object.keys($set).length === 0) {
        st.skipped += 1;
        continue;
      }
      if (!dryRun) {
        await db.collection(coll).updateOne({ _id: doc._id }, { $set, $currentDate: { updatedAt: true } });
      }
      st.updated += 1;
      console.log(`[${coll}] ${doc.id}`);
    }
    logStats(st);
  }

  // --- platform_settings
  {
    const coll = 'platform_settings';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    const doc = await db.collection(coll).findOne({ id: 'platform' });
    if (doc) {
      st.scanned = 1;
      const $set: Document = {};
      if (Array.isArray(doc.availableFutureVisionTags)) {
        const arr = await Promise.all(
          (doc.availableFutureVisionTags as string[]).map(async (t) => {
            if (decree809Tags.has(t)) return t;
            if (!hasCyrillic(t)) return t;
            return translateRuToEnPlain(t, dryRun);
          }),
        );
        if (JSON.stringify(arr) !== JSON.stringify(doc.availableFutureVisionTags)) {
          $set.availableFutureVisionTags = arr;
        }
      }
      if (Object.keys($set).length > 0) {
        if (!dryRun) {
          await db.collection(coll).updateOne({ _id: doc._id }, { $set, $currentDate: { updatedAt: true } });
        }
        st.updated = 1;
        console.log(`[${coll}] platform`);
      } else st.skipped = 1;
    }
    logStats(st);
  }

  // --- transactions
  {
    const coll = 'transactions';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    for await (const doc of db.collection(coll).find({})) {
      st.scanned += 1;
      if (typeof doc.description !== 'string' || !hasCyrillic(doc.description)) {
        st.skipped += 1;
        continue;
      }
      const description = await translateRuToEnPlain(doc.description, dryRun);
      if (!dryRun) {
        await db.collection(coll).updateOne(
          { _id: doc._id },
          { $set: { description }, $currentDate: { updatedAt: true } },
        );
      }
      st.updated += 1;
    }
    logStats(st);
  }

  // --- team_join_requests
  {
    const coll = 'team_join_requests';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    for await (const doc of db.collection(coll).find({})) {
      st.scanned += 1;
      if (typeof doc.applicantMessage !== 'string' || !hasCyrillic(doc.applicantMessage)) {
        st.skipped += 1;
        continue;
      }
      const applicantMessage = await translateRuToEnPlain(doc.applicantMessage, dryRun);
      if (!dryRun) {
        await db.collection(coll).updateOne(
          { _id: doc._id },
          { $set: { applicantMessage }, $currentDate: { updatedAt: true } },
        );
      }
      st.updated += 1;
    }
    logStats(st);
  }

  // --- team_invitations
  {
    const coll = 'team_invitations';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    for await (const doc of db.collection(coll).find({})) {
      st.scanned += 1;
      if (typeof doc.inviterMessage !== 'string' || !hasCyrillic(doc.inviterMessage)) {
        st.skipped += 1;
        continue;
      }
      const inviterMessage = await translateRuToEnPlain(doc.inviterMessage, dryRun);
      if (!dryRun) {
        await db.collection(coll).updateOne(
          { _id: doc._id },
          { $set: { inviterMessage }, $currentDate: { updatedAt: true } },
        );
      }
      st.updated += 1;
    }
    logStats(st);
  }

  // --- project_parent_link_requests
  {
    const coll = 'project_parent_link_requests';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    for await (const doc of db.collection(coll).find({})) {
      st.scanned += 1;
      if (typeof doc.rejectionReason !== 'string' || !hasCyrillic(doc.rejectionReason)) {
        st.skipped += 1;
        continue;
      }
      const rejectionReason = await translateRuToEnPlain(doc.rejectionReason, dryRun);
      if (!dryRun) {
        await db.collection(coll).updateOne(
          { _id: doc._id },
          { $set: { rejectionReason }, $currentDate: { updatedAt: true } },
        );
      }
      st.updated += 1;
    }
    logStats(st);
  }

  // --- notifications (last)
  {
    const coll = 'notifications';
    const st: Stats = { collection: coll, scanned: 0, updated: 0, skipped: 0 };
    for await (const doc of db.collection(coll).find({})) {
      st.scanned += 1;
      const $set: Document = {};
      if (typeof doc.title === 'string' && hasCyrillic(doc.title)) {
        $set.title = await translateRuToEnPlain(doc.title, dryRun);
      }
      if (typeof doc.message === 'string' && hasCyrillic(doc.message)) {
        $set.message = await translateRuToEnPlain(doc.message, dryRun);
      }
      const meta = doc.metadata;
      if (meta && typeof meta === 'object') {
        const next = await translateDeep(meta, dryRun, { preserveStrings: preservePlatformStrings });
        if (JSON.stringify(next) !== JSON.stringify(meta)) {
          $set.metadata = next;
        }
      }
      if (Object.keys($set).length === 0) {
        st.skipped += 1;
        continue;
      }
      if (!dryRun) {
        await db.collection(coll).updateOne({ _id: doc._id }, { $set, $currentDate: { updatedAt: true } });
      }
      st.updated += 1;
    }
    logStats(st);
  }

  // --- verification sample
  console.log('\n--- Verification (Cyrillic count in key string fields) ---');
  const checks: Array<{ name: string; coll: string; field: string }> = [
    { name: 'users.displayName', coll: 'users', field: 'displayName' },
    { name: 'publications.content', coll: 'publications', field: 'content' },
    { name: 'notifications.message', coll: 'notifications', field: 'message' },
  ];
  for (const { name, coll, field } of checks) {
    const n = await db.collection(coll).countDocuments({
      [field]: { $regex: CYR },
    });
    console.log(`${name}: ${n}`);
  }

  await client.close();
  console.log('\nDone.', dryRun ? '(dry-run: no writes)' : '');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
