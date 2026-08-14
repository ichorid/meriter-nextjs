import http from 'node:http';
import https from 'node:https';
import { UZZ_E2E_TLS_CERT, UZZ_E2E_TLS_KEY } from './tls-certs.ts';

export type FakeEmailMessage = {
  to: string;
  subject: string;
  html: string;
  plaintext: string;
  receivedAt: string;
  body: unknown;
  providerRequestId: string;
};

const messages: FakeEmailMessage[] = [];
let failNext = false;
let requestSeq = 0;

function json(res: http.ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function isSendPath(pathname: string): boolean {
  return pathname.endsWith('/email/send.json') || pathname.endsWith('/email/send');
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://fake-email.local');
  const method = req.method ?? 'GET';

  if (method === 'GET' && url.pathname === '/__test__/messages') {
    json(res, 200, { messages });
    return;
  }
  if (method === 'POST' && url.pathname === '/__test__/reset') {
    messages.length = 0;
    failNext = false;
    json(res, 200, { ok: true });
    return;
  }
  if (method === 'POST' && url.pathname === '/__test__/fail-next') {
    failNext = true;
    json(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && isSendPath(url.pathname)) {
    const raw = await readBody(req);
    let body: unknown = raw;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      body = raw;
    }
    if (failNext) {
      failNext = false;
      json(res, 503, { error: 'injected-failure' });
      return;
    }
    const record = body as {
      message?: {
        recipients?: Array<{ email?: string }>;
        subject?: string;
        body?: { html?: string; plaintext?: string };
      };
    };
    requestSeq += 1;
    const providerRequestId = `email-job-${requestSeq}`;
    messages.push({
      to: record.message?.recipients?.[0]?.email ?? '',
      subject: record.message?.subject ?? '',
      html: record.message?.body?.html ?? '',
      plaintext: record.message?.body?.plaintext ?? '',
      receivedAt: new Date().toISOString(),
      body,
      providerRequestId,
    });
    json(res, 200, { status: 'success', job_id: providerRequestId });
    return;
  }

  json(res, 404, { error: 'not-found' });
}

export function startFakeEmailProvider(options?: {
  providerPort?: number;
  controlPort?: number;
}): { provider: https.Server; control: http.Server } {
  const providerPort = options?.providerPort ?? Number(process.env.PROVIDER_PORT ?? 8443);
  const controlPort = options?.controlPort ?? Number(process.env.CONTROL_PORT ?? 9090);
  const onRequest = (req: http.IncomingMessage, res: http.ServerResponse) => {
    void handle(req, res).catch(() => json(res, 500, { error: 'handler-failed' }));
  };
  const provider = https.createServer(
    { cert: UZZ_E2E_TLS_CERT, key: UZZ_E2E_TLS_KEY },
    onRequest,
  );
  const control = http.createServer(onRequest);
  provider.listen(providerPort, '0.0.0.0');
  control.listen(controlPort, '0.0.0.0');
  return { provider, control };
}

function emailControlUrl(
  controlBaseUrl = process.env.UZZ_E2E_EMAIL_CONTROL_URL ?? 'http://127.0.0.1:19090',
): string {
  return controlBaseUrl.replace(/\/$/, '');
}

export async function resetFakeEmail(
  controlBaseUrl?: string,
): Promise<void> {
  const response = await fetch(`${emailControlUrl(controlBaseUrl)}/__test__/reset`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`fake-email reset failed: ${response.status}`);
  }
}

export async function failNextEmailSend(
  controlBaseUrl?: string,
): Promise<void> {
  const response = await fetch(`${emailControlUrl(controlBaseUrl)}/__test__/fail-next`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`fake-email fail-next failed: ${response.status}`);
  }
}

export async function readEmailMessages(
  controlBaseUrl?: string,
): Promise<FakeEmailMessage[]> {
  const response = await fetch(`${emailControlUrl(controlBaseUrl)}/__test__/messages`);
  if (!response.ok) {
    throw new Error(`fake-email control failed: ${response.status}`);
  }
  const payload = (await response.json()) as { messages: FakeEmailMessage[] };
  return payload.messages;
}

export async function readLastEmail(
  controlBaseUrl?: string,
): Promise<FakeEmailMessage | null> {
  const messages = await readEmailMessages(controlBaseUrl);
  return messages.at(-1) ?? null;
}

export async function waitForLastEmail(
  options?: { timeoutMs?: number; controlBaseUrl?: string; to?: string },
): Promise<FakeEmailMessage> {
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const started = Date.now();
  const expectedTo = options?.to?.toLowerCase();
  while (Date.now() - started < timeoutMs) {
    const messages = await readEmailMessages(options?.controlBaseUrl);
    const email = expectedTo
      ? [...messages].reverse().find((item) => item.to.toLowerCase() === expectedTo)
      : messages.at(-1);
    if (email) return email;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('fake-email did not receive a message');
}

const invokedDirectly = (process.argv[1] ?? '').includes('fake-email-provider');
if (invokedDirectly) {
  startFakeEmailProvider();
}
