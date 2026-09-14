/* ================================================================
 * lib/domain.ts — aturan domain sebagai DATA (CC-20) + label UI (CC-13)
 * Ref: DATA.md §4–5 · FR-M6-01 · ISO §4 taksonomi
 * ================================================================ */

import type {
  AcquisitionMethod, AcquisitionSource, AuditAction, CaseStatus, CustodyEventType, ImageFormat,
  IncidentType, ItemStatus, Medium, Packaging, Party, PersonRole, PhysicalCondition,
  PowerState, Priority, SealCondition, SourceCategory, VerificationMethod,
  VerificationResult,
} from './types';

/* ---------- State machine ---------- */
export const TRANSITIONS = {
  item: {
    'collected':    ['sealed', 'in-analysis'],
    'sealed':       ['opened', 'in-analysis'],
    'in-analysis':  ['sealed', 'released'],
    'opened':       ['sealed', 'released'],
    'released':     [],
    'disposed':     [],
  },
  case: {
    'open':   ['active'],
    'active': ['closed'],
    'closed': ['active'],
  },
} as const;

export function canTransition(kind: 'item' | 'case', from: string, to: string): boolean {
  return ((TRANSITIONS[kind] as Record<string, readonly string[]>)[from] ?? []).includes(to);
}

/* ---------- Kategori → medium default ---------- */
export const CATEGORY_MEDIUM: Record<SourceCategory, Medium> = {
  'workstation': 'physical', 'mobile-device': 'physical', 'removable-media': 'physical',
  'memory': 'physical', 'optical-disc': 'physical', 'iot-other': 'physical',
  'cloud-service': 'logical', 'system-log': 'logical',
  'network-capture': 'logical', 'digital-document': 'logical',
};

/* ---------- Label UI ---------- */
export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  collected: 'Tercatat', sealed: 'Tersegel', 'in-analysis': 'Analisis',
  opened: 'Seal Dibuka', released: 'Dirilis', disposed: 'Dimusnahkan',
};
export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: 'Open', active: 'Aktif', closed: 'Ditutup',
};
export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'Tinggi', medium: 'Sedang', low: 'Rendah',
};
export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  'unauthorized-access': 'Akses tidak sah', 'data-leak': 'Kebocoran data',
  'digital-fraud': 'Penipuan digital', 'malware': 'Serangan malware',
  'asset-misuse': 'Penyalahgunaan aset', 'internal-dispute': 'Sengketa internal',
  'other': 'Lainnya',
};
export const SOURCE_CATEGORY_LABELS: Record<SourceCategory, string> = {
  'workstation': 'Workstation / PC', 'mobile-device': 'Perangkat mobile',
  'removable-media': 'Media lepas / USB', 'memory': 'Memori (RAM / dump)',
  'optical-disc': 'Optical disc', 'cloud-service': 'Layanan cloud',
  'system-log': 'Log & berkas sistem', 'network-capture': 'Capture jaringan',
  'digital-document': 'Dokumen digital', 'iot-other': 'IoT / lainnya',
};
export const MEDIUM_LABELS: Record<Medium, string> = { physical: 'Fisik', logical: 'Logis' };
export const POWER_STATE_LABELS: Record<PowerState, string> = { on: 'Menyala (ON)', off: 'Mati (OFF)' };
export const CONDITION_LABELS: Record<PhysicalCondition, string> = {
  intact: 'Utuh', damaged: 'Rusak', burned: 'Terbakar',
  encrypted: 'Terenkripsi', other: 'Lainnya',
};
export const PACKAGING_LABELS: Record<Packaging, string> = {
  'antistatic-bag': 'Antistatic bag', 'evidence-bag': 'Evidence bag',
  'evidence-box': 'Evidence box', 'envelope': 'Amplop', 'none': 'Tanpa wadah (logis)',
};
export const CUSTODY_TYPE_LABELS: Record<CustodyEventType, string> = {
  collected: 'Pemindangan', transferred: 'Transfer', sealed: 'Penyegelan',
  opened: 'Seal dibuka', released: 'Rilis', resealed: 'Segel ulang',
  disposed: 'Pemusnahan',
};
export const SEAL_CONDITION_LABELS: Record<SealCondition, string> = {
  intact: 'Utuh', broken: 'Pecah', 'not-applicable': 'N/A',
};
export const ACQ_SOURCE_LABELS: Record<AcquisitionSource, string> = {
  'non-volatile': 'Non-volatile (disk)', 'volatile': 'Volatile (RAM / live)',
};
export const ACQ_METHOD_LABELS: Record<AcquisitionMethod, string> = {
  'bit-stream': 'Bit-stream image (fisik)', 'logical': 'Logical copy (logis)',
  'targeted': 'Targeted collection', 'live': 'Live acquisition',
};
export const IMAGE_FORMAT_LABELS: Record<ImageFormat, string> = {
  e01: 'E01', raw: 'RAW (dd)', aff4: 'AFF4', other: 'Lainnya',
};
export const VERIFY_METHOD_LABELS: Record<VerificationMethod, string> = {
  'file-compute': 'Perhitungan berkas', 'manual-entry': 'Input manual',
};
export const VERIFY_RESULT_LABELS: Record<VerificationResult, string> = {
  match: 'MATCH', mismatch: 'MISMATCH', unverified: 'Belum terverifikasi',
};
export const PERSON_ROLE_LABELS: Record<PersonRole, string> = {
  defr: 'DEFR', des: 'DES', 'defr-manager': 'DEFR Manager',
  'des-manager': 'DES Manager', investigator: 'Penyidik', other: 'Lainnya',
};

