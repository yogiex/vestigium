# CODE.md — Standar Clean Code Vestigium

> **Versi:** 0.1 · **Status:** Draft (menyesuaikan Decision Register PRD §3)
> **Hierarki:** Bila aturan di dokumen ini bertentangan dengan PRD/FEATURE → PRD/FEATURE menang.
> Dokumen ini hanya mengatur **bentuk kode**, bukan isi fitur.
> **Asumsi aktif (dari PRD):** D-10 localStorage · D-11 multi-file script klasik tanpa build ·
> D-12 zero-outbound · NFR-04 escaping ketat.

---

## 0. Filosofi: Kenapa Standar Ini Lebih Ketat dari Proyek Biasa

Tiga alasan yang membuat kualitas kode Vestigium bukan sekadar selera:

1. **Kode bisa dibaca pihak ketiga.** Pada sistem court-ready, auditor atau ahli lawan
   dapat memeriksa bagaimana sistem bekerja. Kode yang berantakan melemahkan argumen
   "sistem ini dapat direkonstruksi siapa pun".
2. **Kebenaran domain tidak boleh bisa dilanggar tanpa sengaja.** Append-only, hash-chain,
   dan deny-by-default harus **ditegakkan oleh struktur kode** — bukan dijaga dengan disiplin.
   Aturan terpenting di dokumen ini adalah yang membuat "lupa mencatat audit" menjadi
   mustahil, bukan "dilarang".
3. **Pembaca baru harus paham tanpa dijelaskan lisan.** Setiap aturan bisnis di kode
   merujuk nomor FR di PRD — ketertelusuran dari klausul ISO sampai baris kode.

---

## 1. Struktur File & Modul

**CC-01** Satu file = satu modul = satu tanggung jawab. Peta file mengikuti PRD §12.
File tidak boleh tumbuh menjadi "tempat sampah utilitas".

**CC-02** Seluruh kode hidup dalam **satu namespace global: `VEST`**. Setiap file adalah
IIFE yang menempel **tepat satu** properti ke `VEST`. Dilarang membuat global lain,
dilarang global implisit (lupa `const`/`let`).

```js
/* js/store.js */
VEST.store = (function () {
  // privat di sini
  function persist() { /* … */ }
  return { commit, load, persist };
})();
```

**CC-03** Urutan pemuatan di `index.html` eksplisit dan berlapis:

```
core:    js/time.js → js/hash.js → js/id.js → js/store.js → js/audit.js
domain:  js/domain.js (konstanta, enum, transisi) → js/select.js → js/validate.js
ui:      js/dom.js (esc, icon, toast, modal) → js/format.js
views:   js/views/*.js (satu file per route)
app:     js/app.js (router + init) — selalu terakhir
```

Modul **tidak boleh memanggil** modul yang dimuat setelahnya *pada eksekusi top-level*;
pemanggilan lintas-lapis hanya boleh terjadi saat runtime (di dalam fungsi).

**CC-04** Modul inti (`time`, `hash`, `id`, `store`, `select`, `validate`) **bebas DOM** —
tidak menyentuh `document`/`window`. Kemurnian membuat mereka bisa diuji dan dipercaya.
Hanya lapisan `ui` dan `views` yang boleh memanipulasi DOM.

---

## 2. Penamaan & Bahasa

**CC-05** Identifier dalam **Bahasa Inggris**: `camelCase` untuk fungsi/variabel,
`UPPER_SNAKE` untuk konstanta, `PascalCase` tidak dipakai (tidak ada class).

**CC-06** Nilai enum = string lowercase sesuai skema DATA.md, dalam Bahasa Inggris
(`collected`, `transferred`, `bit-stream`, `mismatch`). Nilai-nilai ini masuk JSON ekspor —
**dilarang membuat sinonim kedua** (`"pindah"`, `"Transfer"`, dsb.). Bahasa UI dan bahasa
skema adalah dua hal terpisah.

**CC-07** Konvensi semantik: boolean berawalan `is/has/can/should` (`isSealed`, `hasHash`);
fungsi = kata kerja (`registerCase`, `verifyHash`, `renderCaseDetail`);
handler = `onX`/`handleX` (`onDrop`, `handleSubmit`).

**CC-08** Singkatan hanya dari daftar resmi DATA.md (`ev`, `cust`, `ac`, `no`).
Singkatan pribadi dilarang — kode dibaca orang lain, bukan hanya penulisnya.

