# PRD.md — Vestigium v1.0 (MVP)

> **Versi:** 0.1 · **Status:** DRAFT — menunggu konfirmasi Decision Register (§3)
> **Referensi:** FEATURE.md (kontrak fitur) · ISO/IEC 27037:2012 · README.md
> **Notasi persyaratan:** **WAJIB** = harus ada, diverifikasi · **TIDAK BOLEH** = larangan keras ·
> **SEBAIKNYA** = disarankan, boleh ditunda · **DAPAT** = opsional
> Setiap FR bernomor adalah butir checklist penerimaan — "selesai" = semua FR modulnya lulus.

---

## 1. Identitas & Ringkasan

| Item | Nilai |
|---|---|
| Nama produk | **Vestigium** — Digital Forensic Record System |
| Visi | Menjaga nilai pembuktian bukti digital melalui dokumentasi operasional yang court-ready |
| North star | Ujian Persidangan (FEATURE.md §2.1, serangan A1–A7) |
| Platform | Aplikasi statis 100% sisi-klien, GitHub Pages, tanpa build step |
| Pengguna | Examiner tunggal per perangkat (D-01); peran sebagai metadata, bukan autentikasi |
| Cakupan | ISO/IEC 27037: identification → collection → acquisition → preservation |

---

## 2. Landasan Terkunci (dari FEATURE.md — tidak dibahas ulang)

Univocal & permanen ID · contemporaneous documentation · append-only rantai bukti ·
hash ganda (sumber + image) · disiplin waktu UTC · least alteration · original ≠ working copy ·
third-party reconstructable · deny-by-default · tidak ada byte data bukti keluar perangkat.

---

## 3. Decision Register (menunggu konfirmasi)

Legenda: 🏛 = **arsitektural** — jawaban mengubah struktur kode; ◻ = default aman, cukup tidak keberatan.

| ID | Keputusan | Rekomendasi | Tipe |
|---|---|---|---|
| D-01 | Model penggunaan | Solo per perangkat; merge impor = P1 | ◻ |
| D-02 | Cakupan analisis | Murni 27037; catatan temuan = backlog | ◻ |
| D-03 | Enkripsi backup | P1 (AES-GCM WebCrypto) | ◻ |
| D-04 | Foto evidence | Teks dulu; IndexedDB = P2 | ◻ |
| D-05 | Saksi penyitaan (KUHAP) | **WAJIB** untuk item fisik; opsional untuk bukti logis | ◻ |
| D-06 | Template laporan | Generik formal Bahasa Indonesia | ◻ |
| D-07 🏛 | Nomor kasus `CASE-YYYY-NNN` — NNN reset per tahun? | Ya, reset per tahun | 🏛 |
| D-08 🏛 | Nomor evidence `EV-NNNN` global vs per kasus | Global, monoton, seumur hidup database | 🏛 |
| D-09 🏛 | Dual timestamp: `occurredAt` (kejadian, input user) + `recordedAt` (sistem UTC) | Ya — lihat §7.1 | 🏛 |
| D-10 🏛 | Storage MVP: localStorage vs IndexedDB | localStorage (data teks); IndexedDB = P2 | 🏛 |
| D-11 🏛 | Arsitektur file: multi-file script klasik (tanpa module/build) | Ya — jalan di Pages **dan** `file://` | 🏛 |
| D-12 🏛 | Aset eksternal runtime | **Nol request** setelah load: font self-host (woff2 subset) | 🏛 |
| D-13 | First-run | Layar sambutan: pilih "isi data demo" atau "mulai kosong" | ◻ |
| D-14 | Tema UI | Satu tema + stylesheet cetak terang otomatis (tanpa toggle) | ◻ |
| D-15 | Target layar | Responsif hingga 360px (input lapangan via HP/tablet) | ◻ |
| D-16 | Konfirmasi destruktif | Berjenjang: konfirmasi biasa → ketik kata kunci untuk wipe total | ◻ |
| D-17 | Lisensi repo | MIT (terbuka) — atau internal/proprietary? | ◻ |
| D-18 🏛 | Label evidence format | A4 grid (multi label per lembar) untuk MVP; 105×60mm = P1 | 🏛 |

