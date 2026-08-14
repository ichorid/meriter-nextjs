import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readUzzRuntimeConfig } from '@/config/runtime-config';
import { RuntimeConfigProvider, useRuntimeConfig } from '@/config/runtime-config-context';

describe('readUzzRuntimeConfig', () => {
  it('reads deploy values at request time', () => {
    expect(readUzzRuntimeConfig({
      API_URL: 'https://api.example.test',
      UZZ_WEB_BASE_URL: 'https://uzz.example.test',
      DEFAULT_TELEGRAM_COMMUNITY_ID: 'a1000001-0000-4000-8000-000000000001',
    })).toEqual({
      apiBaseUrl: 'https://api.example.test',
      appBaseUrl: 'https://uzz.example.test',
      defaultCommunityId: 'a1000001-0000-4000-8000-000000000001',
    });
  });

  it('rejects a production placeholder', () => {
    expect(() => readUzzRuntimeConfig({
      NODE_ENV: 'production',
      DEFAULT_TELEGRAM_COMMUNITY_ID: 'REPLACE_WITH_PROD_PILOT_COMMUNITY_ID',
    })).toThrow('DEFAULT_TELEGRAM_COMMUNITY_ID');
  });

  it('resolves two different runtime community IDs from the same reader', () => {
    const first = readUzzRuntimeConfig({
      DEFAULT_TELEGRAM_COMMUNITY_ID: 'a1000001-0000-4000-8000-000000000001',
    });
    const second = readUzzRuntimeConfig({
      DEFAULT_TELEGRAM_COMMUNITY_ID: 'b2000002-0000-4000-8000-000000000002',
    });
    expect(first.defaultCommunityId).toBe('a1000001-0000-4000-8000-000000000001');
    expect(second.defaultCommunityId).toBe('b2000002-0000-4000-8000-000000000002');
  });
});

describe('RuntimeConfigProvider', () => {
  it('exposes server-passed deploy values to client hooks', () => {
    function Probe() {
      const config = useRuntimeConfig();
      return <span>{config.defaultCommunityId}</span>;
    }

    render(
      <RuntimeConfigProvider
        value={readUzzRuntimeConfig({
          API_URL: 'https://api.example.test',
          UZZ_WEB_BASE_URL: 'https://uzz.example.test',
          DEFAULT_TELEGRAM_COMMUNITY_ID: 'a1000001-0000-4000-8000-000000000001',
        })}
      >
        <Probe />
      </RuntimeConfigProvider>,
    );

    expect(screen.getByText('a1000001-0000-4000-8000-000000000001')).toBeInTheDocument();
  });
});
