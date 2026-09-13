/**
 * lib/schemas.ts — Zod schemas untuk validasi Vestigium
 * Ref: CC-19, DATA.md §3, §10
 *
 * Satu schema untuk form DAN lapisan domain (defense-in-depth).
 * Validator murni mengembalikan daftar pesan perbaikan (PRD §8.2).
 */

import { z } from "zod";

// ─── Base Schemas ────────────────────────────────────────────────────

export const timestampSchema = z.string().min(1, "Timestamp wajib diisi");
export const nameSchema = z.string().min(1, "Nama wajib diisi").max(100);
export const notesSchema = z.string().max(500).optional();
export const hashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Hash harus 64 karakter hexadecimal");

// ─── Case ────────────────────────────────────────────────────────────

export const caseSchema = z.object({
  title: z.string().min(1, "Judul kasus wajib diisi").max(200),
  authorization: z
    .string()
    .min(1, "Referensi otorisasi wajib diisi — collection ditolak tanpa ini"),
});

export type CaseInput = z.infer<typeof caseSchema>;

// ─── Evidence Item ───────────────────────────────────────────────────

export const evidenceItemSchema = z.object({
  caseNo: z.string().min(1, "Nomor kasus wajib diisi"),
  label: z.string().min(1, "Label evidence wajib diisi").max(200),
  sourceCategory: z.enum([
    "computer",
    "mobile",
    "removable",
    "network",
    "cloud",
    "iot",
    "photo",
    "audio",
    "document",
    "other",
  ]),
  serialImei: z.string().max(100).optional(),
  powerState: z.enum(["on", "off", "unknown"]),
});

export type EvidenceItemInput = z.infer<typeof evidenceItemSchema>;

// ─── Collection ──────────────────────────────────────────────────────

export const volatileChecklistSchema = z.object({
  ramCaptured: z.boolean(),
  ramNotes: z.string().max(200).optional(),
  runningProcesses: z.boolean().optional(),
  networkConnections: z.boolean().optional(),
  mountedDrives: z.boolean().optional(),
  openFiles: z.boolean().optional(),
  screenCapture: z.boolean().optional(),
  timestamp: timestampSchema,
});

export const collectionSchema = z.object({
  itemNo: z.string().min(1, "Nomor item wajib diisi"),
  at: timestampSchema,
  collector: z.string().min(1, "Pengumpul wajib diisi"),
  witnesses: z.array(z.string()).min(1, "Minimal satu saksi wajib diisi"),
  packaging: z.string().min(1, "Jenis packaging wajib diisi"),
  sealNo: z.string().max(50).optional(),
  volatileChecklist: volatileChecklistSchema.optional(),
  notes: notesSchema,
  deviationNote: notesSchema,
});

export type CollectionInput = z.infer<typeof collectionSchema>;

// ─── Acquisition ─────────────────────────────────────────────────────

export const acquisitionSchema = z
  .object({
    itemNo: z.string().min(1, "Nomor item wajib diisi"),
    at: timestampSchema,
    method: z.enum(["bit-stream", "logical", "live"]),
    tool: z.string().min(1, "Nama tool wajib diisi"),
    toolVersion: z.string().min(1, "Versi tool wajib diisi"),
    writeBlocker: z.string().max(100).optional(),
    sourceHash: hashSchema,
    imageHash: hashSchema,
    justification: z.string().max(500).optional(),
    notes: notesSchema,
  })
  .refine(
    (data) => {
      // Live acquisition wajib ada justifikasi
      if (data.method === "live" && !data.justification) {
        return false;
      }
      return true;
    },
    {
      message:
        "Live acquisition wajib ada justifikasi — original berubah secara inheren (least alteration)",
      path: ["justification"],
    }
  );

export type AcquisitionInput = z.infer<typeof acquisitionSchema>;

// ─── Verification ────────────────────────────────────────────────────

export const verificationSchema = z.object({
  itemNo: z.string().min(1, "Nomor item wajib diisi"),
  at: timestampSchema,
  performedBy: z.string().min(1, "Petugas verifikasi wajib diisi"),
  expectedHash: hashSchema,
  actualHash: hashSchema,
  notes: notesSchema,
});

export type VerificationInput = z.infer<typeof verificationSchema>;

// ─── Custody Transfer ────────────────────────────────────────────────

export const custodyTransferSchema = z
  .object({
    itemNo: z.string().min(1, "Nomor item wajib diisi"),
    at: timestampSchema,
    from: z.string().min(1, "Pengirim wajib diisi"),
    to: z.string().min(1, "Penerima wajib diisi"),
    reason: z.string().min(1, "Alasan transfer wajib diisi").max(200),
  })
  .refine((data) => data.from !== data.to, {
    message: "Pengirim dan penerima tidak boleh orang yang sama",
    path: ["to"],
  });

export type CustodyTransferInput = z.infer<typeof custodyTransferSchema>;

// ─── Examiner ────────────────────────────────────────────────────────

export const examinerSchema = z.object({
  name: nameSchema,
  role: z.enum(["DEFR", "DES"]),
});

export type ExaminerInput = z.infer<typeof examinerSchema>;

// ─── Site Settings ───────────────────────────────────────────────────

export const settingsSchema = z.object({
  siteName: z.string().min(1, "Nama situs wajib diisi").max(100),
  defaultExaminer: z.string().min(1, "Pemeriksa default wajib diisi"),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
