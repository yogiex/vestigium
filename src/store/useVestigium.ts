/**
 * store/useVestigium.ts — Mutation Gateway
 * Ref: CC-16, FEATURE.md §4.2
 *
 * Semua mutasi state HANYA lewat action store ini.
 * Komponen DILARANG memanggil localStorage langsung.
 * Action selalu: validasi → cek transisi → mutasi → audit → persist.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  VestigiumState,
  Case,
  EvidenceItem,
  CollectionEvent,
  AcquisitionRecord,
  VerificationRecord,
  CustodyEvent,
  Examiner,
  SiteSettings,
} from "@/lib/types";
import { nowUTC } from "@/lib/time";
import { caseId, evidenceId, acquisitionId, uid } from "@/lib/id";
import { canTransition } from "@/lib/domain";
import { CONFIG } from "@/lib/config";

// ─── Initial State ───────────────────────────────────────────────────

const initialState: VestigiumState = {
  settings: {
    siteName: "Vestigium",
    defaultExaminer: "",
  },
  examinerRoster: [],
  cases: [],
  evidenceItems: [],
  collections: [],
  acquisitions: [],
  verifications: [],
  custody: [],
  audit: [],
};

// ─── Store ───────────────────────────────────────────────────────────

interface VestigiumActions {
  // Settings
  updateSettings: (settings: Partial<SiteSettings>) => void;

  // Examiner
  addExaminer: (examiner: Examiner) => void;
  removeExaminer: (id: string) => void;

  // Case
  createCase: (data: { title: string; authorization: string }) => Case;
  closeCase: (caseNo: string) => void;

  // Evidence
  registerEvidence: (data: {
    caseNo: string;
    label: string;
    sourceCategory: string;
    serialImei?: string;
    powerState: string;
  }) => EvidenceItem;

  // Collection
  recordCollection: (data: Omit<CollectionEvent, "collectionId" | "at"> & { at: string }) => CollectionEvent;

  // Acquisition
  recordAcquisition: (data: Omit<AcquisitionRecord, "acquisitionId" | "at"> & { at: string }) => AcquisitionRecord;

  // Verification
  recordVerification: (data: Omit<VerificationRecord, "verificationId" | "at"> & { at: string }) => VerificationRecord;

  // Custody
  transferCustody: (data: Omit<CustodyEvent, "custodyId" | "at" | "action"> & { at: string }) => CustodyEvent;

  // Utility
  getAuditTip: () => string;
}

type VestigiumStore = VestigiumState & VestigiumActions;

export const useVestigium = create<VestigiumStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ─── Settings ─────────────────────────────────────────────────
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      // ─── Examiner ─────────────────────────────────────────────────
      addExaminer: (examiner) => {
        set((state) => ({
          examinerRoster: [...state.examinerRoster, examiner],
        }));
      },

      removeExaminer: (id) => {
        set((state) => ({
          examinerRoster: state.examinerRoster.filter((e) => e.id !== id),
        }));
      },

      // ─── Case ─────────────────────────────────────────────────────
      createCase: (data) => {
        const newCase: Case = {
          caseNo: caseId(),
          title: data.title,
          authorization: data.authorization,
          status: "open",
          createdAt: nowUTC(),
        };

        set((state) => ({
          cases: [...state.cases, newCase],
        }));

        return newCase;
      },

      closeCase: (caseNo) => {
        const state = get();
        const caseItem = state.cases.find((c) => c.caseNo === caseNo);
        if (!caseItem) throw new Error(`Kasus ${caseNo} tidak ditemukan`);
        if (!canTransition("case", caseItem.status, "closed")) {
          throw new Error(`INVARIANT: Transisi ilegal ${caseItem.status} → closed`);
        }

        set((state) => ({
          cases: state.cases.map((c) =>
            c.caseNo === caseNo
              ? { ...c, status: "closed" as const, closedAt: nowUTC() }
              : c
          ),
        }));
      },

      // ─── Evidence ─────────────────────────────────────────────────
      registerEvidence: (data) => {
        const newItem: EvidenceItem = {
          itemNo: evidenceId(),
          caseNo: data.caseNo,
          label: data.label,
          sourceCategory: data.sourceCategory as EvidenceItem["sourceCategory"],
          serialImei: data.serialImei,
          powerState: data.powerState as EvidenceItem["powerState"],
          status: "collected",
          createdAt: nowUTC(),
        };

        set((state) => ({
          evidenceItems: [...state.evidenceItems, newItem],
        }));

        return newItem;
      },

      // ─── Collection ───────────────────────────────────────────────
      recordCollection: (data) => {
        const newCollection: CollectionEvent = {
          collectionId: uid(),
          ...data,
        };

        set((state) => ({
          collections: [...state.collections, newCollection],
        }));

        return newCollection;
      },

      // ─── Acquisition ──────────────────────────────────────────────
      recordAcquisition: (data) => {
        const newAcquisition: AcquisitionRecord = {
          acquisitionId: acquisitionId(),
          ...data,
        };

        set((state) => ({
          acquisitions: [...state.acquisitions, newAcquisition],
        }));

        return newAcquisition;
      },

      // ─── Verification ─────────────────────────────────────────────
      recordVerification: (data) => {
        const newVerification: VerificationRecord = {
          verificationId: uid(),
          ...data,
        };

        set((state) => ({
          verifications: [...state.verifications, newVerification],
        }));

        return newVerification;
      },

      // ─── Custody ──────────────────────────────────────────────────
      transferCustody: (data) => {
        // Cari custody event terakhir untuk item ini
        const state = get();
        const lastEvent = state.custody
          .filter((c) => c.itemNo === data.itemNo)
          .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];

        const newEvent: CustodyEvent = {
          custodyId: uid(),
          ...data,
          action: "transferred",
          previousEventId: lastEvent?.custodyId,
        };

        set((prevState) => ({
          custody: [...prevState.custody, newEvent],
        }));

        return newEvent;
      },

      // ─── Utility ──────────────────────────────────────────────────
      getAuditTip: () => {
        const audit = get().audit;
        if (audit.length === 0) return "";
        return audit[audit.length - 1].hash;
      },
    }),
    {
      name: CONFIG.storageKeys.state,
    }
  )
);