**CC-09** Komentar dalam **Bahasa Indonesia**, menjelaskan **MENGAPA** — terutama
rasional hukum/prosedural — bukan mengulang apa yang terlihat dari kode.

```js
// Bagus:
// FR-M4-04: live acquisition mengubah original secara inheren; justifikasi wajib
// karena prinsip least alteration (ISO 27037 §6.4.3).

// Buruk:
// set flag jadi true
```

**CC-10** UI copy = **Bahasa Indonesia formal**; istilah teknis tetap Inggris sesuai
glosarium: *chain of custody* (bukan "rantai penjagaan"), *hash*, *write blocker*,
*evidence*. Konsistensi istilah adalah kredibilitas di dokumen cetak.

---

## 3. Fungsi & Logika

**CC-11** Fungsi ≤ ±40 baris, satu tanggung jawab. Nesting > 2 level wajib dipecah
dengan guard clause atau ekstraksi fungsi.

**CC-12** **Pisahkan logika murni dari efek samping.** Validasi, kalkulasi, pembentukan
objek = fungsi murni (masuk → keluar, tanpa DOM/tanpa mutasi state). Hanya lapisan tipis
(view handler) yang mengurusi form, toast, dan render. Konsekuensi praktisnya: setiap
form punya validator murni yang bisa diuji tanpa browser.

**CC-13** Fungsi dengan > 3 parameter menerima satu objek `{ ... }` + JSDoc.

**CC-14** Early return; tidak ada blok `else` setelah `return`.

**CC-15** Dilarang magic string/number. Enum, batas kuota, ukuran chunk — semuanya
konstanta bernama di `domain.js` atau modul pemiliknya.

---

## 4. Aturan Domain di Kode (Bagian Terpenting)

Aturan-aturan ini menerjemahkan konstitusi sistem (PRD §2) menjadi struktur.

### CC-16 — Mutation Gateway: semua tulisan lewat satu pintu

Setiap perubahan state **hanya** boleh lewat `VEST.store.commit()`:

```js
/**
 * FR-M8-01: tidak ada mutasi tanpa audit — dijamin oleh struktur, bukan disiplin.
 * commit menerapkan mutator, mencatat audit, lalu menyimpan.
 */
VEST.store.commit = function (action, target, detail, mutator) {
  mutator(VEST.state);
  VEST.audit.append(action, target, detail); // recordedAt dari VEST.time.nowUTC()
  VEST.persist();
};
```

**Dilarang keras:** menulis ke localStorage langsung dari view, atau memutasi
`VEST.state` di luar `commit`. Reviewer menolak PR yang melakukannya.

### CC-17 — Append-only ditegakkan, bukan dijanjikan

`custody`, `acquisitions`, `verifications`, `audit` **hanya punya operasi append**.
Record dibekukan setelah dibuat:

```js
VEST.audit.append = function (action, target, detail) {
  const entry = Object.freeze({
    id: VEST.id.uid(), at: VEST.time.nowUTC(),
    actor: VEST.state.settings.examiner, action, target, detail,
    prevHash: VEST.audit.tip(), hash: null // dihitung setelah payload beku
  });
  entry.hash = VEST.hash.entryHash(entry); // CC-24: mesin hash murni
  VEST.state.audit.push(entry);
};
```

Dilarang: `splice`, `filter`+reassign, penggantian field pada array-record.
Koreksi selalu = **record baru** yang merujuk record lama.

### CC-18 — Satu sumber jam

`recordedAt` **hanya** dari `VEST.time.nowUTC()`. **Dilarang** memanggil `new Date()`
di luar modul `time` (pengecualian tunggal: pemformat tampilan jam sidebar).
`occurredAt` hanya dari input user melalui satu parser `VEST.time.toUTC()`.

### CC-19 — Deny-by-default lewat validator murni

Setiap aksi tulis punya validator murni di `validate.js` yang mengembalikan
**daftar pesan perbaikan** (PRD §8.2 — pesan penolakan edukatif):

```js
// FR-M6-04 + FR-M1-03
VEST.validate.transfer = function (state, input) {
  const errors = [];
  if (!input.to) errors.push('Penerima wajib diisi — pilih dari roster personel.');
  if (input.from === input.to) errors.push('Pengirim dan penerima tidak boleh orang yang sama.');
  return errors;
};
```

Handler **wajib** menolak bila `errors.length > 0`. Dilarang validasi tersebar di
dalam handler (duplikasi = dua versi kebenaran).

### CC-20 — State machine sebagai data, bukan if-chain