> **Prosedur konfirmasi:** balas "setuju semua" — atau sebutkan ID yang diubah beserta keputusannya.
> Keputusan yang disetujui dipindahkan ke kolom Status dan dokumen dinaikkan ke v1.0 (baselined).

---

## 4. Pengguna & Konteks Pemakaian

| Situasi | Perangkat | Kebutuhan kunci |
|---|---|---|
| Lapangan (collection) | HP/tablet | Form cepat, validasi menolak setengah jadi, peringatan prosedural |
| Lab (akuisisi/preservasi) | Laptop | Hash streaming, record akuisisi lengkap, Integrity Lab |
| Persiapan sidang | Laptop | Cetak laporan/custody form, ekspor audit, verifikasi rantai |
| Audit/pemeriksaan pihak ketiga | Perangkat examiner | Read-only: log, timeline, artefak cetak yang direkonstruksi ulang |

---

## 5. Persyaratan Fungsional

### M1 — Manajemen Kasus

- **FR-M1-01** Sistem **WAJIB** membuat nomor kasus otomatis `CASE-YYYY-NNN` (D-07). Nomor **TIDAK BOLEH** diedit atau didaur ulang.
- **FR-M1-02** Form kasus **WAJIB** mencatat: judul*, jenis insiden (enum: akses tidak sah, kebocoran data, penipuan digital, malware, penyalahgunaan aset, sengketa internal, lainnya), prioritas (Tinggi/Sedang/Rendah), PIC DEFR* (roster M7), DES penanggung jawab (roster), organisasi, scope pemeriksaan (teks), deskripsi insiden.
- **FR-M1-03** Referensi otorisasi (no. surat tugas/warrant + tanggal) boleh kosong saat kasus dibuat; sistem **WAJIB MENOLAK** record collection untuk kasus yang belum memiliki referensi otorisasi (deny-by-default), dengan pesan yang menjelaskan apa yang harus dilengkapi.
- **FR-M1-04** Status: `open → active → closed`. Transisi ke `closed` **WAJIB** menyertakan alasan; pembukaan kembali **WAJIB** alasan; keduanya tercatat di audit.
- **FR-M1-05** Penutupan kasus saat ada item belum `released` → peringatan eksplisit + konfirmasi (blokir keras = P1).
- **FR-M1-06** Detail kasus **WAJIB** menampilkan ringkasan: jumlah item, status integritas (hash/terverifikasi), event custody terakhir, integritas incident bila ada.

### M2 — Register Evidence (§6.2 Identification)

- **FR-M2-01** Nomor item otomatis `EV-NNNN`, global monoton (D-08), permanen.
- **FR-M2-02** Field registrasi **WAJIB**: kasus*, label*, kategori sumber (enum 10: workstation, mobile, removable media, memori, optical, cloud, log sistem, network capture, dokumen digital, IoT/DVR), lokasi discovery*, waktu discovery, waktu collection*, **power state saat ditemukan (ON/OFF)***, kondisi fisik (enum: utuh, rusak, terbakar, terenkripsi, lainnya + catatan).
- **FR-M2-03** Field identifikasi fisik **SEBAIKNYA** diisi: merek, model, serial/IMEI, kapasitas media (wajib tampil di form; validasi kapasitas vs ukuran image = P1).
- **FR-M2-04** Setiap record **WAJIB** menyimpan dual timestamp (D-09): `occurredAt` (kapan kejadian, input user, dengan offset zona asli bila backdated) dan `recordedAt` (kapan dicatat, jam sistem UTC — otomatis). Keduanya tampil di UI dan laporan.
- **FR-M2-05** Item **TIDAK BOLEH** dihapus dari UI. Kesalahan registrasi fatal ditangani anotasi/void (P1).
- **FR-M2-06** Peringatan prosedural kontekstual **WAJIB** tampil: power ON → order of volatility ("amankan RAM sebelum mematikan"); power OFF → "jangan nyalakan perangkat".
- **FR-M2-07** Registrasi ditolak bila kasus target tidak valid/kasus tanpa otorisasi belum dibuka aktif.

### M3 — Collection Log (§6.3 Collection)

