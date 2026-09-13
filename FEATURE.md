# FEATURE.md — Vestigium (Digital Forensic Record System)

> **Versi:** 1.0 (Baselined) · **Status:** Aktif — acuan tertinggi untuk semua keputusan produk
> **Acuan domain:** ISO/IEC 27037:2012 — Identification · Collection · Acquisition · Preservation
> **Dokumen turunan:** `PRD.md` (persyaratan FR/NFR) · `DATA.md` (skema) · `DESIGN.md` (UI/UX) · `CODE.md` (disiplin kode)
> **Aturan dokumen:** Setiap fitur baru WAJIB masuk dokumen ini dulu sebelum diimplementasikan.
> Bila dokumen turunan bertentangan dengan dokumen ini → dokumen ini menang.

---

## 1. Masalah yang Dipecahkan

Bukti digital jarang gugur di persidangan karena isinya salah — ia gugur karena
**proses penanganannya tidak bisa dibuktikan**:

- Chain of custody terputus, atau hanya ada di ingatan orang.
- Hash tidak dihitung, dihitung setelah fakta, atau tidak pernah diverifikasi ulang.
- Alat dan metode akuisisi tidak terdokumentasi — mudah diserang ahli lawan.
- Catatan dibuat menyusul lewat kertas/Excel yang bisa diedit kapan pun.
- Penyidik tidak dipandu urutan prosedur yang benar (mis. mematikan perangkat live
  sebelum RAM diamankan).

**Vestigium adalah sistem dokumentasi operasional forensik** — bukan alat analisis.
Ia memaksa setiap tindakan terhadap bukti terdokumentasi serentak, append-only,
dan **dapat direkonstruksi pihak ketiga tanpa kehadiran operator aslinya**.

---

## 2. Bintang Utara: Court-Readiness

Semua keputusan fitur tunduk pada satu ujian:

> **"Ujian Persidangan"** — setiap fitur harus bisa menjawab:
> *"Fitur ini menghasilkan jawaban untuk pertanyaan mana di pengadilan,
> dan artefak apa yang dibawakan ke sidang?"*

### 2.1 Tujuh Serangan Klasik di Persidangan → Jawaban Sistem

| # | Serangan (hakim / kuasa hukum lawan) | Kemampuan sistem | Artefak sidang | Modul |
|---|---|---|---|---|
| A1 | "Apa bukti Anda berwenang memeriksa barang ini?" | Referensi otorisasi wajib per kasus | Laporan §Otorisasi | M1 |
| A2 | "Bagaimana Anda yakin ini barang yang sama saat disita?" | Identifikasi univocal: nomor item permanen, serial/IMEI, nomor seal | Label + register | M2, M3 |
| A3 | "Siapa saja yang memegang bukti, kapan, mengapa?" | Chain of custody append-only ber-timestamp UTC | Custody form + timeline | M6 |
| A4 | "Bukti digital mudah diubah — yakin isinya belum berubah?" | Hash ganda (sumber + image) + riwayat verifikasi append | Pernyataan integritas + daftar hash | M4, M5 |
| A5 | "Apakah alat dan metode Anda andal?" | Tool + versi + write blocker wajib tercatat | Laporan §Detail Akuisisi | M4 |
| A6 | "Log sistem Anda bisa diedit, kan?" | Append-only + hash-chain audit | Audit export + verifikasi rantai | M8 |
| A7 | "Siapa yang bisa mengulang pemeriksaan Anda?" | Mesin hash dengan self-test publik (vektor FIPS), prosedur terdokumentasi | Metodologi di laporan; Integrity Lab | M5, M9 |

### 2.2 Dua Sisi Pengguna yang Dilayani

**Penyidik (DEFR/DES)** — butuh *dipandu benar*: urutan prosedur dipandu sistem
(order of volatility, peringatan power state), pencatatan cepat tapi tidak bisa
setengah-setengah, dan aksi yang melanggar prosedur ditolak atau wajib dideklarasikan
sebagai deviasi.

