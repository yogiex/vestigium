/**
 * lib/config.ts — Konfigurasi Vestigium
 * Ref: DESIGN.md §9
 */

export const CONFIG = {
  /**
   * Nama aplikasi
   */
  appName: "Vestigium",

  /**
   * Versi aplikasi
   */
  version: "0.1.0",

  /**
   * Mode operasi
   * - "mvp": 100% client-side, GitHub Pages
   * - "production": backend + auth (L3)
   */
  mode: (process.env.NEXT_PUBLIC_VESTIGIUM_MODE || "mvp") as "mvp" | "production",

  /**
   * Base path untuk GitHub Pages
   */
  basePath: "/vestigium",

  /**
   * Maximum file size untuk hash streaming (100 MB)
   */
  maxFileSize: 100 * 1024 * 1024,

  /**
   * Chunk size untuk hash streaming (8 MB)
   */
  hashChunkSize: 8 * 1024 * 1024,

  /**
   * Storage keys untuk localStorage
   */
  storageKeys: {
    state: "vestigium:state",
    settings: "vestigium:settings",
  },

  /**
   * Format nomor
   */
  formats: {
    caseNo: "CASE-YYYYMMDD-XXX",
    evidenceNo: "EV-YYYYMMDD-XXX",
    acquisitionNo: "AC-YYYYMMDD-XXX",
    docId: "DOC-YYYYMMDD-XXX",
  },
} as const;
