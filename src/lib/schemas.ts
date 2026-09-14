/* ================================================================
 * lib/schemas.ts — zod contract SEMUA aksi tulis + backup (SEC-04 .strict())
 * Ref: DATA.md §3 & §10 (INV-07…20)
 * ================================================================ */

import { z } from 'zod';

import { SCHEMA_VERSION } from './config';
import {
  asOffset, asUtc, AUDIT_ACTIONS, PERSON_ROLES,
  type HashHex64, type UTCString, type VestigiumState,
} from './types';

/* ---------- Primitives ter-brand ---------- */
export const uuidField = z.string().uuid('ID internal tidak valid (SEC-06)');

export const hashHex64Schema = z.string()
  .transform(s => s.trim().toLowerCase())
  .refine(s => /^[0-9a-f]{64}$/.test(s), 'Hash SHA-256 wajib 64 karakter hex lowercase.');

export const utcSchema = z.string()
  .refine(s => /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(s),
    'recordedAt wajib ISO UTC berakhir "Z" (INV-07).')
  .transform(s => asUtc(s));

export const offsetIsoSchema = z.string()
  .refine(s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(s),
    'Format waktu tidak valid — gunakan pemilih tanggal-waktu (INV-07).')
  .transform(s => asOffset(s));

/* ---------- Party (CC-08 discriminated union) ---------- */
export const partySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('person'), personId: uuidField }).strict(),
  z.object({ kind: z.literal('location'), label: z.string().min(1, 'Label lokasi wajib diisi.') }).strict(),
  z.object({ kind: z.literal('external'), label: z.string().min(1, 'Label pihak wajib diisi.') }).strict(),
]);

/* ---------- Case (FR-M1-04 / INV-20) ---------- */
export const caseSchema = z.object({
  id: uuidField,
  caseNo: z.string().regex(/^CASE-\d{4}-\d{3}$/, 'Nomor kasus wajib format CASE-YYYY-NNN.'),
  title: z.string().min(1, 'Judul kasus wajib diisi (FR-M1-02).'),
  incidentType: z.string().min(1),
  priority: z.string().min(1),
  leadDefrId: uuidField,
  specialistDesId: uuidField.optional(),
  organization: z.string().default(''),
  authorizationRef: z.string().optional(),
  authorizationDate: offsetIsoSchema.optional(),
  scope: z.string().default(''),
  description: z.string().default(''),
  status: z.enum(['open', 'active', 'closed']),
  occurredAt: offsetIsoSchema,
  recordedAt: utcSchema,
  closedAt: offsetIsoSchema.optional(),
  closedReason: z.string().optional(),
}).strict().refine(
  d => d.status !== 'closed' || (!!d.closedAt && !!d.closedReason),
  { message: 'Penutupan kasus wajib menyertakan tanggal & alasan (FR-M1-04, INV-20).', path: ['closedReason'] },
);

