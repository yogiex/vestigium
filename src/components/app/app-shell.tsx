'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard, FolderClosed, Box, ArrowRightLeft,
  Fingerprint, ScrollText, Settings, LogOut, Menu,
} from 'lucide-react';

import { useOperatorGuard } from '@/hooks/use-operator-guard';
import { PERSON_ROLE_LABELS } from '@/lib/domain';
import { formatUTC, nowUTC } from '@/lib/time';
import { useVestigium } from '@/store/use-vestigium';

/** NAV — satu-satunya sumber navigasi; route yang belum dibangun = placeholder (Sesi berjalan). */
const NAV = [
  { href: '/',         label: 'Ringkasan',     icon: LayoutDashboard },
  { href: '/cases',    label: 'Kasus',         icon: FolderClosed },
  { href: '/evidence', label: 'Evidence',      icon: Box },
  { href: '/custody',  label: 'Custody',       icon: ArrowRightLeft },
  { href: '/lab',      label: 'Integrity Lab', icon: Fingerprint },
  { href: '/audit',    label: 'Audit Log',     icon: ScrollText },
  { href: '/settings', label: 'Pengaturan',    icon: Settings },
] as const;

const HAZARD = 'bg-[repeating-linear-gradient(-45deg,var(--color-amber-500)_0_8px,#111_8px_16px)]';

/** Jam UTC tampilan — pengecualian tertutup §6; sumber waktu tetap lib/time (§4.3). */
function UtcClock() {
  const [now, setNow] = useState('--:--:--');
  useEffect(() => {
    const tick = () => setNow(formatUTC(nowUTC()).slice(11, 19));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-xs text-primary">
      {now} <span className="text-muted-foreground">UTC</span>
    </span>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return (
    <nav className="space-y-0.5">
      {NAV.map((item, i) => {
        const active = clean === item.href;
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate}
            className={`flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors
              ${active
                ? 'border-l-2 border-primary bg-accent font-medium text-foreground'
                : 'border-l-2 border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
            <span className="w-5 font-mono text-[10px] text-muted-foreground">
              {String(i + 1).padStart(2, '0')}
            </span>
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { mounted, operator } = useOperatorGuard();
  const pathname = usePathname();
  const router = useRouter();
  const signOut = useVestigium(s => s.signOut);
  const [open, setOpen] = useState(false);

  if (!mounted || !operator) return <div className="min-h-screen bg-background" />;  // CC-33

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card print:hidden md:flex">
        <div className="border-b px-5 py-4">
          <div className="text-lg font-bold tracking-tight text-foreground">
            VESTI<span className="text-primary">GIUM</span>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            ISO/IEC 27037 · Digital Evidence
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks pathname={pathname} />
        </div>
        <div className="border-t px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          Zero outbound · lokal
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 print:hidden lg:px-6">
          <div className="flex items-center gap-3">
            {/* hazard band — DESIGN §3.3: hanya di sini & kop laporan */}
            <span className={`hidden h-1 w-16 sm:block ${HAZARD}`} />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Vesti<span className="text-primary">gium</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <UtcClock />
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight text-foreground">{operator.name}</div>
              <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                {PERSON_ROLE_LABELS[operator.role]}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" aria-label="Keluar"
              onClick={() => { signOut(); router.replace('/login'); }}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <div className="border-b bg-card px-4 py-2 print:hidden md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="outline" size="sm" />}>
              <Menu className="size-4" /> Menu
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4">
              <SheetTitle className="text-base font-bold">VESTIGIUM</SheetTitle>
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
        <main className="flex-1 p-4 print:p-0 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