/* ---------- Helper Party ---------- */
export function isSameParty(a: Party, b: Party): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === 'person' && b.kind === 'person'
    ? a.personId === b.personId
    : (a as { label: string }).label === (b as { label: string }).label;
}

export function partyLabel(p: Party, resolvePersonName: (id: string) => string): string {
  switch (p.kind) {
    case 'person': return resolvePersonName(p.personId);
    case 'location': return p.label;
    case 'external': return p.label;
  }
}

/* ================================================================
 * Policy RBAC — GRU-02 (SRS v0.3): role berwenang per aksi. Policy = DATA (CC-20).
 * `satisfies` menjamin: aksi baru di AuditAction tanpa policy = gagal compile.
 * ================================================================ */

/** Aksi yang sah saat belum ada operator aktif (bootstrap first-run / pemulihan pasca-wipe).
 *  IMPORT termasuk: database kosong tak punya roster — restore backup adalah jalur pemulihan (S5). */
export const BOOTSTRAP_ACTIONS = ['PERSON_ADD', 'PERSON_UPDATE', 'SETTINGS', 'IMPORT'] as const;

export const ACTION_ROLES = {
  CASE_CREATE:        ['defr-manager', 'des-manager'],
  CASE_STATUS:        ['defr-manager', 'des-manager'],
  CASE_UPDATE:        ['defr', 'des', 'defr-manager', 'des-manager'],
  EVIDENCE_REGISTER:  ['defr', 'defr-manager'],
  CUSTODY:            ['defr', 'des', 'defr-manager', 'des-manager'],
  ACQUISITION:        ['des', 'des-manager'],
  VERIFY:             ['des', 'des-manager'],
  HASH_REFERENCE:     ['des', 'des-manager'],
  PERSON_ADD:         ['defr-manager', 'des-manager'],
  PERSON_UPDATE:      ['defr-manager', 'des-manager'],
  PERSON_DEACTIVATE:  ['defr-manager', 'des-manager'],
  SETTINGS:           ['defr-manager', 'des-manager'],
  EXPORT:             ['*'],
  IMPORT:             ['defr-manager', 'des-manager'],
  RESET_DEMO:         ['defr-manager', 'des-manager'],
  WIPE:               ['defr-manager', 'des-manager'],
  CHAIN_VERIFY:       ['*'],
} as const satisfies Record<AuditAction, readonly (PersonRole | '*')[]>;

export function canPerform(role: PersonRole | null, action: AuditAction): boolean {
  const allowed = ACTION_ROLES[action] as readonly (PersonRole | '*')[];
  if (allowed.includes('*')) return true;
  return role !== null && (allowed as readonly PersonRole[]).includes(role);
}
