/**
 * lib/id.ts — Generator ID unik Vestigium
 * Ref: CC-21, DATA.md §5
 *
 * Format:
 * - Case: CASE-YYYYMMDD-XXX (counter per hari)
 * - Evidence: EV-YYYYMMDD-XXX (counter per hari)
 * - Acquisition: AC-YYYYMMDD-XXX (counter per hari)
 * - UID: 12 karakter hex
 */

import { nowUTC } from "./time";

// ─── Counter State ───────────────────────────────────────────────────
// Reset otomatis saat tanggal berubah
let currentDate = "";
let counters: Record<string, number> = {};

function getCounter(prefix: string): number {
  const today = nowUTC().slice(0, 10); // "YYYY-MM-DD"
  if (today !== currentDate) {
    currentDate = today;
    counters = {};
  }
  counters[prefix] = (counters[prefix] || 0) + 1;
  return counters[prefix];
}

function padCounter(n: number): string {
  return n.toString().padStart(3, "0");
}

function dateCompact(): string {
  return nowUTC().slice(0, 10).replace(/-/g, ""); // "YYYYMMDD"
}

// ─── Generators ──────────────────────────────────────────────────────

/**
 * Generate case number.
 * Format: CASE-YYYYMMDD-XXX
 */
export function caseId(): string {
  return `CASE-${dateCompact()}-${padCounter(getCounter("CASE"))}`;
}

/**
 * Generate evidence item number.
 * Format: EV-YYYYMMDD-XXX
 */
export function evidenceId(): string {
  return `EV-${dateCompact()}-${padCounter(getCounter("EV"))}`;
}

/**
 * Generate acquisition record number.
 * Format: AC-YYYYMMDD-XXX
 */
export function acquisitionId(): string {
  return `AC-${dateCompact()}-${padCounter(getCounter("AC"))}`;
}

/**
 * Generate unique ID (12 hex chars).
 * Untuk custody, verification, audit, dll.
 */
export function uid(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate DOC-ID untuk laporan cetak.
 * Format: DOC-YYYYMMDD-XXX
 */
export function docId(): string {
  return `DOC-${dateCompact()}-${padCounter(getCounter("DOC"))}`;
}

/**
 * Validasi format ID.
 */
export function isValidCaseId(id: string): boolean {
  return /^CASE-\d{8}-\d{3}$/.test(id);
}

export function isValidEvidenceId(id: string): boolean {
  return /^EV-\d{8}-\d{3}$/.test(id);
}

export function isValidAcquisitionId(id: string): boolean {
  return /^AC-\d{8}-\d{3}$/.test(id);
}