- **FR-M3-01** Registrasi item otomatis membuat CustodyEvent pertama: `collected`, dari: lokasi discovery → kepada: DEFR penemu. Rantai custody **SELALU** dimulai dari lokasi kejadian.
- **FR-M3-02** Record collection **WAJIB**: DEFR penemu* (roster), **saksi** (D-05: wajib untuk item fisik, opsional untuk logis), packaging (enum: antistatic bag, evidence bag, box, amplop, tanpa wadah — bukti logis), nomor seal tamper-evident (wajib untuk wadah fisik; divalidasi unik global).
- **FR-M3-03** Power ON membuka **checklist volatile** yang **WAJIB** dijawab: (a) layar perangkat terdokumentasi/difoto? (b) rencana pengamanan data volatile (RAM/koneksi) tercatat? (c) metode shutdown dicatat? Checklist belum lengkap → record **TIDAK BOLEH** disimpan.
- **FR-M3-04** Flag deviasi prosedur + alasan wajib bila checklist dilanggar/dilompati (mis. perangkat mati mendadak tanpa RAM dump). Deviasi tampil di laporan.
- **FR-M3-05** Setelah collection fisik lengkap (wadah + seal), status item otomatis `sealed`; bukti logis tetap `collected` (preservasi via hash, M4/M5).
- **FR-M3-06** Semua waktu menggunakan dual timestamp (FR-M2-04).

### M4 — Acquisition Log (§6.4 Acquisition)

- **FR-M4-01** Satu item **WAJIB** mendukung N record akuisisi (mis. disk image + RAM dump perangkat yang sama).
- **FR-M4-02** Field record **WAJIB**: jenis sumber (non-volatile/volatile)*, metode (bit-stream/logical/targeted/live)*, tool + versi*, write blocker (teks; "tidak digunakan" dicatat eksplisit), format output (E01/RAW/AFF4/lainnya)*, waktu mulai & selesai*, operator DES* (roster), media tujuan image (teks).
- **FR-M4-03** **Hash ganda**: hash sumber* dan hash image* — masing-masing divalidasi format 64-hex — plus status kecocokan (MATCH / MISMATCH / belum diverifikasi).
- **FR-M4-04** Flag `originalChanged`*: sistem **WAJIB** memaksanya `true` untuk metode live; jika `true`, justifikasi perubahan* wajib diisi.
- **FR-M4-05** Hash diisi manual (paste) **atau** dihitung via Integrity Lab dan ditarik ke record. (Hitung langsung di form dengan progress inline = P1.)
- **FR-M4-06** Record akuisisi **TIDAK BOLEH** diedit setelah dibuat.
- **FR-M4-07** Bila hash sumber ≠ hash image saat input: sistem memberi peringatan keras **tetapi menyimpan apa adanya** (dokumentasi jujur) + tercatat di audit.
- **FR-M4-08** Live acquisition tanpa justifikasi → ditolak.

### M5 — Preservation & Integrity (§6.5)

- **FR-M5-01** Hash referensi item = hash image akuisisi primer. Setelah terisi, **TIDAK BOLEH** diubah; input salah dianulir via record baru.
- **FR-M5-02** Verifikasi = record append: waktu, metode (perhitungan berkas / manual), hash terhitung, hasil (MATCH/MISMATCH), verifier, catatan. Riwayat **TIDAK BOLEH** ditimpa.
- **FR-M5-03** **Integrity Lab**: SHA-256 streaming ber-chunk dengan progress bar; berkas tidak pernah meninggalkan perangkat; hasil dapat (a) dicatat ke riwayat verifikasi item target, (b) ditetapkan sebagai hash referensi bila item belum ber-hash.
- **FR-M5-04** Self-test mesin hash terhadap 2 vektor resmi FIPS/NIST **WAJIB** berjalan saat startup; hasil ditampilkan transparan di UI (serangan A7); fallback WebCrypto bila gagal — ditandai jelas.
- **FR-M5-05** MISMATCH → item ditandai **integrity incident** + catatan investigasi wajib; sistem **TIDAK BOLEH** menyembunyikan/menghapusnya; incident tampil di dashboard dan laporan.
- **FR-M5-06** Lifecycle seal `opened → resealed` dengan nomor seal per state = P1.

