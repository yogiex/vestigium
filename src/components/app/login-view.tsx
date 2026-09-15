'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  ArrowRight, Database, Fingerprint, Loader2, Lock, Mail, ShieldCheck, UserPlus,
} from 'lucide-react';

import { useHasMounted } from '@/hooks/use-has-mounted';
import { DEMO_ACCOUNTS } from '@/lib/demo';
import { formatUTC, nowUTC } from '@/lib/time';
import { useVestigium } from '@/store/use-vestigium';

const loginSchema = z.object({
  email: z.string().email('Masukkan alamat email yang valid.'),
});
type LoginForm = z.infer<typeof loginSchema>;

const setupSchema = loginSchema.extend({
  name: z.string().min(1, 'Nama wajib diisi — ia akan tampil di seluruh dokumen (FR-M7-04).'),
});
type SetupForm = z.infer<typeof setupSchema>;

/* ================= PANEL KIRI — identitas produk (solid, tahan tema) ================= */

function BrandPanel() {
  const [now, setNow] = useState('--:--:--');
  useEffect(() => {
    const tick = () => setNow(formatUTC(nowUTC()).slice(11, 19));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative hidden overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col lg:justify-between">
      {/* lapisan dekoratif — CSS murni, tidak bergantung blur/transparansi */}
      <div className="pointer-events-none absolute inset-0
        bg-[radial-gradient(ellipse_55%_38%_at_18%_0%,hsl(40_87%_55%/0.12),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.30]
        bg-[radial-gradient(hsl(240_5%_22%)_1px,transparent_1px)] [background-size:22px_22px]" />
      <Fingerprint className="pointer-events-none absolute -bottom-16 -right-16 size-72 text-primary opacity-[0.05]" />
      <div className="hazard-band absolute inset-x-0 top-0 h-1" />

      <div className="relative z-10 p-12">
        <div className="flex items-center gap-3.5">
          <div className="flex size-12 items-center justify-center rounded-sm bg-primary text-primary-foreground
            shadow-[0_0_40px_-8px_hsl(40_87%_55%/0.65)]">
            <Fingerprint className="size-7" />
          </div>
          <div>
            <div className="text-2xl font-bold leading-none tracking-tight text-foreground">
              VESTI<span className="text-primary">GIUM</span>
            </div>
            <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.26em] text-muted-foreground">
              Digital Forensic Record System
            </div>
          </div>
        </div>

        <p className="mt-14 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Bukti digital jarang gugur karena isinya salah — ia gugur karena
          <span className="font-medium text-foreground"> prosesnya tidak bisa dibuktikan</span>.
          Vestigium menjaga nilai pembuktian itu sampai ke persidangan:
          setiap tindakan tercatat serentak, append-only, dan dapat direkonstruksi
          siapa pun — tanpa kehadiran operator aslinya.
        </p>
      </div>

      <div className="relative z-10 space-y-3 px-12">
        {[
          { icon: ShieldCheck, t: 'Selaras ISO/IEC 27037:2012',
            d: 'Identification · Collection · Acquisition · Preservation' },
          { icon: Fingerprint, t: 'Append-only & hash-chained',
            d: 'Catatan proses tak terhapus — tampering terdeteksi, bukan disembunyikan' },
          { icon: Database, t: 'Nol byte keluar perangkat',
            d: 'Register residensial lokal — tanpa satu pun request jaringan' },
        ].map(f => (
          <div key={f.t} className="flex items-start gap-4 rounded-sm border border-border bg-card p-4">
            <div className="mt-0.5 rounded-sm border border-primary/30 bg-primary/10 p-2 text-primary">
              <f.icon className="size-4" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">{f.t}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{f.d}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative z-10 flex items-center justify-between px-12 py-6
        font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{now} <span className="text-primary">UTC</span> · waktu forensik</span>
        <span>lapisan 1 · prototipe</span>
      </div>
    </div>
  );
}

/* ================= VIEW ================= */

export function LoginView() {
  const mounted = useHasMounted();
  const router = useRouter();
  const persons = useVestigium(s => s.persons);
  const settings = useVestigium(s => s.settings);
  const addPerson = useVestigium(s => s.addPerson);
  const updateSettings = useVestigium(s => s.updateSettings);
  const seedDemo = useVestigium(s => s.seedDemo);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const firstRun = mounted && persons.length === 0;
  const isDemo = mounted && persons.some(p => p.email?.endsWith('@vestigium.demo'));

  useEffect(() => {
    if (mounted && settings.defaultExaminerId) router.replace('/');
  }, [mounted, settings.defaultExaminerId, router]);

  const login = useForm<LoginForm>({
    resolver: zodResolver(loginSchema), defaultValues: { email: '' } });
  const setup = useForm<SetupForm>({
    resolver: zodResolver(setupSchema), defaultValues: { name: '', email: '' } });

  function onLogin(v: LoginForm) {
    setError(null);
    setPending(true);
    window.setTimeout(() => {
      setPending(false);
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
      updateSettings({ defaultExaminerId: person.id });
      router.replace('/');
    }, 400);
  }

  function onSetup(v: SetupForm) {
    setError(null);
    const r = addPerson({ name: v.name.trim(), email: v.email.trim().toLowerCase(),
      role: 'defr-manager', organization: '', credentials: '', isActive: true });
    if (!r.ok) { setError(r.issues[0]?.message ?? 'Gagal menambahkan.'); return; }
    const s = useVestigium.getState().updateSettings({ defaultExaminerId: r.data.id });
    if (!s.ok) { setError(s.issues[0]?.message ?? 'Gagal mengatur operator.'); return; }
    router.replace('/');
  }

  if (!mounted) return <div className="min-h-screen bg-background" />;

  return (
    /* wrapper eksplisit — kontras dasar dijamin meski sebuah token bermasalah */
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <div className="relative flex flex-col items-center justify-center px-6 py-12">
        {/* logo mini — mobile */}
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <div className="flex size-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <Fingerprint className="size-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            VESTI<span className="text-primary">GIUM</span>
          </span>
        </div>

        <div className="w-full max-w-[400px]">
          <Badge variant="outline"
            className="mb-5 border-primary/40 bg-primary/10 font-mono text-[9px] uppercase tracking-[0.18em] text-primary">
            {firstRun ? 'Penyiapan awal' : 'Gerbang identitas'}
          </Badge>
          <h1 className="text-[2rem] font-semibold leading-tight tracking-tight">
            {firstRun ? 'Buat akun manager' : 'Selamat datang kembali'}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {firstRun
              ? 'Roster masih kosong. Akun pertama berperan manager — berwenang mengatur personel, kasus, dan seluruh kebijakan (GRU-02).'
              : 'Masuk dengan email yang terdaftar pada roster personel. Setiap sesi tercatat di audit trail.'}
          </p>

          <div className="mt-8">
            {error && (
              <Alert variant="destructive" key={error} className="mb-5">
                <AlertDescription className="text-xs leading-relaxed">{error}</AlertDescription>
              </Alert>
            )}

            {firstRun ? (
              <form onSubmit={setup.handleSubmit(onSetup)} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="name"
                    className="text-[10px] font-mono font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Nama lengkap
                  </label>
                  <Input id="name" placeholder="mis. S. Pratama, DES" className="h-11"
                    {...setup.register('name')} />
                  {setup.formState.errors.name && (
                    <p className="text-xs text-destructive">{setup.formState.errors.name.message}</p>)}
                </div>
                <div className="space-y-2">
                  <label htmlFor="setup-email"
                    className="text-[10px] font-mono font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Email — identitas masuk
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="setup-email" type="email" placeholder="nama@organisasi.go.id"
                      className="h-11 pl-9" {...setup.register('email')} />
                  </div>
                  {setup.formState.errors.email && (
                    <p className="text-xs text-destructive">{setup.formState.errors.email.message}</p>)}
                </div>
                <Button type="submit" size="lg" className="w-full gap-2 font-medium">
                  <UserPlus className="size-4" /> Buat Akun &amp; Masuk
                </Button>

                <div className="flex items-center gap-3 pt-2">
                  <Separator className="flex-1" />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">atau</span>
                  <Separator className="flex-1" />
                </div>
                <Button type="button" variant="outline" size="lg" className="w-full"
                  onClick={() => { const r = seedDemo(); if (r.ok) router.replace('/'); }}>
                  Muat Data Demo
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    (prototipe · D-13)
                  </span>
                </Button>
              </form>
            ) : (
              <form onSubmit={login.handleSubmit(onLogin)} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="login-email"
                    className="text-[10px] font-mono font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="login-email" type="email" placeholder="nama@organisasi.go.id"
                      className="h-11 pl-9" autoFocus {...login.register('email')} />
                  </div>
                  {login.formState.errors.email && (
                    <p className="text-xs text-destructive">{login.formState.errors.email.message}</p>)}
                </div>
                <Button type="submit" size="lg" className="w-full gap-2 font-medium" disabled={pending}>
                  {pending
                    ? <Loader2 className="size-4 animate-spin" />
                    : <Lock className="size-4" />}
                  {pending ? 'Memeriksa roster…' : 'Masuk'}
                  {!pending && <ArrowRight className="size-4 opacity-60" />}
                </Button>
              </form>
            )}
          </div>

          {/* Chip akun demo — klik untuk mengisi */}
          {isDemo && !firstRun && (
            <div className="mt-10">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  Akun demo · klik untuk mengisi
                </span>
                <Badge variant="secondary" className="font-mono text-[8px]">tanpa password</Badge>
              </div>
              <div className="grid gap-2">
                {DEMO_ACCOUNTS.map(a => (
                  <button key={a.email} type="button"
                    onClick={() => {
                      login.setValue('email', a.email, { shouldValidate: true });
                      setError(null);
                    }}
                    className="group flex items-center justify-between rounded-sm border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:border-primary/60 hover:bg-accent">
                    <span className="font-mono text-xs text-primary">{a.email}</span>
                    <span className="max-w-44 truncate text-[10px] text-muted-foreground group-hover:text-foreground">
                      {a.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-12 text-center font-mono text-[9px] uppercase leading-loose tracking-[0.16em] text-muted-foreground">
            Gerbang identitas · bukan autentikasi jaringan
            <br />perangkat ini adalah zona kontrol Anda · nol byte keluar
          </p>
        </div>
      </div>
    </div>
  );
}
