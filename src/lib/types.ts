/* ================================================================
 * lib/types.ts — satu-satunya sumber tipe domain (CC-10)
 * Transkripsi DATA.md §3 + value objects ter-brand (tactical DDD):
 * salah pakai antar-tipe = gagal COMPILE, bukan bug runtime.
 * Label UI semua enum ada di lib/domain.ts (CC-13) — tidak di sini.
 * ================================================================ */

import { SCHEMA_VERSION } from './config';

/* ---------- Branded primitives (value objects) ---------- */
declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type Uuid = Brand<string, 'Uuid'>;
export type HashHex64 = Brand<string, 'HashHex64'>;
export type UTCString = Brand<string, 'UTCString'>;
export type OffsetISO = Brand<string, 'OffsetISO'>;
export type CaseNo = Brand<string, 'CaseNo'>;
export type EvidenceNo = Brand<string, 'EvidenceNo'>;
export type AcquisitionNo = Brand<string, 'AcquisitionNo'>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH_RE = /^[0-9a-f]{64}$/;
const UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const OFFSET_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

/** Konstruktor aman — pelanggaran format = INVARIANT (CC-35). */
export function asUuid(s: string): Uuid {
  if (!UUID_RE.test(s)) throw new Error('INVARIANT: bukan UUID valid (SEC-06)');
  return s as Uuid;
}
export function asHashHex64(s: string): HashHex64 {
  if (!HASH_RE.test(s)) throw new Error('INVARIANT: hash wajib 64-hex lowercase (FR-M4-03)');
  return s as HashHex64;
}
export function asUtc(s: string): UTCString {
  if (!UTC_RE.test(s)) throw new Error('INVARIANT: UTCString wajib berakhir "Z" (INV-07)');
  return s as UTCString;
}
export function asOffset(s: string): OffsetISO {
  if (!OFFSET_RE.test(s)) throw new Error('INVARIANT: offset ISO tidak valid (INV-07)');
  return s as OffsetISO;
}

/* ---------- Enum terkunci ---------- */
export const SOURCE_CATEGORIES = ['workstation','mobile-device','removable-media','memory',
  'optical-disc','cloud-service','system-log','network-capture','digital-document','iot-other'] as const;
export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

export const MEDIUMS = ['physical', 'logical'] as const;
export type Medium = (typeof MEDIUMS)[number];

export const POWER_STATES = ['on', 'off'] as const;
export type PowerState = (typeof POWER_STATES)[number];

export const PHYSICAL_CONDITIONS = ['intact','damaged','burned','encrypted','other'] as const;
export type PhysicalCondition = (typeof PHYSICAL_CONDITIONS)[number];

export const PACKAGINGS = ['antistatic-bag','evidence-bag','evidence-box','envelope','none'] as const;
export type Packaging = (typeof PACKAGINGS)[number];

