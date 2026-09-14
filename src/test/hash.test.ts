import { describe, it, expect } from 'vitest';
import { sha256Text, createSha256, FIPS_VECTORS, runSelfTest } from '../lib/hash';

describe('sha256Text', () => {
  it('SHA-256 kosong = e3b0c442…', () => {
    expect(sha256Text('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('SHA-256("abc") = ba7816bf…', () => {
    expect(sha256Text('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('output = 64 hex lowercase', () => {
    const h = sha256Text('test');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('createSha256 streaming', () => {
  it('chunk by chunk = single shot', () => {
    const enc = new TextEncoder();
    const e1 = createSha256();
    e1.update(enc.encode('hel'));
    e1.update(enc.encode('lo '));
    e1.update(enc.encode('world'));
    const h1 = e1.hex();

    const e2 = createSha256();
    e2.update(enc.encode('hello world'));
    const h2 = e2.hex();

    expect(h1).toBe(h2);
  });

  it('throws after finalization', () => {
    const e = createSha256();
    e.update(new Uint8Array(0));
    e.hex();
    expect(() => e.hex()).toThrow('INVARIANT');
  });
});

describe('FIPS_VECTORS', () => {
  it('setiap vektor konsisten', () => {
    for (const v of FIPS_VECTORS) {
      expect(sha256Text(v.input)).toBe(v.expected);
    }
  });
});

describe('runSelfTest', () => {
  it('semua vektor lulus', () => {
    const result = runSelfTest();
    expect(result.ok).toBe(true);
  });
});
