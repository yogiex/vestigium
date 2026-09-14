import type { Metadata } from 'next';

import { CasesView } from '@/components/app/cases-view';

export const metadata: Metadata = { title: 'Register Kasus — Vestigium' };

export default function CasesPage() {
  return <CasesView />;
}
