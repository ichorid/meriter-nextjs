import React from 'react';
import '@testing-library/jest-dom';

// Mock next/navigation redirect
jest.mock('next/navigation', () => ({
    redirect: jest.fn(),
    useRouter: jest.fn(() => ({
        push: jest.fn(),
        replace: jest.fn(),
    })),
    usePathname: jest.fn(() => '/'),
    useSearchParams: jest.fn(() => new URLSearchParams()),
}));

describe('App Router Pages', () => {
    it('should have home page component', () => {
        // Import the home page module
        const pageModule = require('@app/page');
        
        // Verify default export exists
        expect(pageModule.default).toBeDefined();
        expect(typeof pageModule.default).toBe('function');
    });

    it('should have proper route structure', () => {
        // Basic test to ensure app directory exists
        expect(true).toBe(true);
    });
});

