import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

const CANVAS = '#0f172a';
const SURFACE = '#1e293b';
const ACCENT = '#a855f7';
const TEXT = '#f1f5f9';
const MUTED = '#94a3b8';

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function labels(locale: string, isProject: boolean) {
  if (locale === 'ru') {
    return {
      badge: isProject ? 'Приглашение в проект' : 'Приглашение в сообщество',
      platform: 'Meriter — платформа, где мы вместе строим будущее',
    };
  }
  return {
    badge: isProject ? 'Project invitation' : 'Community invitation',
    platform: 'Meriter — a platform where we build the future together',
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const name = truncate(searchParams.get('name') ?? 'Meriter', 72);
  const locale = searchParams.get('locale') === 'en' ? 'en' : 'ru';
  const isProject = searchParams.get('project') === '1';
  const avatar = searchParams.get('avatar')?.trim() || null;
  const copy = labels(locale, isProject);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px',
          background: `linear-gradient(145deg, ${CANVAS} 0%, #020617 55%, ${CANVAS} 100%)`,
          color: TEXT,
          fontFamily: 'Manrope, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '28px',
            padding: '48px 56px',
            borderRadius: '24px',
            background: SURFACE,
            border: '1px solid #334155',
            boxShadow: '0 24px 80px rgba(2, 6, 23, 0.55)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {avatar ? (
              <img
                src={avatar}
                alt=""
                width={88}
                height={88}
                style={{
                  borderRadius: '20px',
                  objectFit: 'cover',
                  border: '2px solid #334155',
                }}
              />
            ) : (
              <div
                style={{
                  width: '88px',
                  height: '88px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${ACCENT} 0%, #9333ea 100%)`,
                  color: '#ffffff',
                  fontSize: '36px',
                  fontWeight: 800,
                }}
              >
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: ACCENT,
                  letterSpacing: '-0.02em',
                }}
              >
                {copy.badge}
              </div>
              <div style={{ fontSize: '52px', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em' }}>
                {name}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '28px', lineHeight: 1.45, color: MUTED }}>{copy.platform}</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
