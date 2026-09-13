# Vestigium

Sistem dokumentasi operasional forensik digital yang selaras ISO/IEC 27037:2012.

**Court-ready.** Setiap perubahan tercatat sebagai event chain of custody yang tidak bisa diubah, hanya dilengkapi.

## Kenapa Vestigium?

Dokumen forensik di pengadilan harus bisa direkonstruksi, diverifikasi, dan dipertanggungjawabkan. Vestigium dirancang untuk itu.

- **Append-only** — record tidak pernah diubah, hanya ditambah (anotasi/anulasi)
- **Hash-chain integrity** — setiap record terhubung ke record sebelumnya
- **Audit otomatis** — setiap mutasi state mencatat audit event tanpa bisa dipintaskan
- **Zero-outbound** — aplikasi tidak melakukan request jaringan setelah dimuat

## Stack

- Next.js 14+ (App Router, TypeScript)
- shadcn/ui + Tailwind CSS
- zustand (+persist localStorage)
- zod (validasi skema)
- Deploy: GitHub Pages (static export)

## Mulai

```bash
npm install
npm run dev
```

## Build

```bash
npm run build    # static export → out/
npm run lint     # eslint
npm run typecheck # tsc --noEmit
npm run test     # vitest
```

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [FEATURE.md](FEATURE.md) | Kontrak fitur & prinsip konstitusi |
| [PRD.md](PRD.md) | Persyaratan FR/NFR bernomor |
| [DATA.md](DATA.md) | Skema entitas & zod contract |
| [DESIGN.md](DESIGN.md) | Arsitektur frontend & wireframe |
| [CODE.md](CODE.md) | Disiplin kode & checklist review |

## Limitasi

- **Tidak ada autentikasi** — multi-examiner via dropdown, bukan login
- **Tidak ada enkripsi data** — localStorage hanya Base64-encoded
- **Tidak ada sinkronisasi** — berjalan offline, ekspor manual
- **Tidak ada backend** — semua data di browser

Ini fitur, bukan bug. Vestigium dirancang untuk skenario di mana koneksi tidak tersedia dan privasi dijaga dengan tidak menyimpan data di server pihak ketiga.

## Lisensi

Belum ditentukan.
