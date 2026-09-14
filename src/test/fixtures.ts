/* ================================================================
 * test/fixtures.ts — vektor deterministik untuk tes.
 * Tidak pakai uuid package — gunakan uid() dari lib.
 * ================================================================ */

import { SCHEMA_VERSION } from '../lib/config';
import { uid } from '../lib/id';
import { asOffset, asUtc, type AuditEvent, type Case, type EvidenceItem, type HashHex64, type Settings, type Uuid } from '../lib/types';

export const TS = asUtc('2025-07-01T00:00:00.000Z');
export const TS_P1 = asUtc('2025-07-01T00:00:01.000Z');
export const TS_LATER = asUtc('2025-07-02T00:00:00.000Z');
export const OFF = asOffset('2025-07-01T07:00:00+07:00');
export const OFF_UTC = asOffset('2025-07-01T00:00:00Z');

export const GENESIS = '0'.repeat(64) as HashHex64;
export const SAMPLE_HASH = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as HashHex64;
export const FAKE_PERSON: Uuid = uid() as Uuid;

export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return Object.freeze({
    orgName: 'Kantor Forensik',
    orgUnit: 'Unit Siber',
    recordedAt: TS,
    ...overrides,
  });
}

export function makeCase(overrides: Partial<Case> = {}): Case {
  return Object.freeze({
    id: uid() as Uuid,
    caseNo: 'CASE-2025-001' as Case['caseNo'],
    title: 'Kasus Contoh',
    incidentType: 'data-leak',
    priority: 'high',
    leadDefrId: FAKE_PERSON,
    authorizationRef: 'AUT-001',
    authorizationDate: OFF,
    organization: 'Polri',
    scope: 'Audit forensik',
    description: 'Deskripsi kasus',
    status: 'open',
    occurredAt: OFF,
    recordedAt: TS,
    ...overrides,
  });
}

export function makeEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return Object.freeze({
    id: uid() as Uuid,
    itemNo: 'EV-0001' as EvidenceItem['itemNo'],
    caseId: uid() as Uuid,
    label: 'Laptop ASUS',
    category: 'workstation',
    medium: 'physical',
    powerState: 'off',
    discoveryLocation: 'Ruang Server',
    condition: 'intact',
    collectedAt: OFF,
    defrId: FAKE_PERSON,
    packaging: 'evidence-bag',
    sealNumber: 'SEAL-001',
    status: 'collected',
    recordedAt: TS,
    ...overrides,
  });
}

export function makeAuditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return Object.freeze({
    seq: 0,
    id: uid() as Uuid,
    at: TS,
    actor: 'DES-1',
    action: 'CASE_CREATE',
    target: 'CASE-2025-001',
    detail: 'Test',
    prevHash: GENESIS,
    hash: SAMPLE_HASH,
    ...overrides,
  });
}

export const CLEAN_STATE = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  persons: [],
  cases: [],
  evidence: [],
  custody: [],
  acquisitions: [],
  verifications: [],
  audit: [],
  settings: makeSettings(),
});
