import { NextResponse } from 'next/server';

/**
 * API route that provides runtime configuration values
 * Used to access server-side environment variables from client components
 */
export async function GET() {
  const botUsername = process.env.BOT_USERNAME;

  // Fail fast - no fallbacks
  if (!botUsername || botUsername.trim() === '') {
    const error = 'BOT_USERNAME environment variable is not set or is empty';
    console.error(`❌ ${error}`);
    
    // In production, this will cause health checks to fail
    return NextResponse.json(
      { error },
      { status: 500 }
    );
  }

  return NextResponse.json({ botUsername });
}

