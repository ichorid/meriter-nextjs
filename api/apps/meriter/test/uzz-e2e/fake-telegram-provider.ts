import http from 'node:http';
import https from 'node:https';
import { UZZ_E2E_TLS_CERT, UZZ_E2E_TLS_KEY } from './tls-certs.ts';

export type FakeTelegramMessage = {
  method: string;
  chatId: string;
  text: string;
  receivedAt: string;
  params: Record<string, string>;
  messageId: number;
};

const messages: FakeTelegramMessage[] = [];
let failNext = false;
let sendDelayMs = 0;
let messageId = 1000;

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

function parseBotMethod(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const methodPart = parts.find((part, index) => index > 0 && !part.startsWith('bot')) ?? parts.at(-1) ?? '';
  return methodPart.split('?')[0] ?? '';
}

async function collectParams(
  req: http.IncomingMessage,
  url: URL,
): Promise<Record<string, string>> {
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  if (req.method === 'POST') {
    const raw = await readBody(req);
    if (!raw) return params;
    const contentType = String(req.headers['content-type'] ?? '');
    if (contentType.includes('application/json')) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        params[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    } else {
      new URLSearchParams(raw).forEach((value, key) => {
        params[key] = value;
      });
    }
  }
  return params;
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://fake-telegram.local');
  const method = req.method ?? 'GET';

  if (method === 'GET' && url.pathname === '/__test__/messages') {
    json(res, 200, { messages });
    return;
  }
  if (method === 'POST' && url.pathname === '/__test__/reset') {
    messages.length = 0;
    failNext = false;
    sendDelayMs = 0;
    json(res, 200, { ok: true });
    return;
  }
  if (method === 'POST' && url.pathname === '/__test__/fail-next') {
    failNext = true;
    json(res, 200, { ok: true });
    return;
  }
  if (method === 'POST' && url.pathname === '/__test__/delay') {
    const raw = await readBody(req);
    const parsed = raw ? (JSON.parse(raw) as { ms?: number }) : {};
    sendDelayMs = Math.max(0, Number(parsed.ms ?? 0));
    json(res, 200, { ok: true, delayMs: sendDelayMs });
    return;
  }

  const botMethod = parseBotMethod(url.pathname);
  if (!botMethod) {
    json(res, 404, { ok: false, error_code: 404, description: 'Not Found' });
    return;
  }
  if (failNext) {
    failNext = false;
    json(res, 502, { ok: false, error_code: 502, description: 'injected-failure' });
    return;
  }

  const params = await collectParams(req, url);
  if (botMethod === 'getMe') {
    json(res, 200, { ok: true, result: { id: 1, is_bot: true, username: 'uzz_e2e_bot' } });
    return;
  }
  if (sendDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, sendDelayMs));
  }

  messageId += 1;
  const stored: FakeTelegramMessage = {
    method: botMethod,
    chatId: params.chat_id ?? '',
    text: params.text ?? '',
    receivedAt: new Date().toISOString(),
    params,
    messageId,
  };
  messages.push(stored);
  json(res, 200, {
    ok: true,
    result: {
      message_id: messageId,
      text: stored.text,
      chat: { id: stored.chatId },
    },
  });
}

export function startFakeTelegramProvider(options?: {
  providerPort?: number;
  controlPort?: number;
}): { provider: https.Server; control: http.Server } {
  const providerPort = options?.providerPort ?? Number(process.env.PROVIDER_PORT ?? 443);
  const controlPort = options?.controlPort ?? Number(process.env.CONTROL_PORT ?? 9091);
  const onRequest = (req: http.IncomingMessage, res: http.ServerResponse) => {
    void handle(req, res).catch(() => json(res, 500, { ok: false, description: 'handler-failed' }));
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

function telegramControlUrl(): string {
  return process.env.UZZ_E2E_TELEGRAM_CONTROL_URL ?? 'http://127.0.0.1:19091';
}

export async function readTelegramMessages(
  controlBaseUrl = telegramControlUrl(),
): Promise<FakeTelegramMessage[]> {
  const response = await fetch(`${controlBaseUrl.replace(/\/$/, '')}/__test__/messages`);
  if (!response.ok) {
    throw new Error(`fake-telegram control failed: ${response.status}`);
  }
  const payload = (await response.json()) as { messages: FakeTelegramMessage[] };
  return payload.messages;
}

export async function resetFakeTelegram(
  controlBaseUrl = telegramControlUrl(),
): Promise<void> {
  const response = await fetch(`${controlBaseUrl.replace(/\/$/, '')}/__test__/reset`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`fake-telegram reset failed: ${response.status}`);
  }
}

export async function delayTelegramSend(
  ms: number,
  controlBaseUrl = telegramControlUrl(),
): Promise<void> {
  const response = await fetch(`${controlBaseUrl.replace(/\/$/, '')}/__test__/delay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ms }),
  });
  if (!response.ok) {
    throw new Error(`fake-telegram delay failed: ${response.status}`);
  }
}

const invokedDirectly = (process.argv[1] ?? '').includes('fake-telegram-provider');
if (invokedDirectly) {
  startFakeTelegramProvider();
}
