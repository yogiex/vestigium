# DATA.md — Vestigium: Skema Data & Kontrak Validasi

> **Versi:** 1.1 · **Status:** Baselined — acuan tunggal untuk `lib/types.ts` + `lib/schemas.ts`
> **Aturan:** Kode yang menyimpang dari dokumen ini = bug. Perubahan skema wajib lewat revisi
> dokumen ini + `schemaVersion` baru. Bila bertentangan dengan FEATURE.md → dijelaskan di §12.
> **Stack:** TypeScript (strict, tanpa `any`) · zod · zustand persist → localStorage.

---

## 1. Konvensi Umum

| Konvensen | Aturan |
|---|---|
| Bahasa skema | Identifier & nilai enum = **English lowercase kebab-case** (`collected`, `bit-stream`, `removable-media`). Nilai enum masuk JSON ekspor — **tidak boleh ada sinonim kedua**. Bahasa UI Indonesia terpisah. |
| `UTCString` | ISO 8601 UTC, selalu berakhir `Z`: `"2025-03-14T04:31:12Z"` — hanya dari `lib/time.ts nowUTC()` (CC-18/AGENTS §4.3). |
| `OffsetISO` | ISO 8601 **dengan offset asli dipertahankan** (hasil input user): `"2025-03-14T09:30:00+07:00"`. Regex validasi: `/Z$\|[+-]\d{2}:\d{2}$/`. |
| ⚠️ Aturan sorting | Karena `occurredAt` ber-offset campur, **dilarang membandingkan string secara leksikografis**. Semua urutan/pembandingan waktu lewat `new Date(...)` di dalam `lib/time.ts`. |
| Dual timestamp | Setiap peristiwa dunia nyata punya `occurredAt` (kejadian, input user) + `recordedAt` (pencatatan, sistem). Pengecualian: `AuditEvent` hanya `at` (= recordedAt — aksi sistem tak punya waktu kejadian terpisah). |
| Urutan tampil | Daftar administratif: `recordedAt` desc. Timeline custody & laporan naratif: `occurredAt` asc (urutan kronologis untuk pengadilan), dengan Δ dicatat-kejadian tampil. |
| ID internal | `uid()` di `lib/id.ts`: `crypto.randomUUID()`; fallback Math.random-based bila `randomUUID` tidak tersedia. ID internal tidak pernah ditampilkan sebagai identitas utama — nomor bisnis (CASE/EV/AC) yang tampil. |
| Freeze | Setiap record append-only dibekukan `Object.freeze()` sebelum masuk state (AGENTS §4.1). |

---

## 2. Peta Entitas & Matriks Mutabilitas

```
Person (roster)  ◄──── direferensikan semua event
Case            ◄──< EvidenceItem ◄──< CustodyEvent          [append-only]
                                ◄──< AcquisitionRecord       [append-only]
                                ◄──< VerificationRecord      [append-only]
AuditEvent      [global, append-only, hash-chained]
Settings        [singleton]
```

**Matriks mutabilitas** — sisi kanan adalah daftar tertutup; apa pun di luar itu = beku:

| Entitas | Beku setelah dibuat | Boleh berubah (terbatas + audited) |
|---|---|---|
| `CustodyEvent` | **semua field** | — |
| `AcquisitionRecord` | **semua field** | — |
| `VerificationRecord` | **semua field** | — |
| `AuditEvent` | **semua field** | — |
| `EvidenceItem` | id, itemNo, seluruh field identifikasi & collection, notes | `status` (via tabel transisi §5) · `referenceHash*` (**write-once**, INV-07) |
| `Case` | id, caseNo, recordedAt | field konteks (judul, deskripsi, scope…) · `status` (§5) · `authorizationRef*` sebelum collection pertama · `closedAt/closedReason` saat penutupan |
| `Person` | id, recordedAt | field profil · `isActive` (deactivate-only bila sudah direferensikan — INV-11) |
| `Settings` | — | semua field |

