/* ================================================================
 * lib/time.ts — SATU-SATUNYA modul yang boleh memanggil new Date()
 * Ref: CC-17 · DATA.md §1 (dual timestamp, dilarang compare leksikografis)
 * ================================================================ */

import { TIMESTAMP_ANOMALY_MS } from './config';
import { asOffset, asUtc, type OffsetISO, type UTCString } from './types';

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** recordedAt — jam sistem UTC. Tidak pernah diinput manusia (konstitusi #2). */
export function nowUTC(): UTCString {
  return asUtc(new Date().toISOString());
}

/** Tahun berjalan — dipakai alokasi nomor kasus (id.ts) tanpa melanggar CC-17. */
export function currentYear(): number {
  return new Date().getUTCFullYear();
}

/** Konstruktor untuk fixture/test: validasi + brand tanpa menyentuh jam. */
export function utc(iso: string): UTCString {
  return asUtc(iso);
}
export function offset(iso: string): OffsetISO {
  return asOffset(iso);
}

/** Milidetik — SATU-SATUNYA titik pembandingan waktu (DATA §1). */
export function toMillis(iso: OffsetISO | UTCString): number {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) throw new Error('INVARIANT: timestamp tidak dapat di-parse');
  return ms;
}

/**
 * Parser occurredAt — input form datetime-local ("2025-03-14T09:30") atau ISO ber-offset.
 * Offset asli dipertahankan; input tanpa offset dianggap waktu lokal perangkat (DATA §1).
 * null = input tidak valid → form menolak (deny-by-default).
 */
export function toUTC(value: string): OffsetISO | null {
  const hasOffset = /(Z|[+-]\d{2}:\d{2})$/.test(value);
  if (hasOffset) {
    try { return asOffset(value); }
    catch { return null; }
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const normalized = value.length === 16 ? `${value}:00` : value;
  return asOffset(`${normalized}${sign}${pad(Math.floor(Math.abs(offMin) / 60))}:${pad(Math.abs(offMin) % 60)}`);
}

/** Anomali dual timestamp (NFR-09): occurred di masa depan, atau jeda > 24 jam. */
export function hasTimestampAnomaly(occurredAt: OffsetISO, recordedAt: UTCString): boolean {
  const o = toMillis(occurredAt), r = toMillis(recordedAt);
  return o > r || r - o > TIMESTAMP_ANOMALY_MS;
}

/* ---------- Formatting tampilan (UI) ---------- */
export function formatUTC(iso: UTCString | OffsetISO): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

export function timeAgo(iso: UTCString | OffsetISO, now: number = Date.now()): string {
  const m = Math.floor((now - toMillis(iso)) / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} mnt lalu`;
  if (m < 1440) return `${Math.floor(m / 60)} jam lalu`;
  return `${Math.floor(m / 1440)} hari lalu`;
}
