# AGENTS.md — Vestigium

> File ini dibaca otomatis oleh AI coding agent (opencode) sebelum bekerja di repo ini.
> **Versi 1.0 — Baselined** (D-22 & keputusan keamanan terkunci).
> Patuhi seluruh isi file. Bila instruksi di sini bertentangan dengan intuisi umum "praktik terbaik",
> **file ini yang menang** — proyek ini memiliki kendala domain forensik yang tidak lazim.

---

## 1. Konteks Proyek

**Vestigium** adalah sistem dokumentasi operasional forensik digital yang selaras ISO/IEC 27037:2012.
Tujuannya satu: menjaga **nilai pembuktian bukti digital di pengadilan** (court-readiness).
Ini BUKAN aplikasi CRUD biasa — ini sistem rekam jejak (chain of custody) yang mungkin
diperiksa oleh hakim, jaksa, dan auditor. Setiap keputusan desain yang terlihat "kaku"
(append-only, validasi menolak, dual timestamp) adalah **disengaja dan memiliki alasan hukum**.

Stack: Next.js 14+ (App Router, TypeScript) · shadcn/ui · Tailwind · zustand (+persist localStorage) · zod ·
deploy GitHub Pages via **static export**.

---

## 2. Urutan Membaca (WAJIB sebelum mengubah kode)

1. `FEATURE.md` — kontrak fitur & prinsip konstitusi (§4) — sumber kebenaran tertinggi
2. `PRD.md` — persyaratan FR/NFR bernomor; kode WAJIB merujuk ID FR-nya
3. `DATA.md` — skema entitas + zod contract
4. `DESIGN.md` — arsitektur frontend, tokens, wireframe
5. `CODE.md` — disiplin kode & checklist review

**Aturan dokumen-dulu:** fitur baru yang belum ada di FEATURE.md/PRD.md JANGAN diimplementasikan —
tawarkan penambahan dokumen terlebih dahulu.

---

## 3. Perintah

```bash
npm run dev         # dev server
npm run build       # static export → out/  (gagal build = tidak boleh merge)
npm run lint        # eslint — wajib bersih
npm run typecheck   # tsc --noEmit — wajib bersih
npm run test        # vitest (lib/ murni: hash FIPS, time, schemas, domain)
```

Package manager mengikuti lockfile yang ada di repo. Jangan menambah dependensi tanpa
membaca §8.

---

## 4. ATURAN KRITIS — pelanggaran = bug fatal domain

Ini bukan gaya kode; ini jaminan hukum. Pelanggaran mana pun = PR ditolak.

### 4.1 Append-only — JANGAN PERNAH menambah update/delete
`custody`, `acquisitions`, `verifications`, `audit` **hanya punya operasi append**.
- DILARANG menambah fungsi `updateX`, `deleteX`, `patchX`, `upsertX` untuk entitas ini.
- DILARANG "merapikan" dengan membuat operasi CRUD lengkap — ini kesalahan paling umum agent.
- Koreksi data selalu = **record baru** yang merujuk record lama (anulasi/anotasi).
- Record append dibekukan: `Object.freeze` pada objek sebelum masuk state.

### 4.2 Mutation Gateway — semua tulisan lewat satu pintu
Setiap mutasi state HANYA melalui action zustand store (`store/useVestigium.ts`).
- Komponen DILARANG memanggil `localStorage` langsung.
- Action store selalu: validasi → cek transisi → mutasi → **audit otomatis** → persist.
- Tidak ada mutasi tanpa entri audit (PRD FR-M8-01) — gateway menjamin ini; jangan pintaskan.

### 4.3 Satu sumber jam
- `recordedAt` HANYA dari `lib/time.ts` → `nowUTC()`.
- DILARANG memanggil `new Date()` di luar `lib/time.ts` (satu pengecualian: `UtcClock` komponen).
- `occurredAt` HANYA dari input user melalui parser `toUTC()` di `lib/time.ts`.
- JANGAN "memperbaiki" jeda antara `occurredAt` dan `recordedAt` — keduanya sengaja
  disimpan terpisah (dual timestamp): catatan tersusul itu jujur dan sah.

### 4.4 Derived value tidak disimpan
Custodian saat ini, jumlah item kasus, status verifikasi = **dihitung via selector**
(`store/selectors.ts`) saat render. DILARANG menyimpannya sebagai field "untuk mempermudah".
Custodian = penerima CustodyEvent terakhir, titik.

