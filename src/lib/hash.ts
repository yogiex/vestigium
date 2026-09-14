/* ================================================================
 * lib/hash.ts — mesin SHA-256 inkremental murni (tanpa DOM/React, CC-02/03)
 * Perubahan file ini wajib: lulus self-test FIPS + alasan di commit (CC-24).
 * ================================================================ */

import { asHashHex64, type HashHex64 } from './types';

const K256 = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);

export interface Sha256Engine {
  update(chunk: Uint8Array): void;
  hex(): HashHex64;
}

export function createSha256(): Sha256Engine {
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
                             0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const buf = new Uint8Array(64);
  let bl = 0, total = 0, finalized = false;

  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  function block(p: Uint8Array, off: number): void {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) {
      w[i] = ((p[off + 4 * i] << 24) | (p[off + 4 * i + 1] << 16) |
              (p[off + 4 * i + 2] << 8) | p[off + 4 * i + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const a15 = w[i - 15], a2 = w[i - 2];
      const s0 = rotr(a15, 7) ^ rotr(a15, 18) ^ (a15 >>> 3);
      const s1 = rotr(a2, 17) ^ rotr(a2, 19) ^ (a2 >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3],
        e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }

  function update(chunk: Uint8Array): void {
    total += chunk.length;
    let off = 0;
    if (bl > 0) {
      const take = Math.min(64 - bl, chunk.length);
      buf.set(chunk.subarray(0, take), bl);
      bl += take; off = take;
      if (bl === 64) { block(buf, 0); bl = 0; }
    }
    while (off + 64 <= chunk.length) { block(chunk, off); off += 64; }
    if (off < chunk.length) { buf.set(chunk.subarray(off), 0); bl = chunk.length - off; }
  }

  function hex(): HashHex64 {
    if (finalized) throw new Error('INVARIANT: engine sudah difinalisasi — buat engine baru');
    finalized = true;
    const bits = total * 8;
    const padLen = bl < 56 ? 56 - bl : 120 - bl;
    const p = new Uint8Array(padLen + 8);
    p[0] = 0x80;
    const dv = new DataView(p.buffer);
    dv.setUint32(padLen, Math.floor(bits / 4294967296));
    dv.setUint32(padLen + 4, bits >>> 0);
    update(p);
    let s = '';
    for (let i = 0; i < 8; i++) s += H[i].toString(16).padStart(8, '0');
    return asHashHex64(s);
  }

  return { update, hex };
}

export function sha256Bytes(data: Uint8Array): HashHex64 {
  const e = createSha256();
  e.update(data);
  return e.hex();
}

export function sha256Text(s: string): HashHex64 {
  return sha256Bytes(new TextEncoder().encode(s));
}

export const FIPS_VECTORS = [
  { input: 'abc',
    expected: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' },
  { input: 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    expected: '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1' },
  { input: '',
    expected: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
] as const;

export function runSelfTest(): { ok: boolean } {
  const ok = FIPS_VECTORS.every(v => sha256Text(v.input) === v.expected);
  return { ok };
}
