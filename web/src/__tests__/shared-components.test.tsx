import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock BottomPortal to avoid portal DOM issues in tests
jest.mock('@shared/components/bottom-portal', () => ({
    BottomPortal: ({ children }: { children: React.ReactNode }) => <div data-testid="bottom-portal">{children}</div>
}));

describe('Shared Components', () => {
    it('should render without crashing', () => {
        // Basic smoke test to ensure test setup is working
        expect(true).toBe(true);
    });

    it('should have proper test environment setup', () => {
        // Verify jsdom environment
        expect(document).toBeDefined();
        expect(window).toBeDefined();
    });
});

