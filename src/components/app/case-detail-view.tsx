'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Box, Lock, LockOpen, PlayCircle, Save, TriangleAlert,
} from 'lucide-react';

import { AppShell } from '@/components/app/app-shell';
import { useOperatorGuard } from '@/hooks/use-operator-guard';
import {
  CASE_STATUS_LABELS, canPerform, INCIDENT_TYPE_LABELS, PRIORITY_LABELS,
} from '@/lib/domain';
import { formatUTC } from '@/lib/time';
import type { CaseStatus, Uuid } from '@/lib/types';
import { useVestigium, type Issue } from '@/store/use-vestigium';
import {
  selectCustodianLabel, selectEvidenceOfCase, selectPersonName,
} from '@/store/selectors';

const LABEL = 'text-[10px] font-mono uppercase tracking-widest text-muted-foreground';

function Issues({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <div className="mt-3 space-y-1">
      {issues.map((i, k) => <p key={k} className="text-xs text-destructive">{i.message}</p>)}
    </div>
  );
}

function CaseDetailInner() {
  const { mounted, operator } = useOperatorGuard();
  const router = useRouter();
  const sp = useSearchParams();
  const caseId = sp.get('id') as Uuid | null;

  const [issues, setIssues] = useState<Issue[]>([]);
  const [statusDialog, setStatusDialog] = useState<'active' | 'closed' | 'reopen' | null>(null);
  const [reason, setReason] = useState('');
  const [authz, setAuthz] = useState('');

  const st = useVestigium();
  const kase = st.cases.find(c => c.id === caseId);
  const updateCaseContext = useVestigium(s => s.updateCaseContext);
  const setCaseStatus = useVestigium(s => s.setCaseStatus);

  if (!mounted || !operator) return <div className="min-h-screen bg-background" />;
  if (!kase) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <p className="text-sm text-muted-foreground">Kasus tidak ditemukan.</p>
          <Button variant="link" onClick={() => router.push('/cases')}>← Kembali ke register</Button>
        </div>
      </AppShell>
    );
  }

  const items = selectEvidenceOfCase(st, kase.id);
  const canStatus = canPerform(operator.role, 'CASE_STATUS');
  const canUpdate = canPerform(operator.role, 'CASE_UPDATE');

  function doSetStatus(to: CaseStatus) {
    setIssues([]);
    // occurredAt status diisi gateway dari nowUTC() — input user tak diminta di dialog
    const r = setCaseStatus(kase!.id, to, { reason: reason.trim() || undefined });
    if (!r.ok) { setIssues(r.issues); return; }
    setStatusDialog(null); setReason('');
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2 font-mono text-xs text-muted-foreground"
          onClick={() => router.push('/cases')}>
          <ArrowLeft className="size-4" /> Register Kasus
        </Button>

        {/* Header kasus */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-primary">{kase.caseNo}</span>
              <Badge variant={kase.status === 'active' ? 'default' : 'secondary'}
                className="font-mono text-[9px] uppercase">{CASE_STATUS_LABELS[kase.status]}</Badge>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{kase.title}</h1>
          </div>
          <div className="flex gap-2">
            {kase.status === 'open' && (
              <Button size="sm" disabled={!canStatus} onClick={() => { setIssues([]); setStatusDialog('active'); }}>
                <PlayCircle className="size-4" /> Aktifkan
              </Button>
            )}
            {kase.status === 'active' && (
              <Button size="sm" variant="destructive" disabled={!canStatus}
                onClick={() => { setIssues([]); setStatusDialog('closed'); }}>
                <Lock className="size-4" /> Tutup
              </Button>
            )}
            {kase.status === 'closed' && (
              <Button size="sm" variant="outline" disabled={!canStatus}
                onClick={() => { setIssues([]); setStatusDialog('reopen'); }}>
                <LockOpen className="size-4" /> Buka Kembali
              </Button>
            )}
          </div>
        </div>

        {/* GERBANG S6 — tampil TEGAS saat otorisasi kosong; muncul selalu sampai terisi */}
        {!kase.authorizationRef && (
          <Alert variant="destructive">
            <TriangleAlert className="size-4" />
            <AlertTitle className="text-sm">Kasus belum berotorisasi — registrasi evidence DIBLOKIR</AlertTitle>
            <AlertDescription className="space-y-3 text-xs">
              <p>
                Tanpa referensi otorisasi (surat tugas / warrant), setiap record collection pada
                kasus ini akan ditolak sistem (FR-M1-03, INV-09, skenario S6).
              </p>
              {canUpdate ? (
                <div className="flex flex-wrap gap-2">
                  <Input value={authz} onChange={e => setAuthz(e.target.value)}
                    placeholder="mis. ST/DF/011/2025" className="max-w-xs bg-background" />
                  <Button size="sm" variant="destructive"
                    onClick={() => {
                      setIssues([]);
                      const r = updateCaseContext(kase.id, { authorizationRef: authz.trim() || undefined });
                      if (!r.ok) setIssues(r.issues); else setAuthz('');
                    }}>
                    <Save className="size-4" /> Simpan Otorisasi
                  </Button>
                </div>
              ) : (
                <p>Role Anda tidak berwenang mengubah konteks kasus (GRU-02) — minta manager mengisi.</p>
              )}
              <Issues issues={issues} />
            </AlertDescription>
          </Alert>
        )}

        {/* Meta kasus */}
        <Card>
          <CardContent className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Insiden', `${INCIDENT_TYPE_LABELS[kase.incidentType]} · ${PRIORITY_LABELS[kase.priority]}`],
              ['PIC DEFR', selectPersonName(st, kase.leadDefrId)],
              ['Otorisasi', kase.authorizationRef ?? '—'],
              ['Dibuka', formatUTC(kase.occurredAt)],
              ['Scope', kase.scope || '—'],
              ['Item evidence', String(items.length)],
            ].map(([k, v]) => (
              <div key={k}>
                <div className={LABEL}>{k}</div>
                <div className="mt-0.5 font-mono text-xs text-foreground">{v}</div>
              </div>
            ))}
            {kase.description && (
              <div className="sm:col-span-2 lg:col-span-3">
                <div className={LABEL}>Deskripsi</div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{kase.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Item evidence kasus — read-only di sini; aksi penuh di modul Evidence (Sesi 5–6) */}
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-widest">Item Evidence</CardTitle>
            <CardDescription className="text-xs">
              {items.length} item · registrasi melalui modul Evidence (menu 03)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada item {kase.authorizationRef ? '' : '— dan tidak bisa ditambahkan sebelum otorisasi terisi.'}
              </p>
            )}
            {items.map(e => (
              <div key={e.id}
                className="flex cursor-pointer items-center gap-3 rounded-sm border border-border px-3 py-2.5 hover:bg-accent"
                onClick={() => router.push(`/evidence/detail?id=${e.id}`)}>
                <span className="font-mono text-xs text-primary">{e.itemNo}</span>
                <span className="flex-1 truncate text-sm">{e.label}</span>
                <span className="hidden font-mono text-[10px] text-muted-foreground sm:block">
                  custodian: {selectCustodianLabel(st, e.id)}
                </span>
                <Badge variant="outline" className="font-mono text-[9px] uppercase">{e.status}</Badge>
                <Box className="size-3.5 text-muted-foreground" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Separator />

        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Dibuka {formatUTC(kase.occurredAt)} · dicatat {formatUTC(kase.recordedAt)} ·
          {' '}penomoran permanen — kasus ini tidak dapat dihapus, hanya ditutup (konstitusi #1)
        </p>
      </div>

      {/* Dialog status dengan alasan wajib (FR-M1-04 / INV-20) */}
      <Dialog open={!!statusDialog} onOpenChange={o => !o && setStatusDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {statusDialog === 'active' && 'Aktifkan kasus'}
              {statusDialog === 'closed' && 'Tutup kasus'}
              {statusDialog === 'reopen' && 'Buka kembali kasus'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Transisi status tervalidasi tabel TRANSITIONS (CC-20) dan ter-audit wajib (INV-19).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {statusDialog === 'closed' && (
              <div className="space-y-1.5">
                <label className={LABEL}>Alasan penutupan * (wajib — INV-20)</label>
                <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="mis. Laporan final diserahkan; seluruh evidence dikembalikan." />
              </div>
            )}
            {statusDialog === 'reopen' && (
              <div className="space-y-1.5">
                <label className={LABEL}>Alasan pembukaan kembali</label>
                <Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} />
              </div>
            )}
            {statusDialog === 'active' && (
              <p className="text-xs text-muted-foreground">
                Kasus berstatus <b>aktif</b> — operasional penuh (collection, akuisisi).
              </p>
            )}
            <Issues issues={issues} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog(null)}>Batal</Button>
            <Button variant={statusDialog === 'closed' ? 'destructive' : 'default'}
              onClick={() => doSetStatus(statusDialog === 'closed' ? 'closed' : 'active')}>
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/** CC-31 — useSearchParams wajib di bawah Suspense pada static export. */
export function CaseDetailView() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <CaseDetailInner />
    </Suspense>
  );
}
