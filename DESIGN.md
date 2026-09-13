# DESIGN.md — Vestigium: Desain UI/UX & Arsitektur Frontend

> **Versi:** 0.2 · **Status:** Draft
> **Stack (baru):** Next.js 14+ (App Router, TypeScript) · shadcn/ui · Tailwind CSS
> **Referensi:** PRD.md (persyaratan FR/NFR) · FEATURE.md (modul) · CODE.md (disiplin kode)
> **Catatan re-baseline:** Keputusan D-11 supersedes (lihat §1). Prinsip domain PRD §2 tidak berubah.

---

## 1. Re-Baseline Keputusan (implikasi stack Next.js)

| ID | Keputusan | Status baru |
|---|---|---|
| D-11 | Tanpa build step, multi-file klasik | ❌ **SUPERSEDED** → Next.js + TypeScript dengan build |
| D-12 | Zero-outbound | ✅ **TETAP**, bentuk berbeda: `next/font/google` men-*self-host* font saat build; `lucide-react` ter-bundle — **nol request runtime** tetap tercapai (NFR-02 aman) |
| D-10 | localStorage | ✅ TETAP → zustand `persist` (localStorage); IndexedDB tetap P2 |
| D-19 | **BARU** — Hosting | GitHub Pages via **static export** + GitHub Actions (sesuai syarat awal). Vercel = alternatif tanpa biaya effort, tapi Pages dipertahankan |
| D-20 | **BARU** — TypeScript | **Ya** (wajib praktis: ekosistem shadcn + zod + tipe domain) |
| D-21 | **BARU** — Tabel data | MVP: `Table` shadcn sederhana; TanStack Table = P1 saat filter/serialisasi kompleks |

**Evolution path (penting untuk arsitektur):** Next.js membuka jalan ke backend sungguhan
(auth + DB) sebagai Lapisan 3 — sejalan dengan kata "fullstack" di visi awal Anda.
Untuk **MVP dan integritas sidang, data tetap 100% sisi-klien** (bukti tidak pernah
meninggalkan perangkat). Konsekuensi arsitektur: lapisan data diisolasi penuh di `store/`
(§4.3) agar suatu hari bisa ditukar ke API/DB tanpa menyentuh UI. Jangan biarkan komponen
mengakses storage secara langsung — itu jembatan masa depan.

---

## 2. Prinsip Desain UI

1. **Dokumen, bukan dashboard.** Nuansa visual = berkas forensik resmi (kertas arsip, pita
   evidence, stempel), bukan admin SaaS generik. Alasan: kredibilitas saat ditunjukkan ke
   auditor/jaksa, dan keselarasan dengan artefak cetak.
2. **Mono = bukti.** Semua data machine-verifiable (hash, timestamp, ID, nomor seal) selalu
   JetBrains Mono. Ini kontrak visual: "jika mono, itu angka yang bisa diverifikasi ulang."
3. **Amber = prosedur.** Amber (warna pita bukti) untuk aksi primer & peringatan prosedural.
   Merah **hanya** untuk integritas gagal & aksi destruktif. Hijau **hanya** untuk verified.
   Tidak ada warna dekoratif — setiap warna bermakna hukum.
4. **Print-parity.** Halaman yang menghasilkan artefak persidangan (`/reports/...`)
   menampilkan persis apa yang tercetak. Tidak ada kejutan saat print.
5. **Penolakan mengajari.** Deny-by-default (PRD §8.2) dirender inline di form, merah pada
   field terkait, dan selalu menyebut perbaikannya: bukan "ditolak", tapi "isi referensi
   otorisasi di header kasus untuk melanjutkan".
6. **Waktu ganda selalu terlihat.** Komponen `DualTimestamp` membuat mustahil keliru antara
   *kapan kejadian* vs *kapan dicatat* — dua baris, dua label, selalu berpasangan.

---

## 3. Design Tokens (Tailwind + CSS Variables shadcn)

### 3.1 Warna (format HSL untuk `globals.css` shadcn)

```css
:root { /* tema aplikasi — gelap */
  --background: 240 9% 4%;          /* charcoal nyaris hitam */
  --foreground: 40 20% 96%;         /* putih kertas hangat */
  --card: 240 6% 7%;
  --border: 240 5% 14%;
  --muted-foreground: 240 5% 62%;
  --primary: 40 87% 55%;            /* amber evidence tape */
  --primary-foreground: 40 70% 8%;
  --destructive: 4 68% 58%;         /* integrity failure / destruktif */
  --success: 152 55% 45%;           /* TERVERIFIKASI — custom var */
}
.light-paper { /* tema komponen laporan (print-parity) */
  --background: 40 30% 97%;         /* kertas */
  --foreground: 240 10% 8%;         /* tinta */
  --primary: 40 80% 42%;            /* amber tinta gelap agar kontras di kertas */
}
```

