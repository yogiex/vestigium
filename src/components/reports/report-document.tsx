/* ================================================================
 * components/reports/report-document.tsx — Kertas A4 print-parity (CC-28)
 * Sesi 9 · FR-M9-01 ·FR-M9-04
 * TANPA 'use client' — murni presentasional, data via props.
 * ================================================================ */

import type { CaseReportData } from '@/store/selectors';
import type { CustodyEventType, OffsetISO } from '@/lib/types';

import {
  CASE_STATUS_LABELS, CUSTODY_TYPE_LABELS, INCIDENT_TYPE_LABELS,
  ITEM_STATUS_LABELS, MEDIUM_LABELS, PRIORITY_LABELS, VERIFY_RESULT_LABELS,
} from '@/lib/domain';
import { formatUTC } from '@/lib/time';

export interface CustodyRow {
  id: string;
  occurredAt: OffsetISO;
  itemNo: string;
  type: CustodyEventType;
  from: string;
  to: string;
  reason: string;
}

/**
 * Kertas A4 print-parity — TANPA state & TANPA 'use client':
 * seluruh data via props (CC-28). Tema light-paper dari globals.css.
 */
export function ReportDocument({ data, custodyRows, picName, docId, generatedAt, examinerName }: {
  data: CaseReportData;
  custodyRows: CustodyRow[];
  picName: string;
  docId: string;
  generatedAt: string;
  examinerName: string;
}) {
  const { kase: c, items, integrity, incidents, chainTipHex, totals } = data;

  const D = (k: string, v: string) => (
    <div className="break-words"><b className="inline-block w-44 text-[#555]">{k}</b>{v || '—'}</div>
  );

  return (
    <article className="mx-auto w-full max-w-[860px] bg-background p-10 text-foreground shadow-lg sm:p-14 print:p-0">
      {/* Kop + hazard band — DESIGN §3.3 */}
      <div className="mb-5 h-1 bg-[repeating-linear-gradient(-45deg,var(--color-amber-500)_0_8px,#111_8px_16px)]" />
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {c.organization || 'Unit Forensik Digital'}
      </div>
      <h1 className="mt-2 text-2xl font-bold leading-tight">
        Laporan Akuisisi &amp; Preservasi Evidence Digital
      </h1>
      <div className="mt-1 border-b-2 border-primary pb-3 font-mono text-[11px] text-muted-foreground">
        Ref: {c.caseNo} · DOC-ID: {docId} · Dibangkitkan {generatedAt} · Selaras ISO/IEC 27037:2012
      </div>

      {/* §1 Ringkasan kasus — otorisasi = jawaban A1 */}
      <h2 className="mt-8 font-mono text-xs font-bold uppercase tracking-widest">
        <span className="text-primary">§1</span>&nbsp; Ringkasan Kasus &amp; Otorisasi
      </h2>
      <div className="mt-2 space-y-1 text-[13px] leading-relaxed">
        {D('No. kasus', c.caseNo)}
        {D('Judul', c.title)}
        {D('Jenis insiden', `${INCIDENT_TYPE_LABELS[c.incidentType]} · prioritas ${PRIORITY_LABELS[c.priority]}`)}
        {D('Status', CASE_STATUS_LABELS[c.status])}
        {D('Otorisasi', c.authorizationRef ?? '—')}
        {D('Scope pemeriksaan', c.scope)}
        {D('Dibuka', formatUTC(c.occurredAt))}
        {D('Deskripsi', c.description)}
      </div>

      {/* §2 Daftar item */}
      <h2 className="mt-8 font-mono text-xs font-bold uppercase tracking-widest">
        <span className="text-primary">§2</span>&nbsp; Daftar Item Evidence (§6.2–6.3)
      </h2>
      <table className="mt-2 w-full border border-border text-[11px]">
        <thead>
          <tr className="bg-muted text-left">
            {['Item', 'Label', 'Kategori', 'Medium', 'Power', 'Collection (UTC)', 'Status'].map(h => (
              <th key={h} className="border-b border-border px-2 py-1.5 font-mono uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={7} className="px-2 py-3 text-muted-foreground">Tidak ada item.</td></tr>
          )}
          {items.map(it => (
            <tr key={it.id} className="border-b border-border">
              <td className="px-2 py-1.5 font-mono text-primary">{it.itemNo}</td>
              <td className="px-2 py-1.5">{it.label}</td>
              <td className="px-2 py-1.5">{it.category}</td>
              <td className="px-2 py-1.5">{MEDIUM_LABELS[it.medium]}</td>
              <td className="px-2 py-1.5 font-mono uppercase">{it.powerState}</td>
              <td className="px-2 py-1.5 font-mono">{formatUTC(it.collectedAt)}</td>
              <td className="px-2 py-1.5">{ITEM_STATUS_LABELS[it.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* §3 Chain of custody — resolved names via custodyRows */}
      <h2 className="mt-8 font-mono text-xs font-bold uppercase tracking-widest">
        <span className="text-primary">§3</span>&nbsp; Chain of Custody (§6.5.3) — {totals.custodyEvents} peristiwa
      </h2>
      <table className="mt-2 w-full border border-border text-[11px]">
        <thead>
          <tr className="bg-muted text-left">
            {['Waktu (UTC)', 'Item', 'Aksi', 'Dari → Kepada', 'Alasan'].map(h => (
              <th key={h} className="border-b border-border px-2 py-1.5 font-mono uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {custodyRows.length === 0 && (
            <tr><td colSpan={5} className="px-2 py-3 text-muted-foreground">Tidak ada peristiwa.</td></tr>
          )}
          {custodyRows.map(r => (
            <tr key={r.id} className="border-b border-border">
              <td className="whitespace-nowrap px-2 py-1.5 font-mono">{formatUTC(r.occurredAt)}</td>
              <td className="px-2 py-1.5 font-mono text-primary">{r.itemNo}</td>
              <td className="px-2 py-1.5">{CUSTODY_TYPE_LABELS[r.type]}</td>
              <td className="px-2 py-1.5">{r.from} → {r.to}</td>
              <td className="px-2 py-1.5">{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* §4 Pernyataan integritas — incident TIDAK disembunyikan (S3) */}
      <h2 className="mt-8 font-mono text-xs font-bold uppercase tracking-widest">
        <span className="text-primary">§4</span>&nbsp; Pernyataan Integritas (§6.5)
      </h2>
      <p className="mt-2 text-[12px] leading-relaxed">
        Dari <b>{items.length}</b> item, <b>{items.filter(it => integrity[it.id].hasReference).length}</b> memiliki
        hash referensi SHA-256 dan <b>{items.filter(it => integrity[it.id].status === 'match').length}</b> telah
        diverifikasi ulang dengan hasil MATCH. Seluruh hash dihitung dengan mesin SHA-256 yang lulus
        self-test vektor resmi FIPS/NIST ({totals.verifications} verifikasi tercatat).
        {incidents.length > 0 && (
          <span className="font-semibold"> Terdapat {incidents.length} MISMATCH tercatat dan
          ditampilkan apa adanya:</span>
        )}
      </p>
      {incidents.map(i => (
        <p key={i.itemNo + i.at} className="mt-1 text-[11px] text-destructive">
          MISMATCH · {i.itemNo} · {formatUTC(i.at)}
        </p>
      ))}
      <div className="mt-3 space-y-1">
        {items.filter(it => integrity[it.id].hasReference).map(it => {
          const st = integrity[it.id].status;
          return (
            <p key={it.id} className="break-all font-mono text-[10px]">
              {it.itemNo}&nbsp;&nbsp;{it.referenceHash}
              {st !== 'unverified' && (
                <b className={st === 'match' ? 'text-green-600' : 'text-destructive'}>
                  &nbsp;&nbsp;[{VERIFY_RESULT_LABELS[st]}]
                </b>
              )}
            </p>
          );
        })}
      </div>
      <p className="mt-3 font-mono text-[10px] text-muted-foreground">
        Audit chain tip: {chainTipHex} — kaitkan laporan ini dengan Audit Trail digital (modul 06).
      </p>

      {/* §5 Pengesahan — dua kolom TTD basah */}
      <h2 className="mt-8 font-mono text-xs font-bold uppercase tracking-widest">
        <span className="text-primary">§5</span>&nbsp; Pengesahan
      </h2>
      <div className="mt-16 grid grid-cols-2 gap-10 text-center text-[12px]">
        <div>
          <div className="border-t border-foreground pt-2 font-semibold">
            {picName || '________________'}
          </div>
          Digital Evidence First Responder
        </div>
        <div>
          <div className="border-t border-foreground pt-2 font-semibold">
            {examinerName || '________________'}
          </div>
          Digital Evidence Specialist
        </div>
      </div>

      <div className="mt-10 border-t border-border pt-3 font-mono text-[9px] tracking-wider text-muted-foreground">
        {docId} · VESTIGIUM — DIGITAL FORENSIC RECORD SYSTEM · DIBANGKITKAN OTOMATIS, SAH BERSAMA REGISTER DIGITAL
      </div>
    </article>
  );
}
