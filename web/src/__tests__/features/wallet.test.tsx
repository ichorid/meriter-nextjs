import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WidgetAvatarBalance } from '@features/wallet/components/widget-avatar-balance';

describe('Wallet Feature', () => {
    const mockBalance = {
        icon: '/test-icon.png',
        amount: 100
    };

    it('should render WidgetAvatarBalance component', () => {
        const { container } = render(
            <WidgetAvatarBalance
                balance1={mockBalance}
                balance2={null}
                avatarUrl="/test-avatar.png"
                onAvatarUrlNotFound={jest.fn()}
                onClick={jest.fn()}
            />
        );
        expect(container.querySelector('.widget-avatar-balance')).toBeInTheDocument();
    });

    it('should display balance amount', () => {
        render(
            <WidgetAvatarBalance
                balance1={mockBalance}
                balance2={null}
                avatarUrl="/test-avatar.png"
                onAvatarUrlNotFound={jest.fn()}
                onClick={jest.fn()}
            />
        );
        expect(screen.getByText(/100/)).toBeInTheDocument();
    });

    it('should render without balance2 when not provided', () => {
        const { container } = render(
            <WidgetAvatarBalance
                balance1={mockBalance}
                balance2={null}
                avatarUrl="/test-avatar.png"
                onAvatarUrlNotFound={jest.fn()}
                onClick={jest.fn()}
            />
        );
        const balances = container.querySelectorAll('.balance');
        expect(balances.length).toBe(1);
    });
});

