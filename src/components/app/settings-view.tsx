'use client';

import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Upload, ShieldAlert, Trash2, UserPlus } from 'lucide-react';

import { AppShell } from '@/components/app/app-shell';
import { useOperatorGuard } from '@/hooks/use-operator-guard';
import { canPerform, PERSON_ROLE_LABELS } from '@/lib/domain';
import { formatUTC } from '@/lib/time';
import { PERSON_ROLES, type Uuid } from '@/lib/types';
import { useVestigium, type Issue } from '@/store/use-vestigium';
import { selectChainReport } from '@/store/selectors';
import type { ChainReport } from '@/lib/types';
import type { ParsedBackup } from '@/lib/schemas';

const LABEL = 'text-[10px] font-mono uppercase tracking-widest text-muted-foreground';
const TH = 'font-mono text-[10px] uppercase';

function Issues({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <Alert variant="destructive" className="mt-3">
      <AlertDescription className="text-xs">
        {issues.map((i, k) => <p key={k}>{i.message}</p>)}
      </AlertDescription>
    </Alert>
  );
}

const personForm = z.object({
  name: z.string().min(1, 'Nama wajib diisi — tampil di seluruh dokumen (FR-M7-04).'),
  email: z.string().email('Email valid wajib — ia adalah identitas masuk (gerbang login).'),
  role: z.enum(PERSON_ROLES),
  organization: z.string().optional(),
  credentials: z.string().optional(),
});
type PersonForm = z.infer<typeof personForm>;

const orgForm = z.object({ orgName: z.string(), orgUnit: z.string() });
type OrgForm = z.infer<typeof orgForm>;

type PendingImport = { backup: ParsedBackup; chainReport: ChainReport };