Aturan pemakaian (dapat di-review): `success` tidak boleh dipakai di luar status verifikasi;
`destructive` tidak boleh dipakai di luar integritas gagal & konfirmasi destruktif.

### 3.2 Tipografi

| Peran | Font | Catatan |
|---|---|---|
| UI & heading | Space Grotesk | `next/font/google`, self-host saat build |
| Data (hash/ID/waktu) | JetBrains Mono | kelas utilitas `font-mono` dikustom ke font ini |

Hierarki: judul halaman `text-2xl font-semibold tracking-tight` · label form pakai
`FormLabel` shadcn (uppercase tracking-wide, `text-xs`) · data mono `text-sm`.

### 3.3 Bentuk & tekstur

- `radius: 0.25rem` — tajam, seperti dokumen.
- **Pita hazard**: utilitas `.hazard-band` (repeating-linear-gradient amber/hitam) — hanya di
  kop laporan & header sidebar. Tidak boleh muncul sembarangan.
- **Stempel** (signature moment): komponen `Stamp` — border double, rotate −4°, animasi
  scale-in. Varian: `verified` (hijau) / `failure` (merah). Hanya di Integrity Lab & laporan.

---

## 4. Arsitektur Frontend

### 4.1 Konfigurasi build (mode-aware — D-22)

```js
// next.config.mjs
const MODE = process.env.VESTIGIUM_MODE ?? 'mvp'; // default fail-safe = mvp

const nextConfig = {
  ...(MODE === 'mvp'
    ? { output: 'export', basePath: '/vestigium', images: { unoptimized: true } }
    : {}), // production: full build, API routes aktif (L3)
  env: { NEXT_PUBLIC_VESTIGIUM_MODE: MODE },
};
export default nextConfig;
```

Deploy MVP via **GitHub Actions** (build → upload `out/` → Pages) + `.nojekyll` di output.
Konfigurasi ini tidak boleh "disederhanakan" — lihat CODE.md CC-30.

Detail dua mode → §4.4.

### 4.2 Routing: kendala static export & polanya ⚠️

`output: 'export'` **tidak mendukung** dynamic segment dengan param runtime
(`/evidence/[id]` butuh `generateStaticParams` yang diketahui saat build — ID kita baru ada
saat runtime). Pola yang dipakai:

```
/evidence                → daftar
/evidence/detail?id=<uuid> → detail (parameter = **internal UUID** — SEC-06/K-2;
                             nomor bisnis `EV-0042` hanya display & pencarian,
                             dilarang menjadi kunci akses/routing)
/reports/preview?case=<uuid> → laporan
```

Route map lengkap:

| Route | Halaman | FR utama |
|---|---|---|
| `/` | Dashboard | FR-M1-06, meter integritas |
| `/cases` · `/cases/detail` | Daftar & detail kasus | M1 |
| `/evidence` · `/evidence/detail` | Daftar & detail item | M2, M5, M6 |
| `/custody` | Ledger custody global | M6 |
| `/lab` | Integrity Lab | M5 |
| `/audit` | Audit trail | M8 |
| `/settings` | Identitas, roster, backup | M7, M10 |
| `/reports/preview` | Laporan & custody form (print) | M9 |

### 4.3 Lapisan data & penegakan aturan domain

| Prinsip lama (vanilla) | Penerjemahan React/TS |
|---|---|
| CC-16 Mutation Gateway | **Satu zustand store** (`useVestigium`); komponen hanya memanggil *action* store. Action = satu-satunya jalur mutasi + audit + persist otomatis |
| CC-17 Append-only | Slice custody/acquisition/verification/audit **hanya mengekspos `appendX()`** — tipe-nya tidak punya edit/delete. Record dibekukan `Object.freeze` |
| CC-19 Validator murni | **Zod schema** di `lib/schemas.ts` — dipakai react-hook-form (FR) sekaligus divalidasi ulang di action store (defense-in-depth) |
| CC-20 State machine | Tabel `TRANSITIONS` di `lib/domain.ts` tetap; action store menolak transisi ilegal via `canTransition()` |
| CC-24 Mesin hash | `lib/hash.ts` — pure TS, streaming, self-test FIPS saat startup (tanpa DOM, tanpa React) |
| CC-18 Satu jam | `lib/time.ts` — `nowUTC()` & parser dual timestamp; komponen tidak pernah memanggil `new Date()` |

