'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer } from 'lucide-react';

import { AppShell } from '@/components/app/app-shell';
import { ReportDocument } from '@/components/reports/report-document';
import { useOperatorGuard } from '@/hooks/use-operator-guard';
import { partyLabel } from '@/lib/domain';
import { formatUTC, nowUTC } from '@/lib/time';
import type { CustodyEventType } from '@/lib/types';
import { useVestigium } from '@/store/use-vestigium';
import { selectCaseReport, selectPersonName } from '@/store/selectors';

function Inner() {
  const { mounted, operator } = useOperatorGuard();
  const sp = useSearchParams();
  // Subscribe state penuh (pola dashboard) — wajib di ATAS early-return (rules-of-hooks);
  // bukan getState() di render agar nama pihak/turunan ikut segar setelah roster berubah.
  const st = useVestigium(s => s);
  const cases = st.cases;
  const [caseId, setCaseId] = useState<string>(sp.get('case') ?? '');

  // DOC-ID & waktu dibangkitkan SEKALI per mount — stabil saat dicetak (FR-M9-04)
  const [meta] = useState(() => ({ ts: nowUTC().replace(/\D/g, '').slice(0, 14), at: formatUTC(nowUTC()) }));

  if (!mounted || !operator) return <div className="min-h-screen bg-background" />;

  const g = st;
  const active = caseId || cases[0]?.id || '';
  const data = active ? selectCaseReport(g, active) : null;

  // Resolve nama pihak custody (kertas memuat NAMA, bukan UUID — FR-M7-04)
  const name = (id: string) => selectPersonName(g, id);
  const custodyRows = data
    ? data.items.flatMap(it => (data.custody[it.id] ?? []).map(ev => ({
        id: ev.id, occurredAt: ev.occurredAt, itemNo: it.itemNo,
        type: ev.type as CustodyEventType,
        from: partyLabel(ev.fromParty, name), to: partyLabel(ev.toParty, name),
        reason: ev.reason,
      })))
    : [];
  const picName = data ? name(data.kase.leadDefrId) : '';

  return (
    <AppShell>
      {/* Toolbar — no-print */}
      <div className="w-full space-y-4 print:hidden">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">09 / Laporan</p>
          <h1 className="text-2xl font-semibold tracking-tight">Laporan Akuisisi &amp; Preservasi</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={active} onValueChange={v => setCaseId(v ?? '')}>
            <SelectTrigger className="w-96"><SelectValue placeholder="Pilih kasus…" /></SelectTrigger>
            <SelectContent>
              {cases.map(c => <SelectItem key={c.id} value={c.id}>{c.caseNo} — {c.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!data} onClick={() => window.print()}>
            <Printer className="size-4" /> Cetak / Simpan PDF
          </Button>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Print-parity: yang Anda lihat = yang tercetak · DOC-ID unik per pembangkitan (FR-M9-04)
        </p>
      </div>

      <div className="py-6 print:p-0">
        {data && (
          <ReportDocument
            data={data}
            custodyRows={custodyRows}
            picName={picName}
            docId={`VEST-RPT-${data.kase.caseNo}-${meta.ts}`}
            generatedAt={meta.at}
            examinerName={operator.name}
          />
        )}
        {!data && (
          <p className="py-20 text-center text-sm text-muted-foreground">Belum ada kasus untuk dilaporkan.</p>
        )}
      </div>
    </AppShell>
  );
}

/** CC-31 — Suspense wajib di sekitar useSearchParams. */
export function ReportsView() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Inner />
    </Suspense>
  );
}
