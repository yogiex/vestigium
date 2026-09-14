import { describe, it, expect } from 'vitest';
import { uid, nextCaseNo, nextEvidenceNo, nextAcquisitionNo } from '../lib/id';
import type { Case, EvidenceItem, AcquisitionRecord } from '../lib/types';

describe('uid', () => {
  it('menghasilkan UUID v4 yang unik', () => {
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('nextCaseNo', () => {
  it('CASE-YYYY-NNN format', () => {
    const result = nextCaseNo([], 2025);
    expect(result).toMatch(/^CASE-2025-\d{3}$/);
  });

  it('nomor berurutan dari array kosong', () => {
    expect(nextCaseNo([], 2025)).toBe('CASE-2025-001');
  });

  it('nomor berurutan dari data existing', () => {
    const existing = [
      { caseNo: 'CASE-2025-001' },
      { caseNo: 'CASE-2025-003' },
    ] as unknown as Case[];
    expect(nextCaseNo(existing, 2025)).toBe('CASE-2025-004');
  });
});

describe('nextEvidenceNo', () => {
  it('EV-NNNN format', () => {
    const result = nextEvidenceNo([]);
    expect(result).toMatch(/^EV-\d{4}$/);
  });

  it('nomor berurutan dari array kosong', () => {
    expect(nextEvidenceNo([])).toBe('EV-0001');
  });

  it('nomor berurutan dari data existing', () => {
    const existing = [
      { itemNo: 'EV-0001' },
      { itemNo: 'EV-0005' },
    ] as unknown as EvidenceItem[];
    expect(nextEvidenceNo(existing)).toBe('EV-0006');
  });
});

describe('nextAcquisitionNo — urut per item (DATA §6, id=UUID)', () => {
  const validEvidence = { id: '550e8400-e29b-41d4-a716-446655440001', itemNo: 'EV-0001' } as unknown as EvidenceItem;
  it('item tanpa akuisisi → AC-EV0001-01', () => {
    expect(nextAcquisitionNo([], validEvidence)).toBe('AC-EV0001-01');
  });
  it('dua akuisisi item → ketiga AC-EV0001-03', () => {
    const mk = (i: string) =>
      ({ id: i, evidenceId: validEvidence.id } as unknown as AcquisitionRecord);
    expect(nextAcquisitionNo([mk('u1'), mk('u2')], validEvidence)).toBe('AC-EV0001-03');
  });
});
