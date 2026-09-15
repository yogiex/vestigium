'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Issue } from '@/store/use-vestigium';

/** CC-22 — satu tempat render pesan penolakan validator. Penolakan adalah fitur (deny-by-default);
 *  pesan selalu menyebut APA yang kurang dan DI MANA, jadi render-nya diseragamkan. */
export function RejectionList({ issues, className }: { issues: Issue[]; className?: string }) {
  if (issues.length === 0) return null;
  return (
    <Alert variant="destructive" className={className ?? 'mt-3'}>
      <AlertDescription className="text-xs">
        {issues.map((issue, i) => <p key={i}>{issue.message}</p>)}
      </AlertDescription>
    </Alert>
  );
}