### M6 — Chain of Custody (§6.5.3)

- **FR-M6-01** Tipe event P0: `collected, transferred, sealed, opened, released`; P1: `resealed, disposed`.
- **FR-M6-02** Field **WAJIB** per event: occurredAt*, dari*, kepada*, alasan*, kondisi seal (utuh/pecah/n-a), pencatat (roster), catatan.
- **FR-M6-03** Custodian item = penerima event terakhir — **diturunkan dari event**, bukan field bebas.
- **FR-M6-04** Transfer dengan `dari == kepada` ditolak.
- **FR-M6-05** Append-only total: tidak ada edit/hapus di UI.
- **FR-M6-06** Timeline per item + visual gap-check pemegang = P1.
- **FR-M6-07** Custody form cetak per item dengan kolom tanda tangan basah (§9.2).

### M7 — Personel & Peran (§5)

- **FR-M7-01** Roster: nama, peran (DEFR / DES / DEFR Manager / DES Manager / penyidik / lainnya), organisasi, kredensial/sertifikasi, status aktif.
- **FR-M7-02** Semua referensi orang di form **WAJIB** dari roster (dropdown + pencarian + tambah-cepat inline); input nama bebas dinonaktifkan.
- **FR-M7-03** Personel yang sudah direferensikan event **TIDAK BOLEH** dihapus — hanya dinonaktifkan.
- **FR-M7-04** Nama tampil identik di seluruh UI dan dokumen cetak (satu sumber).

### M8 — Audit Trail

- **FR-M8-01** Setiap mutasi data **WAJIB** ter-log otomatis: recordedAt UTC, aktor, aksi (enum), target, detail. Tidak ada mutasi tanpa audit.
- **FR-M8-02** **Hash-chain**: tiap entri ber-hash (hash entri sebelumnya + payload); chain tip disimpan; verifikasi rantai mendeteksi edit/penghapusan manual pada storage (serangan A6).
- **FR-M8-03** Filter/pencarian + ekspor CSV & JSON.
- **FR-M8-04** Tombol "Verifikasi Rantai" + hasil eksplisit = P1 (chain itu sendiri P0, tip dicetak di artefak).
- **FR-M8-05** Entri audit **TIDAK BOLEH** dapat diedit/dihapus dari UI.

### M9 — Reporting & Artefak Persidangan

- **FR-M9-01** Laporan kasus A4 sesuai struktur §9.1.
- **FR-M9-02** Custody form per item sesuai §9.2.
- **FR-M9-03** Label evidence A4 grid (D-18) = P1.
- **FR-M9-04** Footer setiap artefak **WAJIB**: DOC-ID (`VEST-RPT-<CASENO>-<ts>`), timestamp generasi UTC, nama organisasi, audit chain tip.
- **FR-M9-05** Cetak via dialog browser → PDF; `@media print` bersih tanpa elemen UI aplikasi.

### M10 — Penyimpanan & Backup

- **FR-M10-01** Persistensi lokal penuh (D-10), berjalan offline.
- **FR-M10-02** Ekspor JSON penuh: `{schemaVersion: 1, exportedAt, chainTip, data:{cases, evidence, custody, acquisitions, verifications, persons, audit}}`; nama `vestigium-backup-<ts>.json`.
- **FR-M10-03** Impor: validasi skema + preview ringkas (jumlah kasus/item/rentang tanggal) + konfirmasi sebelum menimpa; menolak `schemaVersion` lebih baru dari aplikasi.
- **FR-M10-04** Reset demo = konfirmasi biasa; wipe total = konfirmasi berjenjang + ketik kata kunci (D-16).
- **FR-M10-05** Indikator pemakaian storage + peringatan >80% kuota.
- **FR-M10-06** Enkripsi backup (D-03) = P1.

---

## 6. Persyaratan Non-Fungsional

