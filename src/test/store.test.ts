/* ================================================================
 * test/store.test.ts — jaminan gateway: INV-19, RBAC, INV-06/09/16,
 * FR-M3-01, roundtrip backup (S5), wipe berjejak.
 * ================================================================ */
import { beforeEach, describe, expect, it } from 'vitest';

import { verifyChain } from '../lib/audit';
import type { Uuid } from '../lib/types';
import { useVestigium } from '../store/use-vestigium';

const H = 'a'.repeat(64);
const H2 = 'b'.repeat(64);

function seedOperator(role: 'defr-manager' | 'des-manager' | 'defr' | 'des'): Uuid {
  const r = useVestigium.getState().addPerson({
    name: `Tester ${role}`, role, organization: 'T', credentials: '', isActive: true });
  if (!r.ok) throw new Error('seed person gagal');
  const s = useVestigium.getState().updateSettings({ defaultExaminerId: r.data.id });
  if (!s.ok) throw new Error('seed settings gagal');
  return r.data.id;
}

function seedAuthorizedCase(defrId: Uuid): Uuid {
  const r = useVestigium.getState().registerCase({
    title: 'Kasus uji', incidentType: 'unauthorized-access', priority: 'high',
    leadDefrId: defrId, organization: 'T', scope: 'Server X',
    description: 'uji', authorizationRef: 'ST/01/2025', occurredAt: '2025-03-12T08:00:00+07:00',
  });
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.data.id;
}

const physicalInput = (caseId: Uuid, defrId: Uuid) => ({
  caseId, label: 'SSD Uji', category: 'workstation' as const,
  medium: 'physical' as const, serial: 'SN-1', powerState: 'off' as const,
  discoveryLocation: 'Rak 3', condition: 'intact' as const,
  collectedAt: '2025-03-13T09:14:00+07:00',
  defrId,
  witnessId: defrId, packaging: 'antistatic-bag' as const,
  sealNumber: 'SEAL-2025-0001',
});

/** DES tidak boleh EVIDENCE_REGISTER (GRU-02) — siapkan item sebagai defr-manager, lalu ganti operator ke DES. */
function seedItemForDes(): { des: Uuid; evId: Uuid } {
  const mgr = seedOperator('defr-manager');
  const caseId = seedAuthorizedCase(mgr);
  const evId = registerItem(caseId, mgr);
  const des = seedOperator('des-manager');
  return { des, evId };
}

function registerItem(caseId: Uuid, op: Uuid): Uuid {
  const reg = useVestigium.getState().registerEvidence(physicalInput(caseId, op));
  if (!reg.ok) throw new Error(JSON.stringify(reg.issues));
  return reg.data.id;
}

beforeEach(() => useVestigium.getState().__resetForTests());

describe('Bootstrap & RBAC (GRU-02/03, FR-M8-06)', () => {
  it('first-run: PERSON_ADD & SETTINGS sah tanpa operator', () => {
    const s = useVestigium.getState();
    expect(s.settings.defaultExaminerId).toBeUndefined();
    const r = s.addPerson({ name: 'Awal', role: 'defr-manager', organization: '', credentials: '', isActive: true });
    expect(r.ok).toBe(true);
  });

  it('aksi tanpa wewenang DITOLAK + denial tercatat di audit (FR-M8-06)', () => {
    const id = seedOperator('defr');   // defr tidak boleh CASE_CREATE
    const s = useVestigium.getState();
    const before = s.audit.length;
    const r = s.registerCase({ title: 'x', incidentType: 'other', priority: 'low',
      leadDefrId: id, organization: '', scope: '', description: '',
      occurredAt: '2025-03-12T08:00:00+07:00' });
    expect(r.ok).toBe(false);
    const after = useVestigium.getState();
    expect(after.cases.length).toBe(0);              // tidak ada mutasi data
    expect(after.audit.length).toBe(before + 1);     // tapi penolakan tercatat
    expect(after.audit.at(-1)?.detail).toContain('DITOLAK');
    expect(verifyChain(after.audit).valid).toBe(true);
  });
});

