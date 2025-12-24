import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Poll } from '@features/polls/components/poll';

// Mock the simple elements
jest.mock('@shared/components/simple/simple-elements', () => ({
    A: ({ children, onClick }: unknown) => <a onClick={onClick}>{children}</a>
}));

describe('Polls Feature', () => {
    const mockOptions = [
        {
            tagName: 'option1',
            h: 'Test Option 1',
            d: 'Description 1'
        },
        {
            tagName: 'option2',
            h: 'Test Option 2',
            d: 'Description 2'
        }
    ];

    it('should render Poll component without crashing', () => {
        const { container } = render(
            <Poll
                options={mockOptions}
                onSubmit={jest.fn()}
            />
        );
        expect(container.querySelector('.poll')).toBeInTheDocument();
    });

    it('should render all poll options', () => {
        render(
            <Poll
                options={mockOptions}
                onSubmit={jest.fn()}
            />
        );
        expect(screen.getByText('Test Option 1')).toBeInTheDocument();
        expect(screen.getByText('Test Option 2')).toBeInTheDocument();
    });

    it('should handle empty options array', () => {
        const { container } = render(
            <Poll
                options={[]}
                onSubmit={jest.fn()}
            />
        );
        expect(container.querySelector('.poll')).toBeInTheDocument();
    });
});

