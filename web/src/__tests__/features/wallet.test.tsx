import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AvatarBalanceWidget } from '@/components/organisms/AvatarBalanceWidget/AvatarBalanceWidget';

describe('Wallet Feature', () => {
    const mockBalance = {
        icon: '/test-icon.png',
        amount: 100
    };

    it('should render AvatarBalanceWidget component', () => {
        const { container } = render(
            <AvatarBalanceWidget
                balance1={mockBalance}
                balance2={undefined}
                avatarUrl="/test-avatar.png"
                onAvatarUrlNotFound={jest.fn()}
                onClick={jest.fn()}
            />
        );
        // Check for the actual CSS classes used in the component
        expect(container.querySelector('.bg-base-100')).toBeInTheDocument();
        expect(container.querySelector('.shadow-md')).toBeInTheDocument();
    });

    it('should display balance amount', () => {
        render(
            <AvatarBalanceWidget
                balance1={mockBalance}
                balance2={undefined}
                avatarUrl="/test-avatar.png"
                onAvatarUrlNotFound={jest.fn()}
                onClick={jest.fn()}
            />
        );
        expect(screen.getByText(/100/)).toBeInTheDocument();
    });

    it('should render without balance2 when not provided', () => {
        const { container } = render(
            <AvatarBalanceWidget
                balance1={mockBalance}
                balance2={undefined}
                avatarUrl="/test-avatar.png"
                onAvatarUrlNotFound={jest.fn()}
                onClick={jest.fn()}
            />
        );
        // Check that balance1 amount is rendered (span with font-medium class)
        const balanceSpans = container.querySelectorAll('span.font-medium');
        expect(balanceSpans.length).toBe(1);
        expect(balanceSpans[0]).toHaveTextContent('100');
    });
});

