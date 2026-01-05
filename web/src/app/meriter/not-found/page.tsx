'use client';

import React from 'react';
import Link from 'next/link';

/**
 * 404 Not Found page for meriter routes
 * This page is shown when a resource (community, user, post, etc.) doesn't exist
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-lg mb-8">Page not found</p>
      <Link href="/meriter/profile" className="text-blue-500 hover:underline">
        Go to profile page
      </Link>
    </div>
  );
}

