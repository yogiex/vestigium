/* ================================================================
 * lib/audit.ts — rantai audit hash-chained (FR-M8-02, S4)
 * Rumus byte-exact DATA §7
 * ================================================================ */

import { sha256Text } from './hash';
import { uid } from './id';
import { nowUTC } from './time';
import {
  asUtc, type AuditAction, type AuditEvent, type ChainReport, type HashHex64,
} from './types';

export const GENESIS_HASH = ('0'.repeat(64)) as HashHex64;

export function canonicalJson(v: unknown): string {
  if (v === undefined) throw new Error('INVARIANT: undefined tidak sah di payload audit');
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',') + '}';
}

function entryHash(prevHash: HashHex64, payload: unknown): HashHex64 {
  return sha256Text(prevHash + '\n' + canonicalJson(payload));
}

export function auditPayload(e: AuditEvent): Record<string, unknown> {
  return { seq: e.seq, id: e.id, at: e.at, actor: e.actor, action: e.action, target: e.target, detail: e.detail };
}

export interface AuditInput {
  action: AuditAction;
  target: string;
  detail: string;
  actor: string;
  at?: string;
}

export function makeAuditEntry(prev: readonly AuditEvent[], input: AuditInput): AuditEvent {
  const prevHash = prev.length > 0 ? prev[prev.length - 1].hash : GENESIS_HASH;
  const base = {
    seq: prev.length,
    id: uid(),
    at: input.at ? asUtc(input.at) : nowUTC(),
    actor: input.actor,
    action: input.action,
    target: input.target,
    detail: input.detail,
  };
  const entry: AuditEvent = Object.freeze({
    ...base,
    prevHash,
    hash: entryHash(prevHash, base),
  });
  return entry;
}

export function verifyChain(audit: readonly AuditEvent[]): ChainReport {
  for (let i = 0; i < audit.length; i++) {
    const e = audit[i];
    const expectedPrev = i === 0 ? GENESIS_HASH : audit[i - 1].hash;
    const hashOk = entryHash(expectedPrev, auditPayload(e)) === e.hash;
    if (e.seq !== i || e.prevHash !== expectedPrev || !hashOk) {
      return {
        valid: false,
        total: audit.length,
        firstBrokenSeq: i,
        tip: i === 0 ? GENESIS_HASH : audit[i - 1].hash,
      };
    }
  }
  return {
    valid: true,
    total: audit.length,
    tip: audit.length > 0 ? audit[audit.length - 1].hash : GENESIS_HASH,
  };
}

export function chainTip(audit: readonly AuditEvent[]): HashHex64 {
  return audit.length > 0 ? audit[audit.length - 1].hash : GENESIS_HASH;
}