**Hakim / persidangan** — butuh *bisa dipercaya tanpa operator*: dokumen cetak lengkap
dan bertanda tangan, timeline tanpa celah, angka yang bisa dicek ulang siapa pun
(hash, waktu UTC, nomor seri).

---

## 3. Ruang Lingkup

| Fase | Standard | Cakupan |
|---|---|---|
| Identification, Collection, Acquisition, Preservation | **ISO/IEC 27037:2012** | ✅ Inti v1 |
| Analysis & interpretation | ISO/IEC 27042 | ⚠️ Terbatas: catatan temuan per item (backlog) |
| Incident response | ISO/IEC 27035 | ❌ Di luar cakupan |
| Manajemen mutu lab | ISO/IEC 17025 | ⚠️ Terinspirasi (dokumentasi tool & metode), bukan sertifikasi |

**Jangkar hukum Indonesia** (pemandu desain, bukan nasihat hukum):
- UU ITE Pasal 5 — dokumen elektronik sebagai alat bukti sah → menuntut jaminan
  integritas yang disediakan M4/M5.
- KUHAP (penyitaan) — berita acara dengan saksi → field saksi di collection record (M3).

**Jalur evolusi (dilindungi arsitektur):**

| Lapisan | Isi | Status |
|---|---|---|
| L1 | MVP 100% sisi-klien — data tidak pernah meninggalkan perangkat | v1.0 |
| L2 | Peningkatan lokal: enkripsi backup, merge antar tim, foto evidence, label cetak | Backlog |
| L3 | Backend sungguhan (auth + DB) via Next.js server — **domain & prinsip tidak berubah**, hanya lapisan penyimpanan ditukar | Pasca-MVP |

> Prinsip evolusi: bukti tidak pernah *wajib* keluar dari perangkat. Lapisan 3 hanya
> boleh menambah opsi penyimpanan terpusat, tidak pernah menghapus mode lokal.

---

## 4. Konstitusi Sistem (Prinsip Desain)

Hukum lintas-fitur. Modul mana pun yang melanggar = bug desain.

1. **Univocal & permanen** — nomor kasus/item/akuisisi tidak pernah diedit atau
   didaur ulang. Kesalahan dianulir lewat event baru, bukan dihapus.
2. **Contemporaneous** — pencatatan mengikat pada saat tindakan; dual timestamp
   (`occurredAt` input user + `recordedAt` jam sistem UTC otomatis) membuat catatan
   tersusul tetap jujur dan terlihat.
3. **Append-only rantai bukti** — custody, akuisisi, verifikasi, audit tidak punya
   edit/hapus. Koreksi = entri baru yang merujuk entri lama.
4. **Hash ganda** — hash sumber *dan* hash image dicatat terpisah; keduanya wajib MATCH.
5. **Disiplin waktu** — semua timestamp UTC; waktu lokal + zona hanya pelengkap konteks.
6. **Least alteration** — perubahan pada original (termasuk live acquisition) wajib
   dideklarasikan + justifikasi.
7. **Original ≠ working copy** — item fisik dan image punya jalur custody masing-masing.
8. **Third-party reconstructable** — orang luar memahami dan mengulang verifikasi
   hanya dari artefak sistem.
9. **Deny-by-default** — aksi yang tidak sah secara prosedur ditolak sistem dengan
   pesan yang menjelaskan perbaikannya, bukan sekadar diberi peringatan.
10. **Zero outbound** — tidak ada byte data bukti yang dikirim ke mana pun;
    setelah halaman dimuat, aplikasi tidak menghasilkan request jaringan.

---

## 5. Peran & Persona

| Peran | Tugas | Di sistem |
|---|---|---|
| **DEFR** — Digital Evidence First Responder | Penemuan, pengamanan, collection di lokasi | Subjek utama M2/M3 |
| **DES** — Digital Evidence Specialist | Akuisisi & preservasi di lab | Subjek utama M4/M5 |
| DEFR/DES Manager | Otorisasi, persetujuan deviasi | Referensi M1; gating L2 |
| Auditor / Pengawas | Audit berkala | Read-only ke M8 |
| Jaksa / kuasa hukum | Konsumen laporan | Bukan pengguna sistem; menentukan mutu output M9 |

