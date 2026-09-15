import type { Metadata } from 'next';

import { AuditView } from '@/components/app/audit-view';

export const metadata: Metadata = { title: 'Audit Trail — Vestigium' };

export default function AuditPage() {
  return <AuditView />;
}
