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
  AcquisitionRecord, Case, ChainReport, EvidenceItem, Party, Person,
  VerificationRecord, VestigiumState,
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
