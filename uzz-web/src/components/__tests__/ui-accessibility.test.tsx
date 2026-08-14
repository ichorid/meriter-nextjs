import { readFileSync } from 'node:fs';
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
});