> MVP: satu examiner per perangkat; peran adalah **metadata** (siapa melakukan apa),
> bukan autentikasi. Autentikasi multi-pengguna masuk Lapisan 3.

---

## 6. Platform & Teknologi

| Aspek | Keputusan |
|---|---|
| Framework | **Next.js 14+ (App Router, TypeScript)** — static export |
| UI | **shadcn/ui + Tailwind CSS** + lucide-react (ter-bundle) |
| State & persist | Zustand + persist ke localStorage (IndexedDB = P2) |
| Validasi | Zod schema — dipakai form sekaligus lapisan domain (defense-in-depth) |
| Hosting | **GitHub Pages** via GitHub Actions (build → upload `out/`) |
| Font | Self-host saat build (`next/font`) — nol request runtime |
| Karakter | Offline penuh, tanpa server, tanpa backend di MVP |

Kendala platform yang membentuk desain (detail di DESIGN.md §4): routing detail
memakai query parameter (`/evidence/detail?id=…`) karena static export tidak
mendukung dynamic segment runtime; `basePath` mengikuti nama repo.

---

## 7. Modul Fitur

Notasi prioritas: **P0** = MVP (wajib agar valid terhadap 27037) · **P1** = Lapisan 2 · **P2** = Backlog.
Detail persyaratan per fitur (FR bernomor) ada di PRD.md §5.

### M1 — Manajemen Kasus
Wadah konteks, otorisasi legal, batas scope. Menjawab **A1**.

| Fitur | Pri |
|---|---|
| Nomor kasus otomatis `CASE-YYYY-NNN` (permanen) | P0 |
| Referensi otorisasi wajib **sebelum** collection pertama direkam (ditolak bila kosong) | P0 |
| Lifecycle `open → active → closed`; transisi wajib alasan | P0 |
| Scope pemeriksaan; PIC DEFR + DES dari roster | P0 |
| Laporan kasus (M9) | P0 |
| Penutupan diblokir bila ada item belum resolved | P1 |
| Arsip kasus selesai (read-only) | P2 |

**Aturan bisnis:** nomor tidak didaur ulang · collection ditolak tanpa otorisasi ·
penutupan wajib menyertakan keputusan disposal semua item.

### M2 — Register Evidence / Identification (§6.2)
Mencatat "apa yang ditemukan" sebelum disentuh. Menjawab **A2**.

| Fitur | Pri |
|---|---|
| Nomor item otomatis `EV-NNNN` global monoton (permanen) | P0 |
| Taksonomi 10 kategori sumber (workstation, mobile, removable, memori, optical, cloud, log, network capture, dokumen, IoT/DVR) | P0 |
| Identifikasi fisik: merek/model/serial/IMEI/kapasitas | P0 |
| **Power state saat ditemukan (ON/OFF) wajib** — memicu alur M3 berbeda | P0 |
| Waktu discovery vs collection dipisah; dual timestamp | P0 |
| Lokasi fisik + kondisi fisik (utuh/rusak/terenkripsi/lainnya) | P0 |
| Lampiran foto kondisi | P2 |

**Aturan:** item wajib terhubung kasus · power ON memicu checklist volatile (M3) ·
kesalahan fatal = anulasi via event, nomor tetap terpakai.

### M3 — Collection Log (§6.3)
Merekam pemindangan ke pengawasan resmi + keputusan lapangan. Menjawab **A2, A3**.

| Fitur | Pri |
|---|---|
| Record collection: DEFR penemu, waktu, **saksi** (wajib utk fisik, KUHAP) | P0 |
| Packaging (antistatic bag/evidence bag/box/amplop/tanpa wadah) + **nomor seal tamper-evident** (unik global) | P0 |
| **Checklist volatile** (jika ON): layar terdokumentasi / rencana RAM / metode shutdown — belum lengkap = record tidak bisa disimpan | P0 |
| Peringatan prosedural kontekstual (order of volatility, jangan nyalakan perangkat OFF) | P0 |
| Deviasi prosedur + alasan wajib | P0 |
| Persetujuan manager untuk deviasi | P1 |

