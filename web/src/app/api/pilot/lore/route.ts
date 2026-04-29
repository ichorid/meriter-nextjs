import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function GET() {
  try {
    const p = path.join(process.cwd(), 'src', 'features', 'multi-obraz-pilot', 'meriterra-lore.md');
    const content = await fs.readFile(p, 'utf8');
    return new NextResponse(content, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  } catch {
    return new NextResponse('Не удалось загрузить текст.', { status: 500 });
  }
}

