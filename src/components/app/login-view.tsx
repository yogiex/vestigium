'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Fingerprint, Lock, Database } from 'lucide-react';

import { useHasMounted } from '@/hooks/use-has-mounted';
import { useVestigium } from '@/store/use-vestigium';
import { formatUTC, nowUTC } from '@/lib/time';

const loginSchema = z.object({
  email: z.string().email('Masukkan alamat email yang valid.'),
});
type LoginForm = z.infer<typeof loginSchema>;

const setupSchema = loginSchema.extend({
  name: z.string().min(1, 'Nama wajib diisi — ia akan tampil di seluruh dokumen (FR-M7-04).'),
});
type SetupForm = z.infer<typeof setupSchema>;

const FEATURES = [
  { icon: ShieldCheck, t: 'Selaras ISO/IEC 27037:2012',
    d: 'Identification · Collection · Acquisition · Preservation' },
  { icon: Fingerprint, t: 'Append-only & hash-chained',
    d: 'Catatan proses tidak dapat diedit — tampering terdeteksi' },
  { icon: Database, t: 'Nol byte keluar perangkat',
    d: 'Seluruh register residensial di perangkat ini — zero outbound' },
] as const;

/* Kolom kiri: identitas produk — statis, tanpa state domain */
function BrandPanel() {
  const [now, setNow] = useState<string>('--:--:--');
  useEffect(() => {
    // Jam UTC tampilan — sumber waktu tetap lib/time (satu sumber jam, §4.3)
    const tick = () => setNow(formatUTC(nowUTC()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative hidden flex-col justify-between bg-card p-10 lg:flex">
      {/* pita hazard — hanya di sini & kop laporan (DESIGN §3.3) */}
      <div className="absolute inset-x-0 top-0 h-1 bg-[repeating-linear-gradient(-45deg,var(--color-amber-500)_0_11px,#111_11px_22px)]" />
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          VESTI<span className="text-primary">GIUM</span>
        </h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Digital Forensic Record System
        </p>
        <p className="mt-8 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Membangun sistem untuk satu tujuan: menjaga nilai pembuktian bukti digital
          sampai ke persidangan. Setiap tindakan terhadap bukti tercatat serentak,
          append-only, dan dapat direkonstruksi pihak ketiga.
        </p>
      </div>
      <ul className="space-y-5">
        {FEATURES.map(f => (
          <li key={f.t} className="flex gap-3">
            <f.icon className="mt-0.5 size-4 text-primary" />
            <div>
              <div className="text-sm font-medium text-foreground">{f.t}</div>
              <div className="text-xs text-muted-foreground">{f.d}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="font-mono text-xs text-muted-foreground">
        {now} <span className="text-primary">UTC</span> · WAKTU FORENSIK
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

const LABEL_CLASS = 'text-xs font-medium uppercase tracking-wide text-muted-foreground';

export function LoginView() {
  const mounted = useHasMounted();
  const router = useRouter();
  const persons = useVestigium(s => s.persons);
  const activeId = useVestigium(s => s.settings.defaultExaminerId);
  const addPerson = useVestigium(s => s.addPerson);
  const updateSettings = useVestigium(s => s.updateSettings);

  const [error, setError] = useState<string | null>(null);
  const firstRun = mounted && persons.length === 0;

  /* Sudah masuk → langsung ke dashboard */
  useEffect(() => {
    if (mounted && activeId) router.replace('/');
  }, [mounted, activeId, router]);

  const login = useForm<LoginForm>({ resolver: zodResolver(loginSchema),
    defaultValues: { email: '' } });
  const setup = useForm<SetupForm>({ resolver: zodResolver(setupSchema),
    defaultValues: { name: '', email: '' } });

  function onLogin(v: LoginForm) {
    // Gerbang identitas (bukan autentikasi): email harus cocok roster — deny-by-default (§4.6)
    const email = v.email.trim().toLowerCase();
    const person = persons.find(p => p.email === email);
    if (!person) {
      setError(`Email "${email}" tidak terdaftar pada roster — akses ditolak (deny-by-default). Hubungi manager untuk pendaftaran personel.`);
      return;
    }
    if (!person.isActive) {
      setError(`Akun "${person.name}" telah dinonaktifkan — hubungi manager (INV-18).`);
      return;
    }
    const r = updateSettings({ defaultExaminerId: person.id });
    if (!r.ok) { setError(r.issues[0]?.message ?? 'Gagal mengatur operator.'); return; }
    router.replace('/');
  }

  function onSetup(v: SetupForm) {
    /* First-run: BOOTSTRAP_ACTIONS mengizinkan PERSON_ADD & SETTINGS tanpa operator (lib/domain) */
    const r = addPerson({ name: v.name.trim(), email: v.email.trim().toLowerCase(),
      role: 'defr-manager', organization: '', credentials: '', isActive: true });
    if (!r.ok) { setError(r.issues[0]?.message ?? 'Gagal menambahkan.'); return; }
    const s = updateSettings({ defaultExaminerId: r.data.id });
    if (!s.ok) { setError(s.issues[0]?.message ?? 'Gagal mengatur operator.'); return; }
    router.replace('/');
  }

  if (!mounted) return <div className="min-h-screen bg-background" />;   // CC-33

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <BrandPanel />
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {firstRun ? 'Penyiapan Pertama' : 'Masuk'}
            </CardTitle>
            <CardDescription>
              {firstRun
                ? 'Roster masih kosong — buat akun manager pertama. Akun ini berwenang mengatur personel & kasus (GRU-02).'
                : 'Masuk dengan email terdaftar pada roster personel.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs leading-relaxed">{error}</AlertDescription>
              </Alert>
            )}

            {firstRun ? (
              <form onSubmit={setup.handleSubmit(onSetup)} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="name" className={LABEL_CLASS}>Nama lengkap</label>
                  <Input id="name" placeholder="mis. S. Pratama, DES" {...setup.register('name')} />
                  <FieldError message={setup.formState.errors.name?.message} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="email" className={LABEL_CLASS}>Email</label>
                  <Input id="email" type="email" placeholder="nama@organisasi.go.id" {...setup.register('email')} />
                  <FieldError message={setup.formState.errors.email?.message} />
                </div>
                <Button type="submit" className="w-full">
                  <Lock className="size-4" /> Buat Akun &amp; Masuk
                </Button>
              </form>
            ) : (
              <form onSubmit={login.handleSubmit(onLogin)} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className={LABEL_CLASS}>Email</label>
                  <Input id="email" type="email" placeholder="nama@organisasi.go.id"
                    autoFocus {...login.register('email')} />
                  <FieldError message={login.formState.errors.email?.message} />
                </div>
                <Button type="submit" className="w-full">
                  <Lock className="size-4" /> Masuk
                </Button>
              </form>
            )}

            <p className="pt-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Gerbang identitas · bukan autentikasi jaringan · perangkat ini zona kontrol Anda
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
