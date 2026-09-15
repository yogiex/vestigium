import type { Metadata } from 'next';

import { CustodyView } from '@/components/app/custody-view';

export const metadata: Metadata = { title: 'Chain of Custody — Vestigium' };

export default function CustodyPage() {
  return <CustodyView />;
}
