import { describe, expect, it } from 'vitest';

import { verifyChain } from '../lib/audit';
import { stateSchema } from '../lib/schemas';
import { buildDemoState, DEMO_HASH } from '../lib/demo';

describe('Fixture demo (D-13) — sah menurut kontrak penuh', () => {
  const demo = buildDemoState();

  it('lolos stateSchema .strict() (SEC-04)', () => {
    expect(stateSchema.safeParse(demo).success).toBe(true);
  });

  it('rantai audit VALID; entri terakhir RESET_DEMO', () => {
    const r = verifyChain(demo.audit);
    expect(r.valid).toBe(true);
    expect(demo.audit[demo.audit.length - 1].action).toBe('RESET_DEMO');
  });

  it('item ber-hash referensi FIPS + verifikasi MATCH; kasus berotorisasi', () => {
    expect(demo.evidence[0].referenceHash).toBe(DEMO_HASH);
    expect(demo.verifications[0].result).toBe('match');
    expect(demo.cases[0].authorizationRef).toBeTruthy();
    expect(demo.custody[0].type).toBe('collected');   // FR-M3-01 — kontinuitas dimulai di lokasi
  });
});
