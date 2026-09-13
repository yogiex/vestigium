<div align="center">

# VESTIGIUM

**Digital Forensic Record System**

*vestigium* (Latin) — jejak; akar kata ***in**vestigation*.

Sistem dokumentasi operasional forensik digital yang dibangun untuk satu tujuan:
**menjaga nilai pembuktian bukti digital sampai ke persidangan.**

[![Standard](https://img.shields.io/badge/selaras-ISO%2FIEC%2027037:2012-8A6D1C)](FEATURE.md)
[![Status](https://img.shields.io/badge/status-desain%20baselined%20%C2%B7%20implementasi%20berjalan-F0B429)](#-status-proyek)
[![License](https://img.shields.io/badge/license-TBD-lightgrey)](#-lisensi)
[![Platform](https://img.shields.io/badge/platform-GitHub%20Pages%20%C2%B7%20offline--first-181717)](#-teknologi)

</div>

---

## Mengapa Vestigium Ada

Bukti digital jarang gugur di persidangan karena isinya salah.
Ia gugur karena **proses penanganannya tidak bisa dibuktikan**:

- Chain of custody terputus — atau hanya ada di ingatan orang.
- Hash tidak dihitung, dihitung setelah fakta, atau tidak pernah diverifikasi ulang.
- Alat dan metode akuisisi tidak terdokumentasi — mudah diserang ahli lawan.
- Catatan dibuat menyusul lewat kertas atau Excel yang bisa diedit kapan pun.

Vestigium memaksa setiap tindakan terhadap bukti terdokumentasi serentak,
**append-only**, dan dapat direkonstruksi pihak ketiga tanpa kehadiran operator aslinya.
Ini **bukan alat analisis forensik** — ia adalah sistem rekam jejaknya.

## Ujian Persidangan

Setiap fitur harus menjawab satu pertanyaan: *pertanyaan mana di pengadilan yang
dijawab fitur ini, dan artefak apa yang dibawakan ke sidang?*

| Serangan di persidangan | Jawaban Vestigium |
|---|---|
| *"Apa bukti Anda berwenang memeriksa barang ini?"* | Referensi otorisasi wajib per kasus — collection ditolak sistem tanpa itu |
| *"Bagaimana Anda yakin ini barang yang sama saat disita?"* | Identifikasi univocal: nomor item permanen, serial/IMEI, nomor seal tamper-evident |
| *"Siapa saja yang memegang bukti, kapan, dan mengapa?"* | Chain of custody append-only, dual timestamp UTC, tanpa edit/hapus |
| *"Bukti digital mudah diubah — yakin isinya belum berubah?"* | Hash ganda (sumber + image) + riwayat verifikasi yang tidak pernah ditimpa |
| *"Apakah alat dan metode Anda andal?"* | Tool + versi + write blocker wajib tercatat per akuisisi |
| *"Log sistem Anda bisa diedit, kan?"* | Audit log **hash-chained**: tiap entri mengunci entri sebelumnya |
| *"Siapa yang bisa mengulang pemeriksaan Anda?"* | Mesin SHA-256 dengan self-test vektor resmi FIPS/NIST, transparan di UI |

## Cara Kerja dalam 60 Detik

```
Kasus (otorisasi) ──▶ Item evidence (power ON/OFF) ──▶ Collection + seal
      │                                                        │
      ▼                                                        ▼
Laporan A4 + custody form ◀── Verifikasi ulang ◀── Akuisisi + hash ganda
(TTD basah · DOC-ID · audit chain tip)
```

Perangkat ON? Sistem **menolak** collection sebelum checklist volatile lengkap
(order of volatility — RAM diamankan sebelum shutdown). Live acquisition tanpa
justifikasi? Ditolak. Integritas MISMATCH? Ditandai, diaudit, **tidak pernah
disembunyikan**. Penolakan prosedural adalah fitur, bukan bug.

## Fitur Inti

| Modul | Kemampuan kunci |
|---|---|
| **Kasus** | Nomor permanen, referensi otorisasi sebagai gerbang collection, lifecycle dengan alasan wajib |
| **Register Evidence** | 10 kategori sumber, identifikasi fisik, power state wajib, dual timestamp |
| **Collection** | Saksi (selaras KUHAP), packaging + nomor seal unik global, checklist volatile, deviasi terdokumentasi |
| **Akuisisi** | N record per item, hash ganda 64-hex, flag *original changed* dipaksa untuk live acquisition |
| **Preservasi** | Hash referensi terkunci selamanya, riwayat verifikasi append, **Integrity Lab** SHA-256 streaming lokal |
| **Chain of Custody** | Event append-only, custodian diturunkan dari event, custody form cetak dengan kolom TTD basah |
| **Personel** | Roster DEFR/DES — semua nama di dokumen berasal dari satu sumber |
| **Audit Trail** | Append-only + **hash-chain** antar entri, verifikasi rantai, ekspor CSV/JSON |
| **Laporan** | Laporan kasus A4, custody form, DOC-ID + chain tip di setiap artefak |
| **Backup** | Ekspor/impor JSON tervalidasi skema (`schemaVersion` + `chainTip`), lintas environment |

## Prinsip yang Tidak Bisa Ditawar

1. **Univocal & permanen** — nomor tidak pernah diedit atau didaur ulang
2. **Contemporaneous** — dual timestamp: *kapan kejadian* vs *kapan dicatat*, keduanya terlihat
3. **Append-only** — koreksi = record baru yang merujuk record lama, bukan penghapusan
4. **Hash ganda** — sumber dan image dicatat terpisah
5. **Deny-by-default** — aksi tidak sah ditolak dengan pesan yang mengajari
6. **Zero outbound** — nol byte data bukti keluar dari perangkat; nol request jaringan runtime
7. **Third-party reconstructable** — orang luar bisa mengulang verifikasi hanya dari artefak

Lengkap di [FEATURE.md §4](FEATURE.md).

## Status Proyek

> 🚧 **Fase: dokumentasi baselined, implementasi dimulai.**

Seluruh kontrak desain sudah final dan dapat ditinjau (lihat [Peta Dokumentasi](#-peta-dokumentasi)).
Implementasi MVP mengikuti urutan di [DESIGN.md §11](DESIGN.md). Demo live di
GitHub Pages akan tertaut di sini setelah rilis pertama:

```
🔗 Demo: https://yogiex.github.io/vestigium/   (segera)
```

## Teknologi

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | Next.js 14+ (App Router, TypeScript) | Static export untuk GitHub Pages; jalur evolusi ke fullstack |
| UI | shadcn/ui + Tailwind CSS + lucide-react | Ter-bundle penuh — nol request runtime |
| State & persist | Zustand + localStorage | Data 100% sisi-klien; IndexedDB menyusul |
| Validasi | Zod | Satu schema untuk form *dan* lapisan domain (defense-in-depth) |
| Kriptografi | SHA-256 implementasi sendiri + self-test FIPS | Streaming; fallback WebCrypto bila self-test gagal — ditandai jelas |
| Deploy | GitHub Actions → GitHub Pages | `VESTIGIUM_MODE=mvp` → static export |

## Mulai Cepat (Pengembang)

```bash
git clone https://github.com/yogiex/vestigium.git
cd vestigium
npm install

npm run dev          # development server
npm run test         # vitest — hash FIPS, schema, hash-chain
npm run build        # VESTIGIUM_MODE=mvp npm run build → static export ke out/
```

Sebelum berkontribusi, baca [AGENTS.md](AGENTS.md) — berlaku untuk manusia maupun
AI coding agent: **entitas append-only dilarang mendapat operasi edit/delete**,
semua mutasi lewat satu gateway, dan fitur baru wajib masuk dokumen dulu sebelum kode.

## Peta Dokumentasi

| Dokumen | Isi | Untuk siapa |
|---|---|---|
| [FEATURE.md](FEATURE.md) | Kontrak fitur: 10 modul, ujian persidangan, skenario penerimaan S1–S7 | Semua pembaca — **mulai dari sini** |
| [PRD.md](PRD.md) | Persyaratan FR/NFR bernomor + decision register (D-01…D-22) | Kontributor implementasi |
| [DATA.md](DATA.md) | Skema entitas, matriks mutabilitas, spesifikasi hash-chain, invarian | Kontributor data/core |
| [DESIGN.md](DESIGN.md) | Arsitektur frontend, design tokens, wireframe, multi-environment | Kontributor UI |
| [CODE.md](CODE.md) | Disiplin kode & checklist review | Kontributor |
| [AGENTS.md](AGENTS.md) | Aturan untuk AI coding agent (opencode) | Agent + reviewer |

## Model Kepercayaan — Baca Ini Sebelum Memakai

Kejujuran tentang batas adalah bagian dari kredibilitas alat forensik:

- ✅ **Yang dijamin:** ketertelusuran proses, hash-chain anti-tamper lokal, dokumen
  cetak yang konsisten dengan register, verifikasi yang bisa diulang siapa pun.
- ⚠️ **Yang tidak dijamin:** siapa yang mengakses perangkat (tanpa auth — perangkat
  examiner adalah zona kontrol fisik), dan integritas localStorage terhadap pemilik
  perangkat itu sendiri (hash-chain **mendeteksi** tampering, tidak **mencegahnya**).
- 📄 **Jangkar kepercayaan akhir** tetap artefak tercetak + tanda tangan basah —
  setiap laporan memuat DOC-ID dan audit chain tip yang mengaitkannya ke log digital.
- 🔒 **Privasi:** data bukti tidak pernah meninggalkan perangkat. Bukan kebijakan —
  arsitektur (verifikasi S7: nol request jaringan setelah halaman dimuat).

## Roadmap

| Lapisan | Isi | Status |
|---|---|---|
| **L1 — MVP** | 100% sisi-klien di GitHub Pages; seluruh modul P0 | 🚧 Implementasi |
| **L2** | Enkripsi backup (AES-GCM), merge antar tim, foto evidence, label 105×60mm, verifikasi rantai di UI | Backlog |
| **L3 — Production** | Backend (auth + DB) via mode `VESTIGIUM_MODE=production` — domain & prinsip tidak berubah, mode lokal tidak pernah dihapus | Rencana |

Interoperabilitas L1↔L3 lewat berkas backup JSON (`schemaVersion` + `chainTip`) —
migrasi tanpa kehilangan ketertelusuran, bukan sinkronisasi.

## Lisensi

Belum ditentukan (keputusan D-17 terbuka). Kandidat: **MIT**.

---

<div align="center">

*Setiap tindakan terhadap bukti meninggalkan jejak yang tidak bisa dihapus.*
*Itulah vestigium.*

</div>
