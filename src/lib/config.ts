/* ================================================================
 * lib/config.ts — satu-satunya tempat membaca env & konstanta global
 * Ref: D-22 · CC-30/32 · DATA.md §8 · FR-M10-05 · NFR-09
 * ================================================================ */

export type VestMode = 'mvp' | 'production';

/** Mode build — default fail-safe = mvp (CC-30). */
export const VEST_MODE: VestMode =
  process.env.NEXT_PUBLIC_VESTIGIUM_MODE === 'production' ? 'production' : 'mvp';

/** Key namespaced per mode — dua mode di origin sama berbagi localStorage (D-22/K-2). */
export const STORAGE_KEY = `vestigium_${VEST_MODE}_v1`;

/** Harus cocok dengan basePath di next.config.ts (CC-30). */
export const APP_BASE_PATH = '/vestigium';

/** Versi skema data — TUNGGAL lintas mode; naikkan hanya via revisi DATA.md (§9). */
export const SCHEMA_VERSION = 1 as const;

/** Kuota localStorage ±5 MB; peringatan amber di 80% (FR-M10-05). */
export const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;
export const STORAGE_WARN_RATIO = 0.8;

/** Ambang anomali dual timestamp: occurred > recorded, atau jeda > 24 jam (INV-08, NFR-09). */
export const TIMESTAMP_ANOMALY_MS = 24 * 60 * 60 * 1000;
