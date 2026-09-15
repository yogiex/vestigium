'use client';
import { ShieldCheck, ShieldX } from 'lucide-react';

/** Stempel integritas — HANYA di Lab & verifikasi (DESIGN §3.3). Hijau/merah sesuai hukum warna. */
export function Stamp({ verdict }: { verdict: 'verified' | 'failure' }) {
  const ok = verdict === 'verified';
  return (
    <span className={`stamp-base animate-in zoom-in-95 duration-300 ${ok ? 'text-success' : 'text-destructive'}`}>
      <span className="mr-2 inline-block align-middle">{ok ? <ShieldCheck className="size-5" /> : <ShieldX className="size-5" />}</span>
      INTEGRITY {ok ? 'VERIFIED' : 'FAILURE'}
    </span>
  );
}
