import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DealCard, type DealView } from '@/components/deal-card';
import { ListingCard, type ListingView } from '@/components/listing-card';
import { Badge, userContentClass } from '@/components/ui';

const globalsCss = readFileSync(path.resolve(__dirname, '../../app/globals.css'), 'utf8');
const UNBROKEN = 'W'.repeat(300);

function linearize(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(foreground: [number, number, number], background: [number, number, number]): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function themeRgb(name: string): [number, number, number] {
  const block = globalsCss.match(/\[data-theme='dark'\]\s*\{([\s\S]*?)\}/);
  expect(block, 'dark theme block').toBeTruthy();
  const match = block![1].match(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*([0-9]+)\\s+([0-9]+)\\s+([0-9]+)`));
  expect(match, `token ${name}`).toBeTruthy();
  return [Number(match![1]), Number(match![2]), Number(match![3])];
}

function listing(overrides: Partial<ListingView> = {}): ListingView {
  return {
    id: 'listing-1',
    authorId: 'seller-1',
    ownerName: 'Анна',
    title: 'Консультация',
    description: 'Помогу разобраться',
    priceRub: 500,
    deliveryMode: 'online',
    locationText: 'Москва',
    durationText: '1 час',
    availabilityText: 'вечером',
    active: true,
    ...overrides,
  };
}

function deal(overrides: Partial<DealView> = {}): DealView {
  return {
    id: 'deal-1',
    status: 'requested',
    myRole: 'buyer',
    listingSnapshot: { title: 'Консультация', priceRub: 500, deliveryMode: 'online', locationText: 'Telegram' },
    requestMessage: 'Нужна помощь',
    currentNominalRub: 600,
    ...overrides,
  };
}

describe('WCAG AA contrast matrix', () => {
  it('keeps primary foreground/background at or above 4.5 including hover, disabled and focus', () => {
    const white: [number, number, number] = [255, 255, 255];
    const solid = themeRgb('--stitch-accent-solid-rgb');
    const hover = themeRgb('--stitch-accent-solid-hover-rgb');
    const disabledFg = themeRgb('--stitch-accent-disabled-fg-rgb');
    const disabledBg = themeRgb('--stitch-accent-disabled-bg-rgb');
    const focusRing = themeRgb('--stitch-accent-rgb');
    const canvas = themeRgb('--stitch-canvas-rgb');
    const surface = themeRgb('--stitch-surface-rgb');
    const accentText = themeRgb('--stitch-accent-text-rgb');

    const matrix = {
      default: contrastRatio(white, solid),
      hover: contrastRatio(white, hover),
      disabled: contrastRatio(disabledFg, disabledBg),
      focusRing: contrastRatio(focusRing, canvas),
      accentTextOnSurface: contrastRatio(accentText, surface),
    };

    expect(matrix.default).toBeGreaterThanOrEqual(4.5);
    expect(matrix.hover).toBeGreaterThanOrEqual(4.5);
    expect(matrix.disabled).toBeGreaterThanOrEqual(4.5);
    expect(matrix.focusRing).toBeGreaterThanOrEqual(3);
    expect(matrix.accentTextOnSurface).toBeGreaterThanOrEqual(4.5);
  });
});

describe('user content overflow', () => {
  it('does not mask overflow on the document root', () => {
    const rootRule = globalsCss.match(/html,\s*body\s*\{([\s\S]*?)\}/);
    expect(rootRule, 'html, body rule').toBeTruthy();
    expect(rootRule![1]).not.toMatch(/max-width:\s*100vw/);
    expect(rootRule![1]).not.toMatch(/overflow-x:\s*hidden/);
  });

  it('exposes a reusable userContentClass that wraps unbroken strings', () => {
    expect(userContentClass).toMatch(/min-w-0/);
    expect(userContentClass).toMatch(/max-w-full/);
    expect(userContentClass).toMatch(/break-words|overflow-wrap:anywhere|user-content/);
  });

  function expectUserContent(node: HTMLElement) {
    expect(node.className).toMatch(/min-w-0/);
    expect(node.className).toMatch(/max-w-full/);
    expect(node.className).toMatch(/break-words|overflow-wrap|user-content/);
  }

  it('keeps a 300-character unbroken listing title, description, location and badge visible', () => {
    render(
      <div style={{ width: 320 }}>
        <ListingCard
          listing={listing({
            title: UNBROKEN,
            description: UNBROKEN,
            locationText: UNBROKEN,
            durationText: UNBROKEN,
          })}
        />
      </div>,
    );

    const title = screen.getByRole('heading', { name: UNBROKEN });
    const description = screen.getByText((_, node) => node?.tagName === 'P' && node.textContent === UNBROKEN);
    const badges = screen.getAllByText(UNBROKEN).filter((node) => node.tagName === 'SPAN');

    expect(title).toBeVisible();
    expect(description).toBeVisible();
    expect(badges).toHaveLength(2);
    for (const node of [title, description, ...badges]) {
      expectUserContent(node);
    }
  });

  it('wraps deal title, request message and status badge as user content', () => {
    render(
      <div style={{ width: 320 }}>
        <DealCard
          deal={deal({
            listingSnapshot: { title: UNBROKEN, priceRub: 500, deliveryMode: 'online', locationText: UNBROKEN },
            requestMessage: UNBROKEN,
          })}
        />
      </div>,
    );

    const title = screen.getByRole('heading', { name: UNBROKEN });
    const message = screen.getByText((_, node) => node?.tagName === 'DD' && node.textContent === UNBROKEN);
    expect(title).toBeVisible();
    expect(message).toBeVisible();
    expectUserContent(title);
    expectUserContent(message);
  });

  it('lets Badge wrap unbroken user-generated labels', () => {
    render(<Badge tone="accent">{UNBROKEN}</Badge>);
    const badge = screen.getByText(UNBROKEN);
    expect(badge).toBeVisible();
    expectUserContent(badge);
  });

  it('wraps listing owner name and availability as user content', () => {
    render(<ListingCard listing={listing({ ownerName: UNBROKEN, availabilityText: UNBROKEN })} />);
    const owner = screen.getByText(UNBROKEN);
    const availability = screen.getByText(`Когда: ${UNBROKEN}`);
    expect(owner).toBeVisible();
    expect(availability).toBeVisible();
    expectUserContent(owner);
    expectUserContent(availability);
  });

  it('wraps deal counterparty name as user content', () => {
    render(<DealCard deal={deal({ counterpartyName: UNBROKEN })} />);
    const counterparty = screen.getByText((_, node) => node?.tagName === 'P' && (node.textContent ?? '').includes(UNBROKEN));
    expect(counterparty).toBeVisible();
    expectUserContent(counterparty);
  });
});

describe('small accent text on surface', () => {
  const srcRoot = path.resolve(__dirname, '../..');
  const LARGE_TEXT = /\btext-(?:base|lg|xl|2xl|3xl|4xl|5xl|6xl)\b/;
  const ACCENT_TEXT = /(?<![a-z-])text-stitch-accent(?![a-z-])/;
  const ACCENT_FILL = /(?<![a-z-])bg-stitch-accent(?![a-z-/])/;

  function walkSource(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walkSource(full);
      return entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') ? [full] : [];
    });
  }

  function classValues(source: string): string[] {
    const attrs = [...source.matchAll(/className="([^"]+)"/g), ...source.matchAll(/className='([^']+)'/g)].map((match) => match[1]);
    const cnArgs = [...source.matchAll(/className=\{cn\(([\s\S]*?)\)\}/g)].flatMap((block) =>
      [/'([^']+)'/g, /"([^"]+)"/g].flatMap((re) => [...block[1].matchAll(re)].map((match) => match[1])),
    );
    return [...attrs, ...cnArgs];
  }

  it('does not pair bg-stitch-accent with text-white', () => {
    const hits: string[] = [];
    for (const file of walkSource(srcRoot)) {
      for (const value of classValues(readFileSync(file, 'utf8'))) {
        if (ACCENT_FILL.test(value) && /\btext-white\b/.test(value)) {
          hits.push(`${path.relative(srcRoot, file)}: ${value}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('does not use sm/xs text-stitch-accent on surface copy', () => {
    const hits: string[] = [];
    for (const file of walkSource(srcRoot)) {
      for (const value of classValues(readFileSync(file, 'utf8'))) {
        if (ACCENT_TEXT.test(value) && !LARGE_TEXT.test(value)) {
          hits.push(`${path.relative(srcRoot, file)}: ${value}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
