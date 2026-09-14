import { describe, it, expect } from 'vitest';
import {
  caseSchema, evidenceItemSchema, custodyEventSchema, acquisitionSchema,
  backupFileSchema, uuidField, hashHex64Schema, utcSchema, offsetIsoSchema, partySchema,
} from '../lib/schemas';

describe('uuidField', () => {
  it('UUID valid diterima', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(uuidField.parse(id)).toBe(id);
  });

  it('UUID invalid ditolak', () => {
    expect(() => uuidField.parse('bukan-uuid')).toThrow();
  });
});

describe('hashHex64Schema', () => {
  it('normalisasi ke lowercase', () => {
    const h = hashHex64Schema.parse('ABCDEF'.padEnd(64, '0'));
    expect(h).toBe('abcdef'.padEnd(64, '0'));
  });

  it('64 hex chars diterima', () => {
    expect(() => hashHex64Schema.parse('0'.repeat(64))).not.toThrow();
  });
});

describe('utcSchema', () => {
  it('ISO UTC dengan Z diterima', () => {
    const result = utcSchema.parse('2025-07-01T00:00:00.000Z');
    expect(result).toBe('2025-07-01T00:00:00.000Z');
  });

  it('tanpa Z ditolak (INV-07)', () => {
    expect(() => utcSchema.parse('2025-07-01T07:00:00')).toThrow();
  });

  it('dengan offset +07:00 ditolak (bukan UTC)', () => {
    expect(() => utcSchema.parse('2025-07-01T07:00:00+07:00')).toThrow();
  });
});

describe('offsetIsoSchema', () => {
  it('dengan Z diterima', () => {
    expect(() => offsetIsoSchema.parse('2025-07-01T00:00:00Z')).not.toThrow();
  });

  it('dengan offset +07:00 diterima', () => {
    expect(() => offsetIsoSchema.parse('2025-07-01T07:00:00+07:00')).not.toThrow();
  });

  it('tanpa offset ditolak', () => {
    expect(() => offsetIsoSchema.parse('2025-07-01T07:00:00')).toThrow();
  });
});

describe('partySchema', () => {
  it('person diterima', () => {
    expect(partySchema.parse({ kind: 'person', personId: '550e8400-e29b-41d4-a716-446655440000' })).toEqual(
      { kind: 'person', personId: '550e8400-e29b-41d4-a716-446655440000' }
    );
  });

  it('location diterima', () => {
    expect(partySchema.parse({ kind: 'location', label: 'Gedung Utama' })).toEqual(
      { kind: 'location', label: 'Gedung Utama' }
    );
  });

  it('external diterima', () => {
    expect(partySchema.parse({ kind: 'external', label: 'External Lab' })).toEqual(
      { kind: 'external', label: 'External Lab' }
    );
  });

  it('label kosong ditolak', () => {
    expect(() => partySchema.parse({ kind: 'location', label: '' })).toThrow();
  });
});

describe('caseSchema', () => {
  it('kasus valid diterima', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      caseNo: 'CASE-2025-001',
      title: 'Kasus Contoh',
      incidentType: 'data-leak',
      priority: 'high',
      leadDefrId: '550e8400-e29b-41d4-a716-446655440001',
      status: 'open',
      occurredAt: '2025-07-01T07:00:00+07:00',
      recordedAt: '2025-07-01T00:00:00.000Z',
    };
    expect(() => caseSchema.parse(valid)).not.toThrow();
  });

  it('caseNo format salah ditolak', () => {
    const invalid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      caseNo: 'CASE-001',
      title: 'Kasus',
      incidentType: 'data-leak',
      priority: 'high',
      leadDefrId: '550e8400-e29b-41d4-a716-446655440001',
      status: 'open',
      occurredAt: '2025-07-01T07:00:00+07:00',
      recordedAt: '2025-07-01T00:00:00.000Z',
    };
    expect(() => caseSchema.parse(invalid)).toThrow();
  });

  it('status closed tanpa closedAt + closedReason ditolak (INV-20)', () => {
    const invalid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      caseNo: 'CASE-2025-001',
      title: 'Kasus',
      incidentType: 'data-leak',
      priority: 'high',
      leadDefrId: '550e8400-e29b-41d4-a716-446655440001',
      status: 'closed',
      occurredAt: '2025-07-01T07:00:00+07:00',
      recordedAt: '2025-07-01T00:00:00.000Z',
    };
    expect(() => caseSchema.parse(invalid)).toThrow('Penutupan kasus wajib');
  });

  it('field asing ditolak', () => {
    const extra = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      caseNo: 'CASE-2025-001',
      title: 'Kasus',
      incidentType: 'data-leak',
      priority: 'high',
      leadDefrId: '550e8400-e29b-41d4-a716-446655440001',
      status: 'open',
      occurredAt: '2025-07-01T07:00:00+07:00',
      recordedAt: '2025-07-01T00:00:00.000Z',
      hackerField: 'evil',
    };
    expect(() => caseSchema.parse(extra)).toThrow();
  });
});