Transisi status kasus dan item dideklarasikan **satu kali** sebagai tabel:

```js
// FR-M6-01 / FR-M2 (status lifecycle)
VEST.TRANSITIONS = {
  item: {
    collected:   ['sealed', 'in-analysis'],
    sealed:      ['opened', 'in-analysis'],
    'in-analysis':['sealed', 'released'],
    opened:      ['sealed', 'released'],
    released:    []
  }
};
VEST.canTransition = function (kind, from, to) {
  return (VEST.TRANSITIONS[kind][from] || []).includes(to);
};
```

Dilarang memeriksa status dengan rantai `if` tersebar di banyak file.

### CC-21 — ID hanya dari generator

`CASE-…`, `EV-…`, `AC-…`, `uid()` hanya dihasilkan oleh `js/id.js`.
View/handler **dilarang** menyusun string ID secara manual.

### CC-22 — Derived tidak disimpan; dihitung oleh selector

Nilai yang bisa diturunkan (custodian saat ini, jumlah item kasus, status verifikasi)
**tidak disimpan sebagai field** — dihitung `VEST.select.*` saat render. Ini mencegah
inkonsistensi dua sumber kebenaran (FR-M6-03).

### CC-23 — Escape tanpa kompromi

Setiap interpolasi data pengguna ke HTML **wajib** lewat `esc()`:

```js
// SALAH — injeksi HTML
row.innerHTML = `<td>${ev.label}</td>`;

// BENAR
row.innerHTML = `<td>${esc(ev.label)}</td>`;
```

Tanpa `onclick` inline; semua aksi melalui satu delegasi event `[data-action]`.

### CC-24 — Mesin hash sakral

`hash.js` murni (tanpa DOM, tanpa state global), API kecil (`update`, `hex`, `entryHash`).
Perubahan apa pun pada `hash.js` wajib: (1) lulus self-test vektor FIPS/NIST saat startup,
(2) menyebut alasan di commit message, (3) tidak mengubah format output. Fallback WebCrypto
hanya bila self-test gagal — dan harus terlihat di UI (FR-M5-04).

### CC-25 — Zero-outbound ditegakkan

**Dilarang** `fetch`, `XMLHttpRequest`, `WebSocket`, `<img src="http…">`, font CDN,
script CDN. Semua aset lokal. Ikon = fungsi `icon('nama')` yang mengembalikan
SVG inline dari sprite internal. Satu-satunya request jaringan dalam aplikasi:
pemuatan halaman itu sendiri.

---

## 5. DOM & Rendering

**CC-26** View = fungsi `renderX(container, params)` dengan pola tetap:
(1) bangun HTML string → (2) pasang ke container → (3) pasang behavior.
State lokal view (filter, kata kunci pencarian) dideklarasikan di atas file, tidak disebar.

**CC-27** Setelah mutasi = render ulang view penuh dari state (sumber kebenaran tunggal).
**Dilarang** menambal DOM manual untuk data yang berasal dari state.
Pengecualian eksplisit (daftar tertutup): progress bar streaming hash, jam UTC sidebar.

**CC-28** Template HTML membaca state hanya lewat `VEST.select.*` — tidak menggali
`VEST.state.xxx[0].yyy` langsung di template (rawan `undefined` dan duplikasi logika).

---

## 6. Error Handling

**CC-29** Dua kategori, dua perlakuan:
- **Bug programmer** (invarian dilanggar, mis. transisi status ilegal lolos validator):
  `throw new Error('INVARIANT: …')` + `console.error` — lebih baik jelas-jelas rusak
  daripada diam-diam merusak rantai bukti.
- **Kesalahan input user**: pesan di UI (toast/inline), tanpa throw.

**CC-30** Batas penyimpanan (`persist`) dibungkus try/catch: kegagalan simpan =
toast error + banner peringatan + dorongan ekspor (NFR-08). **Tidak boleh gagal diam.**

---

## 7. Gaya & Format

| Aturan | Nilai |
|---|---|
| CC-31 | Indentasi 2 spasi · titik-koma wajib · single quote · template literal untuk HTML · ≤ 100 kolom |
| CC-32 | Tanpa dead code, tanpa `console.log` tertinggal, `TODO` wajib merujuk `#issue` atau ID FR |
| CC-33 | `const` default; `let` hanya bila reassign; **`var` dilarang** |
| CC-34 | Perbandingan selalu `===` / `!==` |
| CC-35 | JSDoc wajib untuk API publik modul inti: `store`, `hash`, `time`, `id`, `select`, `validate` |

