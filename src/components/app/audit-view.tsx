'use client';

import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Fingerprint, Lock } from 'lucide-react';

import { AppShell } from '@/components/app/app-shell';
import { useOperatorGuard } from '@/hooks/use-operator-guard';
import { toAuditCsv } from '@/lib/format';
import { formatUTC } from '@/lib/time';
import { AUDIT_ACTIONS } from '@/lib/types';
import { useVestigium } from '@/store/use-vestigium';
import { selectChainReport } from '@/store/selectors';

export function AuditView() {
  const { mounted, operator } = useOperatorGuard();

  /* CC-26 — view read-only subscribe state penuh; turunan via selector (CC-18).
     Sebelumnya: selectChainReport(getState()) dalam useMemo dgn deps parsial
     → memo bisa menghitung dari state basi. Kini deps lengkap. */
  const st = useVestigium(s => s);
  const audit = st.audit;
  const chain = useMemo(() => selectChainReport(st), [st]);

  const [q, setQ] = useState('');
  const [fAction, setFAction] = useState('all');
  const [chainPanel, setChainPanel] = useState(false);

  const rows = audit
    .filter(e => fAction === 'all' || e.action === fAction)
    .filter(e => !q ||
      `${e.actor} ${e.action} ${e.target} ${e.detail}`.toLowerCase().includes(q.toLowerCase()));

  function onExport() {
    const csv = toAuditCsv(audit);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `vestigium-audit-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  if (!mounted || !operator) return <div className="min-h-screen bg-background" />;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">06 / Audit Log</p>
            <h1 className="text-2xl font-semibold tracking-tight">Audit Trail — Append Only</h1>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setChainPanel(p => !p)}>
              <Fingerprint className="size-4" /> Verifikasi Rantai
            </Button>
            <Button size="sm" onClick={onExport}><Download className="size-4" /> Ekspor CSV</Button>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-sm border border-primary/40 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            Setiap entri ter-hash dengan entri sebelumnya (hash-chain, DATA §7) — pengeditan atau
            penghapusan manual pada penyimpanan <b className="text-foreground">terdeteksi</b> oleh
            verifikasi rantai. Tidak ada antarmuka edit/hapus (FR-M8-05, konstitusi #3).
          </span>
        </div>

        {/* Hasil verifikasi — dilokalisasi (S4) */}
        {chainPanel && (
          <Alert className={chain.valid ? 'border-success/40' : 'border-destructive/40'}>
            <AlertTitle className="text-sm">
              Rantai {chain.total} entri: {chain.valid
                ? <span className="text-success">VALID — tidak ditemukan tampering</span>
                : <span className="text-destructive">PUTUS — entri pertama yang bermasalah: seq #{chain.firstBrokenSeq}</span>}
            </AlertTitle>
            <AlertDescription className="font-mono text-[11px]">tip: {chain.tip}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-3">
          <Input placeholder="Cari aktor / target / detail…" value={q}
            onChange={e => setQ(e.target.value)} className="max-w-xs" />
          {/* base-ui Select memberi string | null — guard wajib utk tipe state string */}
          <Select value={fAction} onValueChange={v => setFAction(v ?? 'all')}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua aksi</SelectItem>
              {AUDIT_ACTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-[10px] uppercase">Seq</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase">Waktu (UTC)</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase">Aktor</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase">Aksi</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase">Target</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      {audit.length === 0 ? 'Belum ada entri audit.' : 'Tidak ada yang cocok.'}
                    </TableCell>
                  </TableRow>
                )}
                {rows.slice(0, 200).map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{e.seq}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-[11px]">{formatUTC(e.at)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{e.actor}</TableCell>
                    <TableCell>
                      <Badge variant={e.detail.startsWith('DITOLAK') ? 'destructive' : 'secondary'}
                        className="font-mono text-[9px]">{e.action}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-primary">{e.target}</TableCell>
                    <TableCell className="max-w-72 truncate text-xs text-muted-foreground">{e.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {rows.length > 200 && (
          <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            menampilkan 200 teratas dari {rows.length} — persempit filter atau ekspor CSV
          </p>
        )}
      </div>
    </AppShell>
  );
}
