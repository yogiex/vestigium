import { describe, expect, it } from 'vitest';

import { toAuditCsv } from '../lib/format';

describe('toAuditCsv (RFC4180)', () => {
  it('header + baris ter-escape; kutip digandakan; BOM ada', () => {
    const csv = toAuditCsv([{ seq: 0, at: '2025-03-15T03:04:11Z',
      actor: 'S. "Pratama"', action: 'CUSTODY', target: 'EV-0001',
      detail: 'Transfer: A → B, alas "imaging"' }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('seq,waktu_utc,aktor,aksi,target,detail');
    expect(csv).toContain('"S. ""Pratama"""');
    expect(csv).toContain('"Transfer: A → B, alas ""imaging"""');
  });
});
