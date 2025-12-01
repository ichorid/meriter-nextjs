import { defineConfig } from 'orval';

// Support both URL and file input
// Set OPENAPI_FILE environment variable to use a static file instead of URL
const inputSource = process.env.OPENAPI_FILE 
  ? { path: process.env.OPENAPI_FILE }
  : { target: process.env.OPENAPI_URL || 'http://localhost:8002/api-json' };

export default defineConfig({
  api: {
    input: inputSource,
    output: {
      target: './src/lib/api/generated',
      client: 'react-query',
      mode: 'tags-split',
      override: {
        mutator: {
          path: './src/lib/api/wrappers/mutator.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'page',
          options: {
            staleTime: 30000,
          },
        },
      },
    },
  },
});

// Note: After Orval generation, run `pnpm generate:hooks` to generate
// high-level hooks with business logic (query keys, cache invalidation, etc.)
// See: scripts/generate-hooks.ts and src/lib/api/hook-configs/

