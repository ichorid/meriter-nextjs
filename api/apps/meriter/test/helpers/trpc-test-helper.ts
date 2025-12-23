/**
 * Helper utilities for testing tRPC endpoints via HTTP
 * Provides a convenient way to call tRPC procedures in e2e tests
 * 
 * tRPC HTTP format:
 * - Queries: GET /trpc/{procedurePath}?input={json}
 * - Mutations: POST /trpc/{procedurePath} with { json: input } in body
 */

import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

/**
 * Call a tRPC query procedure via HTTP
 * Format: GET /trpc/{procedurePath}?input={json}
 */
export async function trpcQuery(
  app: INestApplication,
  path: string,
  input?: any,
  cookies: Record<string, string> = {}
) {
  const queryString = input ? `?input=${encodeURIComponent(JSON.stringify(input))}` : '';
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  
  const response = await request(app.getHttpServer())
    .get(`/trpc/${path}${queryString}`)
    .set('Cookie', cookieHeader)
    .expect(200);
  
  // tRPC returns { result: { data: ... } } or { result: { error: ... } }
  if (response.body.result?.error) {
    throw new Error(`tRPC error: ${JSON.stringify(response.body.result.error)}`);
  }
  
  return response.body.result?.data;
}

/**
 * Call a tRPC mutation procedure via HTTP
 * Format: POST /trpc/{procedurePath} with { json: input } in body
 */
export async function trpcMutation(
  app: INestApplication,
  path: string,
  input?: any,
  cookies: Record<string, string> = {}
) {
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  
  const response = await request(app.getHttpServer())
    .post(`/trpc/${path}`)
    .send(input ? { json: input } : {})
    .set('Content-Type', 'application/json')
    .set('Cookie', cookieHeader)
    .expect(200);
  
  // tRPC returns { result: { data: ... } } or { result: { error: ... } }
  if (response.body.result?.error) {
    throw new Error(`tRPC error: ${JSON.stringify(response.body.result.error)}`);
  }
  
  return response.body.result?.data;
}