describe('evidenceItemSchema', () => {
  const validPhysical = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    itemNo: 'EV-0001',
    caseId: '550e8400-e29b-41d4-a716-446655440001',
    label: 'Laptop',
    category: 'workstation',
    medium: 'physical',
    powerState: 'off',
    discoveryLocation: 'Ruang Server',
    condition: 'intact',
    collectedAt: '2025-07-01T07:00:00+07:00',
    defrId: '550e8400-e29b-41d4-a716-446655440002',
    witnessId: '550e8400-e29b-41d4-a716-446655440003',
    packaging: 'evidence-bag',
    sealNumber: 'SEAL-001',
    status: 'collected',
    recordedAt: '2025-07-01T00:00:00.000Z',
  };

  it('item fisik valid diterima', () => {
    expect(() => evidenceItemSchema.parse(validPhysical)).not.toThrow();
  });

  it('item fisik tanpa witnessId ditolak (INV-10)', () => {
    const noWitness = { ...validPhysical, witnessId: undefined };
    expect(() => evidenceItemSchema.parse(noWitness)).toThrow(/saksi/i);
  });

  it('item fisik tanpa packaging ditolak (INV-10)', () => {
    const noPack = { ...validPhysical, packaging: undefined };
    expect(() => evidenceItemSchema.parse(noPack)).toThrow(/wadah/i);
  });

  it('item fisik dengan packaging "none" ditolak (INV-10)', () => {
    const nonePack = { ...validPhysical, packaging: 'none' };
    expect(() => evidenceItemSchema.parse(nonePack)).toThrow(/wadah/i);
  });

  it('item fisik tanpa sealNumber ditolak (INV-10)', () => {
    const noSeal = { ...validPhysical, sealNumber: undefined };
    expect(() => evidenceItemSchema.parse(noSeal)).toThrow(/seal/i);
  });

  it('item power ON tanpa checklist lengkap ditolak (INV-11)', () => {
    const onItem = {
      ...validPhysical,
      powerState: 'on',
      volatileChecklist: { screenDocumented: false, volatilePlanRecorded: false, shutdownMethodRecorded: false },
    };
    expect(() => evidenceItemSchema.parse(onItem)).toThrow(/checklist/i);
  });

  it('item logis tanpa saksi & packaging lolos', () => {
    const logical = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      itemNo: 'EV-0001',
      caseId: '550e8400-e29b-41d4-a716-446655440001',
      label: 'Backup log',
      category: 'system-log',
      medium: 'logical',
      powerState: 'off',
      discoveryLocation: 'Server',
      condition: 'intact',
      collectedAt: '2025-07-01T07:00:00+07:00',
      defrId: '550e8400-e29b-41d4-a716-446655440002',
      status: 'collected',
      recordedAt: '2025-07-01T00:00:00.000Z',
    };
    expect(() => evidenceItemSchema.parse(logical)).not.toThrow();
  });

  it('condition "other" tanpa notes ditolak', () => {
    const other = { ...validPhysical, condition: 'other', conditionNotes: undefined };
    expect(() => evidenceItemSchema.parse(other)).toThrow();
  });
});

