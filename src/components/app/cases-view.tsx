'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { MoreHorizontal, Plus, Printer } from 'lucide-react';

import { AppShell } from '@/components/app/app-shell';
import { useOperatorGuard } from '@/hooks/use-operator-guard';
import { canPerform, INCIDENT_TYPE_LABELS, PRIORITY_LABELS } from '@/lib/domain';
import { INCIDENT_TYPES, PRIORITIES, type Uuid } from '@/lib/types';
import { toUTC } from '@/lib/time';
import { useVestigium, type Issue } from '@/store/use-vestigium';
import { selectEvidenceOfCase, selectPersonName } from '@/store/selectors';

const LABEL = 'text-[10px] font-mono uppercase tracking-widest text-muted-foreground';
const TH = 'font-mono text-[10px] uppercase';

const CASE_STATUS_FILTER = {
  all: 'Semua status', open: 'Open', active: 'Aktif', closed: 'Ditutup',
} as const;

function Issues({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <div className="mt-3 space-y-1">
      {issues.map((i, k) => (
        <p key={k} className="text-xs text-destructive">{i.message}</p>
      ))}
    </div>
  );
}

const caseForm = z.object({
  title: z.string().min(1, 'Judul kasus wajib diisi (FR-M1-02).'),
  incidentType: z.enum(INCIDENT_TYPES),
  priority: z.enum(PRIORITIES),
  leadDefrId: z.string().min(1, 'PIC DEFR wajib dipilih dari roster (FR-M7-02).'),
  authorizationRef: z.string().optional(),
  scope: z.string().optional(),
  description: z.string().optional(),
  occurredAt: z.string().min(1, 'Waktu pembukaan kasus wajib diisi.'),
});
type CaseForm = z.infer<typeof caseForm>;

