import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/lib/i18n-server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { locale } = body;
        
        // Validate locale
        if (!locale || !['en', 'ru', 'auto'].includes(locale)) {
            return NextResponse.json(
                { error: 'Invalid locale. Must be en, ru, or auto' },
                { status: 400 }
            );
        }
        
        // Create response
        const response = NextResponse.json({ success: true, locale });
        
        // Set cookie
        response.cookies.set('NEXT_LOCALE', locale, {
            maxAge: 365 * 24 * 60 * 60, // 1 year
            path: '/',
            sameSite: 'lax',
            httpOnly: false, // Allow client-side access
        });
        
        return response;
    } catch (error) {
        console.error('Error setting locale:', error);
        return NextResponse.json(
            { error: 'Failed to set locale' },
            { status: 500 }
        );
    }
}
