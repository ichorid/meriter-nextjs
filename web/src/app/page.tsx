'use client';

/**
 * Root page component for static export
 * 
 * This component is rendered when Caddy serves index.html as fallback.
 * ClientRouter (in ClientRootLayout) handles all redirects, including root path redirects.
 * 
 * This component should not interfere with client-side routing.
 * When the actual URL is not '/', Next.js router will handle the route
 * and render the appropriate page component via client-side routing.
 * 
 * We return null to avoid rendering anything that might interfere with routing.
 * Returning null is safe here because Next.js router will render the correct
 * page component based on the URL, even when index.html is served as fallback.
 */
export default function Home() {
    // Don't render anything - let Next.js router and ClientRouter handle routing
    // ClientRouter (in ClientRootLayout) handles root path redirects
    // Next.js router handles all other routes via client-side routing
    return null;
}