**Aturan:** collection pertama otomatis membuat CustodyEvent pertama — rantai
**selalu** mulai dari lokasi kejadian, bukan lab.

### M4 — Acquisition Log (§6.4)
Merekam proses duplikasi data + bukti integritas lengkap. Menjawab **A4, A5**.

| Fitur | Pri |
|---|---|
| **N record akuisisi per item** (bukan field pada item) | P0 |
| Jenis sumber (non-volatile/volatile); metode (bit-stream/logical/targeted/live) | P0 |
| Tool + versi + write blocker; format output (E01/RAW/AFF4); waktu mulai–selesai; operator; media tujuan | P0 |
| **Hash ganda**: hash sumber + hash image (validasi 64-hex) + status MATCH | P0 |
| Flag `originalChanged` — dipaksa `true` untuk live + justifikasi wajib | P0 |
| Multi-copy per akuisisi | P1 |

**Aturan:** record tidak bisa diedit setelah dibuat · hash sumber ≠ image saat input
→ peringatan keras tapi **disimpan apa adanya** (dokumentasi jujur) · live tanpa
justifikasi ditolak.

### M5 — Preservation & Integrity (§6.5)
Membuktikan data tidak berubah, kapan pun, oleh siapa pun. Menjawab **A4, A7**.

| Fitur | Pri |
|---|---|
| Hash referensi ditetapkan saat akuisisi, **terkunci selamanya** | P0 |
| Riwayat verifikasi append (waktu, metode, hash terhitung, MATCH/MISMATCH, verifier) | P0 |
| **Integrity Lab**: SHA-256 streaming lokal + progress; hasil bisa dicatat / ditetapkan sebagai referensi | P0 |
| **Self-test mesin hash** vs vektor FIPS/NIST saat startup, hasil transparan di UI; fallback WebCrypto ditandai jelas | P0 |
| Lifecycle seal `opened → resealed` dengan nomor seal per state | P1 |
| MISMATCH → **integrity incident** + catatan investigasi | P1 |

**Aturan:** hash salah input dianulir via record baru, kedua hash tersimpan ·
riwayat tidak pernah ditimpa · MISMATCH tidak disembunyikan.

### M6 — Chain of Custody (§6.5.3)
Jawaban pasti untuk A3: siapa–kapan–di mana–mengapa, dari lokasi kejadian hingga disposal.

| Fitur | Pri |
|---|---|
| Event append-only: `collected, transferred, sealed, opened, released` (+`resealed, disposed` P1) | P0 |
| Field: waktu, dari→kepada, alasan, kondisi seal, pencatat, catatan | P0 |
| Custodian = penerima event terakhir (**derived**, bukan field bebas) | P0 |
| **Custody form cetak** dengan kolom tanda tangan basah | P0 |
| Visual gap-check timeline; disposal + otorisasi | P1 |

**Aturan:** append-only total · transfer `dari == kepada` ditolak · buka seal tanpa
custody event = pelanggaran yang terlihat di timeline.

### M7 — Personel & Peran (§5)
Konsistensi identitas orang di semua dokumen (mencegah typo yang merusak kredibilitas).

| Fitur | Pri |
|---|---|
| Roster: nama, peran (DEFR/DES/manager/penyidik/lainnya), organisasi, kredensial, status aktif | P0 |
| Semua referensi orang dari roster (combobox + tambah-cepat inline); input bebas dinonaktifkan | P0 |
| Gating peran (manager menyetujui deviasi) | P1 |
| Identitas lintas perangkat via merge impor | P2 |

**Aturan:** personel yang sudah direferensikan event tidak bisa dihapus — hanya dinonaktifkan.

### M8 — Audit Trail
Mematahkan **A6** — "log Anda bisa diedit, kan?"

| Fitur | Pri |
|---|---|
| Log global append-only otomatis (aktor, waktu UTC, aksi, target, detail) | P0 |
| **Hash-chain**: tiap entri ber-hash entri sebelumnya (anti-tamper lokal) | P0 |
| Filter/pencarian + ekspor CSV & JSON | P0 |
| Tombol "Verifikasi Rantai" + laporan hasil; chain tip dicetak di artefak M9 | P1 |
| Ekspor bertanda tangan digital (WebCrypto keypair) | P2 |

