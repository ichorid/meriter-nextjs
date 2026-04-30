/**
 * Generates PWA / favicon PNGs from meriter/merit.svg on Obsidian canvas (#0f172a).
 * Run from repo root: pnpm --filter @meriter/web exec node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const svgPath = join(publicDir, 'meriter', 'merit.svg');

const CANVAS = '#0f172a';

async function iconWithBg(size, relPath, scale = 0.68) {
  const svg = readFileSync(svgPath);
  const inner = Math.max(16, Math.round(size * scale));
  const meritBuf = await sharp(svg)
    .resize({
      width: inner,
      height: inner,
      fit: 'inside',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const { width: w = inner, height: h = inner } = await sharp(meritBuf).metadata();
  const left = Math.max(0, Math.round((size - w) / 2));
  const top = Math.max(0, Math.round((size - h) / 2));

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: CANVAS,
    },
  })
    .composite([{ input: meritBuf, left, top }])
    .png()
    .toFile(join(publicDir, relPath));

  console.log('wrote', relPath);
}

async function main() {
  await iconWithBg(192, 'web-app-manifest-192x192.png');
  await iconWithBg(512, 'web-app-manifest-512x512.png');
  await iconWithBg(180, 'apple-touch-icon.png');
  await iconWithBg(32, 'favicon-32x32.png', 0.85);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