Struktur:

```
src/
├── app/                    # route pages (tipis — hanya komposisi)
├── components/
│   ├── ui/                 # shadcn (generated)
│   ├── app/                # AppShell, Sidebar, UtcClock, PageHeader
│   ├── domain/             # HashBox, DualTimestamp, StatusBadge, Stamp,
│   │                       # CustodyTimeline, VolatileChecklist, PersonCombobox,
│   │                       # DualTimeField, RejectionList, EmptyState
│   └── reports/            # ReportDocument, CustodyFormDocument (print-parity)
├── lib/                    # PURE: hash, time, id, domain, schemas(zod), utils
├── store/                  # useVestigium.ts (gateway), selectors.ts
└── test/                   # vektor FIPS, schema tests (vitest)
```

Aturan arsitektur: `lib/` bebas React; `store/` bebas React DOM (bisa dipakai server
kelak); hanya `components/` & `app/` yang menyentuh UI.

### 4.4 Multi-Environment (D-22)

Satu codebase, dua pipeline build — mode dipilih saat build (static export tidak punya
runtime env). BUKAN dua branch, BUKAN dua konfigurasi dalam satu build.

| | Mode MVP (L1) | Mode Production (L3) |
|---|---|---|
| Build | `VESTIGIUM_MODE=mvp npm run build` | `VESTIGIUM_MODE=production npm run build` |
| Output | `output:'export'` → `out/` → GitHub Pages (Actions) | Full build → API aktif → Vercel/VPS |
| Store | zustand → `vestigium_mvp_v1` (localStorage) | store kedua, interface sama → API/DB (`vestigium_prod_v1`) |
| Zero-outbound | berlaku penuh (S7) | klien tetap lokal-first |

Aturan keras:
1. Default mode = `mvp` (fail-safe).
2. DILARANG strategi dua branch — `schemaVersion` wajib tunggal lintas mode (DATA.md §9).
3. Selama mode mvp, DILARANG ada `app/api/**` di tree — satu saja mematahkan export build.
4. Interop antar environment HANYA via berkas backup JSON (DATA.md §9) — bukan sinkronisasi.
5. Monorepo extraction (`packages/core` + `apps/static` + `apps/server`) hanya saat L3 dimulai.

---

## 5. App Shell

```
┌──────────────────────────────────────────────────────────────────────┐
│ ██ hazard band (4px) ██████████████████████████████████████████████ │
├────────────┬─────────────────────────────────────────────────────────┤
│ VESTIGIUM  │ PageHeader: breadcrumb · judul · [aksi primer]          │
│            ├─────────────────────────────────────────────────────────┤
│ 01 Ringk.  │                                                         │
│ 02 Kasus   │                      konten                             │
│ 03 Evidence│                                                         │
│ 04 Custody │                                                         │
│ 05 Lab     │                                                         │
│ 06 Audit   │                                                         │
│ 07 Setting │                                                         │
│ ──────────  │                                                         │
│ 14:32:07Z  │                                                         │
│ UTC · 82KB │                                                         │
└────────────┴─────────────────────────────────────────────────────────┘
```

- Sidebar: komponen `Sidebar` shadcn; nomor 2-digit + ikon; item aktif = border kiri amber.
- `UtcClock`: live UTC mono di footer sidebar (pengecualian CC-27 tetap berlaku).
- Storage meter: KB terpakai + amber bila >80% kuota (FR-M10-05).
- Mobile (≤ md): sidebar → `Sheet`; semua form tetap satu kolom (D-15, NFR-06).

---

## 6. Wireframe Kunci

### 6.1 Detail Evidence — layar terpenting (FR-M2/M5/M6)

