'use client';
import { AppShell } from '@/components/app/app-shell';

/** Stub modul — menjaga sidebar tidak mati-link sampai sesi terkait dibangun. */
export function ModulePlaceholder({ no, title, sesi }: { no: string; title: string; sesi: number }) {
  return (
    <AppShell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {no} / Modul menyusul
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Dibangun pada Sesi {sesi} — kontrak fitur lihat FEATURE.md.</p>
      </div>
    </AppShell>
  );
}
