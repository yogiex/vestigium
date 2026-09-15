/* ================================================================
 * store/selectors.ts — satu-satunya sumber nilai TURUNAN (CC-18)
 * Fungsi murni — komponen membungkus dengan useShallow. Dilarang
 * menghitung nilai-nilai ini inline di JSX.
 * ================================================================ */

import { chainTip, verifyChain } from '../lib/audit';
import { STORAGE_QUOTA_BYTES, STORAGE_WARN_RATIO } from '../lib/config';
import { partyLabel } from '../lib/domain';
import { toMillis } from '../lib/time';
import type {
  AcquisitionRecord, Case, ChainReport, CustodyEvent,
  EvidenceItem, HashHex64, Party, Person, UTCString, VerificationRecord, VestigiumState,
} from '../lib/types';

export function selectActiveOperator(s: VestigiumState): Person | null {
  return s.persons.find(p => p.id === s.settings.defaultExaminerId) ?? null;
}

export function selectPersonName(s: VestigiumState, id: string): string {
  return s.persons.find(p => p.id === id)?.name ?? '(personel tidak dikenal)';
}

/** INV-04 — custodian = toParty event TERAKHIR (by occurredAt, bukan string compare — DATA §1). */
export function selectCurrentCustodian(s: VestigiumState, evidenceId: string): Party | null {
  const last = s.custody
    .filter(c => c.evidenceId === evidenceId)
    .sort((a, b) => toMillis(b.occurredAt) - toMillis(a.occurredAt))[0];
  return last ? last.toParty : null;
}

export function selectCustodianLabel(s: VestigiumState, evidenceId: string): string {
  const p = selectCurrentCustodian(s, evidenceId);
  return p ? partyLabel(p, id => selectPersonName(s, id)) : '—';
}

export function selectEvidenceOfCase(s: VestigiumState, caseId: string): EvidenceItem[] {
  return s.evidence.filter(e => e.caseId === caseId);
}

export function selectCaseOf(s: VestigiumState, evidenceId: string): Case | null {
  const ev = s.evidence.find(e => e.id === evidenceId);
  return ev ? s.cases.find(c => c.id === ev.caseId) ?? null : null;
}

/** DATA §12.2 — matchStatus TIDAK disimpan; diturunkan dari dua hash yang tercatat. */
export function selectMatchStatus(a: AcquisitionRecord): 'match' | 'mismatch' | 'unverified' {
  if (!a.sourceHash || !a.imageHash) return 'unverified';
  return a.sourceHash === a.imageHash ? 'match' : 'mismatch';
}

export function selectPrimaryAcquisition(s: VestigiumState, evidenceId: string): AcquisitionRecord | null {
  const item = s.evidence.find(e => e.id === evidenceId);
  if (!item?.referenceHash) return null;
  return s.acquisitions
    .filter(a => a.evidenceId === evidenceId && a.imageHash === item.referenceHash)[0] ?? null;
}

export interface ItemIntegrity {
  hasReference: boolean;
  lastVerification: VerificationRecord | null;
  status: 'match' | 'mismatch' | 'unverified';
}

/** Status integritas item = verifikasi terakhir (by recordedAt) atas item/akuisisi primer. */
export function selectItemIntegrity(s: VestigiumState, evidenceId: string): ItemIntegrity {
  const item = s.evidence.find(e => e.id === evidenceId);
  if (!item?.referenceHash) return { hasReference: false, lastVerification: null, status: 'unverified' };
  const primary = selectPrimaryAcquisition(s, evidenceId);
  const last = s.verifications
    .filter(v => v.evidenceId === evidenceId
      && (!v.acquisitionId || (primary !== null && v.acquisitionId === primary.id)))
    .sort((a, b) => toMillis(b.recordedAt) - toMillis(a.recordedAt))[0];
  return { hasReference: true, lastVerification: last ?? null, status: last?.result ?? 'unverified' };
}

/** S3 — integrity incident TIDAK PERNAH disembunyikan (FR-M5-05). */
export function selectIntegrityIncidents(s: VestigiumState): { item: EvidenceItem; verification: VerificationRecord }[] {
  return s.evidence
    .map(item => ({ item, integrity: selectItemIntegrity(s, item.id) }))
    .filter(x => x.integrity.status === 'mismatch' && x.integrity.lastVerification !== null)
    .map(x => ({ item: x.item, verification: x.integrity.lastVerification as VerificationRecord }));
}

export function selectVerificationProgress(s: VestigiumState):
  { verified: number; withHash: number; total: number; percent: number } {
  const withHash = s.evidence.filter(e => e.referenceHash).length;
  const verified = s.evidence.filter(e => selectItemIntegrity(s, e.id).status === 'match').length;
  return { verified, withHash, total: s.evidence.length,
    percent: withHash > 0 ? Math.round((verified / withHash) * 100) : 0 };
}

export function selectChainReport(s: VestigiumState): ChainReport {
  return verifyChain(s.audit);
}

export function selectChainTip(s: VestigiumState): string {
  return chainTip(s.audit);
}

/** FR-M10-05 — meter kuota; amber di 80% (NFR-08). */
export function selectStorageUsage(s: VestigiumState): { bytes: number; ratio: number; warn: boolean } {
  const bytes = new Blob([JSON.stringify(s)]).size;
  const ratio = bytes / STORAGE_QUOTA_BYTES;
  return { bytes, ratio, warn: ratio > STORAGE_WARN_RATIO };
}

