/**
 * Generates PWA / favicon PNGs from scripts/assets/eyecon.png on Obsidian canvas (#0f172a).
 * Run from repo root: pnpm --filter @meriter/web exec node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const pngPath = join(__dirname, 'assets', 'eyecon.png');

const CANVAS = '#0f172a';

async function iconWithBg(size, relPath, scale = 0.68) {
  if (!existsSync(pngPath)) {
    throw new Error(`Missing source PNG: ${pngPath}`);
  }
  const png = readFileSync(pngPath);
  const inner = Math.max(16, Math.round(size * scale));
  const innerBuf = await sharp(png)
    .resize({
      width: inner,
      height: inner,
      fit: 'inside',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const { width: w = inner, height: h = inner } = await sharp(innerBuf).metadata();
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
    .composite([{ input: innerBuf, left, top }])
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