describe('INV-19 + INV-17: setiap mutasi ter-audit dan rantai tetap valid', () => {
  it('3 aksi → audit tumbuh 3, verifyChain valid', () => {
    const op = seedOperator('defr-manager');
    const s = useVestigium.getState();
    const a0 = s.audit.length;
    s.addPerson({ name: 'DEFR Lapangan', role: 'defr', organization: '', credentials: '', isActive: true });
    const r = useVestigium.getState().registerCase({ title: 'K', incidentType: 'data-leak', priority: 'medium',
      leadDefrId: op, organization: '', scope: '', description: '',
      occurredAt: '2025-03-12T08:00:00+07:00' });
    expect(r.ok).toBe(true);
    useVestigium.getState().updateSettings({ orgName: 'PENTEST_org' });
    const s2 = useVestigium.getState();
    expect(s2.audit.length).toBe(a0 + 3);
    expect(verifyChain(s2.audit).valid).toBe(true);
    expect(s2.audit.at(-1)?.seq).toBe(s2.audit.length - 1);   // indeks = seq (DATA §7)
  });
});

describe('INV-09 + FR-M3-01: gerbang otorisasi & custody event pertama', () => {
  it('registrasi evidence TANPA otorisasi ditolak dengan pesan edukatif (S6)', () => {
    const op = seedOperator('defr-manager');
    const caseId = seedAuthorizedCase(op);
    useVestigium.getState().updateCaseContext(caseId, { authorizationRef: undefined });
    const r = useVestigium.getState().registerEvidence(physicalInput(caseId, op));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].message).toContain('otorisasi');
  });

  it('registrasi fisik lengkap → item + custody event "collected" lahir bersama', () => {
    const op = seedOperator('defr-manager');
    const caseId = seedAuthorizedCase(op);
    registerItem(caseId, op);
    const s = useVestigium.getState();
    expect(s.evidence.length).toBe(1);
    expect(s.custody.length).toBe(1);
    expect(s.custody[0].type).toBe('collected');
    expect(s.custody[0].fromParty).toEqual({ kind: 'location', label: 'Rak 3' });
  });

  it('INV-10: fisik tanpa saksi ditolak lewat schema (defense-in-depth di gateway)', () => {
    const op = seedOperator('defr-manager');
    const caseId = seedAuthorizedCase(op);
    const { witnessId: _w, ...tanpaSaksi } = physicalInput(caseId, op);
    void _w;
    const r = useVestigium.getState().registerEvidence(tanpaSaksi);
    expect(r.ok).toBe(false);
  });

  it('INV-05: nomor seal duplikat lintas item ditolak', () => {
    const op = seedOperator('defr-manager');
    const caseId = seedAuthorizedCase(op);
    registerItem(caseId, op);
    const r = useVestigium.getState().registerEvidence(physicalInput(caseId, op));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].path).toBe('sealNumber');
  });
});

describe('Siklus custody: collected → sealed → opened → released', () => {
  it('status + event custody bergerak selaras; transfer dari = custodian turunan', () => {
    const op = seedOperator('defr-manager');
    const caseId = seedAuthorizedCase(op);
    const evId = registerItem(caseId, op);

    const seal = useVestigium.getState().sealEvidence(evId, {
      toParty: { kind: 'location', label: 'Evidence Room' },
      reason: 'Penyimpanan tersegel', occurredAt: '2025-03-13T11:00:00+07:00' });
    expect(seal.ok).toBe(true);
    if (seal.ok) expect(seal.data.fromParty).toEqual({ kind: 'person', personId: op });
    expect(useVestigium.getState().evidence[0].status).toBe('sealed');

    const open = useVestigium.getState().openSeal(evId,
      { toParty: { kind: 'person', personId: op }, reason: 'Imaging',
        occurredAt: '2025-03-14T10:00:00+07:00', sealCondition: 'broken' });
    expect(open.ok).toBe(true);
    expect(useVestigium.getState().evidence[0].status).toBe('opened');

    const rel = useVestigium.getState().releaseEvidence(evId,
      { toParty: { kind: 'external', label: 'Kejaksaan' }, reason: 'Serah terima P21',
        occurredAt: '2025-03-15T09:00:00+07:00' });
    expect(rel.ok).toBe(true);
    const s = useVestigium.getState();
    expect(s.evidence[0].status).toBe('released');
    expect(s.custody.length).toBe(4);
    expect(verifyChain(s.audit).valid).toBe(true);
  });

  it('transisi ilegal (released → sealed) → throw INVARIANT (CC-35)', () => {
    const op = seedOperator('defr-manager');
    const caseId = seedAuthorizedCase(op);
    const evId = registerItem(caseId, op);
    useVestigium.getState().startAnalysis(evId,
      { toParty: { kind: 'location', label: 'Lab Forensik' }, reason: 'r',
        occurredAt: '2025-03-14T09:00:00+07:00' });
    const rel = useVestigium.getState().releaseEvidence(evId,
      { toParty: { kind: 'external', label: 'Kejaksaan' }, reason: 'r',
        occurredAt: '2025-03-15T09:00:00+07:00' });
    expect(rel.ok).toBe(true);
    expect(() => useVestigium.getState().sealEvidence(evId,
      { toParty: { kind: 'location', label: 'ER' }, reason: 'r',
        occurredAt: '2025-03-16T09:00:00+07:00' })).toThrow(/INVARIANT/);
  });
});