### 4.5 State machine sebagai tabel
Transisi status (`collected→sealed→…`, `open→active→closed`) hanya melalui tabel
`TRANSITIONS` + `canTransition()` di `lib/domain.ts`. DILARANG if-chain status tersebar.
Transisi ilegal yang lolos validator = `throw Error('INVARIANT: …')` — jangan ditangkap
diam-diam; lebih baik jelas-jelas rusak daripada merusak rantai bukti secara senyap.

### 4.6 Deny-by-default — JANGAN dilonggarkan
Validasi zod menolak data tidak lengkap secara prosedural (mis. collection tanpa
otorisasi kasus, checklist volatile belum lengkap, live acquisition tanpa justifikasi).
- JANGAN mengubah validasi keras menjadi peringatan "agar UX lebih baik" — penolakan
  adalah fitur, bukan bug.
- Pesan penolakan selalu edukatif: sebut APA yang harus dilengkapi dan DI MANA.
- Hash sumber ≠ hash image saat input: peringatkan keras tapi **simpan apa adanya**
  (dokumentasi jujur), jangan blokir, jangan koreksi otomatis.

### 4.7 Zero-outbound — JANGAN menambah request jaringan runtime
- DILARANG: `fetch`, `XMLHttpRequest`, `WebSocket`, `<img src="http…">`, font CDN,
  script CDN, analytics, sembarang embed.
- Font via `next/font` (self-host saat build). Ikon via `lucide-react` (ter-bundle).
- Setelah halaman dimuat, aplikasi harus menghasilkan **nol** request jaringan
  (diverifikasi manual via scenario S7).

### 4.8 Integritas tidak pernah disembunyikan
Hasil MISMATCH, integrity incident, deviasi prosedur → ditampilkan apa adanya di UI
dan laporan. DILARANG menyembunyikan, menghapus, atau "menyelesaikan" otomatis.

### 4.9 Render aman
DILARANG `dangerouslySetInnerHTML`. Semua data user lolos escaping React bawaan.

### 4.10 Security (SEC — CODE.md §15)
- DILARANG: `dangerouslySetInnerHTML`, `eval`, `new Function`, `fetch` baru, inline handler.
- Parameter URL & referensi antar-record = **internal UUID via selector** (K-2). Nomor bisnis
  (`EV-0042`, `CASE-2025-014`) = display & pencarian only — dilarang jadi kunci akses/routing.
- Schema impor backup wajib `.strict()`. CSP `connect-src 'none'` tidak boleh dilonggarkan.
- IDOR/broken access control = N/A struktural di mode mvp (tanpa server) — JANGAN menambah
  kontrol server-side yang tidak berlaku (auth header, CSRF token), JANGAN mengeklaimnya.

---

## 5. Kendala Platform — GitHub Pages static export

- `next.config.mjs`: `output: 'export'`, `basePath: '/vestigium'`, `images.unoptimized: true`.
- **DILARANG membuat dynamic route segment** (`/[id]`) untuk data runtime — tidak didukung
  static export. Pola wajib: `/evidence/detail?id=...` dibaca via `useSearchParams()`
  yang **wajib dibungkus `<Suspense>`** (else build gagal).
- Semua link internal pakai `Link` atau path + query; jangan asumsikan URL path dinamis.
- Ini agent sering "memperbaiki" ke route dinamis karena terasa lebih idiomatik — JANGAN.

### Multi-environment (D-22)
- Mode build via `VESTIGIUM_MODE` (`mvp` default | `production`). DILARANG mengubah logika mode
  di `next.config.mjs` atau "menyederhanakannya" (CC-30).
- Selama mode mvp: DILARANG membuat `app/api/**` — satu route saja mematahkan static export.
- Storage key HANYA dari konstanta tunggal `lib/config.ts` (`vestigium_mvp_v1`) —
  dilarang hardcode `localStorage` key di komponen/store lain.
- DILARANG menyelesaikan dua environment dengan strategi dua branch.

---

## 6. Struktur & Lapisan

```
src/
├── app/            # route pages — TIPIS, hanya komposisi
├── components/
│   ├── ui/         # shadcn (generated) — jangan diedit manual
│   ├── app/        # AppShell, Sidebar, UtcClock, PageHeader
│   ├── domain/     # HashBox, DualTimestamp, StatusBadge, Stamp, CustodyTimeline,
│   │               # VolatileChecklist, PersonCombobox, RejectionList, TypeToConfirm
│   └── reports/    # ReportDocument, CustodyFormDocument (print-parity A4)
├── lib/            # MURNI: hash, time, id, domain, schemas(zod), utils
├── store/          # useVestigium (gateway mutasi) + selectors
└── test/           # vektor FIPS, schema tests
```

