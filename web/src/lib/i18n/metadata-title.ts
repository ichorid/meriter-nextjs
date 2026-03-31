import { cookies } from 'next/headers';
import type { Locale } from '@/i18n/request';
import en from '../../../messages/en.json';
import ru from '../../../messages/ru.json';

type MessagesRoot = typeof en;

function localeFromCookie(): Locale {
    const v = cookies().get('NEXT_LOCALE')?.value;
    return v === 'ru' ? 'ru' : 'en';
}

function getNestedString(messages: MessagesRoot, dotPath: string): string | undefined {
    const parts = dotPath.split('.');
    let cur: unknown = messages;
    for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur) {
            cur = (cur as Record<string, unknown>)[p];
        } else {
            return undefined;
        }
    }
    return typeof cur === 'string' ? cur : undefined;
}

/**
 * Server-only metadata title using the same message bundles as the client.
 * Respects `NEXT_LOCALE` cookie when set; otherwise defaults to English.
 */
export function metadataTitle(dotPath: string): { title: string } {
    const locale = localeFromCookie();
    const messages = (locale === 'ru' ? ru : en) as MessagesRoot;
    const title = getNestedString(messages, dotPath) ?? dotPath;
    return { title };
}
