'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, ArrowRightLeft, FileSearch, Lock, LockOpen, PlayCircle, ShieldCheck, Unlock } from 'lucide-react';

import { AppShell } from '@/components/app/app-shell';
import { CustodyTimeline } from '@/components/domain/custody-timeline';
import { HashBox } from '@/components/domain/hash-box';
import { Stamp } from '@/components/domain/stamp';
import { StatusBadge } from '@/components/domain/status-badge';
import { useOperatorGuard } from '@/hooks/use-operator-guard';
import {
  canPerform, canTransition, CONDITION_LABELS,
  MEDIUM_LABELS, POWER_STATE_LABELS, SOURCE_CATEGORY_LABELS,
  ACQ_METHOD_LABELS, VERIFY_METHOD_LABELS, VERIFY_RESULT_LABELS,
} from '@/lib/domain';
import { formatUTC } from '@/lib/time';
import { asHashHex64 } from '@/lib/types';
import type { Party, SealCondition, Uuid } from '@/lib/types';
import { useVestigium, type Issue } from '@/store/use-vestigium';
import {
  selectAcquisitionsOfItem, selectCaseOf, selectCustodianLabel,
  selectCustodyEventsOfItem, selectItemIntegrity, selectMatchStatus,
  selectPersonName, selectVerificationsOfItem,
} from '@/store/selectors';

function Issues({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <div className="mt-3 space-y-1">
      {issues.map((i, k) => <p key={k} className="text-xs text-destructive">{i.message}</p>)}
    </div>
  );
}