```
◀ Evidence Register   EV-0003 · CASE-2025-002                 [TERSEGEL]
Arsip mailbox PST — j.santoso@ptnd.co.id

┌ Aksi ────────────────────────────────────────────────────────────────┐
│ [Transfer Custody] [Verifikasi Integritas] [Buka Seal] [Cetak Label] │
└──────────────────────────────────────────────────────────────────────┘
┌ IDENTIFIKASI (dl) ──────────────┐ ┌ CHAIN OF CUSTODY (timeline) ────┐
│ Kategori        Log / dokumen   │ │ ● collected   14 Mar 09:14 UTC  │
│ Power state     OFF             │ │   lokasi → A. Ramadhan (DEFR)   │
│ Lokasi          Mail server     │ │ ● transferred 15 Mar 10:02 UTC  │
│ Serial/IMEI     —               │ │   A.R → S. Pratama (DES)        │
│ Waktu kejadian  14 Mar 09:14    │ │ ● sealed      15 Mar 11:40 UTC  │
│ Dicatat         14 Mar 09:16 ⚠  │ │   → Evidence Room               │
│ Metode          logical copy    │ │   [Δ dicatat 2 mnt setelah]     │
└─────────────────────────────────┘ └─────────────────────────────────┘
┌ HASH REFERENSI §6.5 ─────────────────────────────────────────────────┐
│ SHA-256  a3f9e2…c21b4            [copy]      ✅ TERVERIFIKASI (2×)   │
│ sumber: santoso.pst · 2.0 GiB                terakhir: 16 Mar 08:00  │
└──────────────────────────────────────────────────────────────────────┘
┌ AKUISISI (N record) ─────────────────────────────────────────────────┐
│ AC-EV0003-01 · logical · Export ECP · hash ganda MATCH   [+ Tambah]  │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 Registrasi item + gerbang checklist volatile (FR-M3-03) — Novel UX

Dialog `Sheet` kanan (bukan modal kecil — formnya panjang dan penting):

```
┌ REGISTRASI EVIDENCE ───────────────────────────── [§6.2–6.4] ─────┐
│ Kasus ▾   Label* ________   Kategori ▾   Power saat ditemukan:    │
│                                            (●) OFF  ( ) ON        │
│ ┌─ ⚠ PERANGKAT ON — ORDER OF VOLATILITY (§6.3) ────────────────┐  │
│ │ [x] Layar & kondisi terdokumentasi                            │  │
│ │ [x] Rencana pengamanan volatile (RAM) tercatat                │  │
│ │ [ ] Metode shutdown dicatat                                   │  │
│ │ ── Checklist belum lengkap. Record TIDAK DAPAT disimpan. ──   │  │
│ └───────────────────────────────────────────────────────────────┘  │
│ Saksi* ▾ (wajib utk fisik)   Wadah ▾   No. Seal* ____             │
│ Deviasi prosedur? ( ) tidak ( ) ya → alasan ____________          │
│                                        [ Batal ] [Registrasi]     │
└────────────────────────────────────────────────────────────────────┘
```

Perilaku gerbang: tombol simpan **disabled** + `RejectionList` menyebut butir yang
belum; checklist hanya muncul jika power = ON (progressive disclosure).

### 6.3 Integrity Lab

```
┌ KALKULASI SHA-256 ───────────────────┐ ┌ VERIFIKASI vs REGISTER ──┐
│ ┌ dropzone ────────────────────────┐ │ │ Target item ▾            │
│ │ seret berkas — 0 byte keluar     │ │ │ Referensi: a3f9e2…c21b4  │
│ └──────────────────────────────────┘ │ │                          │
│ ████████████░░░░ 62% · 740 MB/s      │ │   ┌─────────────────┐    │
│ sha256 (mono, 8 baris)        [copy] │ │ │ ✅ INTEGRITY      │    │
│                                      │ │ │   VERIFIED       │    │
│ self-test: PASSED (2 vektor FIPS)    │ │ └─────────────────┘    │
└──────────────────────────────────────┘ │ [Catat ke riwayat]      │
                                         └─────────────────────────┘
