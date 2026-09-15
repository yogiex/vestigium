'use client';

import { ArrowRight } from 'lucide-react';

import { CUSTODY_TYPE_LABELS, SEAL_CONDITION_LABELS } from '@/lib/domain';
import { formatUTC } from '@/lib/time';
import type { CustodyEvent } from '@/lib/types';

/** Timeline kronologis + Δ dual-timestamp selalu terlihat (konstitusi #2). */
export function CustodyTimeline({ events, resolveName }: {
  events: CustodyEvent[];
  resolveName: (id: string) => string;
}) {
  if (events.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Belum ada peristiwa.</p>;
  }
  return (
    <ol className="relative space-y-5 border-l border-border pl-5">
      {events.map(ev => {
        const delta = Date.parse(ev.recordedAt) - Date.parse(ev.occurredAt);
        const m = Math.floor(delta / 60000);
        const deltaText = m < 1 ? 'tepat' : m < 60 ? `${m} mnt` : `${Math.floor(m / 60)} jam`;
        const label = (p: CustodyEvent['fromParty']) =>
          p.kind === 'person' ? resolveName(p.personId) : p.label;
        return (
          <li key={ev.id} className="relative">
            <span className="absolute -left-[25px] top-1 size-2.5 rounded-full border-2 border-primary bg-background" />
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
                {CUSTODY_TYPE_LABELS[ev.type]}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">{formatUTC(ev.occurredAt)}</span>
              <span className="font-mono text-[9px] text-muted-foreground">· Δ catat {deltaText}</span>
            </div>
            <div className="mt-1 text-sm">
              <span className="font-medium text-foreground">{label(ev.fromParty)}</span>
              <ArrowRight className="mx-1.5 inline size-3 text-muted-foreground" />
              <span className="font-medium text-foreground">{label(ev.toParty)}</span>
            </div>
            <div className="text-xs text-muted-foreground">{ev.reason}</div>
            {(ev.sealNumber || ev.sealCondition !== 'not-applicable') && (
              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                seal: {SEAL_CONDITION_LABELS[ev.sealCondition]}{ev.sealNumber && ` · ${ev.sealNumber}`}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