| ID | Persyaratan |
|---|---|
| NFR-01 | Performa hash: ≥ 50 MB/s streaming; berkas 1 GB selesai ≤ 30 dtk di laptop umum; UI tetap responsif selama proses |
| NFR-02 | **Zero outbound**: setelah halaman dimuat, tidak ada satu pun request jaringan (D-12) — font self-host, ikon inline |
| NFR-03 | Offline penuh setelah load pertama; berfungsi dari `file://` maupun Pages |
| NFR-04 | Keamanan render: semua data pengguna di-escape; tidak ada injeksi HTML mentah |
| NFR-05 | Browser: versi terakhir & sebelumnya Chrome, Edge, Firefox, Safari |
| NFR-06 | Responsif hingga lebar 360px (D-15) |
| NFR-07 | Aksesibilitas dasar: label form terhubung, fokus terlihat, kontras teks utama ≥ 4.5:1 |
| NFR-08 | Ketahanan data: simpan segera setelah setiap mutasi; storage rusak → pesan jelas + dorongan ekspor, bukan crash diam |
| NFR-09 | Anomali jam (deteksi pergeseran besar recordedAt) → peringatan ke operator (SEBAIKNYA) |
| NFR-10 | Tanpa build step; script klasik multi-file (D-11) |

---

## 7. Spesifikasi Data & Format

### 7.1 Dual Timestamp (D-09)

Setiap peristiwa dunia nyata menyimpan dua waktu — ini implementasi kontemporer prinsip *contemporaneous* **tanpa berbohong**:

```
occurredAt : "2025-03-14T09:30:00+07:00"   ← kapan kejadian (input user; offset asli dipertahankan)
recordedAt : "2025-03-14T04:31:12Z"        ← kapan dicatat (jam sistem, UTC, otomatis)
```

Aturan: `recordedAt` tidak pernah diinput manusia. Jika `occurredAt` mendekati/melampaui `recordedAt` secara janggal (backdating ekstrem), sistem menampilkan konfirmasi ringan — tetap mengizinkan, karena catatan tersusul adalah kenyataan lapangan; yang penting **kedua waktu terlihat** di UI dan laporan.

### 7.2 Format ID

| Entitas | Format | Contoh | Aturan |
|---|---|---|---|
| Kasus | `CASE-YYYY-NNN` | CASE-2025-014 | NNN reset per tahun (D-07) |
| Evidence | `EV-NNNN` | EV-0042 | Global monoton (D-08) |
| Akuisisi | `AC-<evNo>-NN` | AC-EV0042-01 | Urut per item |
| DOC-ID laporan | `VEST-RPT-<caseNo>-<YYYYMMDDHHMMSS>` | — | Setiap generasi cetak unik |

### 7.3 Enum Kunci

- **Status item:** `collected → sealed → in-analysis → released` (+ `disposed` P1)
- **Status kasus:** `open → active → closed`
- **Tipe custody event:** `collected, transferred, sealed, opened, released` (+ `resealed, disposed` P1)
- **Metode akuisisi:** `bit-stream, logical, targeted, live`
- **Hasil verifikasi:** `match, mismatch, unverified`

### 7.4 Migrasi Skema

Impor membaca `schemaVersion`: sama → terima; lebih lama → migrasi terdefinisi; lebih baru → **tolak** dengan pesan versi aplikasi yang dibutuhkan.

---

## 8. Arsitektur Halaman & Aturan Interaksi

### 8.1 Inventaris Halaman

| Route | Halaman | Isi kunci |
|---|---|---|
| `#/` | Dashboard | Statistik, docket kasus, aktivitas, meter integritas, status self-test hash |
| `#/cases` | Daftar kasus | Tabel + pencarian + filter status |
| `#/case/:id` | Detail kasus | Header otorisasi, tabel item, timeline custody ringkas, aksi status |
| `#/evidence` | Daftar evidence | Tabel + filter kasus/status/integritas |
| `#/evidence/:id` | Detail item | Identifikasi lengkap, hash box, aksi custody, timeline, riwayat verifikasi & akuisisi |
| `#/custody` | Ledger custody global | Tabel kronologis + pencarian |
| `#/lab` | Integrity Lab | Drop berkas → hash streaming → bandingkan register → stempel hasil |
| `#/audit` | Audit log | Tabel append-only + filter + ekspor |
| `#/settings` | Pengaturan | Identitas unit, roster, backup/impor, zona berbahaya |
| `#/report/:caseId` | Laporan | Kertas A4 di layar + tombol cetak |

