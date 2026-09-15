import { Badge } from '@/components/ui/badge';

import { ITEM_STATUS_LABELS, CASE_STATUS_LABELS } from '@/lib/domain';
import type { CaseStatus, ItemStatus } from '@/lib/types';

const VARIANT: Record<ItemStatus, 'default' | 'secondary' | 'outline'> = {
  collected: 'outline', sealed: 'default', 'in-analysis': 'default',
  opened: 'secondary', released: 'secondary', disposed: 'secondary',
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <Badge variant={VARIANT[status]} className="font-mono text-[9px] uppercase">
      {ITEM_STATUS_LABELS[status]}
    </Badge>
  );
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return (
    <Badge variant={status === 'active' ? 'default' : 'secondary'} className="font-mono text-[9px] uppercase">
      {CASE_STATUS_LABELS[status]}
    </Badge>
  );
}