Setiap file dibuka header standar:

```js
/* ================================================================
 * js/validate.js — validator murni semua aksi tulis (deny-by-default)
 * Ref: FR-M1-03, FR-M3-03, FR-M4-04, FR-M6-02/04, CC-19
 * ================================================================ */
```

---

## 8. Git

**CC-36** Conventional commit: `type(scope): ringkasan Bahasa Indonesia`.
Scope = modul (`store`, `views/case`, `hash`). Body (bila perlu) merujuk FR/S:
`Ref: FR-M4-03, S1`.

```
feat(acquisition): hash ganda sumber+image dengan validasi 64-hex
fix(store): commit tidak menulis audit saat mutator throw
Ref: FR-M4-03, FR-M8-01
```

**CC-37** Satu commit = satu niat kecil. Dilarang mencampur fitur + perbaikan tak terkait.

**CC-38** Branch: `feat/<modul>`, `fix/<topik>`, `docs/<dokumen>`. `main` selalu
dalam keadaan deployable (sumber GitHub Pages).

**CC-39** Sebelum merge ke `main`: lulus checklist review (§10) + smoke test S1–S7
yang relevan (PRD §10).

---

## 9. Uji Mandiri & Pengujian

**CC-40** Hal kritis punya **self-test runtime**: vektor hash FIPS (FR-M5-04) dan
verifikasi rantai audit (S4). Hasilnya terlihat di UI — gagal self-test tidak boleh senyap.

**CC-41** Karena fungsi inti murni (CC-04, CC-12), sediakan `test.html` — harness tanpa
build step — untuk: vektor hash, parser waktu ganda, semua validator, generator ID.
Aturan: logika baru yang murni = sertakan kasus uji di harness.

**CC-42** Skenario penerimaan S1–S7 (PRD §10) dijalankan manual sebelum setiap rilis ke
`main`; hasilnya dicatat di deskripsi release.

---

## 10. Checklist Review (setiap PR)

1. Semua mutasi lewat `store.commit`? (CC-16)
2. Ada operasi selain append pada record append-only? (CC-17)
3. `new Date()` di luar modul time? (CC-18)
4. Aksi tulis tanpa validator murni, atau validatornya menyebar? (CC-19)
5. If-chain status yang seharusnya tabel transisi? (CC-20)
6. Interpolasi tanpa `esc()`? (CC-23)
7. `fetch`/CDN/aset remote baru? (CC-25)
8. Derived value ikut disimpan? (CC-22)
9. Fitur merujuk FR di PRD dan klausulnya masih akurat? (CC-09)
10. Smoke test S yang relevan lulus?

> Kriteria menerima: **semua** jawaban bersih. Satu pelanggaran CC = revisi.

---

## 11. Contoh Kanonik: Satu Aksi Tulis Lengkap

Semua handler mengikuti pola ini — validasi murni → commit → umpan balik → render ulang:

```js
/* js/views/custody.js — handler transfer custody (FR-M6-01..05) */
function handleSubmitTransfer(evItem, form) {
  const input = {
    from: form.from.value.trim(),
    to:   form.to.value.trim(),
    reason: form.reason.value.trim(),
    occurredAt: VEST.time.toUTC(form.at.value)
  };

  const errors = VEST.validate.transfer(VEST.state, input);   // CC-19
  if (errors.length) return VEST.ui.showErrors(errors);        // tolak, edukatif

  const event = VEST.domain.makeCustodyEvent(evItem, 'transferred', input);
  if (!VEST.canTransition('item', evItem.status, 'transferred')) {
    throw new Error('INVARIANT: transisi ilegal lolos validator'); // CC-29
  }

  VEST.store.commit('CUSTODY', evItem.itemNo,                  // CC-16 (audit otomatis)
    `Transfer: ${input.from} → ${input.to}`,
    s => s.custody.unshift(event));

  VEST.ui.toast('Transfer custody tercatat.');
  route();                                                     // CC-27
}
```

Perhatikan: tidak ada baris yang bisa "lupa" — audit, persist, dan penolakan ilegal
semuanya struktural.

---

## 12. Glosarium Istilah (UI vs Kode)

| Kode (EN) | UI/Dokumen (ID formal) |
|---|---|
| case | kasus |
| evidence item | item evidence |
| custody event | peristiwa chain of custody |
| acquisition | akuisisi |
| verification | verifikasi integritas |
| seal | seal / penyegelan |
| examiner | pemeriksa (DEFR/DES) |
