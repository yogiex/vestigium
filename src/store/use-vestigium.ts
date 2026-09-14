/* ================================================================
 * store/use-vestigium.ts — Mutation Gateway (CC-15) + API append-only (CC-16)
 * Urutan deny-gates per aksi tulis:
 *   1. canPerform (GRU-02/03)  → ditolak + DIAUDIT (FR-M8-06: penolakan = bukti kebijakan)
 *   2. bentuk record (generator CC-21) → zod full-schema (CC-22, defense-in-depth)
 *   3. cek lintas-entitas (INV-05/09/16) → pesan edukatif
 *   4. canTransition (CC-20) → throw INVARIANT bila lolos (CC-35)
 *   5. commit(): append record (Object.freeze) + audit otomatis (INV-19)
 * Urutan array: audit = ascending seq (indeks = seq, DATA §7); entitas lain = append di ekor.
 * Penyimpanan: zustand persist → vestigium_mvp_v1 (D-22, lib/config).
 * DILARANG menambah updateX/deleteX pada custody/acquisition/verification/audit.
 * ================================================================ */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ZodError } from 'zod';

import { chainTip, makeAuditEntry, verifyChain } from '../lib/audit';
import { SCHEMA_VERSION, STORAGE_KEY } from '../lib/config';
import {
  BOOTSTRAP_ACTIONS, canPerform, canTransition, partyLabel,
} from '../lib/domain';
import { nextAcquisitionNo, nextCaseNo, nextEvidenceNo, uid } from '../lib/id';
import { nowUTC, toMillis } from '../lib/time';
import {
  acquisitionSchema, backupFileSchema, caseSchema, custodyEventSchema,
  evidenceItemSchema, personSchema, settingsSchema, verificationSchema,
} from '../lib/schemas';
import type { ParsedBackup } from '../lib/schemas';
import type {
  AcquisitionRecord, AuditAction, Case, CaseStatus, ChainReport, CustodyEvent,
  CustodyEventType, EvidenceItem, HashHex64, ItemStatus, Party, Person, PersonRole,
  SealCondition, Settings, Uuid, VerificationRecord, VestigiumState,
} from '../lib/types';

/* ---------- Kontrak hasil aksi (CC-22: issues edukatif ke RejectionList) ---------- */
export interface Issue { path: string; message: string }
export type ActionResult<T> = { ok: true; data: T } | { ok: false; issues: Issue[] };

const toIssues = (e: ZodError): Issue[] =>
  e.issues.map(i => ({ path: i.path.join('.'), message: i.message }));
const fail = (message: string, path = ''): { ok: false; issues: Issue[] } =>
  ({ ok: false, issues: [{ path, message }] });

/* ---------- Input types — field sistem (id/nomor/recordedAt) diisi gateway ---------- */
export type CaseInput = Omit<Case, 'id' | 'caseNo' | 'recordedAt' | 'status' |
  'occurredAt' | 'authorizationDate' | 'closedAt'> & {
  occurredAt: string; authorizationDate?: string; closedAt?: string };
export type CaseContextPatch = Partial<Pick<Case, 'title' | 'incidentType' | 'priority' |
  'specialistDesId' | 'organization' | 'authorizationRef' | 'scope' | 'description'>> &
  { authorizationDate?: string };
export type EvidenceInput = Omit<EvidenceItem, 'id' | 'itemNo' | 'recordedAt' | 'status' |
  'collectedAt' | 'discoveryAt' | 'referenceHash' | 'referenceHashSource' |
  'referenceHashLockedAt'> & { collectedAt: string; discoveryAt?: string };
export type CustodyMoveInput = {
  toParty: Party; reason: string; occurredAt: string;
  sealCondition?: SealCondition; sealNumber?: string; notes?: string };
export type AcquisitionInput = Omit<AcquisitionRecord, 'id' | 'acquisitionNo' | 'recordedAt' |
  'startedAt' | 'finishedAt'> & { startedAt: string; finishedAt: string };
