/**
 * store/selectors.ts — Selector untuk derived values
 * Ref: CC-22, FEATURE.md §4.4
 *
 * Derived value tidak disimpan; dihitung saat render.
 * DILARANG menyimpan field derived sebagai "untuk mempermudah".
 */

import type { VestigiumState, CustodyEvent, EvidenceItem } from "@/lib/types";

type State = VestigiumState;

// ─── Case Selectors ──────────────────────────────────────────────────

/**
 * Dapatkan kasus berdasarkan nomor.
 */
export const getCaseByNo = (state: State, caseNo: string) =>
  state.cases.find((c) => c.caseNo === caseNo);

/**
 * Dapatkan semua kasus aktif (status open).
 */
export const getOpenCases = (state: State) =>
  state.cases.filter((c) => c.status === "open");

/**
 * Jumlah item dalam kasus.
 */
export const getCaseItemCount = (state: State, caseNo: string) =>
  state.evidenceItems.filter((e) => e.caseNo === caseNo).length;

// ─── Evidence Selectors ──────────────────────────────────────────────

/**
 * Dapatkan item evidence berdasarkan nomor.
 */
export const getEvidenceByNo = (state: State, itemNo: string) =>
  state.evidenceItems.find((e) => e.itemNo === itemNo);

/**
 * Dapatkan semua item untuk kasus tertentu.
 */
export const getEvidenceByCase = (state: State, caseNo: string) =>
  state.evidenceItems.filter((e) => e.caseNo === caseNo);

/**
 * Custodian saat ini (penerima custody event terakhir).
 * Ref: FEATURE.md §4.4 — custodian = penerima event terakhir, titik.
 */
export const getCurrentCustodian = (state: State, itemNo: string): string | null => {
  const lastTransfer = state.custody
    .filter((c) => c.itemNo === itemNo && c.action === "transferred")
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];

  return lastTransfer?.to || null;
};

/**
 * Status verifikasi terakhir untuk item.
 */
export const getLastVerification = (state: State, itemNo: string) =>
  state.verifications
    .filter((v) => v.itemNo === itemNo)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];

// ─── Collection Selectors ────────────────────────────────────────────

/**
 * Dapatkan collection untuk item tertentu.
 */
export const getCollectionByItem = (state: State, itemNo: string) =>
  state.collections.find((c) => c.itemNo === itemNo);

// ─── Acquisition Selectors ───────────────────────────────────────────

/**
 * Dapatkan semua akuisisi untuk item tertentu.
 */
export const getAcquisitionsByItem = (state: State, itemNo: string) =>
  state.acquisitions
    .filter((a) => a.itemNo === itemNo)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

/**
 * Hash referensi terakhir (untuk verifikasi).
 */
export const getReferenceHash = (state: State, itemNo: string): string | null => {
  const acquisitions = getAcquisitionsByItem(state, itemNo);
  if (acquisitions.length === 0) return null;
  return acquisitions[acquisitions.length - 1].imageHash;
};

// ─── Custody Selectors ───────────────────────────────────────────────

/**
 * Riwayat custody untuk item tertentu.
 */
export const getCustodyHistory = (state: State, itemNo: string): CustodyEvent[] =>
  state.custody
    .filter((c) => c.itemNo === itemNo)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

/**
 * Total jumlah custody events.
 */
export const getTotalCustodyEvents = (state: State) => state.custody.length;

// ─── Audit Selectors ─────────────────────────────────────────────────

/**
 * Audit chain tip (hash terakhir).
 */
export const getAuditTip = (state: State): string => {
  if (state.audit.length === 0) return "";
  return state.audit[state.audit.length - 1].hash;
};

/**
 * Verifikasi integritas audit chain.
 */
export const verifyAuditChain = (state: State): {
  valid: boolean;
  brokenAt?: number;
} => {
  for (let i = 1; i < state.audit.length; i++) {
    const entry = state.audit[i];
    const prev = state.audit[i - 1];
    if (entry.prevHash !== prev.hash) {
      return { valid: false, brokenAt: i };
    }
  }
  return { valid: true };
};

// ─── Dashboard Selectors ─────────────────────────────────────────────

/**
 * Statistik dashboard.
 */
export const getDashboardStats = (state: State) => ({
  totalCases: state.cases.length,
  openCases: state.cases.filter((c) => c.status === "open").length,
  totalEvidence: state.evidenceItems.length,
  evidenceInAnalysis: state.evidenceItems.filter(
    (e) => e.status === "in-analysis"
  ).length,
  totalCustodyEvents: state.custody.length,
  auditEntries: state.audit.length,
});

/**
 * Evidence yang butuh verifikasi (sudah lebih dari 7 hari tanpa verifikasi).
 */
export const getEvidenceNeedingVerification = (state: State): EvidenceItem[] => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return state.evidenceItems.filter((item) => {
    if (item.status === "released") return false;

    const lastVerification = getLastVerification(state, item.itemNo);
    if (!lastVerification) return true;

    return new Date(lastVerification.at) < sevenDaysAgo;
  });
};
