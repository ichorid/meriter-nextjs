import { NextResponse } from 'next/server';

/**
 * API route that provides runtime configuration values
 * Used to access server-side environment variables from client components
 */
export async function GET() {
  // Debug: Log all environment variables that start with BOT
  console.log('🔍 BOT_USERNAME debug:', {
    BOT_USERNAME: process.env.BOT_USERNAME || '[NOT SET]',
    BOT_TOKEN: process.env.BOT_TOKEN ? '[SET]' : '[NOT SET]',
    NODE_ENV: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('BOT')).join(', '),
  });

  const botUsername = process.env.BOT_USERNAME;

  // Fail fast - no fallbacks
  if (!botUsername || botUsername.trim() === '') {
    const error = 'BOT_USERNAME environment variable is not set or is empty';
    console.error(`❌ ${error}`);
    console.error('Available env vars:', Object.keys(process.env).sort().join(', '));
    
    // In production, this will cause health checks to fail
    return NextResponse.json(
      { error },
      { status: 500 }
    );
  }

  return NextResponse.json({ botUsername });
}