**Aturan:** tidak ada UI edit/hapus · verifikasi rantai mendeteksi tampering storage.

### M9 — Reporting & Artefak Persidangan
Output sistem = berkas yang dibawa ke sidang.

| Artefak | Isi | Pri |
|---|---|---|
| **Laporan kasus (A4)** | Ringkasan + otorisasi, daftar item, detail akuisisi (tool, write blocker, hash ganda, `originalChanged`), chain of custody, pernyataan integritas + daftar incident apa adanya, personel, pengesahan 2 TTD basah | P0 |
| **Custody form per item** | Timeline + kolom TTD basah tiap pihak | P0 |
| **Label evidence** | A4 grid (P1); 105×60 mm (P2) | P1 |
| Ringkasan integritas | Terverifikasi vs belum, riwayat MISMATCH | P1 |

**Aturan:** setiap artefak memuat DOC-ID (`VEST-RPT-<caseNo>-<ts>`), timestamp
generasi UTC, organisasi, dan audit chain tip — kertas mengaitkan dirinya ke log digital.

### M10 — Penyimpanan, Backup, Interoperabilitas

| Fitur | Pri |
|---|---|
| Persistensi lokal penuh, offline | P0 |
| Ekspor JSON penuh: `{schemaVersion, exportedAt, chainTip, data}` | P0 |
| Impor: validasi skema + preview + konfirmasi eksplisit; tolak versi lebih baru | P0 |
| Reset demo = konfirmasi; wipe total = ketik kata kunci | P0 |
| Indikator storage + peringatan >80% kuota | P0 |
| Enkripsi backup (AES-GCM WebCrypto) | P1 |
| Impor **merge** (union by ID + laporan konflik) untuk tim | P1 |
| Lampiran berkas/foto (IndexedDB); PWA | P2 |

**Aturan:** impor tidak pernah menimpa data valid secara diam-diam.

---

## 8. Model Data Inti

```
Case (1) ──< EvidenceItem (N)
EvidenceItem (1) ──< CustodyEvent (N)              [append-only]
EvidenceItem (1) ──< AcquisitionRecord (N)         [append-only]
AcquisitionRecord (1) ──< VerificationRecord (N)   [append-only]
Person (1) ──< direferensikan semua event
AuditEvent (global, append-only, hash-chained)
```

**Invarian:** ID unik & permanen · entitas append-only hanya insert + anotasi ·
referensi tidak menggantung · custodian selalu konsisten dengan event terakhir
(derived). Skema final di `DATA.md` / `lib/types.ts`.

---

## 9. Matriks Ketertelusuran ISO 27037 → Fitur → Artefak

| Klausul | Tuntutan | Modul | Artefak sidang |
|---|---|---|---|
| §4 | Taksonomi sumber, volatile vs non-volatile, keadaan daya | M2, M4 | Register, checklist live |
| §5 | Peran DEFR/DES + manager | M7 | Blok pengesahan laporan |
| §6.2 | Identifikasi univocal, lokasi, waktu, otorisasi | M1, M2 | Register + laporan §Otorisasi |
| §6.3 | Collection, packaging, seal, order of volatility | M3, M6 | Collection record + custody form |
| §6.4 | Metode, tool, live acquisition terkendali | M4 | Laporan §Detail Akuisisi |
| §6.5 | Preservasi, hash, custody, storage, verifikasi ulang | M5, M6, M8, M9 | Pernyataan integritas, audit export |

---

## 10. Skenario Penerimaan