export type VerificationInput = Omit<VerificationRecord, 'id' | 'recordedAt' | 'occurredAt'> &
  { occurredAt: string };
export type PersonInput = Omit<Person, 'id' | 'recordedAt'>;
export type SettingsPatch = Partial<Pick<Settings, 'orgName' | 'orgUnit' | 'defaultExaminerId'>>;

/* ---------- Fallback storage memori — SSR/prerender & lingkungan uji tanpa localStorage ---------- */
const memoryStorage = (() => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
})();
const safeStorage = (): Storage =>
  typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : (memoryStorage as unknown as Storage);

function emptyState(): VestigiumState {
  return {
    schemaVersion: SCHEMA_VERSION,
    persons: [], cases: [], evidence: [], custody: [],
    acquisitions: [], verifications: [], audit: [],
    settings: { orgName: '', orgUnit: '', recordedAt: nowUTC() },
  };
}

export interface VestigiumStore extends VestigiumState {
  /* Cases */
  registerCase(input: CaseInput): ActionResult<Case>;
  updateCaseContext(caseId: Uuid, patch: CaseContextPatch): ActionResult<Case>;
  setCaseStatus(caseId: Uuid, to: CaseStatus, opts?: { occurredAt?: string; reason?: string }): ActionResult<Case>;
  /* Evidence */
  registerEvidence(input: EvidenceInput): ActionResult<EvidenceItem>;
  transferCustody(evidenceId: Uuid, input: CustodyMoveInput): ActionResult<CustodyEvent>;
  sealEvidence(evidenceId: Uuid, input: CustodyMoveInput): ActionResult<CustodyEvent>;
  openSeal(evidenceId: Uuid, input: CustodyMoveInput): ActionResult<CustodyEvent>;
  releaseEvidence(evidenceId: Uuid, input: CustodyMoveInput): ActionResult<CustodyEvent>;
  startAnalysis(evidenceId: Uuid, input: CustodyMoveInput): ActionResult<CustodyEvent>;
  /* Integritas */
  appendAcquisition(input: AcquisitionInput): ActionResult<AcquisitionRecord>;
  appendVerification(input: VerificationInput): ActionResult<VerificationRecord>;
  setReferenceHash(evidenceId: Uuid, hash: string,
    source?: { fileName?: string; sizeBytes?: number }): ActionResult<EvidenceItem>; // INV-06 write-once
  /* Person & settings */
  addPerson(input: PersonInput): ActionResult<Person>;
  deactivatePerson(personId: Uuid): ActionResult<Person>;   // INV-18: deactivate-only
  updateSettings(patch: SettingsPatch): ActionResult<Settings>;
  signOut(): void;
  /* Backup — FR-M10-02/03 */
  exportBackup(): ParsedBackup;
  parseBackup(raw: unknown): { ok: true; backup: ParsedBackup; chainReport: ChainReport }
                           | { ok: false; issues: Issue[] };
  applyBackup(raw: unknown): ActionResult<VestigiumState>;
  wipeAll(): ActionResult<null>;
  /* Uji — reset state penuh (jangan dipakai di UI) */
  __resetForTests(seed?: Partial<VestigiumState>): void;
}

