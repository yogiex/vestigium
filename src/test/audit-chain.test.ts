import { describe, it, expect } from 'vitest';
import { makeAuditEntry, verifyChain, GENESIS_HASH as GENESIS, canonicalJson } from '../lib/audit';
import { FAKE_PERSON } from './fixtures';
import type { AuditEvent } from '../lib/types';

describe('makeAuditEntry & verifyChain (S4)', () => {
  it('golden chain 3 entri valid', () => {
    const a1 = makeAuditEntry([], {
      action: 'CASE_CREATE', target: 'CASE-001', detail: 'Kasus dibuat', actor: FAKE_PERSON,
    });
    const a2 = makeAuditEntry([a1], {
      action: 'EVIDENCE_REGISTER', target: 'EV-0001', detail: 'Item tercatat', actor: FAKE_PERSON,
    });
    const a3 = makeAuditEntry([a1, a2], {
      action: 'CUSTODY', target: 'EV-0001', detail: 'Transfer', actor: FAKE_PERSON,
    });

    expect(a1.seq).toBe(0);
    expect(a2.seq).toBe(1);
    expect(a3.seq).toBe(2);
    expect(a1.prevHash).toBe(GENESIS);
    expect(a2.prevHash).toBe(a1.hash);
    expect(a3.prevHash).toBe(a2.hash);

    const report = verifyChain([a1, a2, a3]);
    expect(report.valid).toBe(true);
    expect(report.total).toBe(3);
    expect(report.tip).toBe(a3.hash);
  });

  it('chain kosong = valid', () => {
    const report = verifyChain([]);
    expect(report.valid).toBe(true);
    expect(report.total).toBe(0);
    expect(report.tip).toBe(GENESIS);
  });

  it('chain rusak (hash dipalsukan)', () => {
    const a1 = makeAuditEntry([], {
      action: 'CASE_CREATE', target: 'CASE-001', detail: 'Kasus', actor: FAKE_PERSON,
    });
    const a2 = makeAuditEntry([a1], {
      action: 'EVIDENCE_REGISTER', target: 'EV-0001', detail: 'Item', actor: FAKE_PERSON,
    });

    // Simulasi pemalsuan: ubah detail a1 tapi pertahankan hash lama
    const tampered = { ...a1, detail: 'PALSU' } as unknown as AuditEvent;

    const report = verifyChain([tampered, a2]);
    expect(report.valid).toBe(false);
    expect(report.firstBrokenSeq).toBe(0);
  });
});

describe('canonicalJson', () => {
  it('key sorted', () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it('nested sorted', () => {
    expect(canonicalJson({ z: { b: 2, a: 1 } })).toBe('{"z":{"a":1,"b":2}}');
  });

  it('undefined throws', () => {
    expect(() => canonicalJson(undefined)).toThrow('INVARIANT');
  });
});
