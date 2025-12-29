import { Metadata } from 'next';
import ProfileFavoritesPage from './Client';

export const metadata: Metadata = {
  title: 'Favorites',
};

export default function Page() {
  return <ProfileFavoritesPage />;
}
