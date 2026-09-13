/**
 * lib/domain.ts — State machine, transisi, konstanta domain
 * Ref: CC-20, FEATURE.md §4.5
 *
 * Transisi status hanya melalui tabel TRANSITIONS + canTransition().
 * DILARANG if-chain status tersebar.
 */

import type {
  CaseStatus,
  ItemStatus,
  CustodyAction,
  SourceCategory,
  PowerState,
  AcquisitionMethod,
  HashVerificationResult,
} from "./types";

// ─── State Machine ───────────────────────────────────────────────────

/**
 * Tabel transisi status kasus.
 * Ref: FEATURE.md §4.5 — transisi sebagai tabel, bukan if-chain
 */
export const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  open: ["closed"],
  closed: [], // kasus tidak bisa dibuka kembali
};

/**
 * Tabel transisi status item evidence.
 */
export const ITEM_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  collected: ["sealed", "in-analysis"],
  sealed: ["opened", "in-analysis"],
  "in-analysis": ["sealed", "released"],
  opened: ["sealed", "released"],
  released: [], // item yang sudah released tidak bisa diubah
};

/**
 * Cek apakah transisi status valid.
 * Ref: CC-20 — canTransition() sebagai satu titik pengecekan
 */
export function canTransition(
  kind: "case" | "item",
  from: CaseStatus | ItemStatus,
  to: CaseStatus | ItemStatus
): boolean {
  if (kind === "case") {
    return (CASE_TRANSITIONS[from as CaseStatus] || []).includes(to as CaseStatus);
  }
  return (ITEM_TRANSITIONS[from as ItemStatus] || []).includes(to as ItemStatus);
}

/**
 * Dapatkan transisi yang valid dari status tertentu.
 */
export function validTransitions(
  kind: "case" | "item",
  current: CaseStatus | ItemStatus
): Array<CaseStatus | ItemStatus> {
  const table = kind === "case" ? CASE_TRANSITIONS : ITEM_TRANSITIONS;
  return table[current as keyof typeof table] || [];
}

// ─── Konstanta ───────────────────────────────────────────────────────

/**
 * Urutan volatilitas (order of volatility).
 * Ref: FEATURE.md §4.6, PRD FR-M3-03
 */
export const VOLATILITY_ORDER = [
  { key: "ramCaptured", label: "RAM (Memory)" },
  { key: "runningProcesses", label: "Proses berjalan" },
  { key: "networkConnections", label: "Koneksi jaringan" },
  { key: "mountedDrives", label: "Drive terpasang" },
  { key: "openFiles", label: "File terbuka" },
  { key: "screenCapture", label: "Screenshot" },
] as const;

/**
 * Ukuran chunk untuk hash streaming (8 MB).
 * Ref: DESIGN.md §8
 */
export const HASH_CHUNK_SIZE = 8 * 1024 * 1024;

/**
 * 10 kategori sumber evidence.
 * Ref: DATA.md §3
 */
export const SOURCE_CATEGORIES: Array<{
  value: SourceCategory;
  label: string;
}> = [
  { value: "computer", label: "Komputer" },
  { value: "mobile", label: "Mobile" },
  { value: "removable", label: "Removable Media" },
  { value: "network", label: "Network" },
  { value: "cloud", label: "Cloud" },
  { value: "iot", label: "IoT" },
  { value: "photo", label: "Foto" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Dokumen" },
  { value: "other", label: "Lainnya" },
];

/**
 * Status power state.
 */
export const POWER_STATES: Array<{
  value: PowerState;
  label: string;
  description: string;
}> = [
  { value: "on", label: "Menyala", description: "Perangkat dalam kondisi menyala" },
  { value: "off", label: "Mati", description: "Perangkat dalam kondisi mati" },
  { value: "unknown", label: "Tidak Diketahui", description: "Status power tidak dapat ditentukan" },
];

/**
 * Metode akuisisi.
 */
export const ACQUISITION_METHODS: Array<{
  value: AcquisitionMethod;
  label: string;
  requiresJustification: boolean;
}> = [
  { value: "bit-stream", label: "Bit-stream Copy", requiresJustification: false },
  { value: "logical", label: "Logical Copy", requiresJustification: false },
  { value: "live", label: "Live Acquisition", requiresJustification: true },
];

/**
 * Hasil verifikasi hash.
 */
export const HASH_RESULTS: Array<{
  value: HashVerificationResult;
  label: string;
  color: string;
}> = [
  { value: "match", label: "Cocok", color: "text-green-600" },
  { value: "mismatch", label: "Tidak Cocok", color: "text-red-600" },
  { value: "source-absent", label: "Hash Sumber Tidak Ada", color: "text-yellow-600" },
  { value: "image-absent", label: "Hash Image Tidak Ada", color: "text-yellow-600" },
];

/**
 * Aksi custody.
 */
export const CUSTODY_ACTIONS: Array<{
  value: CustodyAction;
  label: string;
}> = [
  { value: "collected", label: "Dikumpulkan" },
  { value: "sealed", label: "Disegel" },
  { value: "transferred", label: "Ditransfer" },
  { value: "opened", label: "Dibuka" },
  { value: "released", label: "Dirilis" },
];

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Dapatkan label untuk source category.
 */
export function getSourceLabel(category: SourceCategory): string {
  return SOURCE_CATEGORIES.find((c) => c.value === category)?.label || category;
}

/**
 * Dapatkan label untuk power state.
 */
export function getPowerStateLabel(state: PowerState): string {
  return POWER_STATES.find((p) => p.value === state)?.label || state;
}

/**
 * Dapatkan label untuk acquisition method.
 */
export function getAcquisitionLabel(method: AcquisitionMethod): string {
  return ACQUISITION_METHODS.find((m) => m.value === method)?.label || method;
}

/**
 * Dapatkan warna untuk status item.
 */
export function getItemStatusColor(status: ItemStatus): string {
  const colors: Record<ItemStatus, string> = {
    collected: "bg-blue-100 text-blue-800",
    sealed: "bg-purple-100 text-purple-800",
    opened: "bg-orange-100 text-orange-800",
    "in-analysis": "bg-yellow-100 text-yellow-800",
    released: "bg-green-100 text-green-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

/**
 * Dapatkan label untuk status item.
 */
export function getItemStatusLabel(status: ItemStatus): string {
  const labels: Record<ItemStatus, string> = {
    collected: "Dikumpulkan",
    sealed: "Disegel",
    opened: "Dibuka",
    "in-analysis": "Dalam Analisis",
    released: "Dirilis",
  };
  return labels[status] || status;
}
