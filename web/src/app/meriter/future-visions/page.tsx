import { Metadata } from 'next';
import FutureVisionsPageClient from './FutureVisionsPageClient';

export const metadata: Metadata = {
  title: 'Future Visions',
};

export default function FutureVisionsPage() {
  return <FutureVisionsPageClient />;
}
