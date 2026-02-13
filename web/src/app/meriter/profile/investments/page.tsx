import { Metadata } from 'next';
import ProfileInvestmentsPage from './Client';

export const metadata: Metadata = {
  title: 'My Investments',
};

export default function Page() {
  return <ProfileInvestmentsPage />;
}
