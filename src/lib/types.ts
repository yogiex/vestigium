/**
 * lib/types.ts — Tipe domain Vestigium
 * Ref: DATA.md §3, §10
 */

// ─── Enum ────────────────────────────────────────────────────────────
export type CaseStatus = "open" | "closed";
export type ItemStatus =
  | "collected"
  | "sealed"
  | "opened"
  | "in-analysis"
  | "released";
export type SourceCategory =
  | "computer"
  | "mobile"
  | "removable"
  | "network"
  | "cloud"
  | "iot"
  | "photo"
  | "audio"
  | "document"
  | "other";
export type PowerState = "on" | "off" | "unknown";
export type AcquisitionMethod = "bit-stream" | "logical" | "live";
export type HashVerificationResult =
  | "match"
  | "mismatch"
  | "source-absent"
  | "image-absent";
export type CustodyAction =
  | "collected"
  | "sealed"
  | "transferred"
  | "opened"
  | "released";

// ─── Entity ──────────────────────────────────────────────────────────
export interface Case {
  caseNo: string;
  title: string;
  authorization: string;
  status: CaseStatus;
  createdAt: string; // ISO 8601 UTC
  closedAt?: string;
}

export interface EvidenceItem {
  itemNo: string;
  caseNo: string;
  label: string;
  sourceCategory: SourceCategory;
  serialImei?: string;
  powerState: PowerState;
  status: ItemStatus;
  createdAt: string;
}

export interface CollectionEvent {
  collectionId: string;
  itemNo: string;
  at: string;
  collector: string;
  witnesses: string[];
  packaging: string;
  sealNo?: string;
  volatileChecklist?: VolatileChecklist;
  notes?: string;
  deviationNote?: string;
}

export interface VolatileChecklist {
  ramCaptured: boolean;
  ramNotes?: string;
  runningProcesses?: boolean;
  networkConnections?: boolean;
  mountedDrives?: boolean;
  openFiles?: boolean;
  screenCapture?: boolean;
  timestamp: string;
}

export interface AcquisitionRecord {
  acquisitionId: string;
  itemNo: string;
  at: string;
  method: AcquisitionMethod;
  tool: string;
  toolVersion: string;
  writeBlocker?: string;
  sourceHash: string;
  imageHash: string;
  originalChanged?: boolean;
  justification?: string;
  notes?: string;
}

export interface VerificationRecord {
  verificationId: string;
  itemNo: string;
  at: string;
  performedBy: string;
  expectedHash: string;
  actualHash: string;
  result: HashVerificationResult;
  notes?: string;
}

export interface CustodyEvent {
  custodyId: string;
  itemNo: string;
  at: string;
  action: CustodyAction;
  from?: string;
  to?: string;
  reason: string;
  previousEventId?: string;
}

export interface Examiner {
  id: string;
  name: string;
  role: "DEFR" | "DES";
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  prevHash: string;
  hash: string;
}

export interface SiteSettings {
  siteName: string;
  defaultExaminer: string;
}

// ─── State ───────────────────────────────────────────────────────────
export interface VestigiumState {
  settings: SiteSettings;
  examinerRoster: Examiner[];
  cases: Case[];
  evidenceItems: EvidenceItem[];
  collections: CollectionEvent[];
  acquisitions: AcquisitionRecord[];
  verifications: VerificationRecord[];
  custody: CustodyEvent[];
  audit: AuditEntry[];
}
