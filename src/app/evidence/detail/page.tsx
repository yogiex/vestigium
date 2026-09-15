import type { Metadata } from 'next';

import { EvidenceDetailView } from '@/components/app/evidence-detail-view';

export const metadata: Metadata = { title: 'Detail Evidence — Vestigium' };

export default function EvidenceDetailPage() {
  return <EvidenceDetailView />;
}