/* ---------- Pihak picker (Party union — CC-08) ---------- */
function PartyPicker({ value, onChange, persons }: {
  value: Party; onChange: (p: Party) => void;
  persons: { id: string; name: string }[];
}) {
  return (
    <RadioGroup
      value={value.kind}
      onValueChange={(k: string | null) => k && onChange((k === 'person'
        ? { kind: 'person', personId: persons[0]?.id as never }
        : { kind: k, label: '' }) as Party)}
      className="flex gap-4">
      {(['person', 'location', 'external'] as const).map(k => (
        <Label key={k} className="flex items-center gap-1.5 font-mono text-[10px] uppercase">
          <RadioGroupItem value={k} /> {k}
        </Label>
      ))}
      <div className="flex-1">
        {value.kind === 'person' ? (
          <Select value={value.personId} onValueChange={v => onChange({ kind: 'person', personId: v as never })}>
            <SelectTrigger><SelectValue placeholder="Dari roster…" /></SelectTrigger>
            <SelectContent>
              {persons.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input value={value.label} placeholder={value.kind === 'location' ? 'mis. Evidence Room' : 'mis. Kejaksaan Negeri'}
            onChange={e => onChange({ kind: value.kind, label: e.target.value })} />
        )}
      </div>
    </RadioGroup>
  );
}

const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/** Konfigurasi 5 aksi custody — satu tabel, bukan if-chain (CC-20). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- MOVE_CFG used only for MoveKey type derivation
const MOVE_CFG = {
  transferCustody: {}, sealEvidence: {}, openSeal: {},
  releaseEvidence: {}, startAnalysis: {},
} as const;
type MoveKey = keyof typeof MOVE_CFG;
const MOVE_TITLE: Record<MoveKey, string> = {
  transferCustody: 'Transfer Custody',
  sealEvidence: 'Segel Item',
  openSeal: 'Buka Seal',
  releaseEvidence: 'Rilis / Serah Terima',
  startAnalysis: 'Mulai Analisis',
};

/* ---------- Inner (butuh useSearchParams → Suspense, CC-31) ---------- */
function EvidenceDetailInner() {
  const { mounted, operator } = useOperatorGuard();
  const router = useRouter();
  const sp = useSearchParams();
  const evidenceId = sp.get('id') as Uuid | null;

  const [issues, setIssues] = useState<Issue[]>([]);
  const [moveDialog, setMoveDialog] = useState<keyof typeof MOVE_CFG | null>(null);
  const [toParty, setToParty] = useState<Party>({ kind: 'location', label: '' });
  const [moveReason, setMoveReason] = useState('');
  const [moveAt, setMoveAt] = useState(nowLocal());
  const [hashDialog, setHashDialog] = useState(false);
  const [hashInput, setHashInput] = useState('');
  const [hashFile, setHashFile] = useState('');
  const [acqDialog, setAcqDialog] = useState(false);
  const [acq, setAcq] = useState({
    source: 'non-volatile', method: 'bit-stream', tool: '', writeBlocker: '',
    outputFormat: 'e01', targetMedia: '', startedAt: nowLocal(), finishedAt: nowLocal(),
    sourceHash: '', imageHash: '', originalChanged: false,
    changeJustification: '', sourceClockNotes: '',
  });
  const [verDialog, setVerDialog] = useState(false);
  const [ver, setVer] = useState({ method: 'manual-entry', computedHash: '', result: 'match', acquisitionId: '' });

  const item = useVestigium(s => s.evidence.find(e => e.id === evidenceId));
  // Subscribe state penuh (pola dashboard) — bukan getState() di render: pembacaan
  // turunan (kasus, integritas, timeline) harus ikut segar setelah aksi/roster berubah.
  const g = useVestigium(s => s);

  const A = {
    transferCustody: useVestigium(s => s.transferCustody),
    sealEvidence: useVestigium(s => s.sealEvidence),
    openSeal: useVestigium(s => s.openSeal),
    releaseEvidence: useVestigium(s => s.releaseEvidence),
    startAnalysis: useVestigium(s => s.startAnalysis),
    setReferenceHash: useVestigium(s => s.setReferenceHash),
    appendAcquisition: useVestigium(s => s.appendAcquisition),
    appendVerification: useVestigium(s => s.appendVerification),
  };

  if (!mounted) return <div className="min-h-screen bg-background" />;
  if (!item) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <p className="text-sm text-muted-foreground">Item tidak ditemukan.</p>
          <Button variant="link" onClick={() => router.push('/evidence')}>← Register Evidence</Button>
        </div>
      </AppShell>
    );
  }

  const kase = selectCaseOf(g, item.id);
  const integrity = selectItemIntegrity(g, item.id);
  const acquisitions = selectAcquisitionsOfItem(g, item.id);
  const verifications = selectVerificationsOfItem(g, item.id);
  const custodyEvents = selectCustodyEventsOfItem(g, item.id);
  const canCustody = canPerform(operator!.role, 'CUSTODY');
  const canHash = canPerform(operator!.role, 'HASH_REFERENCE');
  const canAcq = canPerform(operator!.role, 'ACQUISITION');
  const canVerify = canPerform(operator!.role, 'VERIFY');

  /* Gerbang tombol: transisi sah (CC-20) + RBAC (GRU-02) */
  const btnOk = (to: string | null) => canCustody && (!to || canTransition('item', item.status, to));

  function doMove() {
    if (!item || !moveDialog) return;
    setIssues([]);
    const input = { toParty, reason: moveReason.trim(), occurredAt: moveAt,
      sealCondition: (moveDialog === 'openSeal' ? 'broken' : undefined) as SealCondition | undefined };
    const r = A[moveDialog](item.id, input);
    if (!r.ok) { setIssues(r.issues); return; }
    setMoveDialog(null); setMoveReason(''); setToParty({ kind: 'location', label: '' });
  }

  function doSetHash() {
    if (!item) return;
    setIssues([]);
    const r = A.setReferenceHash(item.id, hashInput.trim().toLowerCase(),
      hashFile ? { fileName: hashFile } : undefined);
    if (!r.ok) { setIssues(r.issues); return; }
    setHashDialog(false); setHashInput(''); setHashFile('');
  }

  function doAcq() {
    if (!item) return;
    setIssues([]);
    const r = A.appendAcquisition({
      evidenceId: item.id, source: acq.source as never, method: acq.method as never,
      tool: acq.tool.trim(), writeBlocker: acq.writeBlocker.trim() || 'tidak digunakan — n/a',
      outputFormat: acq.outputFormat as never, targetMedia: acq.targetMedia.trim(),
      startedAt: acq.startedAt, finishedAt: acq.finishedAt,
      operatorId: operator!.id as never,
      sourceHash: acq.sourceHash.trim() ? asHashHex64(acq.sourceHash.trim().toLowerCase()) : undefined,
      imageHash: acq.imageHash.trim() ? asHashHex64(acq.imageHash.trim().toLowerCase()) : undefined,
      originalChanged: acq.originalChanged,
      changeJustification: acq.changeJustification.trim() || undefined,
      sourceClockNotes: acq.sourceClockNotes.trim() || undefined,
    });
    if (!r.ok) { setIssues(r.issues); return; }
    setAcqDialog(false);
  }

  function doVerify() {
    if (!item) return;
    setIssues([]);
    const r = A.appendVerification({
      evidenceId: item.id,
      acquisitionId: (ver.acquisitionId || undefined) as never,
      method: ver.method as never, computedHash: asHashHex64(ver.computedHash.trim().toLowerCase()),
      result: ver.result as never, verifierId: operator!.id as never, occurredAt: nowLocal(),
    });
    if (!r.ok) { setIssues(r.issues); return; }   // INV-16 → pesan edukatif dari gateway
    setVerDialog(false); setVer(v => ({ ...v, computedHash: '' }));
  }

  const lastStamp = integrity.status === 'match' ? 'verified'
    : integrity.status === 'mismatch' ? 'failure' : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2 font-mono text-xs text-muted-foreground"
          onClick={() => router.push('/evidence')}>
          <ArrowLeft className="size-4" /> Register Evidence
        </Button>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-primary">{item.itemNo}</span>
              {kase && <span className="font-mono text-xs text-muted-foreground">{kase.caseNo}</span>}
              <StatusBadge status={item.status} />
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{item.label}</h1>
          </div>
        </div>

        {/* Toolbar aksi — disabled by transisi + RBAC */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!btnOk(null)}
            onClick={() => { setMoveDialog('transferCustody'); }}>
            <ArrowRightLeft className="size-4" /> Transfer
          </Button>
          <Button size="sm" variant="outline" disabled={!btnOk('sealed')}
            onClick={() => setMoveDialog('sealEvidence')}>
            <Lock className="size-4" /> Segel
          </Button>
          <Button size="sm" variant="outline" disabled={!btnOk('opened')}
            onClick={() => setMoveDialog('openSeal')}>
            <LockOpen className="size-4" /> Buka Seal
          </Button>
          <Button size="sm" variant="outline" disabled={!btnOk('in-analysis')}
            onClick={() => setMoveDialog('startAnalysis')}>
            <PlayCircle className="size-4" /> Mulai Analisis
          </Button>
          <Button size="sm" variant="outline" disabled={!btnOk('released')}
            onClick={() => setMoveDialog('releaseEvidence')}>
            <Unlock className="size-4" /> Rilis
          </Button>
          <Button size="sm" disabled={!canHash || !!item.referenceHash}
            onClick={() => setHashDialog(true)}
            title={item.referenceHash ? 'Hash referensi write-once (INV-06)' : undefined}>
            <ShieldCheck className="size-4" /> Tetapkan Hash Referensi
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          {/* ===== KIRI: identifikasi + integritas + akuisisi + verifikasi ===== */}
          <div className="space-y-4 lg:col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-xs uppercase tracking-widest">Identifikasi &amp; Collection</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {([
                  ['Kategori', SOURCE_CATEGORY_LABELS[item.category]],
                  ['Medium', MEDIUM_LABELS[item.medium]],
                  ['Power saat ditemukan', POWER_STATE_LABELS[item.powerState]],
                  ['Kondisi', CONDITION_LABELS[item.condition]],
                  ['Serial', item.serial ?? '—'],
                  ['Lokasi penemuan', item.discoveryLocation],
                  ['DEFR penemu', selectPersonName(g, item.defrId)],
                  ['Saksi', item.witnessId ? selectPersonName(g, item.witnessId) : '—'],
                  ['Wadah / Seal', `${item.packaging ?? '—'}${item.sealNumber ? ` · ${item.sealNumber}` : ''}`],
                  ['Custodian saat ini', selectCustodianLabel(g, item.id)],
                  ['Collection (UTC)', formatUTC(item.collectedAt)],
                  ['Dicatat (UTC)', formatUTC(item.recordedAt)],
                ] as const).map(([k, v]) => (
                  <div key={k}>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</div>
                    <div className="mt-0.5 font-mono text-xs text-foreground">{v}</div>
                  </div>
                ))}
                {item.deviation && (
                  <div className="sm:col-span-2">
                    <Alert variant="destructive" className="py-2.5">
                      <AlertDescription className="text-xs">
                        <b>Deviasi prosedur tercatat:</b> {item.deviation.reason}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Integritas — hash referensi + stamp + verifikasi */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-xs uppercase tracking-widest">Preservasi &amp; Integritas (§6.5)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {item.referenceHash ? (
                  <>
                    <HashBox label="SHA-256 referensi — TERKUNCI (INV-06)"
                      hash={item.referenceHash}
                      sub={item.referenceHashSource?.fileName} />
                    <div className="flex items-center justify-between">
                      {lastStamp
                        ? <Stamp verdict={lastStamp} />
                        : <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">belum pernah diverifikasi ulang</span>}
                      <Button size="sm" variant="outline" disabled={!canVerify}
                        onClick={() => { setIssues([]); setVerDialog(true); }}>
                        <FileSearch className="size-4" /> Catat Verifikasi
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Belum ada hash referensi — tetapkan manual di sini, atau hitung berkas via
                      Integrity Lab (menu 05, Sesi 8).
                    </p>
                    <Button size="sm" disabled={!canHash} onClick={() => setHashDialog(true)}>
                      <ShieldCheck className="size-4" /> Tetapkan Hash Referensi
                    </Button>
                  </div>
                )}

                {verifications.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono text-[10px] uppercase">Waktu</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase">Metode</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase">Hash terhitung</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase">Hasil</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verifications.map(v => (
                        <TableRow key={v.id}>
                          <TableCell className="whitespace-nowrap font-mono text-[10px]">{formatUTC(v.recordedAt)}</TableCell>
                          <TableCell className="text-xs">{VERIFY_METHOD_LABELS[v.method]}</TableCell>
                          <TableCell className="font-mono text-[10px] text-primary">{v.computedHash.slice(0, 18)}…</TableCell>
                          <TableCell>
                            <span className={`font-mono text-[10px] font-bold ${v.result === 'match' ? 'text-success' : v.result === 'mismatch' ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {VERIFY_RESULT_LABELS[v.result]}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Akuisisi — N record per item (FR-M4-01) */}
            <Card>
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle className="font-mono text-xs uppercase tracking-widest">Akuisisi ({acquisitions.length})</CardTitle>
                <Button size="sm" variant="outline" disabled={!canAcq} onClick={() => { setIssues([]); setAcqDialog(true); }}>
                  + Tambah Record
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {acquisitions.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">Belum ada record akuisisi.</p>
                )}
                {acquisitions.map(a => {
                  const ms = selectMatchStatus(a);
                  return (
                    <div key={a.id} className="rounded-sm border border-border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-primary">{a.acquisitionNo}</span>
                        <span className="text-xs">{ACQ_METHOD_LABELS[a.method]}</span>
                        {a.originalChanged && (
                          <span className="font-mono text-[9px] uppercase text-destructive">original berubah</span>
                        )}
                        <span className={`ml-auto font-mono text-[10px] font-bold ${ms === 'match' ? 'text-success' : ms === 'mismatch' ? 'text-destructive' : 'text-muted-foreground'}`}>
                          hash {ms.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1.5 grid gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                        <span>tool: <span className="text-foreground">{a.tool}</span></span>
                        <span>wb: <span className="text-foreground">{a.writeBlocker}</span></span>
                        <span>target: <span className="text-foreground">{a.targetMedia}</span></span>
                        <span>format: <span className="text-foreground">{a.outputFormat}</span></span>
                        {a.sourceClockNotes && <span className="sm:col-span-2">jam sumber: <span className="text-foreground">{a.sourceClockNotes}</span></span>}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* ===== KANAN: timeline custody ===== */}
          <div className="lg:col-span-2">
            <Card className="sticky top-20">
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-xs uppercase tracking-widest">Chain of Custody</CardTitle>
                <CardDescription className="text-xs">
                  Kronologis · append-only · Δ = jeda kejadian→pencatatan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CustodyTimeline events={custodyEvents}
                  resolveName={id => selectPersonName(g, id)} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ===== Dialog aksi custody (generik 5 aksi — MOVE_CFG) ===== */}
      <Dialog open={!!moveDialog} onOpenChange={o => !o && setMoveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {moveDialog && MOVE_TITLE[moveDialog]}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pengirim otomatis = custodian saat ini ({selectCustodianLabel(g, item.id)}) —
              tidak dapat diarbitrer (INV-04).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Penerima *</Label>
              <PartyPicker value={toParty} onChange={setToParty}
                persons={g.persons.filter(p => p.isActive).map(p => ({ id: p.id, name: p.name }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Alasan * (FR-M6-02)</Label>
              <Input value={moveReason} onChange={e => setMoveReason(e.target.value)}
                placeholder="mis. Serah terima untuk imaging forensik" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Waktu kejadian *</Label>
              <Input type="datetime-local" value={moveAt} onChange={e => setMoveAt(e.target.value)} />
            </div>
            <Issues issues={issues} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialog(null)}>Batal</Button>
            <Button onClick={doMove} disabled={!moveReason.trim()}>
              {moveDialog && MOVE_TITLE[moveDialog]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog hash referensi (INV-06) ===== */}
      <Dialog open={hashDialog} onOpenChange={setHashDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Tetapkan Hash Referensi</DialogTitle>
            <DialogDescription className="text-xs">
              Write-once — setelah tersimpan <b>tidak dapat diubah selamanya</b> (INV-06).
              Untuk perhitungan dari berkas: gunakan Integrity Lab (Sesi 8).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={hashInput} onChange={e => setHashInput(e.target.value)}
              placeholder="64 karakter hex — SHA-256" className="font-mono" />
            <Input value={hashFile} onChange={e => setHashFile(e.target.value)}
              placeholder="Nama berkas acuan (opsional)" />
            <Issues issues={issues} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHashDialog(false)}>Batal</Button>
            <Button onClick={doSetHash} disabled={!/^[0-9a-fA-F]{64}$/.test(hashInput.trim())}>
              Kunci Hash Referensi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog akuisisi (FR-M4) ===== */}
      <Dialog open={acqDialog} onOpenChange={setAcqDialog}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Record Akuisisi Baru</DialogTitle>
            <DialogDescription className="text-xs">
              Hash sumber ≠ hash image tetap DISIMPAN apa adanya (dokumentasi jujur — FR-M4-07).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase">Jenis sumber</Label>
              <Select value={acq.source} onValueChange={v => setAcq(a => ({ ...a, source: v ?? a.source }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="non-volatile">Non-volatile (disk)</SelectItem>
                  <SelectItem value="volatile">Volatile (RAM/live)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase">Metode</Label>
              <Select value={acq.method} onValueChange={v => setAcq(a => ({
                ...a, method: v ?? a.method, originalChanged: (v ?? a.method) === 'live' ? true : a.originalChanged }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['bit-stream', 'logical', 'targeted', 'live'].map(m => (
                    <SelectItem key={m} value={m}>{ACQ_METHOD_LABELS[m as never]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase">Tool + versi *</Label>
              <Input value={acq.tool} onChange={e => setAcq(a => ({ ...a, tool: e.target.value }))}
                placeholder="mis. FTK Imager 4.7.0" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase">Write blocker *</Label>
              <Input value={acq.writeBlocker} onChange={e => setAcq(a => ({ ...a, writeBlocker: e.target.value }))}
                placeholder="mis. Tableau T8u — atau: tidak digunakan — <alasan>" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase">Format output</Label>
              <Select value={acq.outputFormat} onValueChange={v => setAcq(a => ({ ...a, outputFormat: v ?? a.outputFormat }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['e01', 'raw', 'aff4', 'other'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase">Media tujuan *</Label>
              <Input value={acq.targetMedia} onChange={e => setAcq(a => ({ ...a, targetMedia: e.target.value }))}
                placeholder="mis. Evidence HDD-04" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase">Mulai *</Label>
              <Input type="datetime-local" value={acq.startedAt}
                onChange={e => setAcq(a => ({ ...a, startedAt: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase">Selesai *</Label>
              <Input type="datetime-local" value={acq.finishedAt}
                onChange={e => setAcq(a => ({ ...a, finishedAt: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase">Hash sumber (64-hex)</Label>
              <Input value={acq.sourceHash} onChange={e => setAcq(a => ({ ...a, sourceHash: e.target.value }))}
                className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase">Hash image (64-hex)</Label>
              <Input value={acq.imageHash} onChange={e => setAcq(a => ({ ...a, imageHash: e.target.value }))}
                className="font-mono text-xs" />
            </div>
            {acq.method === 'live' && (
              <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-xs sm:col-span-2">
                <Label className="flex items-center gap-2 font-mono text-[10px] uppercase text-destructive">
                  <input type="checkbox" checked={acq.originalChanged} disabled /> Original berubah = true (dipaksa — INV-12)
                </Label>
                <Input className="mt-2" value={acq.changeJustification}
                  onChange={e => setAcq(a => ({ ...a, changeJustification: e.target.value }))}
                  placeholder="Justifikasi wajib (INV-13): mis. live response sebelum shutdown" />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="font-mono text-[10px] uppercase">Kondisi jam sistem sumber (P-08, opsional)</Label>
              <Input value={acq.sourceClockNotes}
                onChange={e => setAcq(a => ({ ...a, sourceClockNotes: e.target.value }))}
                placeholder="mis. jam server tertinggal 4 menit dari UTC" />
            </div>
            <Issues issues={issues} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcqDialog(false)}>Batal</Button>
            <Button onClick={doAcq}
              disabled={!acq.tool.trim() || !acq.targetMedia.trim()
                || (acq.method === 'live' && !acq.changeJustification.trim())}>
              Simpan Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog verifikasi (INV-16 di gateway) ===== */}
      <Dialog open={verDialog} onOpenChange={setVerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Catat Verifikasi</DialogTitle>
            <DialogDescription className="text-xs">
              Hasil divalidasi gateway terhadap hash acuan (INV-16) — pilihan tidak konsisten
              ditolak dengan pesan yang menjelaskan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase">Metode</Label>
              <Select value={ver.method} onValueChange={v => setVer(s => ({ ...s, method: v ?? s.method }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual-entry">Input manual</SelectItem>
                  <SelectItem value="file-compute">Perhitungan berkas (via Lab)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase">Hash terhitung *</Label>
              <Input value={ver.computedHash} onChange={e => setVer(s => ({ ...s, computedHash: e.target.value }))}
                placeholder="64-hex" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase">Hasil</Label>
              <Select value={ver.result} onValueChange={v => setVer(s => ({ ...s, result: v ?? s.result }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="match">MATCH</SelectItem>
                  <SelectItem value="mismatch">MISMATCH</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Issues issues={issues} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerDialog(false)}>Batal</Button>
            <Button onClick={doVerify} disabled={!/^[0-9a-fA-F]{64}$/.test(ver.computedHash.trim())}>
              Catat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/** CC-31 — useSearchParams wajib di bawah Suspense pada static export. */
export function EvidenceDetailView() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <EvidenceDetailInner />
    </Suspense>
  );
}
