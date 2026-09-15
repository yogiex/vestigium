/* ================================================================
 * lib/format.ts — utilitas formatasi murni (tanpa React/DOM, CC-02/03)
 * CSV export (Sesi 9) — testable per CC-49.
 * ================================================================ */

/** CSV audit — RFC4180: quote semua field, escape "", BOM utk Excel. */
export function toAuditCsv(events: readonly {
  seq: number; at: string; actor: string; action: string; target: string; detail: string;
}[]): string {
  const q = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = ['seq,waktu_utc,aktor,aksi,target,detail',
    ...events.map(e => [e.seq, e.at, e.actor, e.action, e.target, e.detail].map(q).join(','))];
  return '\ufeff' + lines.join('\r\n');
}
