import type { Metadata } from 'next';

import { ReportsView } from '@/components/app/reports-view';

export const metadata: Metadata = { title: 'Laporan Kasus — Vestigium' };

export default function ReportsPage() {
  return <ReportsView />;
}
