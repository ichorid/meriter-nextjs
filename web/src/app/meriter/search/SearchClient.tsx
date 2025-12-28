import { Metadata } from 'next';
import SearchResultsPage from './SearchClient';

export const metadata: Metadata = {
  title: 'Search',
};

export default function Page() {
  return <SearchResultsPage />;
}
