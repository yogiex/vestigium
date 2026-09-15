/* ================================================================
 * lib/demo.ts — fixture demo D-13 / FR-M10-04 (PROTOTIPE)
 * Murni (CC-04): state lengkap + rantai audit VALID via makeAuditEntry.
 * Akun demo = identitas roster (@vestigium.demo) — TANPA password:
 * gerbang login tetap email-matching (README Model Kepercayaan, GRU-01).
 * Dibangun lewat rantai audit asli, bukan data tempelan — sehingga demo
 * memperlihatkan sistem yang "sudah dipakai" (INV-17 tetap terjaga).
 * ================================================================ */

import { makeAuditEntry } from './audit';
import { SCHEMA_VERSION } from './config';
import { FIPS_VECTORS } from './hash';
import { offset, utc } from './time';
import {
  asHashHex64,
  type AcquisitionNo, type AcquisitionRecord, type AuditEvent, type Case, type CaseNo,
  type CustodyEvent, type EvidenceItem, type EvidenceNo, type Person, type Settings,
  type Uuid, type VerificationRecord, type VestigiumState,
} from './types';

/** Hash demo = vektor FIPS "abc" — valid, dikenali, dapat diverifikasi ulang di Integrity Lab. */
export const DEMO_HASH = asHashHex64(FIPS_VECTORS[0].expected);

export const DEMO_IDS = {
  manager: '11111111-1111-4111-8111-111111111111',
  defr: '22222222-2222-4222-8222-222222222222',
  des: '33333333-3333-4333-8333-333333333333',
  investigator: '44444444-4444-4444-8444-444444444444',
  witness: '55555555-5555-4555-8555-555555555555',
  case: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  ev: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  acq: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  ver: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  cust1: 'c0000000-0000-4000-8000-000000000001',
  cust2: 'c0000000-0000-4000-8000-000000000002',
} as const;

/** Ditampilkan di layar login saat data demo terpasang (tanpa password — gerbang identitas). */
export const DEMO_ACCOUNTS = [
  { email: 'manager@vestigium.demo', role: 'DES Manager — akses penuh' },
  { email: 'defr@vestigium.demo', role: 'DEFR — kasus & evidence' },
  { email: 'des@vestigium.demo', role: 'DES — akuisisi & verifikasi' },
  { email: 'investigator@vestigium.demo', role: 'Penyidik — banyak aksi ditolak (demo RBAC)' },
] as const;

const ACTOR = 'S. Pratama, DES';
const ORG = 'PT Nusantara Data — Unit Forensik Digital';

