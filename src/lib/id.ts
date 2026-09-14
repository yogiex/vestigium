/* ================================================================
 * lib/id.ts — generator uid & nomor bisnis (DATA §6)
 * Penomoran DERIVED dari array append-only — tanpa counters (DATA §12.5).
 * View/handler DILARANG menyusun string ID manual (CC-21).
 * ================================================================ */

import { currentYear } from './time';
import {
  asUuid, type AcquisitionNo, type AcquisitionRecord, type Case, type CaseNo,
  type EvidenceItem, type EvidenceNo, type Uuid,
} from './types';

const pad = (n: number, w: number) => String(n).padStart(w, '0');

/** Internal UUID — opaque, tak terenumerasi (SEC-06). */
export function uid(): Uuid {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return asUuid(crypto.randomUUID());
  }
  const b = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map(x => x.toString(16).padStart(2, '0')).join('');
  return asUuid(`${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`);
}

/** CASE-YYYY-NNN — NNN reset per tahun (D-07). */
export function nextCaseNo(cases: readonly Case[], year: number = currentYear()): CaseNo {
  const prefix = `CASE-${year}-`;
  const max = cases
    .filter(c => c.caseNo.startsWith(prefix))
    .reduce((m, c) => Math.max(m, Number(c.caseNo.slice(prefix.length))), 0);
  return `${prefix}${pad(max + 1, 3)}` as CaseNo;
}

/** EV-NNNN — global monoton seumur hidup database (D-08). */
export function nextEvidenceNo(items: readonly EvidenceItem[]): EvidenceNo {
  const max = items.reduce((m, it) => Math.max(m, Number(it.itemNo.slice(3))), 0);
  return `EV-${pad(max + 1, 4)}` as EvidenceNo;
}

/** AC-<evNo tanpa strip>-NN — dihitung dari milik item (id kini UUID — koreksi DATA §15.7). */
export function nextAcquisitionNo(
  acquisitions: readonly AcquisitionRecord[],
  ev: EvidenceItem,
): AcquisitionNo {
  const count = acquisitions.filter(a => a.evidenceId === ev.id).length;
  return `AC-${ev.itemNo.replace('-', '')}-${pad(count + 1, 2)}` as AcquisitionNo;
}