export const ITEM_STATUSES = ['collected','sealed','in-analysis','opened','released','disposed'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const CASE_STATUSES = ['open', 'active', 'closed'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const INCIDENT_TYPES = ['unauthorized-access','data-leak','digital-fraud','malware',
  'asset-misuse','internal-dispute','other'] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PERSON_ROLES = ['defr','des','defr-manager','des-manager','investigator','other'] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

export const CUSTODY_TYPES = ['collected','transferred','sealed','opened','released',
  'resealed','disposed'] as const;
export type CustodyEventType = (typeof CUSTODY_TYPES)[number];

export const SEAL_CONDITIONS = ['intact', 'broken', 'not-applicable'] as const;
export type SealCondition = (typeof SEAL_CONDITIONS)[number];

export const ACQ_SOURCES = ['non-volatile', 'volatile'] as const;
export type AcquisitionSource = (typeof ACQ_SOURCES)[number];

export const ACQ_METHODS = ['bit-stream', 'logical', 'targeted', 'live'] as const;
export type AcquisitionMethod = (typeof ACQ_METHODS)[number];

export const IMAGE_FORMATS = ['e01', 'raw', 'aff4', 'other'] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

export const VERIFY_METHODS = ['file-compute', 'manual-entry'] as const;
export type VerificationMethod = (typeof VERIFY_METHODS)[number];

export const VERIFY_RESULTS = ['match', 'mismatch', 'unverified'] as const;
export type VerificationResult = (typeof VERIFY_RESULTS)[number];

export const AUDIT_ACTIONS = ['CASE_CREATE','CASE_STATUS','CASE_UPDATE','EVIDENCE_REGISTER',
  'CUSTODY','ACQUISITION','VERIFY','HASH_REFERENCE','PERSON_ADD','PERSON_UPDATE',
  'PERSON_DEACTIVATE','SETTINGS','EXPORT','IMPORT','RESET_DEMO','WIPE','CHAIN_VERIFY'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/* ---------- Value object: Party (DATA §3.4) ---------- */
export type Party =
  | { kind: 'person'; personId: Uuid }
  | { kind: 'location'; label: string }
  | { kind: 'external'; label: string };

export interface VolatileChecklist {
  screenDocumented: boolean;
  volatilePlanRecorded: boolean;
  shutdownMethodRecorded: boolean;
}

/* ---------- Entitas (DATA §3.1–3.8) ---------- */
export interface Person {
  id: Uuid;
  name: string;
  email?: string;          // identitas login gerbang operator — unik, lowercase (Sesi 3a)
  role: PersonRole;
  organization: string;
  credentials: string;
  isActive: boolean;
  recordedAt: UTCString;
}

export interface Case {
  id: Uuid;
  caseNo: CaseNo;
  title: string;
  incidentType: IncidentType;
  priority: Priority;
  leadDefrId: Uuid;
  specialistDesId?: Uuid;
  organization: string;
  authorizationRef?: string;
  authorizationDate?: OffsetISO;
  scope: string;
  description: string;
  status: CaseStatus;
  occurredAt: OffsetISO;
  recordedAt: UTCString;
  closedAt?: OffsetISO;
  closedReason?: string;
}

export interface EvidenceItem {
  id: Uuid;
  itemNo: EvidenceNo;
  caseId: Uuid;
  label: string;
  category: SourceCategory;
  medium: Medium;
  brand?: string;
  model?: string;
  serial?: string;
  capacityBytes?: number;
  powerState: PowerState;
  discoveryLocation: string;
  discoveryAt?: OffsetISO;
  condition: PhysicalCondition;
  conditionNotes?: string;
  collectedAt: OffsetISO;
  defrId: Uuid;
  witnessId?: Uuid;
  packaging?: Packaging;
  sealNumber?: string;
  volatileChecklist?: VolatileChecklist;
  deviation?: { reason: string } | null;
  referenceHash?: HashHex64;
  referenceHashSource?: { fileName?: string; sizeBytes?: number };
  referenceHashLockedAt?: UTCString;
  status: ItemStatus;
  notes?: string;
  recordedAt: UTCString;
}

export interface CustodyEvent {
  id: Uuid;
  evidenceId: Uuid;
  type: CustodyEventType;
  fromParty: Party;
  toParty: Party;
  reason: string;
  sealCondition: SealCondition;
  sealNumber?: string;
  recordedById: Uuid;
  notes?: string;
  occurredAt: OffsetISO;
  recordedAt: UTCString;
}

export interface AcquisitionRecord {
  id: Uuid;                      // internal UUID (SEC-06) — koreksi DATA §15.7
  acquisitionNo: AcquisitionNo;  // AC-EV0001-01 — display & pencarian (K-2)
  evidenceId: Uuid;
  source: AcquisitionSource;
  method: AcquisitionMethod;
  tool: string;
  writeBlocker: string;
  outputFormat: ImageFormat;
  primaryOutput?: { fileName: string; sizeBytes?: number };
  targetMedia: string;
  startedAt: OffsetISO;
  finishedAt: OffsetISO;
  operatorId: Uuid;
  sourceHash?: HashHex64;
  imageHash?: HashHex64;
  originalChanged: boolean;
  changeJustification?: string;
  sourceClockNotes?: string;
  notes?: string;
  recordedAt: UTCString;
}

export interface VerificationRecord {
  id: Uuid;
  evidenceId: Uuid;
  acquisitionId?: Uuid;
  method: VerificationMethod;
  computedHash: HashHex64;
  result: VerificationResult;
  verifierId: Uuid;
  notes?: string;
  occurredAt: OffsetISO;
  recordedAt: UTCString;
}

export interface AuditEvent {
  seq: number;
  id: Uuid;
  at: UTCString;
  actor: string;
  action: AuditAction;
  target: string;
  detail: string;
  prevHash: HashHex64;
  hash: HashHex64;
}

export interface Settings {
  orgName: string;
  orgUnit: string;
  defaultExaminerId?: Uuid;
  recordedAt: UTCString;
}

export interface VestigiumState {
  schemaVersion: typeof SCHEMA_VERSION;
  persons: Person[];
  cases: Case[];
  evidence: EvidenceItem[];
  custody: CustodyEvent[];
  acquisitions: AcquisitionRecord[];
  verifications: VerificationRecord[];
  audit: AuditEvent[];
  settings: Settings;
}

export interface ChainReport {
  valid: boolean;
  total: number;
  firstBrokenSeq?: number;
  tip: HashHex64;
}