/** Waktu lokal sekarang (wall clock) untuk default input datetime-local. */
const localNow = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function CasesView() {
  const { mounted, operator } = useOperatorGuard();
  const router = useRouter();
  const st = useVestigium();
  const { cases, persons } = st;
  const registerCase = useVestigium(s => s.registerCase);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');

  const canCreate = operator ? canPerform(operator.role, 'CASE_CREATE') : false;

  const form = useForm<CaseForm>({
    resolver: zodResolver(caseForm),
    defaultValues: {
      title: '', incidentType: 'unauthorized-access', priority: 'medium',
      leadDefrId: '', authorizationRef: '', scope: '', description: '',
      occurredAt: localNow(),
    },
  });
  const incidentType = useWatch({ control: form.control, name: 'incidentType' });
  const priority = useWatch({ control: form.control, name: 'priority' });
  const leadDefrId = useWatch({ control: form.control, name: 'leadDefrId' });

  const activePersons = persons.filter(p => p.isActive);
  const personItems = Object.fromEntries(activePersons.map(p => [p.id, p.name]));

  const filtered = cases
    .filter(c => status === 'all' || c.status === status)
    .filter(c => !q ||
      c.caseNo.toLowerCase().includes(q.toLowerCase()) ||
      c.title.toLowerCase().includes(q.toLowerCase()));

  function onSubmit(v: CaseForm) {
    setIssues([]);
    // §4.3 — occurredAt hanya dari input user lewat parser toUTC(); naive → offset lokal
    const occurredAt = toUTC(v.occurredAt);
    if (!occurredAt) {
      setIssues([{ path: 'occurredAt', message: 'Waktu pembukaan tidak valid.' }]);
      return;
    }
    const r = registerCase({
      title: v.title.trim(),
      incidentType: v.incidentType,
      priority: v.priority,
      leadDefrId: v.leadDefrId as Uuid,
      organization: '',
      authorizationRef: v.authorizationRef?.trim() || undefined,
      scope: v.scope?.trim() ?? '',
      description: v.description?.trim() ?? '',
      occurredAt,
    });
    if (!r.ok) { setIssues(r.issues); return; }
    setOpen(false);
    form.reset({ ...form.getValues(), title: '', authorizationRef: '', scope: '', description: '' });
    router.push(`/cases/detail?id=${r.data.id}`);
  }

  if (!mounted || !operator) return <div className="min-h-screen bg-background" />;

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">02 / Kasus</p>
            <h1 className="text-2xl font-semibold tracking-tight">Register Kasus</h1>
          </div>
          <Button onClick={() => { setIssues([]); setOpen(true); }} disabled={!canCreate}>
            <Plus className="size-4" /> Buka Kasus
          </Button>
        </div>

        {/* Info RBAC — FR-M1-03 & GRU-03: tombol mati + alasan */}
        {!canCreate && (
          <p className="rounded-sm border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            Mode baca — pembukaan kasus memerlukan role manager (GRU-02). Hubungi manager
            atau ganti operator aktif di Pengaturan.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Input placeholder="Cari nomor / judul kasus…" value={q}
            onChange={e => setQ(e.target.value)} className="max-w-xs" />
          <Select items={CASE_STATUS_FILTER} value={status} onValueChange={v => setStatus(v ?? 'all')}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="closed">Ditutup</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={TH}>No. Kasus</TableHead>
                  <TableHead className={TH}>Judul</TableHead>
                  <TableHead className={TH}>Insiden</TableHead>
                  <TableHead className={TH}>PIC</TableHead>
                  <TableHead className={TH}>Item</TableHead>
                  <TableHead className={TH}>Status</TableHead>
                  <TableHead className={TH}>Otorisasi</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      {cases.length === 0
                        ? 'Belum ada kasus — buka kasus pertama untuk memulai register.'
                        : 'Tidak ada kasus yang cocok dengan filter.'}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map(c => (
                  <TableRow key={c.id} className="cursor-pointer"
                    onClick={() => router.push(`/cases/detail?id=${c.id}`)}>
                    <TableCell className="font-mono text-xs text-primary">{c.caseNo}</TableCell>
                    <TableCell className="max-w-64 truncate text-sm">{c.title}</TableCell>
                    <TableCell className="text-xs">{INCIDENT_TYPE_LABELS[c.incidentType]}</TableCell>
                    <TableCell className="text-xs">{selectPersonName(st, c.leadDefrId)}</TableCell>
                    <TableCell className="font-mono text-xs">{selectEvidenceOfCase(st, c.id).length}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'active' ? 'default' : 'secondary'}
                        className="font-mono text-[9px] uppercase">{c.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {c.authorizationRef
                        ? <span className="font-mono text-[10px] text-muted-foreground">{c.authorizationRef}</span>
                        : <Badge variant="outline" className="border-destructive/50 font-mono text-[9px] text-destructive">BELUM</Badge>}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/cases/detail?id=${c.id}`)}>
                            Buka detail
                          </DropdownMenuItem>
                          {/* placeholder laporan — aktif di Sesi 9 */}
                          <DropdownMenuItem disabled>
                            <Printer className="size-3.5" /> Cetak laporan (Sesi 9)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialog buka kasus — gerbang otorisasi diisi DI SINI (FR-M1-03) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Buka Kasus Baru</DialogTitle>
            <DialogDescription className="text-xs">
              Referensi otorisasi (surat tugas / warrant) boleh diisi kemudian — TETAPI
              registrasi evidence akan DITOLAK selama kosong (S6, FR-M1-03).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className={LABEL}>Judul kasus *</label>
              <Input placeholder="mis. Dugaan akses tidak sah pada server HRD" {...form.register('title')} />
              {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <span className={LABEL}>Jenis insiden</span>
              <Select items={INCIDENT_TYPE_LABELS} value={incidentType}
                onValueChange={v => { if (v) form.setValue('incidentType', v as CaseForm['incidentType']); }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map(t => <SelectItem key={t} value={t}>{INCIDENT_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className={LABEL}>Prioritas</span>
              <Select items={PRIORITY_LABELS} value={priority}
                onValueChange={v => { if (v) form.setValue('priority', v as CaseForm['priority']); }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className={LABEL}>PIC DEFR *</span>
              <Select items={personItems} value={leadDefrId || null}
                onValueChange={v => { if (v) form.setValue('leadDefrId', v, { shouldValidate: true }); }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Dari roster…" /></SelectTrigger>
                <SelectContent>
                  {activePersons.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.leadDefrId && (
                <p className="text-xs text-destructive">{form.formState.errors.leadDefrId.message}</p>)}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="f-occurredAt" className={LABEL}>Waktu pembukaan *</label>
              <Input id="f-occurredAt" type="datetime-local" {...form.register('occurredAt')} />
              {form.formState.errors.occurredAt && (
                <p className="text-xs text-destructive">{form.formState.errors.occurredAt.message}</p>)}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className={LABEL}>Referensi otorisasi (surat tugas / warrant)</label>
              <Input placeholder="mis. ST/DF/011/2025" {...form.register('authorizationRef')} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className={LABEL}>Scope pemeriksaan</label>
              <Input placeholder="mis. Server HRD-01, media penyimpanan terkait" {...form.register('scope')} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className={LABEL}>Deskripsi insiden</label>
              <Textarea rows={3} placeholder="Kronologi singkat, ruang lingkup, sumber yang dicurigai…" {...form.register('description')} />
            </div>
            <Issues issues={issues} />
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit">Buka Kasus</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
