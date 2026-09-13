/**
 * lib/time.ts — Satu sumber jam untuk Vestigium
 * Ref: CC-18, FEATURE.md §4.3
 *
 * recordedAt HANYA dari nowUTC().
 * occurredAt HANYA dari input user melalui toUTC().
 * Dilarang memanggil new Date() di luar modul ini.
 */

/**
 * Mengembalikan timestamp UTC dalam format ISO 8601.
 * HANYA fungsi ini yang menghasilkan recordedAt.
 */
export function nowUTC(): string {
  return new Date().toISOString();
}

/**
 * Parse input datetime lokal user ke ISO 8601 UTC.
 * HANYA fungsi ini yang menghasilkan occurredAt dari input user.
 * @param localDatetime - string dari input type="datetime-local" (format: "YYYY-MM-DDTHH:MM")
 * @returns ISO 8601 UTC string
 */
export function toUTC(localDatetime: string): string {
  if (!localDatetime) {
    throw new Error("Timestamp wajib diisi");
  }
  const date = new Date(localDatetime);
  if (isNaN(date.getTime())) {
    throw new Error(`Timestamp tidak valid: ${localDatetime}`);
  }
  return date.toISOString();
}

/**
 * Format timestamp untuk tampilan UI (locale Indonesia).
 */
export function formatDisplay(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Format timestamp untuk dokumen cetak (format formal).
 */
export function formatDocument(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("id-ID", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * DUAL TIMESTAMP: tampilkan occurredAt vs recordedAt.
 * Ref: FEATURE.md §4.3 — jeda antara keduanya disimpan, bukan "diperbaiki"
 */
export interface DualTimestamp {
  occurredAt: string;
  recordedAt: string;
  gap: string;
}

export function dualTimestamp(
  occurredAt: string,
  recordedAt: string
): DualTimestamp {
  const occurred = new Date(occurredAt);
  const recorded = new Date(recordedAt);
  const diffMs = recorded.getTime() - occurred.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  let gap: string;
  if (diffSec < 60) {
    gap = `${diffSec} detik`;
  } else if (diffSec < 3600) {
    gap = `${Math.floor(diffSec / 60)} menit ${diffSec % 60} detik`;
  } else {
    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    gap = `${hours} jam ${mins} menit`;
  }

  return { occurredAt, recordedAt, gap };
}