export const useVestigium = create<VestigiumStore>()(
  persist(
    (set, get) => {
      /* ---------- helper internal gateway ---------- */
      const actorName = (s: VestigiumState): string =>
        s.persons.find(p => p.id === s.settings.defaultExaminerId)?.name ?? 'Operator';
      const activeRole = (s: VestigiumState): PersonRole | null =>
        s.persons.find(p => p.id === s.settings.defaultExaminerId)?.role ?? null;
      const personLabel = (s: VestigiumState) => (id: string): string =>
        s.persons.find(p => p.id === id)?.name ?? '(personel tidak dikenal)';

      /** commit() — SATU pintu mutasi: produce → audit otomatis (INV-19, CC-15). */
      function commit(action: AuditAction, target: string, detail: string,
        produce: (s: VestigiumState) => Partial<VestigiumState>): void {
        set(st => {
          const entry = makeAuditEntry(st.audit, { action, target, detail, actor: actorName(st) });
          return { ...produce(st), audit: [...st.audit, entry] };
        });
      }
      /** Denial RBAC tetap diaudit — tanpa mutasi data (FR-M8-06). */
      function denyRBAC(action: AuditAction, target: string, role: PersonRole | null): ActionResult<never> {
        set(st => ({ audit: [...st.audit, makeAuditEntry(st.audit, {
          action, target,
          detail: `DITOLAK: role "${role ?? '(tanpa operator)'}" tidak berwenang — GRU-03`,
          actor: actorName(st) })] }));
        return fail(`Anda tidak berwenang melakukan aksi ini (${action} memerlukan role berwenang). ` +
          'Minta persetujuan manager atau ganti operator aktif di Pengaturan.');
      }
      /** Gerbang 1: policy — bootstrap first-run dikecualikan terkontrol. */
      function guard(s: VestigiumState, action: AuditAction, target: string): ActionResult<never> | null {
        const bootstrapping = !s.settings.defaultExaminerId
          && (BOOTSTRAP_ACTIONS as readonly string[]).includes(action);
        if (bootstrapping || canPerform(activeRole(s), action)) return null;
        return denyRBAC(action, target, activeRole(s));
      }

      /* ---------- implementasi generik aksi custody ---------- */
      function custodyMove(cfg: { label: string; type: CustodyEventType; toStatus: ItemStatus | null }) {
        return (evidenceId: Uuid, input: CustodyMoveInput): ActionResult<CustodyEvent> => {
          const s = get();
          const item = s.evidence.find(e => e.id === evidenceId);
          if (!item) return fail('Item evidence tidak ditemukan.');
          const denied = guard(s, 'CUSTODY', item.itemNo);
          if (denied) return denied;

          // fromParty = custodian saat ini — DITURUNKAN, operator tidak bisa mengarang pengirim (INV-04)
          const last = s.custody
            .filter(c => c.evidenceId === evidenceId)
            .sort((a, b) => toMillis(b.occurredAt) - toMillis(a.occurredAt))[0];
          if (!last) return fail('Item belum memiliki rantai custody — registrasi terlebih dahulu.');
          const fromParty = last.toParty;

          const event = Object.freeze({
            id: uid(), evidenceId, type: cfg.type,
            fromParty, toParty: input.toParty,
            reason: input.reason,
            sealCondition: input.sealCondition ?? (cfg.type === 'opened' ? 'broken' : 'not-applicable'),
            sealNumber: input.sealNumber,
            recordedById: s.settings.defaultExaminerId ?? last.recordedById,
            notes: input.notes,
            occurredAt: input.occurredAt,
            recordedAt: nowUTC(),
          });
          const parsed = custodyEventSchema.safeParse(event);          // gerbang 2 (termasuk INV-14)
          if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };
          const data = Object.freeze(parsed.data) as CustodyEvent;

          if (cfg.toStatus && !canTransition('item', item.status, cfg.toStatus))   // gerbang 4
            throw new Error(`INVARIANT: transisi ${item.status}→${cfg.toStatus} ilegal lolos validator (CC-20)`);

          const detail = `${cfg.label}: ${partyLabel(fromParty, personLabel(s))} → ${partyLabel(input.toParty, personLabel(s))} — ${input.reason}`;
          commit('CUSTODY', item.itemNo, detail, st => ({
            custody: [...st.custody, data],
            evidence: cfg.toStatus
              ? st.evidence.map(e => e.id === evidenceId
                  ? Object.freeze({ ...e, status: cfg.toStatus as ItemStatus }) : e)
              : st.evidence,
          }));
          return { ok: true, data };
        };
      }

      return {
        ...emptyState(),

        /* ================= CASES ================= */
        registerCase: (input) => {
          const s = get();
          const denied = guard(s, 'CASE_CREATE', 'case');
          if (denied) return denied;
          const c = {
            ...input,
            id: uid(), caseNo: nextCaseNo(s.cases), status: 'open',
            recordedAt: nowUTC(),
          };
          const parsed = caseSchema.safeParse(c);
          if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };
          const data = Object.freeze(parsed.data) as Case;
          commit('CASE_CREATE', data.caseNo, `${data.title} · PIC ${personLabel(s)(data.leadDefrId)}`,
            st => ({ cases: [...st.cases, data] }));
          return { ok: true, data };
        },

        updateCaseContext: (caseId, patch) => {
          const s = get();
          const c = s.cases.find(x => x.id === caseId);
          if (!c) return fail('Kasus tidak ditemukan.');
          const denied = guard(s, 'CASE_UPDATE', c.caseNo);
          if (denied) return denied;
          const parsed = caseSchema.safeParse({ ...c, ...patch });
          if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };
          const data = Object.freeze(parsed.data) as Case;
          commit('CASE_UPDATE', c.caseNo, `Konteks kasus diperbarui: ${Object.keys(patch).join(', ')}`,
            st => ({ cases: st.cases.map(x => x.id === caseId ? data : x) }));
          return { ok: true, data };
        },

        setCaseStatus: (caseId, to, opts) => {
          const s = get();
          const c = s.cases.find(x => x.id === caseId);
          if (!c) return fail('Kasus tidak ditemukan.');
          const denied = guard(s, 'CASE_STATUS', c.caseNo);
          if (denied) return denied;
          if (!canTransition('case', c.status, to))
            throw new Error(`INVARIANT: transisi kasus ${c.status}→${to} ilegal (CC-20)`);
          const closing = to === 'closed';
          if (closing && !opts?.reason)
            return fail('Penutupan kasus wajib menyertakan alasan (FR-M1-04, INV-20).', 'closedReason');
          const merged = { ...c, status: to,
            closedAt: closing ? (opts?.occurredAt ?? nowUTC()) : c.closedAt,
            closedReason: closing ? opts?.reason : c.closedReason };
          const parsed = caseSchema.safeParse(merged);
          if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };
          const data = Object.freeze(parsed.data) as Case;
          const detail = closing ? `Kasus ditutup — ${opts?.reason}`
            : to === 'active' && c.status === 'closed' ? 'Kasus dibuka kembali'
            : `Status: ${c.status} → ${to}`;
          commit('CASE_STATUS', c.caseNo, detail,
            st => ({ cases: st.cases.map(x => x.id === caseId ? data : x) }));
          return { ok: true, data };
        },

        /* ================= EVIDENCE ================= */
        registerEvidence: (input) => {
          const s = get();
          const denied = guard(s, 'EVIDENCE_REGISTER', 'evidence');
          if (denied) return denied;
          // INV-09 — gerbang otorisasi kasus (S6): tolak SEBELUM membentuk record
          const kase = s.cases.find(c => c.id === input.caseId);
          if (!kase) return fail('Kasus target tidak ditemukan (INV-02).');
          if (!kase.authorizationRef)
            return fail(`Collection ditolak: kasus ${kase.caseNo} belum memiliki referensi otorisasi — lengkapi di header kasus terlebih dahulu (FR-M1-03).`);
          // INV-05 — nomor seal unik lintas item
          if (input.sealNumber && s.evidence.some(e => e.sealNumber === input.sealNumber))
            return fail(`Nomor seal "${input.sealNumber}" sudah terpakai item lain — seal wajib unik global (INV-05).`, 'sealNumber');

          const item = {
            ...input,
            id: uid(), itemNo: nextEvidenceNo(s.evidence), status: 'collected',
            recordedAt: nowUTC(),
          };
          const parsed = evidenceItemSchema.safeParse(item);
          if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };
          const data = Object.freeze(parsed.data) as EvidenceItem;

          // FR-M3-01 — CustodyEvent PERTAMA lahir bersama registrasi (rantai mulai dari lokasi)
          const firstEvent = {
            id: uid(), evidenceId: data.id, type: 'collected',
            fromParty: { kind: 'location', label: data.discoveryLocation },
            toParty: { kind: 'person', personId: data.defrId },
            reason: 'Pengambilan awal di lokasi (ISO 27037 §6.3)',
            sealCondition: data.sealNumber ? 'intact' : 'not-applicable',
            sealNumber: data.sealNumber,
            recordedById: data.defrId,
            occurredAt: data.collectedAt,
            recordedAt: nowUTC(),
          };
          const parsedEv = custodyEventSchema.safeParse(firstEvent);
          if (!parsedEv.success) return { ok: false, issues: toIssues(parsedEv.error) };
          const ev = Object.freeze(parsedEv.data) as CustodyEvent;

          commit('EVIDENCE_REGISTER', data.itemNo,
            `${data.label} → ${kase.caseNo} (${data.powerState === 'on' ? 'ON — volatile checklist lengkap' : 'OFF'})`,
            st => ({ evidence: [...st.evidence, data], custody: [...st.custody, ev] }));
          return { ok: true, data };
        },

        transferCustody: custodyMove({ label: 'Transfer', type: 'transferred', toStatus: null }),
        sealEvidence:    custodyMove({ label: 'Penyegelan', type: 'sealed', toStatus: 'sealed' }),
        openSeal:        custodyMove({ label: 'Seal dibuka', type: 'opened', toStatus: 'opened' }),
        releaseEvidence: custodyMove({ label: 'Rilis', type: 'released', toStatus: 'released' }),
        startAnalysis:   custodyMove({ label: 'Mulai analisis', type: 'transferred', toStatus: 'in-analysis' }),

        /* ================= INTEGRITAS ================= */
        appendAcquisition: (input) => {
          const s = get();
          const item = s.evidence.find(e => e.id === input.evidenceId);
          if (!item) return fail('Item evidence tidak ditemukan (INV-03).');
          const denied = guard(s, 'ACQUISITION', item.itemNo);
          if (denied) return denied;
          const rec = {
            ...input,
            id: uid(), acquisitionNo: nextAcquisitionNo(s.acquisitions, item),
            recordedAt: nowUTC(),
          };
          const parsed = acquisitionSchema.safeParse(rec);
          if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };
          const data = Object.freeze(parsed.data) as AcquisitionRecord;
          // FR-M4-07: hash sumber ≠ image TETAP DISIMPAN apa adanya (dokumentasi jujur);
          // status match ditampilkan lewat selectMatchStatus — penolakan hanya untuk format.
          const hashNote = data.imageHash && data.sourceHash
            ? (data.imageHash === data.sourceHash ? 'hash MATCH' : 'hash MISMATCH — dicatat apa adanya')
            : 'hash dicatat';
          commit('ACQUISITION', item.itemNo,
            `${data.acquisitionNo} · ${data.method} · ${data.tool} · ${hashNote}`,
            st => ({ acquisitions: [...st.acquisitions, data] }));
          return { ok: true, data };
        },

        appendVerification: (input) => {
          const s = get();
          const item = s.evidence.find(e => e.id === input.evidenceId);
          if (!item) return fail('Item evidence tidak ditemukan (INV-03).');
          const denied = guard(s, 'VERIFY', item.itemNo);
          if (denied) return denied;
          // INV-16 — konsistensi result vs hash acuan efektif (lintas-entitas → gateway, bukan schema)
          let acuan: HashHex64 | null = item.referenceHash ?? null;
          if (input.acquisitionId) {
            const acq = s.acquisitions.find(a => a.id === input.acquisitionId);
            if (!acq || acq.evidenceId !== input.evidenceId)
              return fail('Akuisisi acuan tidak ditemukan pada item ini (INV-03).');
            acuan = acq.imageHash ?? acuan;
          }
          const expected = acuan === null ? 'unverified'
            : input.computedHash === acuan ? 'match' : 'mismatch';
          if (input.result !== expected) {
            const why = acuan === null ? 'hash acuan belum ada'
              : input.computedHash === acuan ? 'hash COCOK dengan acuan' : 'hash TIDAK COCOK dengan acuan';
            return fail(`Hasil verifikasi tidak konsisten: ${why} — result yang sah: "${expected}" (INV-16).`, 'result');
          }
          const parsed = verificationSchema.safeParse({ ...input, id: uid(), recordedAt: nowUTC() });
          if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };
          const data = Object.freeze(parsed.data) as VerificationRecord;
          commit('VERIFY', item.itemNo, `Verifikasi ${data.method}: ${data.result.toUpperCase()}`,
            st => ({ verifications: [...st.verifications, data] }));
          return { ok: true, data };
        },

        setReferenceHash: (evidenceId, hash, source) => {
          const s = get();
          const item = s.evidence.find(e => e.id === evidenceId);
          if (!item) return fail('Item evidence tidak ditemukan.');
          const denied = guard(s, 'HASH_REFERENCE', item.itemNo);
          if (denied) return denied;
          if (item.referenceHash)                                            // INV-06 write-once
            throw new Error('INVARIANT: hash referensi write-once (INV-06) — anulasi via record baru, bukan penimpaan');
          const merged = { ...item, referenceHash: hash,
            referenceHashSource: source, referenceHashLockedAt: nowUTC() };
          const parsed = evidenceItemSchema.safeParse(merged);
          if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };
          const data = Object.freeze(parsed.data) as EvidenceItem;
          commit('HASH_REFERENCE', item.itemNo,
            `Hash referensi ditetapkan${source?.fileName ? ` dari "${source.fileName}"` : ''} — TERKUNCI (INV-06)`,
            st => ({ evidence: st.evidence.map(e => e.id === evidenceId ? data : e) }));
          return { ok: true, data };
        },

        /* ================= PERSON & SETTINGS ================= */
        addPerson: (input) => {
          const s = get();
          const denied = guard(s, 'PERSON_ADD', 'roster');
          if (denied) return denied;
          // Email = identitas gerbang operator; roster satu sumber identitas (GRU) → unik & lowercase
          const email = input.email?.trim().toLowerCase();
          if (email && s.persons.some(x => x.email === email))
            return fail(`Email "${email}" sudah terdaftar pada personel lain — roster adalah satu sumber identitas (GRU).`, 'email');
          const parsed = personSchema.safeParse({ ...input, email, id: uid(), recordedAt: nowUTC() });
          if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };
          const data = Object.freeze(parsed.data) as Person;
          commit('PERSON_ADD', data.name, `Roster: ${data.role} — ${data.organization}`,
            st => ({ persons: [...st.persons, data] }));
          return { ok: true, data };
        },

        deactivatePerson: (personId) => {
          const s = get();
          const p = s.persons.find(x => x.id === personId);
          if (!p) return fail('Personel tidak ditemukan.');
          const denied = guard(s, 'PERSON_DEACTIVATE', p.name);
          if (denied) return denied;
          const parsed = personSchema.safeParse({ ...p, isActive: false });
          if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };
          const data = Object.freeze(parsed.data) as Person;
          commit('PERSON_DEACTIVATE', p.name, 'Personel dinonaktifkan — riwayat referensi tetap utuh (INV-18)',
            st => ({ persons: st.persons.map(x => x.id === personId ? data : x) }));
          return { ok: true, data };
        },

        updateSettings: (patch) => {
          const s = get();
          const denied = guard(s, 'SETTINGS', 'settings');
          if (denied) return denied;
          const parsed = settingsSchema.safeParse({ ...s.settings, ...patch });
          if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };
          const data = parsed.data as Settings;
          commit('SETTINGS', 'settings', `Pengaturan diperbarui: ${Object.keys(patch).join(', ')}`,
            () => ({ settings: data }));
          return { ok: true, data };
        },

        /** Keluar sesi = operasi sesi, bukan mutasi data — selalu diizinkan bagi diri sendiri
         *  (tanpa gerbang RBAC; tetap ter-audit agar ketertelusuran sesi utuh, INV-19). */
        signOut: () => {
          const s = get();
          if (!s.settings.defaultExaminerId) return;
          set(st => ({
            settings: { ...st.settings, defaultExaminerId: undefined },
            audit: [...st.audit, makeAuditEntry(st.audit, {
              action: 'SETTINGS', target: 'session',
              detail: 'Operator keluar — sesi ditutup', actor: actorName(st),
            })],
          }));
        },

        /* ================= BACKUP (FR-M10-02/03) ================= */
        exportBackup: () => {
          const s = get();
          const backup: ParsedBackup = {
            schemaVersion: SCHEMA_VERSION,
            exportedAt: nowUTC(),
            chainTip: chainTip(s.audit),
            counts: {
              persons: s.persons.length, cases: s.cases.length, evidence: s.evidence.length,
              custody: s.custody.length, acquisitions: s.acquisitions.length,
              verifications: s.verifications.length, audit: s.audit.length,
            },
            data: {
              schemaVersion: SCHEMA_VERSION,
              persons: s.persons, cases: s.cases, evidence: s.evidence, custody: s.custody,
              acquisitions: s.acquisitions, verifications: s.verifications,
              audit: s.audit, settings: s.settings,
            },
          };
          set(st => ({ audit: [...st.audit, makeAuditEntry(st.audit,
            { action: 'EXPORT', target: 'backup',
              detail: `Ekspor: ${backup.counts.cases} kasus, ${backup.counts.evidence} item`,
              actor: actorName(st) })] }));
          return backup;
        },

        parseBackup: (raw) => {
          const parsed = backupFileSchema.safeParse(raw);       // SEC-04: zod .strict()
          if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };
          const backup = parsed.data as unknown as ParsedBackup;
          return { ok: true, backup, chainReport: verifyChain(backup.data.audit) };
        },

        applyBackup: (raw) => {
          const s = get();
          const denied = guard(s, 'IMPORT', 'backup');
          if (denied) return denied;
          const parsed = backupFileSchema.safeParse(raw);       // re-parse — defense-in-depth
          if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };
          const backup = parsed.data as unknown as ParsedBackup;
          const report = verifyChain(backup.data.audit);
          const next: VestigiumState = { ...backup.data };
          // Audit IMPORT menaut pada rantai yang diimpor — ketertelusuran lintas database (DATA §9.2)
          const entry = makeAuditEntry(next.audit, { action: 'IMPORT', target: 'backup',
            detail: `Impor diterapkan · rantai ${report.valid ? 'VALID' : `PUTUS di seq ${report.firstBrokenSeq}`} · ekspor ${backup.exportedAt}`,
            actor: actorName(s) });
          next.audit = [...next.audit, entry];
          set(next);
          return { ok: true, data: next };
        },

        wipeAll: () => {
          const s = get();
          const denied = guard(s, 'WIPE', 'system');
          if (denied) return denied;
          const prevActor = actorName(s);
          const fresh = emptyState();
          // Jejak wipe bertahan di database BARU — akuntabilitas lintas wipe
          fresh.audit = [makeAuditEntry(fresh.audit, { action: 'WIPE', target: 'system',
            detail: 'Database baru dibuat setelah wipe total — nomor mulai dari 1 (DATA §6)',
            actor: prevActor })];
          set(fresh);
          return { ok: true, data: null };
        },

        __resetForTests: (seed) => set({ ...emptyState(), ...seed }),
      };
    },
    {
      name: STORAGE_KEY,                                        // D-22 — lib/config (CC-32)
      version: SCHEMA_VERSION,
      storage: createJSONStorage(safeStorage),
      partialize: (s) => ({
        schemaVersion: s.schemaVersion, persons: s.persons, cases: s.cases, evidence: s.evidence,
        custody: s.custody, acquisitions: s.acquisitions, verifications: s.verifications,
        audit: s.audit, settings: s.settings,
      }),
      migrate: (persisted) => persisted as VestigiumStore,      // registry migrasi — DATA §9
    },
  ),
);
