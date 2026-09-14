import type { Metadata } from 'next';

import { CaseDetailView } from '@/components/app/case-detail-view';

export const metadata: Metadata = { title: 'Detail Kasus — Vestigium' };

export default function CaseDetailPage() {
  return <CaseDetailView />;
}
