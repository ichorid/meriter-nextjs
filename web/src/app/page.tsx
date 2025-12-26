'use client';

/**
 * Root page component for static export
 * 
 * This component is rendered when Caddy serves index.html as fallback.
 * All redirect logic is handled by ClientRouter component.
 * 
 * This page should be completely passive - it returns an empty fragment
 * to allow Next.js router to handle routing via client-side navigation.
 */
export default function Home() {
    // Return empty fragment - Next.js router will handle rendering the correct page
    // ClientRouter (in ClientRootLayout) handles all redirects including root path
    return <></>;
}

