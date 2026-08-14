import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { UzzAppRouter } from '../../../../api/apps/meriter/src/trpc/uzz-app.types';
import { config } from '@/config';

export const MERITER_PRODUCT_HEADER = 'x-meriter-product';

export const trpc = createTRPCReact<UzzAppRouter>();

export function getTrpcClient(apiBaseUrl: string) {
  const apiUrl = apiBaseUrl.trim();
  const trpcUrl = apiUrl
    ? `${apiUrl}${config.product.trpcPath}`
    : config.product.trpcPath;

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: trpcUrl,
        transformer: superjson,
        headers() {
          return { [MERITER_PRODUCT_HEADER]: config.product.header };
        },
        fetch(url, init) {
          return fetch(url, { ...init, credentials: 'include' });
        },
      }),
    ],
  });
}