export function buildDemoState(): VestigiumState {
  const persons: Person[] = [
    { id: DEMO_IDS.manager as Uuid, name: ACTOR, email: 'manager@vestigium.demo', role: 'des-manager',
      organization: ORG, credentials: 'DES, CHFI', isActive: true, recordedAt: utc('2025-03-01T02:00:00Z') },
    { id: DEMO_IDS.defr as Uuid, name: 'A. Ramadhan, DEFR', email: 'defr@vestigium.demo', role: 'defr',
      organization: ORG, credentials: 'DEFR', isActive: true, recordedAt: utc('2025-03-01T02:01:00Z') },
    { id: DEMO_IDS.des as Uuid, name: 'R. Maharani, DES', email: 'des@vestigium.demo', role: 'des',
      organization: ORG, credentials: 'DES', isActive: true, recordedAt: utc('2025-03-01T02:02:00Z') },
    { id: DEMO_IDS.investigator as Uuid, name: 'Budi Santoso', email: 'investigator@vestigium.demo',
      role: 'investigator', organization: ORG, credentials: '—', isActive: true,
      recordedAt: utc('2025-03-01T02:03:00Z') },
    { id: DEMO_IDS.witness as Uuid, name: 'Citra Dewi (saksi internal)', role: 'other',
      organization: ORG, credentials: '—', isActive: true, recordedAt: utc('2025-03-01T02:04:00Z') },
  ];

  const kase: Case = {
    id: DEMO_IDS.case as Uuid, caseNo: 'CASE-2025-001' as CaseNo,
    title: 'Dugaan akses tidak sah pada server HRD-01',
    incidentType: 'unauthorized-access', priority: 'high',
    leadDefrId: DEMO_IDS.defr as Uuid, specialistDesId: DEMO_IDS.des as Uuid,
    organization: ORG, authorizationRef: 'ST/DF/011/2025',
    authorizationDate: offset('2025-03-10T09:00:00+07:00'),
    // FR-M1-03 — otorisasi terisi agar collection lolos gerbang INV-09
    scope: 'Server HRD-01, media penyimpanan & memori terkait',
    description: 'Login anomali di luar jam kerja dari IP tidak dikenal. Diminta akuisisi disk & RAM untuk rekonstruksi aktivitas.',
    status: 'active',
    occurredAt: offset('2025-03-12T08:00:00+07:00'), recordedAt: utc('2025-03-12T01:05:00Z'),
  };

  const ev: EvidenceItem = {
    id: DEMO_IDS.ev as Uuid, itemNo: 'EV-0001' as EvidenceNo, caseId: kase.id,
    label: 'SSD Server HRD-01 (500 GB)', category: 'workstation', medium: 'physical',
    serial: 'SN-SSD-001', capacityBytes: 500107862016,
    powerState: 'off', discoveryLocation: 'Rak server lt. 3', condition: 'intact',
    collectedAt: offset('2025-03-13T09:14:00+07:00'),
    defrId: DEMO_IDS.defr as Uuid,
    witnessId: DEMO_IDS.witness as Uuid,   // INV-10 — item fisik wajib saksi
    packaging: 'antistatic-bag', sealNumber: 'SEAL-2025-0001',
    referenceHash: DEMO_HASH,               // INV-06 — hash referensi terkunci
    referenceHashSource: { fileName: 'HRD-01.E01', sizeBytes: 500107862016 },
    referenceHashLockedAt: utc('2025-03-16T01:10:00Z'),
    status: 'in-analysis', notes: 'Image E01 + verifikasi ganda (FIPS vector "abc").',
    recordedAt: utc('2025-03-13T02:16:00Z'),
  };

  const custody: CustodyEvent[] = [
    // FR-M3-01 — rantai custody dimulai dari lokasi penemuan
    { id: DEMO_IDS.cust1 as Uuid, evidenceId: ev.id, type: 'collected',
      fromParty: { kind: 'location', label: 'Rak server lt. 3' },
      toParty: { kind: 'person', personId: DEMO_IDS.defr as Uuid },
      reason: 'Pemindangan awal di lokasi (ISO 27037 §6.3)',
      sealCondition: 'intact', sealNumber: 'SEAL-2025-0001',
      recordedById: DEMO_IDS.defr as Uuid,
      occurredAt: ev.collectedAt, recordedAt: utc('2025-03-13T02:16:00Z') },
    { id: DEMO_IDS.cust2 as Uuid, evidenceId: ev.id, type: 'transferred',
      fromParty: { kind: 'person', personId: DEMO_IDS.defr as Uuid },
      toParty: { kind: 'person', personId: DEMO_IDS.des as Uuid },
      reason: 'Serah terima imaging & analisis artefak',
      sealCondition: 'not-applicable',
      recordedById: DEMO_IDS.des as Uuid,
      occurredAt: offset('2025-03-14T09:30:00+07:00'), recordedAt: utc('2025-03-14T02:35:00Z') },
  ];

  const acq: AcquisitionRecord = {
    id: DEMO_IDS.acq as Uuid, acquisitionNo: 'AC-EV0001-01' as AcquisitionNo,
    evidenceId: ev.id, source: 'non-volatile', method: 'bit-stream',
    tool: 'FTK Imager 4.7.0', writeBlocker: 'Tableau T8u',
    outputFormat: 'e01', primaryOutput: { fileName: 'HRD-01.E01', sizeBytes: 500107862016 },
    targetMedia: 'Evidence HDD-04',
    startedAt: offset('2025-03-14T10:00:00+07:00'), finishedAt: offset('2025-03-14T12:30:00+07:00'),
    operatorId: DEMO_IDS.des as Uuid,
    sourceHash: DEMO_HASH, imageHash: DEMO_HASH,   // FR-M4-07 — hash sumber == image
    originalChanged: false,
    sourceClockNotes: 'Jam sistem server tertinggal ±4 menit dari UTC (dicatat saat akuisisi)',
    notes: 'Verifikasi ganda: hash sumber == hash image.',
    recordedAt: utc('2025-03-14T05:31:00Z'),
  };

  const ver: VerificationRecord = {
    id: DEMO_IDS.ver as Uuid, evidenceId: ev.id,
    method: 'file-compute', computedHash: DEMO_HASH, result: 'match',
    verifierId: DEMO_IDS.des as Uuid,
    notes: 'Verifikasi ulang image E01 via Integrity Lab.',
    occurredAt: offset('2025-03-16T08:00:00+07:00'), recordedAt: utc('2025-03-16T01:10:00Z'),
  };

  const settings: Settings = {
    orgName: 'PT Nusantara Data', orgUnit: 'Unit Forensik Digital',
    defaultExaminerId: DEMO_IDS.manager as Uuid,
    recordedAt: utc('2025-03-01T02:00:00Z'),
  };

  /* Rantai audit — dibangun dengan makeAuditEntry agar hash-chain VALID (INV-17). */
  const audit: AuditEvent[] = [];
  const add = (action: AuditEvent['action'], target: string, detail: string, at: string) =>
    void audit.push(makeAuditEntry(audit, { action, target, detail, actor: ACTOR, at }));

  add('PERSON_ADD', ACTOR, 'Roster: des-manager (akun demo)', '2025-03-01T02:00:05Z');
  add('PERSON_ADD', 'A. Ramadhan, DEFR', 'Roster: defr (akun demo)', '2025-03-01T02:01:05Z');
  add('PERSON_ADD', 'R. Maharani, DES', 'Roster: des (akun demo)', '2025-03-01T02:02:05Z');
  add('PERSON_ADD', 'Budi Santoso', 'Roster: investigator (akun demo RBAC)', '2025-03-01T02:03:05Z');
  add('PERSON_ADD', 'Citra Dewi', 'Roster: saksi internal', '2025-03-01T02:04:05Z');
  add('SETTINGS', 'settings', 'Operator aktif: S. Pratama, DES · identitas unit demo', '2025-03-01T02:05:00Z');
  add('CASE_CREATE', kase.caseNo, `${kase.title} · PIC A. Ramadhan, DEFR`, '2025-03-12T01:05:10Z');
  add('EVIDENCE_REGISTER', ev.itemNo, `${ev.label} → ${kase.caseNo} (OFF)`, '2025-03-13T02:16:10Z');
  add('CUSTODY', ev.itemNo, 'Pemindangan: Rak server lt. 3 → A. Ramadhan, DEFR', '2025-03-13T02:16:20Z');
  add('CUSTODY', ev.itemNo, 'Transfer: A. Ramadhan, DEFR → R. Maharani, DES — imaging & analisis', '2025-03-14T02:35:10Z');
  add('ACQUISITION', ev.itemNo, 'AC-EV0001-01 · bit-stream · FTK Imager 4.7.0 · hash MATCH', '2025-03-14T05:31:10Z');
  add('HASH_REFERENCE', ev.itemNo, 'Hash referensi ditetapkan dari "HRD-01.E01" — TERKUNCI (INV-06)', '2025-03-16T01:10:05Z');
  add('VERIFY', ev.itemNo, 'Verifikasi file-compute: MATCH', '2025-03-16T01:10:15Z');
  add('RESET_DEMO', 'demo', 'Data demo dimuat (prototipe, D-13) — akun: @vestigium.demo', '2025-03-16T01:11:00Z');

  return {
    schemaVersion: SCHEMA_VERSION,
    persons,
    cases: [kase],
    evidence: [ev],
    custody,
    acquisitions: [acq],
    verifications: [ver],
    audit,
    settings,
  };
}