```

### 6.4 Dashboard & Laporan — deskriptif

- **Dashboard**: kartu statistik (kasus aktif, item, event custody, % terverifikasi dengan
  `Progress`), docket kasus, aktivitas terakhir, banner status self-test hash.
- **Laporan** (`/reports/preview`): komponen `ReportDocument` membungkus diri dengan
  `light-paper` class + lebar A4 terpusat di atas latar gelap → print-parity jelas;
  tombol cetak memanggil `window.print()` dengan `@media print` menyembunyikan shell.

---

## 7. Inventaris Komponen Domain → shadcn

| Komponen | Basis shadcn | Logika kustom | FR |
|---|---|---|---|
| `DualTimestamp` | `Tooltip` | dua baris occurred/recorded, ikon ⚠ bila janggal >24 jam | FR-M2-04 |
| `DualTimeField` | `Input type=datetime-local` + `Popover` | konversi lokal→UTC saat submit | FR-M2-04 |
| `StatusBadge` | `Badge` | map enum→variant (satu tabel di `domain.ts`) | §7.3 PRD |
| `HashBox` | — | mono, truncate+expand, tombol copy, label konteks | FR-M5-01 |
| `Stamp` | — | animasi stempel verified/failure | FR-M5-05 |
| `CustodyTimeline` | — | timeline vertikal, Δ antara occurred & recorded | M6 |
| `VolatileChecklist` | `Checkbox` | gerbang disable-save + alasan | FR-M3-03 |
| `PersonCombobox` | `Command`+`Popover` | sumber roster-only + quick-add inline | FR-M7-02 |
| `RejectionList` | `Alert` | daftar pesan zod yang edukatif | §8.2 PRD |
| `TypeToConfirm` | `Input`+`AlertDialog` | ketik kata kunci utk wipe | D-16 |
| `SealNumberField` | `Input` | validasi unik global terhadap register | FR-M3-02 |
| `UtcClock` · `StorageMeter` | — | polling ringan, pengecualian render | NFR-08 |

Primitif shadcn yang dipakai langsung: `Table, Card, Dialog, Sheet, AlertDialog, Form,
Select, Checkbox, Command, Popover, Tabs, Progress, Sonner(toast), Badge, Alert, Separator`.

---

## 8. Pola Interaksi (terikat FR)

1. **Gerbang deny-by-default** — semua form: zod memvalidasi saat submit → `RejectionList`
   inline merah per field; action store memvalidasi ulang (tolak bila lolos UI tapi gagal
   domain → itu bug, `console.error` + toast generik, sesuai CC-29).
2. **Konfirmasi berjenjang** — L1 `AlertDialog` (impor, tutup kasus, muat demo);
   L2 `TypeToConfirm` "HAPUS SEMUA" (wipe total).
3. **Toast** (Sonner) — setiap commit sukses; error = variant destructive. Aksi
   MISMATCH = toast destruktif **dan** stempel failure.
4. **Empty state selalu mengarahkan** — "Belum ada kasus → [Buka Kasus Pertama]".
5. **Print** — `print:` variants: sembunyikan sidebar/header; `ReportDocument` penuh lebar;
   header/footer cetak memuat DOC-ID + chain tip (FR-M9-04).

---

## 9. Aksesibilitas & Responsif

- Radix (dasar shadcn) memberi focus-trap, aria, keyboard nav — NFR-07 jauh lebih murah
  di stack ini; tetap wajib: label form terhubung, `focus-visible ring` amber, kontras ≥4.5:1.
- Breakpoint kritis **360px**: form registrasi satu kolom, tombol aksi full-width,
  tabel → scroll horizontal dengan kolom kunci ter-sticky (item no).
- Target sentuh ≥44px pada semua aksi di halaman evidence/collection (konteks lapangan).

---

## 10. Implikasi ke Dokumen Lain

- **CODE.md → v0.2 diperlukan**: CC-02/03 (namespace IIFE → modul ES), CC-16 (gateway →
  action store), CC-19 (validator murni → zod), CC-23 (esc() → React escaping + aturan
  `dangerouslySetInnerHTML` dilarang), CC-25 (tetap: dilarang `<img>`/font remote runtime),
  CC-36–39 git tetap. Inti CC-16/17/18/20/24 **tidak berubah**.
- **DATA.md** masih terutang — di stack ini praktis menjadi `lib/types.ts` + `lib/schemas.ts`
  (zod) + kontrak persist; tetap didokumentasikan dulu sebelum kode.
- **PRD §12 (struktur repo)** digantikan §4.3 dokumen ini.

---

## 11. Urutan Pelaksanaan

```
1. Konfirmasi §1 (D-19/20/21) & keputusan tersisa PRD §3     ← SEKARANG
2. Scaffold: Next.js + TS + shadcn + Tailwind + next/font + deploy workflow
3. DATA.md → lib/types.ts + lib/schemas.ts (zod)  [skema dikunci dulu]
4. CODE.md v0.2  [disiplin versi React]
5. lib/ murni + vitest (hash FIPS, time, domain) — tanpa UI
6. store/ + audit chain — tanpa UI
7. UI per modul mengikuti §6, urutan: settings → cases → evidence →
   custody → lab → audit → dashboard → reports
8. S1–S7 (PRD §10) → rilis
```
