import { Metadata } from 'next';
import CreateProjectPage from './CreateProjectClient';

export const metadata: Metadata = {
  title: 'Create Project',
};

export default function Page() {
  return <CreateProjectPage />;
}
