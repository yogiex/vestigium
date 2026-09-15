'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDownUp, ArrowRight, Lock } from 'lucide-react';

import { AppShell } from '@/components/app/app-shell';
import { useOperatorGuard } from '@/hooks/use-operator-guard';
import { CUSTODY_TYPE_LABELS, SEAL_CONDITION_LABELS } from '@/lib/domain';
import { CUSTODY_TYPES, type CustodyEventType } from '@/lib/types';
import { formatUTC } from '@/lib/time';
import { useVestigium } from '@/store/use-vestigium';
import { selectCustodyContinuity, selectCustodyLedger } from '@/store/selectors';

/** Δ dual-timestamp: <1 mnt "tepat", lalu menit/jam; >24 jam = anomali (NFR-09). */
function formatDelta(ms: number): { text: string; anomali: boolean } {
  if (ms < 0) return { text: '⚠ mundur', anomali: true };
  const m = Math.floor(ms / 60000);
  if (m < 1) return { text: 'tepat', anomali: false };
  if (m < 60) return { text: `${m} mnt`, anomali: false };
  const h = Math.floor(m / 60);
  if (h < 24) return { text: `${h} jam`, anomali: false };
  return { text: `⚠ ${Math.floor(h / 24)} hari`, anomali: true };
}

/** Warna badge aksi — makna konsisten dengan dashboard (default=prosedur). */
const TYPE_VARIANT: Record<CustodyEventType, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  collected: 'outline', transferred: 'default', sealed: 'default',
  opened: 'secondary', released: 'secondary', resealed: 'default', disposed: 'destructive',
};

export function CustodyView() {
  const { mounted, operator } = useOperatorGuard();
  const router = useRouter();

  const evidence = useVestigium(s => s.evidence);
  const custodyCount = useVestigium(s => s.custody.length);

  const [q, setQ] = useState('');
  const [fType, setFType] = useState('all');
  const [asc, setAsc] = useState(false);

  /* Read-only ledger — selector murni dihitung dari state (CC-18/26) */
  const rows = useMemo(() => {
    const all = selectCustodyLedger(useVestigium.getState());
    const dir = asc ? 1 : -1;
    return all
      .sort((a, b) => dir * (Date.parse(a.event.occurredAt) - Date.parse(b.event.occurredAt)))
      .filter(r => fType === 'all' || r.event.type === fType)
      .filter(r => !q ||
        `${r.itemNo} ${r.itemLabel} ${r.fromLabel} ${r.toLabel} ${r.event.reason} ${r.event.sealNumber ?? ''}`
          .toLowerCase().includes(q.toLowerCase()));
  }, [evidence, custodyCount, q, fType, asc]);

  const continuity = useMemo(
    () => selectCustodyContinuity(useVestigium.getState()),
    [evidence, custodyCount]);

  const transfers = useVestigium(s => s.custody.filter(c => c.type === 'transferred').length);
  const seals = useVestigium(s => s.custody.filter(c => c.type === 'sealed').length);

  if (!mounted || !operator) return <div className="min-h-screen bg-background" />;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">04 / Chain of Custody</p>
          <h1 className="text-2xl font-semibold tracking-tight">Rantai Pemegangan Bukti</h1>
        </div>

        {/* Note-strip — identitas halaman (§6.5) */}
        <div className="flex items-start gap-2.5 rounded-sm border border-primary/40 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <b className="text-foreground">Append-only.</b> Setiap perpindahan bukti wajib tercatat
            dengan waktu kejadian + waktu pencatatan (UTC) — entri tidak dapat diedit atau dihapus
            dari antarmuka. Koreksi = entri baru (konstitusi #3, §6.5.3).
          </span>
        </div>

        {/* Gap-check kontinuitas — pelanggaran TAMPIL, bukan disembunyikan (S3) */}
        {!continuity.ok && (
          <Alert variant="destructive">
            <AlertTitle className="text-sm">
              {continuity.broken.length} rantai custody tidak berawal dari lokasi kejadian
            </AlertTitle>
            <AlertDescription className="text-xs">
              {continuity.broken.map(b =>
                `${b.itemNo} (peristiwa pertama: ${CUSTODY_TYPE_LABELS[b.firstType as CustodyEventType] ?? b.firstType})`).join(' · ')}
              <br />Setiap rantai wajib berawal event <b>collected</b> — FR-M3-01. Jika ini hasil
              manipulasi storage, verifikasi rantai audit (modul 06) akan mengkonfirmasinya.
            </AlertDescription>
          </Alert>
        )}

        {/* Statistik ringkas */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Total peristiwa', String(custodyCount)],
            ['Transfer', String(transfers)],
            ['Penyegelan', String(seals)],
          ].map(([k, v]) => (
            <Card key={k}>
              <CardContent className="p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
                <div className="mt-1 text-2xl font-semibold text-foreground">{v}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Cari item / pihak / alasan / seal…" value={q}
            onChange={e => setQ(e.target.value)} className="max-w-xs" />
          <Select value={fType} onValueChange={v => setFType(v ?? 'all')}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua aksi</SelectItem>
              {CUSTODY_TYPES.map(t => (
                <SelectItem key={t} value={t}>{CUSTODY_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setAsc(a => !a)}>
            <ArrowDownUp className="size-4" /> {asc ? 'Terlama dulu' : 'Terbaru dulu'}
          </Button>
        </div>

        {/* Ledger */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-[10px] uppercase">Kejadian (UTC)</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase">Δ Catat</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase">Item</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase">Aksi</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase">Rantai</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase">Alasan</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase">Seal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      {custodyCount === 0
                        ? 'Belum ada peristiwa custody — rantai lahir otomatis saat registrasi evidence (FR-M3-01).'
                        : 'Tidak ada peristiwa yang cocok dengan filter.'}
                    </TableCell>
                  </TableRow>
                )}
                {rows.map(r => {
                  const delta = formatDelta(r.deltaMs);
                  return (
                    <TableRow key={r.event.id} className="cursor-pointer"
                      onClick={() => router.push(`/evidence/detail?id=${r.evidenceId}`)}>
                      <TableCell className="whitespace-nowrap font-mono text-[11px]">
                        {formatUTC(r.event.occurredAt)}
                      </TableCell>
                      <TableCell className={`whitespace-nowrap font-mono text-[11px] ${delta.anomali ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {delta.text}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-primary">{r.itemNo}</span>
                        <div className="max-w-40 truncate text-[11px] text-muted-foreground">{r.itemLabel}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={TYPE_VARIANT[r.event.type]} className="font-mono text-[9px] uppercase">
                          {CUSTODY_TYPE_LABELS[r.event.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium text-foreground">{r.fromLabel}</span>
                        <ArrowRight className="mx-1 inline size-3 text-muted-foreground" />
                        <span className="font-medium text-foreground">{r.toLabel}</span>
                      </TableCell>
                      <TableCell className="max-w-52 truncate text-xs text-muted-foreground">
                        {r.event.reason}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                        {SEAL_CONDITION_LABELS[r.event.sealCondition]}
                        {r.event.sealNumber && <div>{r.event.sealNumber}</div>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Custodian saat ini diturunkan dari peristiwa terakhir (INV-04) ·
          {' '}custody form dengan kolom tanda tangan menyusul di modul Laporan (Sesi 9)
        </p>
      </div>
    </AppShell>
  );
}