| ID | Skenario | Lulus jika |
|---|---|---|
| S1 | **Siklus penuh** — kasus → item OFF → collection+seal → akuisisi hash ganda MATCH → verifikasi ulang → cetak laporan + custody form | Dokumen konsisten; rantai mulai dari lokasi; hash ganda tercatat terpisah |
| S2 | **Perangkat live** — item ON → checklist volatile → live acquisition | Collection ditolak tanpa checklist; `originalChanged=true` + justifikasi wajib |
| S3 | **Serangan integritas** — verifikasi ulang → MISMATCH | Stempel failure, incident ditandai & tampil di laporan, tidak ada yang disembunyikan |
| S4 | **Uji tamper audit** — edit storage manual → verifikasi rantai | Pemutusan chain terdeteksi & dilokalisasi |
| S5 | **Roundtrip backup** — ekspor → wipe → impor → verifikasi rantai | Data identik; chain valid; skema divalidasi |
| S6 | **Deny-by-default** — collection pada kasus tanpa otorisasi | Ditolak dengan pesan yang menjelaskan solusi |
| S7 | **Zero-outbound** — DevTools network tab saat pemakaian | Tidak ada request setelah load |

---

## 11. Definisi Selesai (DoD)

Fitur dinyatakan selesai jika:
1. Semua aturan bisnis modulnya terimplementasi + deny-by-default bekerja.
2. Setiap mutasi data memicu audit event (via mutation gateway).
3. Menghasilkan (atau memperkaya) artefak persidangan M9.
4. Zero outbound; tidak ada byte data bukti keluar perangkat.
5. Klausul ISO yang dijawab tercantum di fitur (ketertelusuran terjaga).
6. Skenario S terkait lulus.

---

## 12. Batasan Platform & Mitigasi

| Batasan | Risiko | Mitigasi |
|---|---|---|
| Static export — tanpa server/auth | Siapa pun dengan akses perangkat bisa membuka | Hash-chain audit (M8), enkripsi backup (M10 P1), disiplin fisik perangkat |
| Routing query-param (bukan path dinamis) | URL tidak semestinya bagi auditor | Konvensi dibagikan di README; artifact cetak tetap rujukan resmi |
| localStorage terbatas ~5 MB | Lampiran besar tak muat | Data teks MVP jauh di bawah kuota; foto → IndexedDB (P2); berkas bukti tetap di luar sistem (hanya hash) |
| Tanpa sinkronisasi realtime | Tim bisa kerja di data terpisah | Ekspor/impor JSON + merge (P1); satu "register of record" per tim |
| Browser = lingkungan tak terkendali | Screenshot/manipulasi UI | Kepercayaan akhir pada artefak tercetak + tanda tangan basah |

---

## 13. Di Luar Cakupan v1

Analisis forensik (carving, timeline reconstruction) · autentikasi multi-pengguna/server ·
manajemen insiden (27035) · integrasi tool akuisisi pihak ketiga · penandatanganan PKI lembaga.
(Lapisan 3 — backend penuh — direncanakan pasca-MVP tanpa mengubah prinsip §4.)

---

## 14. Status Dokumen & Keputusan

| Dokumen | Status |
|---|---|
| FEATURE.md (ini) | ✅ v1.0 Baselined |
| PRD.md | ✅ 0.1 — decision register D-01…D-21 (rekomendasi diadopsi sebagai default; revisi per ID kapan pun melalui changelog) |
| CODE.md | ✅ 0.1 vanilla → **v0.2 versi React/TS menunggu** (translasi CC-16/19/23 ke store/zod/React) |
| DESIGN.md | ✅ 0.1 — Next.js + shadcn, wireframe kunci, komponen domain |
| DATA.md | ⏳ Terutang — skema final + zod contract, sebelum scaffold data layer |

Keputusan terbuka: **D-17 lisensi repo** (MIT vs proprietary).

---

## 15. Perubahan Dokumen

| Versi | Perubahan |
|---|---|
| 0.1 | Draft awal: 10 modul, kerangka court-readiness, matriks ketertelusuran |
| 0.2 | Nama produk ditetapkan: **vestigium** |
| 1.0 | Re-baseline stack: Next.js + shadcn + Tailwind (D-11 superseded; D-19/20/21 ditambahkan) · dual timestamp menjadi prinsip konstitusi (#2) · skenario penerimaan S1–S7 · jalur evolusi L1/L2/L3 · zero-outbound naik menjadi prinsip konstitusi (#10) · status dokumen & keputusan dirapikan |