Rasional: identifikasi item yang bisa diedit meruntuhkan prinsip univocal (konstitusi #1).
Informasi baru setelah registrasi masuk sebagai **record baru** (custody notes, verification
notes, akuisisi baru) — bukan edit field lama.

---

## 3. Definisi Entitas

> Komentar `//` pada tipe = rujukan FR/klausul; wajib dipertahankan di `lib/types.ts`.

### 3.1 Person (roster — FR-M7)

```ts
export type PersonRole =
  | 'defr' | 'des' | 'defr-manager' | 'des-manager' | 'investigator' | 'other';

export interface Person {
  id: string;              // uid() internal
  name: string;            // tampil identik di semua dokumen (FR-M7-04)
  role: PersonRole;
  organization: string;
  credentials: string;     // mis. "DEFR, CHFI" — teks bebas
  isActive: boolean;       // deactivate-only bila direferensikan (INV-11)
  recordedAt: UTCString;
}
```

### 3.2 Case (FR-M1)

```ts
export type CaseStatus = 'open' | 'active' | 'closed';
export type IncidentType =
  | 'unauthorized-access' | 'data-leak' | 'digital-fraud' | 'malware'
  | 'asset-misuse' | 'internal-dispute' | 'other';
export type Priority = 'high' | 'medium' | 'low';

export interface Case {
  id: string;
  caseNo: string;            // CASE-2025-014 — permanen (§6, D-07)
  title: string;
  incidentType: IncidentType;
  priority: Priority;
  leadDefrId: string;        // ref Person — wajib
  specialistDesId?: string;  // ref Person
  organization: string;
  authorizationRef?: string; // FR-M1-03 — gate collection (zod refine lintas-entitas)
  authorizationDate?: OffsetISO;
  scope: string;             // batas pemeriksaan
  description: string;
  status: CaseStatus;
  occurredAt: OffsetISO;     // kapan kasus dibuka (input user)
  recordedAt: UTCString;
  closedAt?: OffsetISO;      // wajib saat status='closed' (refine)
  closedReason?: string;     // wajib saat 'closed' & saat reopen (FR-M1-04)
}
```

### 3.3 EvidenceItem (FR-M2, M3, M5)

```ts
export type SourceCategory =
  | 'workstation' | 'mobile-device' | 'removable-media' | 'memory'
  | 'optical-disc' | 'cloud-service' | 'system-log' | 'network-capture'
  | 'digital-document' | 'iot-other';                          // taksonomi §4 ISO 27037

export type Medium = 'physical' | 'logical';   // lihat klarifikasi §12.3
export type PowerState = 'on' | 'off';         // FR-M2-02 — wajib, memicu M3
export type PhysicalCondition = 'intact' | 'damaged' | 'burned' | 'encrypted' | 'other';
export type Packaging =
  | 'antistatic-bag' | 'evidence-bag' | 'evidence-box' | 'envelope' | 'none';
export type ItemStatus =
  | 'collected' | 'sealed' | 'in-analysis' | 'opened' | 'released' | 'disposed';

export interface VolatileChecklist {   // FR-M3-03 — lengkap = gerbang simpan
  screenDocumented: boolean;
  volatilePlanRecorded: boolean;
  shutdownMethodRecorded: boolean;
}

export interface EvidenceItem {
  id: string;
  itemNo: string;            // EV-0042 — global monoton, permanen (§6, D-08)
  caseId: string;            // ref Case — tidak boleh menggantung (INV-02)
  label: string;
  category: SourceCategory;
  medium: Medium;            // default dari CATEGORY_MEDIUM (§4), user override
  // — identifikasi fisik (SEBAIKNYA terisi, FR-M2-03)
  brand?: string;
  model?: string;
  serial?: string;           // serial / IMEI
  capacityBytes?: number;    // basis validasi ukuran image (P1)
  // — penemuan (§6.2)
  powerState: PowerState;
  discoveryLocation: string;
  discoveryAt?: OffsetISO;   // dipisah dari collection (FR-M2-02)
  condition: PhysicalCondition;
  conditionNotes?: string;   // wajib bila condition='other' (refine)
  // — collection (§6.3) — occurredAt item ≡ collectedAt (satu field, §12.3)
  collectedAt: OffsetISO;
  defrId: string;            // ref Person — penemu (roster, FR-M7-02)
  witnessId?: string;        // wajib bila medium='physical' (KUHAP, D-05)
  packaging?: Packaging;     // wajib bila physical; ≠'none' bila physical
  sealNumber?: string;       // wajib bila physical; unik global (INV-06)
  volatileChecklist?: VolatileChecklist; // wajib lengkap bila powerState='on'
  deviation?: { reason: string } | null; // FR-M3-04 — ada bila prosedur dilanggar
  // — preservasi (§6.5)
  referenceHash?: string;        // hex64 — write-once (INV-07)
  referenceHashSource?: { fileName?: string; sizeBytes?: number };
  referenceHashLockedAt?: UTCString;     // = recordedAt penetapan
  // — status & meta
  status: ItemStatus;
  notes?: string;            // beku setelah dibuat (§2)
  recordedAt: UTCString;
}
```

### 3.4 CustodyEvent (FR-M6)

```ts
export type CustodyEventType =
  | 'collected' | 'transferred' | 'sealed' | 'opened' | 'released'
  | 'resealed' | 'disposed';   // resealed & disposed = P1
export type SealCondition = 'intact' | 'broken' | 'not-applicable';

/** Pihak dalam rantai: orang WAJIB via roster; lokasi/pihak eksternal = label. */
export type Party =
  | { kind: 'person'; personId: string }   // FR-M7-02
  | { kind: 'location'; label: string }    // "Evidence Room", "Rak server lt.3"
  | { kind: 'external'; label: string };   // jaksa, kuasa hukum, dsb.

export interface CustodyEvent {
  id: string;
  evidenceId: string;        // ref EvidenceItem (INV-03)
  type: CustodyEventType;
  fromParty: Party;
  toParty: Party;
  reason: string;            // wajib (FR-M6-02)
  sealCondition: SealCondition;
  sealNumber?: string;       // snapshot seal saat event
  recordedById: string;      // ref Person — pencatat
  notes?: string;
  occurredAt: OffsetISO;
  recordedAt: UTCString;
}
```

> Event `collected` pertama **dibuat otomatis** oleh aksi registrasi evidence
> (FR-M3-01): from = `{kind:'location', label: discoveryLocation}` → to =
> `{kind:'person', personId: defrId}`. UI tidak menawarkan registrasi evidence
> tanpa membuat event ini.

### 3.5 AcquisitionRecord (FR-M4)

```ts
export type AcquisitionSource = 'non-volatile' | 'volatile';  // §6.4.2 / §6.4.3
export type AcquisitionMethod = 'bit-stream' | 'logical' | 'targeted' | 'live';
export type ImageFormat = 'e01' | 'raw' | 'aff4' | 'other';

export interface AcquisitionRecord {
  id: string;                // AC-EV0042-01 (§6) — sekaligus ID tampil
  evidenceId: string;
  source: AcquisitionSource;
  method: AcquisitionMethod;
  tool: string;              // "FTK Imager 4.7.0" — tool+versi (A5)
  writeBlocker: string;      // model HW, atau "tidak digunakan — <alasan>"
  outputFormat: ImageFormat;
  primaryOutput?: { fileName: string; sizeBytes?: number };
  targetMedia: string;       // media penyimpanan image
  startedAt: OffsetISO;
  finishedAt: OffsetISO;     // refine: ≥ startedAt
  operatorId: string;        // ref Person (DES)
  sourceHash?: string;       // hex64 — hash sumber (FR-M4-03)
  imageHash?: string;        // hex64 — hash image
  // matchStatus TIDAK disimpan — derived (§12.2)
  originalChanged: boolean;  // FR-M4-04 — dipaksa true utk 'live' (refine)
  changeJustification?: string; // wajib bila originalChanged
  sourceClockNotes?: string; // P-08/K-4: kondisi jam sistem sumber vs UTC saat akuisisi
                             // (mis. "jam server tertinggal 4 mnt dari UTC") — menjawab
                             // serangan validitas timestamp artefak di persidangan
  notes?: string;
  recordedAt: UTCString;
}
```

### 3.6 VerificationRecord (FR-M5)

```ts
export type VerificationMethod = 'file-compute' | 'manual-entry';
export type VerificationResult = 'match' | 'mismatch' | 'unverified';

export interface VerificationRecord {
  id: string;
  evidenceId: string;        // wajib — verifikasi mengacu hash referensi item
  acquisitionId?: string;    // opsional — konteks image akuisisi tertentu (§12.1)
  method: VerificationMethod;
  computedHash: string;      // hex64 — hash terhitung saat verifikasi
  result: VerificationResult; // fakta tercatat; INVARIANT dicek saat tulis (§12.2)
  verifierId: string;        // ref Person
  notes?: string;
  occurredAt: OffsetISO;
  recordedAt: UTCString;     // urutan riwayat = recordedAt
}
```

### 3.7 AuditEvent (FR-M8) — hash-chained

```ts
export type AuditAction =
  | 'CASE_CREATE' | 'CASE_STATUS' | 'EVIDENCE_REGISTER' | 'CUSTODY'
  | 'ACQUISITION' | 'VERIFY' | 'HASH_REFERENCE' | 'PERSON_ADD'
  | 'PERSON_UPDATE' | 'PERSON_DEACTIVATE' | 'SETTINGS' | 'EXPORT'
  | 'IMPORT' | 'RESET_DEMO' | 'WIPE' | 'CHAIN_VERIFY';

export interface AuditEvent {
  seq: number;               // posisi rantai, mulai 0, monoton
  id: string;                // uid()
  at: UTCString;             // aksi sistem — tanpa occurredAt
  actor: string;             // snapshot teks nama pemeriksa saat itu (bukan ref —
                             // audit harus tetap terbaca walau roster berubah)
  action: AuditAction;
  target: string;            // nomor bisnis: CASE-2025-014 / EV-0042 / 'system'
  detail: string;
  prevHash: string;          // hex64; genesis = "0".repeat(64)
  hash: string;              // hex64 — rumus §7
}
```

### 3.8 Settings & State Root

```ts
export interface Settings {
  orgName: string;
  orgUnit: string;
  defaultExaminerId?: string;
  recordedAt: UTCString;
}

export interface VestigiumState {
  schemaVersion: 1;
  persons: Person[];
  cases: Case[];
  evidence: EvidenceItem[];
  custody: CustodyEvent[];            // append-only
  acquisitions: AcquisitionRecord[];  // append-only
  verifications: VerificationRecord[];// append-only
  audit: AuditEvent[];                // append-only, hash-chained
  settings: Settings;
}
```

> **Tanpa array `counters`.** Semua nomor sekuens dialokasikan dari array append-only
> (§6) — menghilangkan satu mode kegagalan sinkronisasi sepenuhnya.

---

## 4. Enum Terkunci & Tabel Pendamping

Kategori → medium default (user boleh override `medium`):

```ts
export const CATEGORY_MEDIUM: Record<SourceCategory, Medium> = {
  'workstation': 'physical', 'mobile-device': 'physical', 'removable-media': 'physical',
  'memory': 'physical', 'optical-disc': 'physical', 'iot-other': 'physical',
  'cloud-service': 'logical', 'system-log': 'logical',
  'network-capture': 'logical', 'digital-document': 'logical',
};
```

Label UI semua enum hidup di **satu tabel** `lib/domain.ts` (`STATUS_LABELS`,
`METHOD_LABELS`, dst.) — dilarang menerjemahkan inline di komponen.

---

## 5. State Machine (tabel transisi — CC-20)

```ts
export const TRANSITIONS = {
  item: {
    'collected':    ['sealed', 'in-analysis'],
    'sealed':       ['opened', 'in-analysis'],
    'in-analysis':  ['sealed', 'released'],
    'opened':       ['sealed', 'released'],
    'released':     [],
    'disposed':     [],
  },
  case: {
    'open':   ['active'],
    'active': ['closed'],
    'closed': ['active'],   // reopen — closedReason wajib diisi baru
  },
} as const;

export type ItemStatus = keyof typeof TRANSITIONS.item;
```

Aturan: transisi ilegal yang lolos validator = `throw Error('INVARIANT: ...')`
(AGENTS §4.5). Event custody yang menyertai transisi:

| Transisi item | CustodyEvent wajib ikut dibuat |
|---|---|
| collected | `collected` (otomatis saat registrasi) |
| → sealed | `sealed` (with sealNumber snapshot) |
| → opened | `opened` + sealCondition |
| → in-analysis / released | `transferred` bila pihak berubah; aksi dicatat di audit |

---

## 6. Alokasi Nomor (tanpa counter — derived dari append-only array)

```ts
// lib/id.ts — sumber tunggal penomoran (AGENTS: view dilarang menyusun ID manual)
nextCaseNo(state):    'CASE-' + tahun + '-' + pad3(max(seq kasus tahun tsb) + 1)
nextEvidenceNo(state):'EV-'    + pad4(max(seluruh itemNo) + 1)
nextAcquisitionNo(state, evNo): 'AC-' + evNo + '-' + pad2(count akuisisi item + 1)
```

- Karena semua array sumber **append-only** (tanpa delete), derivasi ini bebas gap
  dan tidak bisa mundur.
- `wipe-all` = database baru; nomor mulai dari 1 lagi — **dokumentasikan di UI
  zona berbahaya** bahwa penomoran tidak didaur ulang *dalam umur satu database*.
- `DOC-ID` laporan: `VEST-RPT-<caseNo>-<YYYYMMDDHHMMSS UTC>` — unik per generasi cetak.

---

## 7. Spesifikasi Hash-Chain Audit (byte-exact — S4 bergantung padanya)

```
canonicalJSON(v):
  - objek  : kunci diurutkan (Unicode code point), rekursif
  - array  : urutan dipertahankan
  - tanpa whitespace insignifikan
  - output string UTF-8

payload_n  = { id, at, actor, action, target, detail }   // TANPA seq/prevHash/hash
hash_n     = SHA-256( UTF8( prevHash_n + "\n" + canonicalJSON(payload_n) ) )
prevHash_0 = "0".repeat(64)   // genesis
seq_n      = n                // indeks 0..N-1
```

**Verifikasi rantai** (`lib/audit.ts verifyChain`): jalan dari seq 0, hitung ulang
tiap `hash`, bandingkan. Laporan hasil:

```ts
export interface ChainReport {
  valid: boolean;
  total: number;
  firstBrokenSeq?: number;   // dilokalisasi (S4: "teridentifikasi")
  tip: string;               // hash terakhir — dicetak di artefak M9 (FR-M9-04)
}
```

- Payload yang di-hash **tidak termasuk** `seq/prevHash/hash` — ketiganya struktural.
- Pemisah `\n` antara prevHash dan payload wajib (mencegah ambigu konkatenasi).
- Golden test: fixture audit kecil + expected hash dihitung oleh test suite;
  fungsi SHA-256 itu sendiri divalidasi vektor FIPS (`"abc"` → `ba7816bf…15ad`).

---

## 8. Penyimpanan (zustand persist → localStorage)

| Aspek | Nilai |
|---|---|
| Key | `vestigium_${MODE}_v1` → `vestigium_mvp_v1` / `vestigium_prod_v1` (D-22). Konstanta tunggal di `lib/config.ts` — dilarang hardcode key di komponen/store lain. |
| Library | `zustand/middleware persist` — `version: 1` sinkron dgn `schemaVersion`, `migrate` → registry §9 |
| Bentuk | Seluruh `VestigiumState` (tanpa `partialize` — state UI transient tidak masuk store) |
| Persist | Otomatis pasca setiap action gateway (AGENTS §4.2); `setItem` dibungkus try/catch → toast + banner + dorongan ekspor (NFR-08) |
| Kuota | Meter = `JSON.stringify(state).length`; amber > 80% dari ~5 MB (FR-M10-05) |
| Hydration | Guard `mounted` untuk UI yang membaca state persist — cegah hydration mismatch static export (AGENTS §6) |

> Namespacing key = kebutuhan **transport** (localStorage per-origin — dua mode di domain sama
> berbagi storage), BUKAN perubahan skema. `schemaVersion` tetap 1; berkas backup antar mode
> saling kompatibel.

---

## 9. Format Ekspor / Impor & Migrasi

### 9.1 Berkas ekspor — `vestigium-backup-YYYYMMDDHHMMSS.json` (UTC)

```json
{
  "schemaVersion": 1,
  "exportedAt": "2025-03-16T08:00:00Z",
  "chainTip": "<hex64 dari §7>",
  "counts": { "cases": 2, "evidence": 4, "custody": 8, "acquisitions": 2,
              "verifications": 3, "persons": 5, "audit": 42 },
  "data": {
    "persons": [], "cases": [], "evidence": [], "custody": [],
    "acquisitions": [], "verifications": [], "audit": [], "settings": {}
  }
}
```

`counts` ada untuk preview impor (FR-M10-03) tanpa mengurai seluruh data.

### 9.2 Alur impor (deny-by-default)

```
1. zod.parse BackupFile            → gagal = tolak ("berkas bukan backup Vestigium yang valid")
2. schemaVersion > CURRENT         → tolak ("backup dibuat aplikasi lebih baru — perbarui aplikasi")
3. schemaVersion < CURRENT         → jalankan MIGRATIONS berurutan hingga CURRENT
4. verifyChain(data.audit)         → hasil ditampilkan di preview (putus ≠ tolak —
                                     tampilkan peringatan keras + biarkan keputusan operator)
5. Preview (counts, exportedAt, hasil chain) → konfirmasi eksplisit → timpa
6. Audit: action 'IMPORT', detail nama berkas + chainTip
7. Impor lintas mode (mvp↔production) diizinkan dan merupakan jalur migrasi resmi antar
   environment — bukan sinkronisasi.
```

```ts
export const MIGRATIONS: Record<number, (d: unknown) => unknown> = {
  // v1 awal — kosong. Pola contoh: 1: (d) => ({ ...d, fieldBaru: default })
};
```

---

## 10. Invarian (numbered — tiap butir = test case wajib)

| ID | Invarian | Dijamin oleh |
|---|---|---|
| INV-01 | `custody/acquisitions/verifications/audit` hanya bertambah; panjang tak pernah menyusut | Tipe store tanpa operasi lain (AGENTS §4.1) + test |
| INV-02 | Setiap `evidence.caseId` merujuk `Case` yang ada | zod lintas-entitas saat tulis + `validateState()` |
| INV-03 | Setiap `custody.evidenceId` & `acquisitions.evidenceId` & `verification.evidenceId` merujuk item yang ada; `verification.acquisitionId` (bila ada) merujuk akuisisi item itu | sama |
| INV-04 | Custodian item = `toParty` event custody terakhir (by occurredAt) | selector — field custodian tidak ada |
| INV-05 | `sealNumber` unik global di seluruh item + custody events yang menyimpannya | zod refine saat tulis |
| INV-06 | `referenceHash` write-once: penulisan kedua = throw INVARIANT | action gateway |
| INV-07 | `occurredAt` valid ISO-ber-offset; `recordedAt` berakhir `Z` | zod |
| INV-08 | `occurredAt > recordedAt` (peristiwa masa depan) → peringatan + konfirmasi, tetap boleh (NFR-09) | form |
| INV-09 | Custody `collected` pertama hanya lahir bersama registrasi item; kasus tanpa `authorizationRef` menolak registrasi (FR-M1-03, S6) | zod refine lintas-entitas |
| INV-10 | `medium='physical'` → `witnessId`, `packaging` (≠'none'), `sealNumber` wajib (D-05) | zod refine |
| INV-11 | `powerState='on'` → `volatileChecklist` tiga-tiganya `true` (FR-M3-03, S2) | zod refine |
| INV-12 | `method='live'` → `originalChanged=true` + `changeJustification` (FR-M4-04) | zod refine |
| INV-13 | `originalChanged=true` → `changeJustification` wajib | zod refine |
| INV-14 | Transfer: `fromParty ≠ toParty` (FR-M6-04) | zod refine |
| INV-15 | `finishedAt ≥ startedAt` pada akuisisi | zod refine |
| INV-16 | `verification.result` **harus konsisten** dengan perbandingan `computedHash` vs hash acuan (referensi item, atau imageHash akuisisi bila `acquisitionId` ada); `unverified` hanya bila item belum ber-hash referensi | action gateway — ketidaksesuaian = throw INVARIANT |
| INV-17 | Rantai audit: `prevHash_n = hash_{n-1}`; `hash` = rumus §7 | `verifyChain` (S4) |
| INV-18 | Person yang direferensikan event tidak bisa dihapus — hanya `isActive=false` (FR-M7-03) | action gateway |
| INV-19 | Setiap mutasi state menghasilkan ≥1 AuditEvent | gateway (FR-M8-01) |
| INV-20 | `case.status='closed'` → `closedReason` terisi; reopen → reason baru menimpa + audited | zod refine + gateway |

`validateState(state): Error[]` di `lib/validate.ts` memeriksa INV-02/03 (dan chain
opsional) — dijalankan pasca-impor dan tersedia di test harness.

---

## 11. Katalog Selector (derived — satu-satunya sumber nilai turunan)

| Selector | Menghitung |
|---|---|
| `selectCurrentCustodian(evidenceId)` | display Party dari custody event terakhir (INV-04) |
| `selectCaseItems(caseId)` · `selectItemCase(itemId)` | relasi |
| `selectPrimaryAcquisition(evidenceId)` | akuisisi pertama dengan `imageHash === referenceHash` (jika ada) |
| `selectMatchStatus(acquisition)` | `sourceHash && imageHash ? (sama?'match':'mismatch') : 'unverified'` (§12.2) |
| `selectItemIntegrity(evidenceId)` | `{ hasReference, lastVerification, status }` — status dari verifikasi terakhir (by recordedAt) atas item/akuisisi primer |
| `selectIntegrityIncidents()` | item dgn verifikasi terakhir `mismatch` (S3 — tak pernah disembunyikan) |
| `selectVerificationProgress()` | `{ verified, withHash, total, percent }` — meter dashboard |
| `selectChainTip()` · `verifyChain()` | §7 |
| `selectStorageUsage()` | §8 |
| `selectNextX()` | §6 — hanya dipanggil dari gateway saat alokasi |

**Dilarang** menghitung nilai di atas inline di komponen (CC-22/AGENTS §4.4).

---

## 12. Klarifikasi Formal terhadap FEATURE/PRD

Perubahan dokumenter kecil akibat perincian skema — dicatat di sini agar tak ada
divergensi diam-diam; flag untuk changelog FEATURE.md v1.1:

1. **FEATURE.md §8 diagram** — `VerificationRecord` wajib merujuk `EvidenceItem`
   dan *opsional* merujuk `AcquisitionRecord`. Verifikasi mengacu pada **hash
   referensi item** (objek hukum yang penting); rujukan akuisisi = konteks tambahan.
   PRD FR-M5-02/03 sudah sesuai bentuk ini; diagram §8 diperbarui.
2. **PRD FR-M4-03 `matchStatus` tidak disimpan** — sepenuhnya derived
   (konstitusi + CC-22: kedua operand tercatat & beku). Selector `selectMatchStatus`.
   Sebaliknya `verification.result` **disimpan** sebagai fakta tercatat dengan
   invariant konsistensi saat tulis (INV-16) — bukan ditambah sembarangan.
3. **`EvidenceItem.occurredAt ≡ collectedAt`** — satu field dua peran (registrasi
   item = peristiwa collection). Tidak ada duplikasi.
4. **`Party` terstruktur** (§3.4) — menegakkan FR-M7-02 (orang hanya dari roster)
   sambil mengizinkan lokasi/pihak eksternal sebagai label teks.
5. **Tanpa array counters** (§6) — penomoran derived dari array append-only;
   melampaui PRD §7.2 yang tidak menspesifikasi mekanisme.

---

## 13. Contoh Golden (fixture format untuk `test/`)

```json
{
  "custody": {
    "id": "0f2a…uuid", "evidenceId": "9c1b…uuid", "type": "transferred",
    "fromParty": { "kind": "person", "personId": "a1…uuid" },
    "toParty":   { "kind": "location", "label": "Evidence Room" },
    "reason": "Serah terima penyimpanan pasca-imaging",
    "sealCondition": "intact", "sealNumber": "SEAL-2025-00871",
    "recordedById": "b2…uuid",
    "occurredAt": "2025-03-15T10:02:00+07:00",
    "recordedAt": "2025-03-15T03:04:11Z"
  },
  "audit": {
    "seq": 7, "id": "cd3e…uuid", "at": "2025-03-15T03:04:12Z",
    "actor": "S. Pratama, DES", "action": "CUSTODY", "target": "EV-0003",
    "detail": "Transfer: A. Ramadhan → Evidence Room",
    "prevHash": "<hash seq 6>", "hash": "<sha256(prevHash + '\n' + canonicalJSON(payload))>"
  }
}
```

---

## 14. Kewajiban Test (vitest — `test/`)

| Test | Memvalidasi |
|---|---|
| FIPS vectors (`"abc"`, 2x`"abcdbcde…"`) | mesin SHA-256 (§7, FR-M5-04) |
| Golden chain fixture → hash deterministik + `verifyChain` | §7, INV-17, S4 |
| Tamper fixture (ubah 1 field) → `firstBrokenSeq` terdeteksi | S4 |
| Seluruh `*.createSchema` — case valid & tiap refine (INV-09…15) | §3, §10 |
| Schema `acquisition` menerima `sourceClockNotes` (string opsional), menolak tipe salah | K-4, FR-M4-02 |
| `nextCaseNo/nextEvidenceNo/nextAcquisitionNo` — rollover tahun, max+1 | §6 |
| `validateState` mendeteksi referensi menggantung | INV-02/03 |
| Roundtrip ekspor→impor + migrasi registry | §9, S5 |