export function SettingsView() {
  const { mounted, operator } = useOperatorGuard();
  const st = useVestigium();
  const { persons, settings } = st;
  const chain = selectChainReport(st);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const canManage = operator ? canPerform(operator.role, 'PERSON_ADD') : false;
  const canImport = operator ? canPerform(operator.role, 'IMPORT') : false;
  const canWipe = operator ? canPerform(operator.role, 'WIPE') : false;

  const form = useForm<PersonForm>({
    resolver: zodResolver(personForm),
    defaultValues: { name: '', email: '', role: 'defr', organization: '', credentials: '' },
  });
  const roleValue = useWatch({ control: form.control, name: 'role' });
  const org = useForm<OrgForm>({
    resolver: zodResolver(orgForm),
    defaultValues: { orgName: settings.orgName, orgUnit: settings.orgUnit },
  });

  const report = (r: { ok: true } | { ok: false; issues: Issue[] }, msg: string) => {
    setIssues([]);
    if (r.ok) setOkMsg(msg); else { setOkMsg(null); setIssues(r.issues); }
  };

  /* --- Ekspor: Blob download — bukan request jaringan (§4.7) --- */
  const fileRef = useRef<HTMLInputElement>(null);
  function onExport() {
    const b = st.exportBackup();
    const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vestigium-backup-${b.exportedAt.replace(/\D/g, '').slice(0, 14)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setOkMsg(`Backup diunduh — chain tip ${b.chainTip.slice(0, 16)}…`);
  }

  /* --- Impor: parse → preview → konfirmasi (FR-M10-03 deny-by-default) --- */
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [pendingRaw, setPendingRaw] = useState<unknown>(null);
  function onImportFile(f: File) {
    setIssues([]); setOkMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw: unknown = JSON.parse(String(reader.result));
        const r = st.parseBackup(raw);
        if (!r.ok) { setIssues(r.issues); return; }
        setPendingRaw(raw);
        setPendingImport({ backup: r.backup, chainReport: r.chainReport });   // preview dulu — belum diterapkan
      } catch {
        setIssues([{ path: '', message: 'Berkas bukan JSON yang valid.' }]);
      }
    };
    reader.readAsText(f);
  }
  function confirmImport() {
    if (!pendingImport) return;
    const r = st.applyBackup(pendingRaw);
    setPendingImport(null); setPendingRaw(null);
    report(r, 'Backup diterapkan — register diganti penuh, aksi IMPORT tercatat di audit.');
  }

  /* --- Wipe: ketik HAPUS (D-16 konfirmasi berjenjang L2) --- */
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeWord, setWipeWord] = useState('');
  function confirmWipe() {
    const r = st.wipeAll();
    setWipeOpen(false); setWipeWord('');
    report(r, 'Database baru dibuat — jejak WIPE bertahan di audit.');
  }

  if (!mounted || !operator) return <div className="min-h-screen bg-background" />;

  const activePersons = persons.filter(p => p.isActive);
  const personItems = Object.fromEntries(
    activePersons.map(p => [p.id, `${p.name} — ${PERSON_ROLE_LABELS[p.role]}`]));

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">07 / Pengaturan</p>
          <h1 className="text-2xl font-semibold tracking-tight">Pengaturan Sistem</h1>
        </div>

        {okMsg && <Alert><AlertTitle className="text-sm">{okMsg}</AlertTitle></Alert>}
        <Issues issues={issues} />

        {/* Operator aktif — subjek RBAC (GRU-04) */}
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-widest">Operator Aktif</CardTitle>
            <CardDescription className="text-xs">
              Menentukan aktor semua pencatatan &amp; hak akses (canPerform). Pengaturan terakhir: {formatUTC(settings.recordedAt)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select items={personItems} value={settings.defaultExaminerId ?? null}
              onValueChange={v => {
                if (!v) return;
                report(st.updateSettings({ defaultExaminerId: v as Uuid }), 'Operator aktif diganti.');
              }}>
              <SelectTrigger className="w-full sm:w-80"><SelectValue placeholder="Pilih personel…" /></SelectTrigger>
              <SelectContent>
                {activePersons.map(p => (
                  <SelectItem key={p.id} value={p.id}>{personItems[p.id]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Roster — FR-M7 */}
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-widest">Roster Personel</CardTitle>
            <CardDescription className="text-xs">
              {canManage ? 'Tambah & nonaktifkan personel. Yang sudah terekam event tidak dapat dihapus (INV-18).'
                : 'Mode baca — hanya manager yang berwenang mengelola roster (GRU-03).'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={TH}>Nama</TableHead>
                  <TableHead className={TH}>Email</TableHead>
                  <TableHead className={TH}>Peran</TableHead>
                  <TableHead className={TH}>Status</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {persons.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.email ?? '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-[9px]">{PERSON_ROLE_LABELS[p.role]}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? 'default' : 'secondary'} className="font-mono text-[9px]">
                        {p.isActive ? 'AKTIF' : 'NONAKTIF'}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        {p.isActive && p.id !== settings.defaultExaminerId && (
                          <Button variant="ghost" size="sm"
                            onClick={() => report(st.deactivatePerson(p.id), `${p.name} dinonaktifkan.`)}>
                            Nonaktifkan
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {canManage && (
              <form onSubmit={form.handleSubmit(v => {
                const r = st.addPerson({
                  name: v.name.trim(), email: v.email.trim().toLowerCase(),
                  role: v.role, organization: v.organization?.trim() ?? '',
                  credentials: v.credentials?.trim() ?? '', isActive: true,
                });
                report(r, `${v.name.trim()} ditambahkan ke roster.`);
                if (r.ok) form.reset();
              })} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="p-name" className={LABEL}>Nama *</label>
                  <Input id="p-name" placeholder="mis. A. Ramadhan, DEFR" {...form.register('name')} />
                  {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-1">
                  <label htmlFor="p-email" className={LABEL}>Email (identitas masuk) *</label>
                  <Input id="p-email" type="email" placeholder="nama@organisasi.go.id" {...form.register('email')} />
                  {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
                </div>
                <div className="space-y-1">
                  <span className={LABEL}>Peran</span>
                  <Select items={PERSON_ROLE_LABELS} value={roleValue}
                    onValueChange={v => { if (v) form.setValue('role', v); }}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PERSON_ROLES.map(r => <SelectItem key={r} value={r}>{PERSON_ROLE_LABELS[r]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="p-cred" className={LABEL}>Kredensial</label>
                  <Input id="p-cred" placeholder="mis. DEFR, CHFI" {...form.register('credentials')} />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" size="sm"><UserPlus className="size-4" /> Tambah Personel</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Identitas unit */}
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-widest">Identitas Unit</CardTitle>
            <CardDescription className="text-xs">Tampil pada kop seluruh laporan cetak (M9).</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2"
              onSubmit={org.handleSubmit(v =>
                report(st.updateSettings({ orgName: v.orgName.trim(), orgUnit: v.orgUnit.trim() }),
                  'Identitas unit tersimpan.'))}>
              <Input placeholder="Nama organisasi" aria-label="Nama organisasi" {...org.register('orgName')} />
              <Input placeholder="Unit (mis. Unit Forensik Digital)" aria-label="Unit" {...org.register('orgUnit')} />
              <div className="sm:col-span-2">
                <Button type="submit" size="sm" variant="outline" disabled={!canManage}>Simpan Identitas</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Backup — FR-M10-02/03 */}
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-widest">Data &amp; Backup</CardTitle>
            <CardDescription className="text-xs font-mono">
              Rantai audit: {chain.valid ? 'VALID' : `PUTUS di seq ${chain.firstBrokenSeq}`} · {chain.total} entri · tip {chain.tip.slice(0, 20)}…
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button size="sm" onClick={onExport}><Download className="size-4" /> Ekspor JSON</Button>
            <Button size="sm" variant="outline" disabled={!canImport} onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Impor JSON
            </Button>
            <input ref={fileRef} type="file" accept="application/json" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ''; }} />
          </CardContent>
        </Card>

        {/* Zona berbahaya — konfirmasi berjenjang L2 (D-16) */}
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-destructive">
              <ShieldAlert className="size-4" /> Zona Berbahaya
            </CardTitle>
            <CardDescription className="text-xs">
              Hapus seluruh register. Jejak WIPE tetap tercatat di database baru; penomoran mulai dari 1 (DATA §6).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="destructive" disabled={!canWipe} onClick={() => setWipeOpen(true)}>
              <Trash2 className="size-4" /> Hapus Semua Data
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Dialog konfirmasi impor — preview sebelum timpa */}
      <AlertDialog open={!!pendingImport} onOpenChange={o => { if (!o) { setPendingImport(null); setPendingRaw(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Terapkan backup ini?</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs">
              {pendingImport && (
                `Kasus: ${pendingImport.backup.counts.cases} · Evidence: ${pendingImport.backup.counts.evidence} · Custody: ${pendingImport.backup.counts.custody} · ` +
                `Rantai audit ${pendingImport.chainReport.valid ? 'VALID' : `PUTUS di seq ${pendingImport.chainReport.firstBrokenSeq}`} — ekspor ${pendingImport.backup.exportedAt}`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-xs text-destructive">Seluruh data saat ini akan DIGANTI. Aksi ini tercatat di audit.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImport}>Ya, Terapkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog wipe — ketik HAPUS */}
      <AlertDialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Hapus seluruh data?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Ketik <span className="font-mono font-bold text-destructive">HAPUS</span> untuk mengonfirmasi. Tindakan tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={wipeWord} onChange={e => setWipeWord(e.target.value)} placeholder="HAPUS" aria-label="Konfirmasi HAPUS" />
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <Button variant="destructive" size="sm" disabled={wipeWord !== 'HAPUS'} onClick={confirmWipe}>
              Hapus Permanen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
