'use client';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

/** Kontrak visual §2: mono = sesuatu yang bisa diverifikasi ulang. */
export function HashBox({ label, hash, sub }: { label: string; hash: string; sub?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-sm border border-border bg-background p-3.5 pr-11">
      <div className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}{sub && <span className="normal-case"> · {sub}</span>}
      </div>
      <p className="break-all font-mono text-xs leading-relaxed text-primary">{hash}</p>
      <button
        className="absolute right-2 top-2 rounded-sm border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-primary"
        onClick={() => navigator.clipboard?.writeText(hash).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })}
        title="Salin hash">
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