describe('INV-06 & INV-16: hash referensi write-once; result konsisten', () => {
  it('setReferenceHash kedua kali → throw INVARIANT', () => {
    const { evId } = seedItemForDes();
    expect(useVestigium.getState().setReferenceHash(evId, H, { fileName: 'img.E01' }).ok).toBe(true);
    expect(() => useVestigium.getState().setReferenceHash(evId, H2)).toThrow(/INV-06/);
  });

  it('result mismatch padahal hash cocok → ditolak (INV-16)', () => {
    const { des: op, evId } = seedItemForDes();
    useVestigium.getState().setReferenceHash(evId, H);
    const r = useVestigium.getState().appendVerification({
      evidenceId: evId, method: 'manual-entry', computedHash: H as never,
      result: 'mismatch', verifierId: op, occurredAt: '2025-03-15T08:00:00+07:00' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].message).toContain('INV-16');
  });

  it('akuisisi: id UUID + acquisitionNo AC-EV0001-01; mismatch hash tetap disimpan (FR-M4-07)', () => {
    const { des: op, evId } = seedItemForDes();
    const r = useVestigium.getState().appendAcquisition({
      evidenceId: evId, source: 'non-volatile', method: 'bit-stream', tool: 'FTK Imager 4.7',
      writeBlocker: 'Tableau T35689iu', outputFormat: 'e01', targetMedia: 'HDD 1TB',
      startedAt: '2025-03-14T10:00:00+07:00', finishedAt: '2025-03-14T12:00:00+07:00',
      operatorId: op, sourceHash: H as never, imageHash: H2 as never, originalChanged: false });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.acquisitionNo).toBe('AC-EV0001-01');
      expect(r.data.id).not.toBe(r.data.acquisitionNo);
      expect(r.data.imageHash).toBe(H2);
    }
    expect(useVestigium.getState().audit.at(-1)?.detail).toContain('MISMATCH');
  });
});

describe('S5 — roundtrip backup: ekspor → wipe → impor → rantai valid', () => {
  it('data identik setelah restore; audit IMPORT menaut rantai baru', () => {
    const op = seedOperator('defr-manager');
    const caseId = seedAuthorizedCase(op);
    registerItem(caseId, op);
    const backup = useVestigium.getState().exportBackup();

    useVestigium.getState().wipeAll();
    const afterWipe = useVestigium.getState();
    expect(afterWipe.cases.length).toBe(0);
    expect(afterWipe.audit.length).toBe(1);                       // jejak WIPE
    expect(afterWipe.audit[0].action).toBe('WIPE');

    const r = useVestigium.getState().applyBackup(JSON.parse(JSON.stringify(backup)));
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    const restored = useVestigium.getState();
    expect(restored.cases.length).toBe(backup.data.cases.length);
    expect(restored.evidence.length).toBe(1);
    expect(verifyChain(restored.audit).valid).toBe(true);
    expect(restored.audit.at(-1)?.action).toBe('IMPORT');          // menaut database impor
    expect(restored.audit.at(-1)?.seq).toBe(restored.audit.length - 1);
  });

  it('parseBackup menolak berkas dengan field asing (SEC-04 .strict())', () => {
    const r = useVestigium.getState().parseBackup({ schemaVersion: 1, injected: true });
    expect(r.ok).toBe(false);
  });
});

describe('Append-only (INV-01) — perilaku array', () => {
  it('custody/audit hanya bertambah sepanjang siklus penuh', () => {
    const op = seedOperator('defr-manager');
    const caseId = seedAuthorizedCase(op);
    const evId = registerItem(caseId, op);
    const lens = [useVestigium.getState().custody.length];
    useVestigium.getState().sealEvidence(evId,
      { toParty: { kind: 'location', label: 'ER' }, reason: 'r', occurredAt: '2025-03-13T11:00:00+07:00' });
    lens.push(useVestigium.getState().custody.length);
    useVestigium.getState().openSeal(evId,
      { toParty: { kind: 'person', personId: op }, reason: 'r', occurredAt: '2025-03-14T10:00:00+07:00' });
    lens.push(useVestigium.getState().custody.length);
    expect(lens).toEqual([1, 2, 3]);   // monoton — tidak pernah menyusut
  });
});
