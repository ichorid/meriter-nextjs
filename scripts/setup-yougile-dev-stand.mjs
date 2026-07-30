#!/usr/bin/env node
/**
 * Bootstrap local YouGile integration test stand:
 * - platform wipe -> dmitrsosnin@gmail.com superadmin
 * - YouGile Pilot community + demo members (email-mapped for assignee tests)
 * - optional seedDemoWorld for richer feed data
 *
 * Requires: API on :8002 with FAKE_DATA_MODE + TEST_AUTH_MODE, Mongo rs0.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const { parse, stringify } = require(
  join(dirname(fileURLToPath(import.meta.url)), '../api/node_modules/superjson/dist/index.js'),
);

const API = process.env.MERITER_API_URL ?? 'http://localhost:8002';
const WIPE_PASSWORD = '1243';
const SUPERADMIN_EMAIL = 'dmitrsosnin@gmail.com';

const YOUGILE_COMMUNITY = {
  name: 'YouGile Pilot',
  description:
    'Тестовое сообщество для интеграции YouGile: автопосты при переносе задачи в колонку «Готово».',
  typeTag: 'team',
  futureVisionText:
    'Команда видит выполненные задачи YouGile как посты в Meriter и получает заслуги за вклад.',
};

const DEMO_MEMBERS = [
  {
    email: 'vldslvaia0@gmail.com',
    displayName: 'Владислав (YouGile demo)',
  },
  {
    email: 'rarusland@gmail.com',
    displayName: 'Руслан (YouGile demo)',
  },
];

function parseCookies(setCookieHeaders) {
  const jar = {};
  for (const header of setCookieHeaders) {
    const part = header.split(';')[0];
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    jar[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return jar;
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function waitForApi(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${API}/api/v1/config`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`API not reachable at ${API}`);
}

async function authFakeSuperadmin() {
  const res = await fetch(`${API}/api/v1/auth/fake/superadmin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) {
    throw new Error(`fake/superadmin failed: ${res.status} ${await res.text()}`);
  }
  const cookies = parseCookies(res.headers.getSetCookie?.() ?? []);
  return cookies;
}

async function authMockEmail(email, cookies = {}) {
  const res = await fetch(`${API}/api/v1/auth/mock/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(cookies),
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error(`mock/email failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const merged = { ...cookies, ...parseCookies(res.headers.getSetCookie?.() ?? []) };
  return { cookies: merged, data };
}

async function trpcMutation(path, input, cookies) {
  const res = await fetch(`${API}/trpc/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(cookies),
    },
    body: stringify(input),
  });
  const body = await res.json();
  if (!res.ok || body.error || body.result?.error) {
    throw new Error(
      `tRPC ${path} failed: ${JSON.stringify(body.error ?? body.result?.error ?? body)}`,
    );
  }
  const raw = body.result?.data;
  if (raw && typeof raw === 'object' && 'json' in raw) {
    return parse(JSON.stringify(raw));
  }
  return raw;
}

async function trpcQuery(path, input, cookies) {
  const qs = input ? `?input=${encodeURIComponent(stringify(input))}` : '';
  const res = await fetch(`${API}/trpc/${path}${qs}`, {
    headers: { Cookie: cookieHeader(cookies) },
  });
  const body = await res.json();
  if (!res.ok || body.error || body.result?.error) {
    throw new Error(
      `tRPC ${path} failed: ${JSON.stringify(body.error ?? body.result?.error ?? body)}`,
    );
  }
  const raw = body.result?.data;
  if (raw && typeof raw === 'object' && 'json' in raw) {
    return parse(JSON.stringify(raw));
  }
  return raw;
}

async function main() {
  console.log(`Waiting for API at ${API}...`);
  await waitForApi();

  console.log('1/5 Fake superadmin -> platform wipe...');
  let cookies = await authFakeSuperadmin();
  await trpcMutation(
    'platformDev.wipeUserContent',
    { wipePassword: WIPE_PASSWORD },
    cookies,
  );

  console.log('2/5 Login as dmitrsosnin@gmail.com (bootstrap superadmin)...');
  ({ cookies } = await authMockEmail(SUPERADMIN_EMAIL, {}));

  const me = await trpcQuery('users.getMe', undefined, cookies);
  if (me.globalRole !== 'superadmin') {
    throw new Error(`Expected superadmin, got ${me.globalRole ?? 'none'}`);
  }
  console.log(`   User: ${me.displayName} (${me.id})`);

  console.log('3/5 Create YouGile Pilot community...');
  let community = await trpcMutation('communities.create', YOUGILE_COMMUNITY, cookies);

  console.log('4/5 Seed demo members (email-mapped for YouGile assignees)...');
  for (const member of DEMO_MEMBERS) {
    await authMockEmail(member.email, {});
    console.log(`   + ${member.email}`);
  }

  console.log('5/5 Optional demo world seed (publications, wallets)...');
  try {
    const seedResult = await trpcMutation(
      'platformDev.seedDemoWorld',
      { force: true },
      cookies,
    );
    console.log(`   seedDemoWorld: ${JSON.stringify(seedResult?.summary ?? seedResult)}`);
  } catch (err) {
    console.warn(`   seedDemoWorld skipped: ${err.message}`);
  }

  // Re-fetch community list entry
  community = await trpcQuery('communities.getById', { id: community.id }, cookies);

  const settingsUrl = `http://localhost:8001/meriter/communities/${community.id}/settings`;
  const yougileTabUrl = `${settingsUrl}?tab=yougile`;

  console.log('\n=== YouGile dev stand ready ===\n');
  console.log(`Superadmin: ${SUPERADMIN_EMAIL}`);
  console.log(`Community:  ${community.name} (${community.id})`);
  console.log(`Settings:   ${settingsUrl}`);
  console.log(`YouGile:    ${yougileTabUrl}`);
  console.log('\nLogin in browser:');
  console.log('  1. Open http://localhost:8001/meriter/login');
  console.log(`  2. Email login -> ${SUPERADMIN_EMAIL} (TEST_AUTH_MODE mock)`);
  console.log('  3. Open YouGile tab in community settings');
  console.log('\nWebhook: set api/.env DOMAIN to your cloudflared host and restart API.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
