'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

/**
 * Catch-all redirect from /mt/* to /meriter/* for backward compatibility
 */
export default function MtRedirect() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        // Replace /mt with /meriter in the pathname
        const newPath = pathname.replace('/mt', '/meriter');
        
        // Preserve query parameters
        const queryString = searchParams.toString();
        const fullPath = queryString ? `${newPath}?${queryString}` : newPath;
        
        console.log('🔄 Redirecting from', pathname, 'to', fullPath);
        router.replace(fullPath);
    }, [pathname, searchParams, router]);

    return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>Перенаправление...</p>
        </div>
    );
}