### 8.2 Aturan Interaksi Global

1. **Pesan penolakan selalu edukatif** — bukan "ditolak", melainkan "apa yang harus dilengkapi" (mis. "Collection ditolak: kasus belum memiliki referensi otorisasi — isi di header kasus").
2. **Peringatan prosedural inline** di form (power state, live acquisition, mismatch) — bukan dialog terpisah.
3. **Konfirmasi berjenjang** (D-16): level 1 = modal konfirmasi (impor, tutup kasus); level 2 = ketik kata kunci (wipe total).
4. **Setiap aksi yang mengubah data menghasilkan toast + entri audit.**

---

## 9. Spesifikasi Artefak Cetak

### 9.1 Laporan Kasus (A4 portrait)

Kop (organisasi + pita hazard) → §1 Ringkasan kasus & **otorisasi** → §2 Daftar item evidence → §3 Detail akuisisi per item (metode, tool, write blocker, hash ganda, `originalChanged` + justifikasi) → §4 Chain of custody lengkap → §5 Pernyataan integritas (tabel hash + status verifikasi + **daftar integrity incident apa adanya**) → §6 Personel & peran → §7 Pengesahan (2 kolom TTD basah) → footer DOC-ID + timestamp generasi + chain tip.

### 9.2 Custody Form (1 item per halaman)

Identitas item + hash referensi → tabel event kronologis (waktu, aksi, dari→kepada, alasan, kondisi seal) → **kolom tanda tangan per baris event** → footer sama dengan §9.1.

---

## 10. Kriteria Penerimaan

| ID | Skenario | Lulus jika |
|---|---|---|
| S1 | **Siklus penuh** (kasus → item OFF → collection+seal → akuisisi hash ganda MATCH → verifikasi ulang → cetak laporan + custody form) | Semua dokumen konsisten; rantai custody mulai dari lokasi; hash ganda tercatat terpisah |
| S2 | **Perangkat live** (item ON → checklist volatile → live acquisition) | Sistem menolak menyelesaikan collection tanpa checklist; `originalChanged=true` + justifikasi wajib |
| S3 | **Serangan integritas** (verifikasi ulang → MISMATCH) | Stempel failure, incident ditandai & tampil di laporan, tidak ada yang disembunyikan |
| S4 | **Uji tamper audit** (edit storage manual → verifikasi rantai) | Pemutusan chain terdeteksi dan dilokalisasi |
| S5 | **Roundtrip backup** (ekspor → wipe → impor → verifikasi rantai) | Data identik; chain valid; skema versi divalidasi |
| S6 | **Deny-by-default** (collection pada kasus tanpa otorisasi) | Ditolak dengan pesan yang menjelaskan solusi |
| S7 | **Zero-outbound** (DevTools network tab saat pemakaian) | Tidak ada request setelah load |

Setiap FR §5 adalah butir checklist smoke test per modul.

---

## 11. Risiko Tambahan (melengkapi FEATURE.md §11)

| Risiko | Mitigasi |
|---|---|
| Jam perangkat tidak akurat → recordedAt salah | Dual timestamp + NFR-09; occurredAt manual tetap sahih karena jujur dicatat tersusul |
| Kuota localStorage penuh di tengah kerja | FR-M10-05 peringatan dini; data teks MVP jauh di bawah 5 MB |
| Ekspor JSON dimodifikasi lalu diimpor | Validasi skema + chain tip + verifikasi rantai pasca-impor (P1) |

---

## 12. Struktur Repo (D-11)

```
vestigium/
├── index.html
├── css/app.css · css/print.css
├── js/db.js · js/hash.js · js/audit.js · js/ui.js
├── js/views/*.js (dashboard, cases, evidence, custody, lab, audit, settings, report)
├── js/app.js (router + init)
├── assets/fonts/*.woff2 (D-12)
└── FEATURE.md · PRD.md · DATA.md · DESIGN.md · README.md
```

Urutan deliverable: **PRD baselined → DATA.md (skema final) → DESIGN.md (wireframe) → kode P0 → S1–S7 → deploy.**
