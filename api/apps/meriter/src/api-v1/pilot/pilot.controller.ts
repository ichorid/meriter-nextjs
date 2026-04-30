import { Controller, Get } from '@nestjs/common';
import { ApiResponseHelper } from '../common/helpers/api-response.helper';
import { readFile } from 'node:fs/promises';
import { join, resolve as resolvePath } from 'node:path';

async function readFirstExisting(paths: string[]): Promise<string> {
  for (const p of paths) {
    try {
      return await readFile(p, 'utf8');
    } catch {
      // try next
    }
  }
  return '';
}

@Controller('api/pilot')
export class PilotController {
  @Get('lore')
  async getMythText(): Promise<{ success: true; data: string }> {
    // NOTE: `/api/*` is routed to the backend in most environments (Caddy),
    // so we expose a backend endpoint for the pilot myth text.
    const cwd = process.cwd();
    const primary = '/app/public/meriterra-lore.md';
    const candidates = [
      primary,
      // packaged runtime (api Docker image copies this into /app/public)
      join(cwd, 'public', 'meriterra-lore.md'),
      // when cwd is inside dist/apps/meriter (common for Nest prod)
      join(cwd, '..', '..', '..', 'public', 'meriterra-lore.md'),
      // repo root (common in docker / production)
      join(cwd, 'web', 'src', 'features', 'multi-obraz-pilot', 'meriterra-lore.md'),
      // when running from api/ as cwd
      join(cwd, '..', 'web', 'src', 'features', 'multi-obraz-pilot', 'meriterra-lore.md'),
      // compiled dist (fallback)
      resolvePath(__dirname, '../../../../../../web/src/features/multi-obraz-pilot/meriterra-lore.md'),
    ];

    // Prefer the canonical Docker runtime path first.
    // (In practice we saw cases where cwd-based paths drift.)
    let text = '';
    try {
      text = await readFile(primary, 'utf8');
    } catch {
      text = await readFirstExisting(candidates);
    }
    // Avoid 500 in prod if the file wasn't bundled correctly.
    // UI can still show the title and a short message.
    const fallback =
      '## Миф и правила\n\nТекст временно недоступен. Попробуйте обновить страницу чуть позже.';
    return ApiResponseHelper.successResponse(text.trim().length > 0 ? text : fallback);
  }
}