Aturan lapisan:
- `lib/` = **bebas React & bebas DOM**. Fungsi murni, mudah diuji.
- `store/` = bebas React DOM (komponen hanya memanggil action).
- Hanya `components/` & `app/` yang menyentuh UI.
- Setelah mutasi = render ulang dari state (re-render penuh). DILARANG menambal DOM manual
  untuk data dari state. Pengecualian tertutup: progress bar streaming hash, `UtcClock`.

### Gotcha hydration (zustand persist + static export)
Halaman pre-render tanpa data localStorage → risiko hydration mismatch. Pola wajib:
guard `mounted` (atau `skipHydration` + hydrate di effect) untuk UI yang membaca state
persist. Jangan "menyelesaikan" dengan menghapus persist atau memindah data ke server.

---

## 7. Pola Wajib: Satu Aksi Tulis

Setiap aksi tulis mengikuti pola ini tanpa pengecualian:

```
1. Form (react-hook-form + zod schema dari lib/schemas.ts)
2. Submit → validasi ulang di action store (defense-in-depth)
3. Cek transisi state: canTransition() — tolak bila ilegal (throw INVARIANT)
4. Bentuk record (dual timestamp: occurredAt dari input, recordedAt dari nowUTC())
5. Append lewat gateway → audit otomatis → persist otomatis
6. Toast sukses / RejectionList inline bila gagal
7. Render ulang dari state
```

Contoh acuan: implementasi `transferCustody` di `store/useVestigium.ts` — jadikan template
untuk aksi tulis baru.

---

## 8. Dependensi

- Prinsip: minimal. Setiap dependensi baru = justifikasi tertulis di deskripsi PR +
  pertimbangan zero-outbound (§4.7) dan ukuran bundle.
- Dilarang menambah: state manager kedua, CSS framework kedua, date library besar
  (pakai `lib/time.ts`), fetch wrapper, ORM.
- `components/ui/` shadcn ditambah via CLI shadcn (`npx shadcn@latest add <komponen>`),
  bukan dikopas manual dari internet.

---

## 9. Gaya Kode (ringkas — detail di CODE.md)

- Identifier **Bahasa Inggris** (`camelCase`, `UPPER_SNAKE` konstanta); komentar **Bahasa Indonesia**.
- Komentar menjelaskan MENGAPA (rasional hukum/prosedural) + merujuk ID FR:
  `// FR-M4-04: live acquisition mengubah original; justifikasi wajib (least alteration §6.4.3)`
- Nilai enum = string lowercase English (`collected`, `bit-stream`, `mismatch`) sesuai skema —
  JANGAN membuat sinonim. Bahasa UI = Indonesia formal; istilah teknis tetap Inggris
  (chain of custody, hash, write blocker, evidence).
- `const` default, `===` selalu, tanpa `any` (pakai tipe domain dari `lib/types.ts`),
  tanpa dead code, tanpa `console.log` tertinggal.
- Fungsi ≤ ~40 baris, satu tanggung jawab; logika murni dipisah dari efek samping.

---

## 10. Definisi Selesai — cek sebelum mengklaim selesai

1. Semua FR yang disentuh terimplementasi + merujuk ID FR di komentar.
2. Setiap mutasi menghasilkan audit event (lewati gateway = gagal).
3. `npm run lint` · `npm run typecheck` · `npm run build` · `npm run test` — semua bersih.
4. Skenario penerimaan terkait (FEATURE.md §10, S1–S7) lulus secara manual.
5. Zero-outbound tetap terjaga (tidak ada request runtime baru).
6. Tidak ada entitas append-only yang mendapat operasi tulis selain append.

---

## 11. Jika Ragu

- Aturan bertentangan atau kasus tidak tercakup → **TANYA, jangan mengasumsikan.**
- Memilih antara "lebih mudah" vs "lebih patuh aturan" → **pilih patuh aturan**, lalu catat
  ketegangannya sebagai usulan perubahan dokumen.
- Tergoda menambah fitur yang "pasti dibutuhkan" (edit, delete, sync, auth, dsb.) →
  cek FEATURE.md §13 (di luar cakupan) dan §3 (roadmap lapisan) dulu.
