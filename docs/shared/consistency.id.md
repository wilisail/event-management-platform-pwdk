# Acuan konsistensi — Bahasa Indonesia

[Indeks bersama](README.md) · [English](consistency.en.md) · [Pilihan dan hasil vote UX](ux-votes.md)

Diperbarui: **18 Oktober 2026**. Catatan ini membedakan PRD, styling yang diterima, implementasi prototype, dan usulan yang masih perlu dibahas.

## 1. Styling yang diterima

Wili menerima arah visual TemuEvent dari Rizky melalui [PR #1](https://github.com/wilisail/event-management-platform-pwdk/pull/1). Rizky memimpin arah visual F1; tampilan F2 mengikuti arah tersebut. Bila ada penyesuaian styling bersama selanjutnya, Wili menyesuaikan F2 dan memperbarui catatan ini. Perubahan alur atau format data lintas fitur tetap dibahas bersama.

Acuan awal: [stylesheet F1](../../app/globals.css) dan komponen pada prototype commit [`cd58275`](https://github.com/wilisail/event-management-platform-pwdk/commit/cd582753a480d68ce14e00021a52f8ec93d8372f).

| Bagian | Acuan prototype |
| --- | --- |
| Nama | TemuEvent |
| Latar dan teks | `#fcf9ff`, permukaan putih; teks `#11103d` |
| Warna utama | Ungu/indigo, antara lain `#5148df` dan `#4f46e5` |
| Aksen | Pink, antara lain `#e539a7`; gradasi ungu–pink |
| Border | `#ebe7f5` |
| Huruf | Arial, Helvetica, sans-serif |
| Komponen | Card dan tombol membulat, ruang cukup, responsif |
| Implementasi UI saat ini | React + Next.js + TypeScript, Tailwind dan setup shadcn |

Nilai ini merekam prototype yang diterima. Mengikuti styling tidak berarti otomatis menerima nilai reward contoh atau seluruh perilaku checkout demo.

## 2. Kewajiban PRD

- F1: discovery/detail/pembuatan event; pembelian, promosi dan status transaksi; review setelah hadir.
- F2: autentikasi dan otorisasi; referral/reward/profil; dashboard organizer, keputusan transaksi, email dan daftar attendee.
- Dua role: customer dan organizer. Pembelian memerlukan akun; izin diperiksa di backend.
- Enam status: waiting for payment, waiting for admin confirmation, done, rejected, expired, canceled. Batas upload bukti dua jam; otomatis canceled setelah tiga hari tanpa keputusan organizer. Awal hitung tiga hari perlu disepakati.
- Referrer mendapat 10.000 poin; pendaftar dengan referral mendapat kupon. Poin dan kupon berlaku tiga bulan. Nominal kupon tidak ditentukan PRD.
- Poin/kupon/voucher yang berlaku dan kapasitas dikembalikan bila rejected, expired atau canceled; proses pengembalian harus aman bila dipanggil ulang.
- IDR, responsif, protected routes, dialog konfirmasi yang relevan, empty states, unit test tiap flow, dan SQL transaction untuk perubahan terkait.

Rubrik terbaru: F1 = **4 + 4 + 2**; F2 = **4 autentikasi + 4 referral/profil + 2 dashboard**. UI mockup belum memenuhi fungsi backend tersebut. Payment gateway, microservices, Redis dan QR scanner tidak diwajibkan oleh brief yang dibagikan.

## 3. Status sistem dan pilihan teknis

| Bagian | Status saat ini |
| --- | --- |
| Frontend | F1 pada root repo memakai Next.js, React dan TypeScript; bukan Vite. F2 preview mengikuti stack UI ini dan bisa dijalankan terpisah. |
| Backend/API | F1 prototype belum memiliki backend bisnis. F2 preview memiliki Express + TypeScript, REST/JSON read-only dengan data dummy. Ini belum autentikasi atau transaksi produksi. |
| ORM/database/hosting | **Usulan Wili:** Prisma + PostgreSQL di Supabase, mengikuti materi kursus. MySQL + hosting yang mendukungnya tetap alternatif. Belum final dan belum disiapkan melalui pekerjaan ini. |
| Data dummy | Wili berencana membantu hosting dan sekitar 30 contoh transaksi beserta user/event/tiket terkait setelah format disepakati. |
| Deployment | Belum dipilih. Batas free tier dan cara menjalankan scheduler perlu dicek pada layanan yang dipilih. |

Prisma adalah ORM; PostgreSQL/MySQL adalah database; Supabase adalah calon penyedia PostgreSQL. PRD yang dibagikan tidak mewajibkan penyedia atau ORM tertentu. Next.js ada dalam sebagian materi kursus; exercise full-stack memakai Vite. Mempertahankan prototype Next.js adalah arah saat ini agar tidak perlu mengganti UI yang sudah dibuat; ini belum menetapkan seluruh arsitektur akhir.

## 4. Batas pekerjaan dan titik pertemuan

Masing-masing developer tetap mengerjakan frontend **dan** backend fitur sendiri. Target kerja sementara: fitur bisa dijalankan/didemokan terpisah untuk memperjelas kontribusi; bentuk penilaian akhir mengikuti ketentuan evaluator.

| Pemilik | Ruang lingkup | Pertemuan yang perlu cocok |
| --- | --- | --- |
| Rizky / F1 | Event, pembelian, bukti bayar, timeout, voucher event, review | Identitas customer, reward checkout, data dashboard dan bukti kehadiran |
| Wili / F2 | Akun/role, referral, poin/kupon platform, profil, dashboard, keputusan organizer dan email | Identitas event/transaksi, jumlah/nominal tiket, status, deadline, pengembalian dan rating organizer |
| Bersama | UX lintas fitur, format API/data, integrasi | ID/relasi, error format, auth handoff, status, aturan diskon, deadline, kontrak dan migrasi |

Contoh batas untuk dikonfirmasi: form pembuatan/edit event dari F1 dapat dibuka dari dashboard F2; tidak perlu dua implementasi aturan edit. F1 dapat menyediakan proses status/pengembalian pembelian yang juga dipakai keputusan organizer F2. Pilihan service/API final masih terbuka.

Entitas awal F1: events, ticket types, purchases/items, payment proofs, event vouchers, reviews. Entitas awal F2: users/profiles, referral registrations, point grants, platform coupons, sessions/password resets, attendance. Nama tabel, ID, relasi, dan penanggung jawab migrasi yang bersinggungan ditentukan bersama. Schema bukan milik eksklusif F2. Poin per batch perlu melacak sisa yang belum terpakai dan alokasi penebusannya agar expiry/pengembalian akurat.

Pada aplikasi gabungan, perubahan pembelian, reservasi kapasitas dan penebusan reward harus konsisten dalam SQL transaction. Expiry F1 dan reject F2 memakai satu proses pengembalian yang mencegah pengembalian dua kali. Prototype yang tersedia belum menjalankan proses ini.

## 5. Kontrak dan keputusan yang masih terbuka

[Usulan kontrak F2](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/contracts/README.md) dan [tipe data](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/contracts/types.ts) dapat ditinjau melalui [draft PR #2](https://github.com/wilisail/event-management-platform-pwdk/pull/2). Endpoint `/api/demo/...`, `x-demo-persona`, saldo 20.000, kupon Rp25.000 dan ID contoh adalah data prototype. Header demo tidak boleh dipakai sebagai autentikasi produksi.

Lima pilihan bersama ada di [catatan vote](ux-votes.md). **Semua hasil masih pending**. Hal teknis berikut dibahas saat diperlukan: session/token, kontrak API final, nominal kupon, reward yang kedaluwarsa saat ditahan, arti tiga bulan/timezone, database/hosting, dan urutan migrasi. Prototype F2 memakai tiga bulan kalender UTC dengan penyesuaian akhir bulan; ini usulan implementasi yang perlu dikonfirmasi sebelum terhubung ke transaksi nyata.

## 6. Git dan integrasi

- Rizky dapat commit/push ke `feature-1`; Wili ke `feature-2`. PR tidak diperlukan untuk setiap push pada branch kerja sendiri.
- Wili mengambil peran koordinasi integrasi. Alur kerja yang diusulkan: PR fitur → `integration`, uji alur gabungan → PR ke `main`. Dokumen bersama bisa diperbarui melalui PR dokumentasi ke `main`, lalu dibawa ke `integration`.
- Nama branch tidak mengatur hak eksklusif. Pada pemeriksaan 18 Oktober 2026, Rizky memiliki izin **write**, `main`/`integration` belum protected dan tidak ada ruleset. Jadi GitHub belum memaksa semua merge melalui Wili; koordinasi tersebut adalah pembagian kerja, bukan pembatasan akses yang sudah aktif.
- Pertahankan riwayat commit dan petunjuk menjalankan masing-masing fitur agar kontribusi mudah ditinjau. Tes gabungan melibatkan kedua developer; integrator tidak menggantikan tanggung jawab implementasi masing-masing.
- Credential database berada di environment backend; repo cukup berisi `.env.example` tanpa nilai rahasia. Wili dapat membantu setup hosting, sedangkan perubahan struktur lintas fitur dibahas bersama.
