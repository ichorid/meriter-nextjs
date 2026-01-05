import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/test-utils';
import { FavoriteStar } from '@/components/atoms/FavoriteStar/FavoriteStar';
import type { FavoriteTargetType } from '@/hooks/api/useFavorites';

const mockUseIsFavorite = jest.fn();
const mockAddMutateAsync = jest.fn<Promise<{ success: boolean }>, [{ targetType: FavoriteTargetType; targetId: string }]>();
const mockRemoveMutateAsync = jest.fn<Promise<{ success: boolean }>, [{ targetType: FavoriteTargetType; targetId: string }]>();

jest.mock('@/hooks/api/useFavorites', () => ({
  useIsFavorite: (...args: unknown[]) => mockUseIsFavorite(...args),
  useAddFavorite: () => ({ mutateAsync: mockAddMutateAsync, isPending: false }),
  useRemoveFavorite: () => ({ mutateAsync: mockRemoveMutateAsync, isPending: false }),
}));

describe('FavoriteStar', () => {
  beforeEach(() => {
    mockUseIsFavorite.mockReset();
    mockAddMutateAsync.mockReset();
    mockRemoveMutateAsync.mockReset();
    mockAddMutateAsync.mockResolvedValue({ success: true });
    mockRemoveMutateAsync.mockResolvedValue({ success: true });
  });

  it('calls addFavorite when currently not favorited', async () => {
    mockUseIsFavorite.mockReturnValue({ data: { isFavorite: false } });

    renderWithProviders(
      <FavoriteStar targetType="publication" targetId="p1" />,
      { authContextValue: { isAuthenticated: true } },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Favorite' }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith({ targetType: 'publication', targetId: 'p1' });
    expect(mockRemoveMutateAsync).not.toHaveBeenCalled();
  });

  it('calls removeFavorite when currently favorited', async () => {
    mockUseIsFavorite.mockReturnValue({ data: { isFavorite: true } });

    renderWithProviders(
      <FavoriteStar targetType="publication" targetId="p1" />,
      { authContextValue: { isAuthenticated: true } },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Unfavorite' }));

    expect(mockRemoveMutateAsync).toHaveBeenCalledWith({ targetType: 'publication', targetId: 'p1' });
    expect(mockAddMutateAsync).not.toHaveBeenCalled();
  });
});


