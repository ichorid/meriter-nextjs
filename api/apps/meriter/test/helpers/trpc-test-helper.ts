/**
 * Helper utilities for testing tRPC endpoints via HTTP
 * Provides a convenient way to call tRPC procedures in e2e tests
 * 
 * tRPC HTTP format:
 * - Queries: GET /trpc/{procedurePath}?input={json}
 * - Mutations: POST /trpc/{procedurePath} with { json: input } in body
 */

import * as request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import superjson from 'superjson';

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
  // For queries, tRPC v11 uses query parameters with superjson format
  // Use superjson.stringify to properly serialize the input
  const queryString = input ? `?input=${encodeURIComponent(superjson.stringify(input))}` : '';
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  
  const response = await request(app.getHttpServer())
    .get(`/trpc/${path}${queryString}`)
    .set('Cookie', cookieHeader)
    .expect(200);
  
  // tRPC returns { result: { data: ... } } or { result: { error: ... } }
  if (response.body.result?.error) {
    throw new Error(`tRPC error: ${JSON.stringify(response.body.result.error)}`);
  }
  
  // Parse response data with superjson (tRPC v11 uses superjson transformer)
  const rawData = response.body.result?.data;
  if (rawData && typeof rawData === 'object' && 'json' in rawData) {
    return superjson.parse(JSON.stringify(rawData));
  }
  return rawData;
}

/**
 * Call a tRPC mutation procedure via HTTP
 * Format: POST /trpc/{procedurePath}?input={json}
 * Note: tRPC v11 HTTP adapter uses query parameters for input in both GET and POST requests
 */
export async function trpcMutation(
  app: INestApplication,
  path: string,
  input?: any,
  cookies: Record<string, string> = {}
) {
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  
  // tRPC v11 with superjson transformer expects input in body as { json: input }
  // The superjson.stringify wraps input in { json: ... } format
  const body = input ? superjson.stringify(input) : '{}';
  
  const response = await request(app.getHttpServer())
    .post(`/trpc/${path}`)
    .send(body)
    .set('Content-Type', 'application/json')
    .set('Cookie', cookieHeader)
    .expect(200);
  
  // tRPC returns { result: { data: ... } } or { result: { error: ... } }
  if (response.body.result?.error) {
    throw new Error(`tRPC error: ${JSON.stringify(response.body.result.error)}`);
  }
  
  // Parse response data with superjson (tRPC v11 uses superjson transformer)
  const rawData = response.body.result?.data;
  if (rawData && typeof rawData === 'object' && 'json' in rawData) {
    return superjson.parse(JSON.stringify(rawData));
  }
  return rawData;
}

/**
 * Call a tRPC query procedure via HTTP, returning error instead of throwing
 * Returns { data?, error? } - test can check error.code
 * Format: GET /trpc/{procedurePath}?input={json}
 */
export async function trpcQueryWithError(
  app: INestApplication,
  path: string,
  input?: any,
  cookies: Record<string, string> = {}
): Promise<{ data?: any; error?: { code: string; message: string; httpStatus?: number } }> {
  // Use superjson.stringify for consistency
  const queryString = input ? `?input=${encodeURIComponent(superjson.stringify(input))}` : '';
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  
  const response = await request(app.getHttpServer())
    .get(`/trpc/${path}${queryString}`)
    .set('Cookie', cookieHeader)
    .expect(200);
  
  // tRPC returns { result: { data: ... } } or { result: { error: ... } }
  if (response.body.result?.error) {
    const error = response.body.result.error;
    return {
      error: {
        code: error.data?.code || error.code || 'UNKNOWN',
        message: error.message || 'Unknown error',
        httpStatus: mapTrpcErrorCodeToHttpStatus(error.data?.code || error.code),
      },
    };
  }
  
  // Parse response data with superjson
  const rawData = response.body.result?.data;
  let parsedData = rawData;
  if (rawData && typeof rawData === 'object' && 'json' in rawData) {
    parsedData = superjson.parse(JSON.stringify(rawData));
  }
  
  return { data: parsedData };
}

/**
 * Call a tRPC mutation procedure via HTTP, returning error instead of throwing
 * Returns { data?, error? } - test can check error.code
 * Format: POST /trpc/{procedurePath}?input={json}
 */
export async function trpcMutationWithError(
  app: INestApplication,
  path: string,
  input?: any,
  cookies: Record<string, string> = {}
): Promise<{ data?: any; error?: { code: string; message: string; httpStatus?: number } }> {
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  
  // tRPC v11 with superjson transformer expects input in body as superjson format
  const body = input ? superjson.stringify(input) : '{}';
  
  const response = await request(app.getHttpServer())
    .post(`/trpc/${path}`)
    .send(body)
    .set('Content-Type', 'application/json')
    .set('Cookie', cookieHeader)
    .expect(200);
  
  // tRPC returns { result: { data: ... } } or { result: { error: ... } }
  if (response.body.result?.error) {
    const error = response.body.result.error;
    return {
      error: {
        code: error.data?.code || error.code || 'UNKNOWN',
        message: error.message || 'Unknown error',
        httpStatus: mapTrpcErrorCodeToHttpStatus(error.data?.code || error.code),
      },
    };
  }
  
  // Parse response data with superjson
  const rawData = response.body.result?.data;
  let parsedData = rawData;
  if (rawData && typeof rawData === 'object' && 'json' in rawData) {
    parsedData = superjson.parse(JSON.stringify(rawData));
  }
  
  return { data: parsedData };
}

/**
 * Map tRPC error codes to HTTP status codes
 */
function mapTrpcErrorCodeToHttpStatus(code?: string): number {
  const codeMap: Record<string, number> = {
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    INTERNAL_SERVER_ERROR: 500,
    TIMEOUT: 408,
    CONFLICT: 409,
    PRECONDITION_FAILED: 412,
    PAYLOAD_TOO_LARGE: 413,
    UNPROCESSABLE_CONTENT: 422,
    TOO_MANY_REQUESTS: 429,
    CLIENT_CLOSED_REQUEST: 499,
  };
  
  return codeMap[code || ''] || 500;
}