describe('custodyEventSchema', () => {
  const validCustody = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    evidenceId: '550e8400-e29b-41d4-a716-446655440001',
    type: 'transferred',
    fromParty: { kind: 'person', personId: '550e8400-e29b-41d4-a716-446655440002' },
    toParty: { kind: 'person', personId: '550e8400-e29b-41d4-a716-446655440003' },
    reason: 'Transfer ke lab',
    sealCondition: 'intact',
    recordedById: '550e8400-e29b-41d4-a716-446655440004',
    occurredAt: '2025-07-01T07:00:00+07:00',
    recordedAt: '2025-07-01T00:00:00.000Z',
  };

  it('custody valid diterima', () => {
    expect(() => custodyEventSchema.parse(validCustody)).not.toThrow();
  });

  it('from == to ditolak (INV-14)', () => {
    const sameParty = {
      ...validCustody,
      fromParty: { kind: 'person', personId: '550e8400-e29b-41d4-a716-446655440002' },
      toParty: { kind: 'person', personId: '550e8400-e29b-41d4-a716-446655440002' },
    };
    expect(() => custodyEventSchema.parse(sameParty)).toThrow('sama');
  });
});

describe('acquisitionSchema', () => {
  const validAcq = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    acquisitionNo: 'AC-EV0001-01',
    evidenceId: '550e8400-e29b-41d4-a716-446655440001',
    source: 'non-volatile',
    method: 'bit-stream',
    tool: 'FTK Imager 4.7',
    writeBlocker: 'Tableau T35689iu',
    outputFormat: 'e01',
    targetMedia: 'HDD Seagate 1TB',
    startedAt: '2025-07-01T07:00:00+07:00',
    finishedAt: '2025-07-01T08:00:00+07:00',
    operatorId: '550e8400-e29b-41d4-a716-446655440002',
    originalChanged: false,
    recordedAt: '2025-07-01T00:00:00.000Z',
  };

  it('acquisition valid diterima', () => {
    expect(() => acquisitionSchema.parse(validAcq)).not.toThrow();
  });

  it('live tanpa originalChanged true ditolak (INV-12)', () => {
    const live = { ...validAcq, method: 'live', originalChanged: false };
    expect(() => acquisitionSchema.parse(live)).toThrow('flag wajib true');
  });

  it('originalChanged true tanpa justifikasi ditolak (INV-13)', () => {
    const changed = { ...validAcq, originalChanged: true, changeJustification: undefined };
    expect(() => acquisitionSchema.parse(changed)).toThrow('Justifikasi');
  });

  it('finishedAt < startedAt ditolak (INV-15)', () => {
    const timeWrong = {
      ...validAcq,
      startedAt: '2025-07-01T08:00:00+07:00',
      finishedAt: '2025-07-01T07:00:00+07:00',
    };
    expect(() => acquisitionSchema.parse(timeWrong)).toThrow('selesai');
  });
});

describe('backupFileSchema (.strict() SEC-04)', () => {
  it('backup valid diterima', () => {
    const valid = {
      schemaVersion: 1 as const,
      exportedAt: '2025-07-01T00:00:00.000Z',
      chainTip: '0'.repeat(64),
      counts: { cases: 0, evidence: 0 },
      data: {
        schemaVersion: 1 as const,
        persons: [], cases: [], evidence: [], custody: [],
        acquisitions: [], verifications: [], audit: [],
        settings: { orgName: '', orgUnit: '', recordedAt: '2025-07-01T00:00:00.000Z' },
      },
    };
    expect(() => backupFileSchema.parse(valid)).not.toThrow();
  });

  it('field asing ditolak', () => {
    const extra = {
      schemaVersion: 1 as const,
      exportedAt: '2025-07-01T00:00:00.000Z',
      chainTip: '0'.repeat(64),
      counts: {},
      data: {
        schemaVersion: 1 as const,
        persons: [], cases: [], evidence: [], custody: [],
        acquisitions: [], verifications: [], audit: [],
        settings: { orgName: '', orgUnit: '', recordedAt: '2025-07-01T00:00:00.000Z' },
      },
      evilField: 'bad',
    };
    expect(() => backupFileSchema.parse(extra)).toThrow();
  });
});