/* ---------- EvidenceItem (INV-10, INV-11) ---------- */
export const evidenceItemSchema = z.object({
  id: uuidField,
  itemNo: z.string().regex(/^EV-\d{4}$/, 'Nomor item wajib format EV-NNNN.'),
  caseId: uuidField,
  label: z.string().min(1, 'Label item wajib diisi (FR-M2-02).'),
  category: z.string().min(1),
  medium: z.enum(['physical', 'logical']),
  brand: z.string().optional(),
  model: z.string().optional(),
  serial: z.string().optional(),
  capacityBytes: z.number().int().positive().optional(),
  powerState: z.enum(['on', 'off']),
  discoveryLocation: z.string().min(1, 'Lokasi penemuan wajib diisi (FR-M2-02).'),
  discoveryAt: offsetIsoSchema.optional(),
  condition: z.string().min(1),
  conditionNotes: z.string().optional(),
  collectedAt: offsetIsoSchema,
  defrId: uuidField,
  witnessId: uuidField.optional(),
  packaging: z.enum(['antistatic-bag','evidence-bag','evidence-box','envelope','none']).optional(),
  sealNumber: z.string().optional(),
  volatileChecklist: z.object({
    screenDocumented: z.boolean(),
    volatilePlanRecorded: z.boolean(),
    shutdownMethodRecorded: z.boolean(),
  }).strict().optional(),
  deviation: z.object({ reason: z.string().min(1, 'Alasan deviasi wajib diisi (FR-M3-04).') })
    .strict().nullable().optional(),
  referenceHash: hashHex64Schema.optional(),
  referenceHashSource: z.object({
    fileName: z.string().optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
  }).strict().optional(),
  referenceHashLockedAt: utcSchema.optional(),
  status: z.enum(['collected','sealed','in-analysis','opened','released','disposed']),
  notes: z.string().optional(),
  recordedAt: utcSchema,
}).strict().superRefine((d, ctx) => {
  if (d.medium === 'physical') {
    if (!d.witnessId)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['witnessId'],
        message: 'Saksi penyitaan wajib untuk item fisik (INV-10, KUHAP D-05).' });
    if (!d.packaging)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['packaging'],
        message: 'Wadah pengemasan wajib untuk item fisik (INV-10).' });
    else if (d.packaging === 'none')
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['packaging'],
        message: 'Item fisik tidak boleh "tanpa wadah" (INV-10).' });
    if (!d.sealNumber)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sealNumber'],
        message: 'Nomor seal tamper-evident wajib untuk item fisik (INV-10).' });
  }
  if (d.powerState === 'on') {
    const c = d.volatileChecklist;
    if (!c || !c.screenDocumented || !c.volatilePlanRecorded || !c.shutdownMethodRecorded)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['volatileChecklist'],
        message: 'Checklist volatile belum lengkap — record tidak dapat disimpan (INV-11, S2).' });
  }
  if (d.condition === 'other' && !d.conditionNotes)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conditionNotes'],
      message: 'Jelaskan kondisi fisik bila memilih "Lainnya".' });
});

/* ---------- CustodyEvent (INV-14) ---------- */
function isSamePartyShallow(a: unknown, b: unknown): boolean {
  const x = a as { kind: string; personId?: string; label?: string };
  const y = b as { kind: string; personId?: string; label?: string };
  if (x.kind !== y.kind) return false;
  return x.kind === 'person' ? x.personId === y.personId : x.label === y.label;
}

export const custodyEventSchema = z.object({
  id: uuidField,
  evidenceId: uuidField,
  type: z.enum(['collected','transferred','sealed','opened','released','resealed','disposed']),
  fromParty: partySchema,
  toParty: partySchema,
  reason: z.string().min(1, 'Alasan wajib diisi (FR-M6-02).'),
  sealCondition: z.enum(['intact', 'broken', 'not-applicable']),
  sealNumber: z.string().optional(),
  recordedById: uuidField,
  notes: z.string().optional(),
  occurredAt: offsetIsoSchema,
  recordedAt: utcSchema,
}).strict().refine(
  d => !isSamePartyShallow(d.fromParty, d.toParty),
  { message: 'Pengirim dan penerima tidak boleh sama (INV-14).', path: ['toParty'] },
);