/* ---------- Custody ledger (Sesi 7) ---------- */

export interface CustodyLedgerRow {
  event: CustodyEvent;
  evidenceId: string;
  itemNo: string;
  itemLabel: string;
  caseNo: string | null;
  fromLabel: string;
  toLabel: string;
  /** Δ recorded − occurred (dual timestamp selalu terlihat — konstitusi #2). */
  deltaMs: number;
}

/** Ledger global, kronologis (occurredAt desc — pembandingan via toMillis, DATA §1). */
export function selectCustodyLedger(s: VestigiumState): CustodyLedgerRow[] {
  return [...s.custody]
    .sort((a, b) => toMillis(b.occurredAt) - toMillis(a.occurredAt))
    .map(ev => {
      const item = s.evidence.find(e => e.id === ev.evidenceId);
      const kase = item ? s.cases.find(c => c.id === item.caseId) : null;
      return {
        event: ev,
        evidenceId: ev.evidenceId,
        itemNo: item?.itemNo ?? '(?)',
        itemLabel: item?.label ?? '(item tidak ditemukan — INV-03 dilanggar)',
        caseNo: kase?.caseNo ?? null,
        fromLabel: partyLabel(ev.fromParty, id => selectPersonName(s, id)),
        toLabel: partyLabel(ev.toParty, id => selectPersonName(s, id)),
        deltaMs: toMillis(ev.recordedAt) - toMillis(ev.occurredAt),
      };
    });
}

/**
 * Gap-check kontinuitas (M6, P1 awal): setiap rantai HARUS dimulai event
 * 'collected' (FR-M3-01). Rantai yang tidak berawal dari lokasi kejadian =
 * pelanggaran yang TAMPIL, bukan disembunyikan (konstitusi #8, S3).
 */
export function selectCustodyContinuity(s: VestigiumState): {
  ok: boolean;
  broken: { itemNo: string; label: string; firstType: string }[];
} {
  const broken = s.evidence
    .map(item => {
      const events = s.custody.filter(c => c.evidenceId === item.id);
      if (events.length === 0) return null;
      const earliest = events.reduce((a, b) =>
        toMillis(a.occurredAt) <= toMillis(b.occurredAt) ? a : b);
      return earliest.type === 'collected'
        ? null
        : { itemNo: item.itemNo, label: item.label, firstType: earliest.type };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  return { ok: broken.length === 0, broken };
}

/* ---------- Riwayat per item (Sesi 6) — CC-18: dilarang filter inline di JSX ---------- */

export function selectAcquisitionsOfItem(s: VestigiumState, evidenceId: string): AcquisitionRecord[] {
  return s.acquisitions
    .filter(a => a.evidenceId === evidenceId)
    .sort((a, b) => toMillis(b.recordedAt) - toMillis(a.recordedAt));
}

export function selectVerificationsOfItem(s: VestigiumState, evidenceId: string): VerificationRecord[] {
  return s.verifications
    .filter(v => v.evidenceId === evidenceId)
    .sort((a, b) => toMillis(b.recordedAt) - toMillis(a.recordedAt));
}

export function selectCustodyEventsOfItem(s: VestigiumState, evidenceId: string): CustodyEvent[] {
  return s.custody
    .filter(c => c.evidenceId === evidenceId)
    .sort((a, b) => toMillis(a.occurredAt) - toMillis(b.occurredAt)); // kronologis utk timeline
}

/* ---------- Laporan kasus (Sesi 9, M9) — agregasi murni, CC-18/26 ---------- */

export interface CaseReportData {
  kase: Case;
  items: EvidenceItem[];
  custody: Record<string, CustodyEvent[]>;
  acquisitions: Record<string, AcquisitionRecord[]>;
  integrity: Record<string, ItemIntegrity>;
  incidents: { itemNo: string; at: UTCString; hash: HashHex64 }[];
  chainTipHex: string;
  totals: { custodyEvents: number; acquisitions: number; verifications: number };
}

export function selectCaseReport(s: VestigiumState, caseId: string): CaseReportData | null {
  const kase = s.cases.find(c => c.id === caseId);
  if (!kase) return null;
  const items = s.evidence
    .filter(e => e.caseId === caseId)
    .sort((a, b) => a.itemNo.localeCompare(b.itemNo));
  const custody: CaseReportData['custody'] = {};
  const acquisitions: CaseReportData['acquisitions'] = {};
  const integrity: CaseReportData['integrity'] = {};
  let cN = 0, aN = 0, vN = 0;
  for (const it of items) {
    const c = selectCustodyEventsOfItem(s, it.id);
    const a = selectAcquisitionsOfItem(s, it.id);
    const v = selectVerificationsOfItem(s, it.id);
    custody[it.id] = c; acquisitions[it.id] = a; integrity[it.id] = selectItemIntegrity(s, it.id);
    cN += c.length; aN += a.length; vN += v.length;
  }
  const incidents = selectIntegrityIncidents(s)
    .filter(x => x.item.caseId === caseId)
    .map(x => ({ itemNo: x.item.itemNo, at: x.verification.recordedAt,
                 hash: x.verification.computedHash }));
  return {
    kase, items, custody, acquisitions, integrity, incidents,
    chainTipHex: chainTip(s.audit),
    totals: { custodyEvents: cN, acquisitions: aN, verifications: vN },
  };
}
