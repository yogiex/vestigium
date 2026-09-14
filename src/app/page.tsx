import type { Metadata } from 'next';

import { DashboardView } from '@/components/app/dashboard-view';

export const metadata: Metadata = { title: 'Ringkasan — Vestigium' };

export default function DashboardPage() {
  return <DashboardView />;
}