/* ---------- AcquisitionRecord (INV-12, INV-13, INV-15) ---------- */
export const acquisitionSchema = z.object({
  id: uuidField,
  acquisitionNo: z.string().regex(/^AC-EV\d{4}-\d{2}$/, 'Format nomor akuisisi: AC-EVNNNN-NN (DATA §6).'),
  evidenceId: uuidField,
  source: z.enum(['non-volatile', 'volatile']),
  method: z.enum(['bit-stream', 'logical', 'targeted', 'live']),
  tool: z.string().min(1, 'Tool + versi wajib dicatat (serangan A5, FR-M4-02).'),
  writeBlocker: z.string().min(1, 'Write blocker wajib — atau "tidak digunakan — <alasan>".'),
  outputFormat: z.enum(['e01', 'raw', 'aff4', 'other']),
  primaryOutput: z.object({
    fileName: z.string().min(1),
    sizeBytes: z.number().int().nonnegative().optional(),
  }).strict().optional(),
  targetMedia: z.string().min(1, 'Media tujuan image wajib dicatat.'),
  startedAt: offsetIsoSchema,
  finishedAt: offsetIsoSchema,
  operatorId: uuidField,
  sourceHash: hashHex64Schema.optional(),
  imageHash: hashHex64Schema.optional(),
  originalChanged: z.boolean(),
  changeJustification: z.string().optional(),
  sourceClockNotes: z.string().optional(),
  notes: z.string().optional(),
  recordedAt: utcSchema,
}).strict().superRefine((d, ctx) => {
  if (d.method === 'live' && !d.originalChanged)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['originalChanged'],
      message: 'Live acquisition mengubah original — flag wajib true (INV-12, FR-M4-04).' });
  if (d.originalChanged && !d.changeJustification)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['changeJustification'],
      message: 'Justifikasi perubahan original wajib diisi (INV-13).' });
  if (new Date(d.finishedAt).getTime() < new Date(d.startedAt).getTime())
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['finishedAt'],
      message: 'Waktu selesai tidak boleh sebelum waktu mulai (INV-15).' });
});

/* ---------- VerificationRecord ---------- */
export const verificationSchema = z.object({
  id: uuidField,
  evidenceId: uuidField,
  acquisitionId: uuidField.optional(),
  method: z.enum(['file-compute', 'manual-entry']),
  computedHash: hashHex64Schema,
  result: z.enum(['match', 'mismatch', 'unverified']),
  verifierId: uuidField,
  notes: z.string().optional(),
  occurredAt: offsetIsoSchema,
  recordedAt: utcSchema,
}).strict();

/* ---------- AuditEvent ---------- */
export const auditEventSchema = z.object({
  seq: z.number().int().nonnegative(),
  id: uuidField,
  at: utcSchema,
  actor: z.string().min(1),
  action: z.enum(AUDIT_ACTIONS as unknown as [string, ...string[]]),
  target: z.string().min(1),
  detail: z.string(),
  prevHash: hashHex64Schema,
  hash: hashHex64Schema,
}).strict();

/* ---------- Person (INV-18: deactivate-only) ---------- */
export const personSchema = z.object({
  id: uuidField,
  name: z.string().min(1, 'Nama personel wajib diisi.'),
  email: z.string().email('Format email tidak valid.').optional(),
  role: z.enum(PERSON_ROLES),
  organization: z.string(),
  credentials: z.string(),
  isActive: z.boolean(),
  recordedAt: utcSchema,
}).strict();

/* ---------- State & Backup (.strict() — SEC-04) ---------- */
export const settingsSchema = z.object({
  orgName: z.string().default(''),
  orgUnit: z.string().default(''),
  defaultExaminerId: uuidField.optional(),
  recordedAt: utcSchema,
}).strict();

export const stateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  persons: z.array(personSchema),
  cases: z.array(caseSchema),
  evidence: z.array(evidenceItemSchema),
  custody: z.array(custodyEventSchema),
  acquisitions: z.array(acquisitionSchema),
  verifications: z.array(verificationSchema),
  audit: z.array(auditEventSchema),
  settings: settingsSchema,
}).strict();

export const backupFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  exportedAt: utcSchema,
  chainTip: hashHex64Schema,
  counts: z.record(z.number().int().nonnegative()),
  data: stateSchema,
}).strict();

/** Bentuk berkas backup ber-tipe domain (branded) — output zod dicast di gateway. */
export interface ParsedBackup {
  schemaVersion: typeof SCHEMA_VERSION;
  exportedAt: UTCString;
  chainTip: HashHex64;
  counts: Record<string, number>;
  data: VestigiumState;
}
