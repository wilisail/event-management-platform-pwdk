# Copyable WhatsApp drafts

## 1. Accept the UI baseline

Mas, saya sudah lihat prototype TemuEvent-nya. Saya setuju kita pakai nama, tema, dan styling ini sebagai acuan bersama. PR untuk prototype-nya sudah saya merge ke main, dan F2 saya ikuti arah visual dari mas ya.

https://github.com/wilisail/event-management-platform-pwdk/pull/1

## 2. Shared UX vote

Untuk diskusi, saya rangkum 5 pilihan yang menyambungkan F1 dan F2. Aturan yang sudah jelas di PRD tetap kita ikuti; yang kita pilih hanya detail alurnya. A di bawah ini usulan awal, belum keputusan bersama.

1) Kapan login?
A. Boleh jelajah/pilih tiket dulu; saat checkout perlu akun, login/register lalu kembali ke pilihan tadi.
B. Login dulu sebelum masuk pemilihan tiket.
Dampak: F1 transaksi menyimpan pilihan/tujuan kembali; F2 auth mengembalikan user ke sana. A lebih lancar untuk browsing; B lebih sederhana untuk handoff. Ticketmaster menyarankan login sebelum membeli; posisi persisnya di aplikasi kita tetap kita pilih.

2) Poin + kupon + voucher?
A. Pertahankan interaksi demo: voucher event + kupon aplikasi + poin bisa digabung, dihitung server dan total tidak negatif.
B. Pilih voucher ATAU kupon aplikasi, lalu masih boleh memakai poin.
Dampak: F1 checkout/perhitungan/restorasi; F2 data rewards dan penolakan dari dashboard. A mengikuti demo mas, dengan pengujian kombinasi lebih banyak. B mengurangi kombinasi tetapi perlu penyesuaian checkout. Eventbrite menjadi contoh input promo; aturan penggabungannya untuk proyek kita belum ditetapkan PRD.

3) Event gratis / total akhir Rp0?
A. Tanpa upload bukti; langsung tercatat done/terkonfirmasi dan masuk attendee list.
B. Tanpa bukti, tetapi menunggu organizer; untuk alur ini batas 3 hari mulai saat pemesanan.
Dampak: F1 status/pembayaran; F2 antrean persetujuan, attendee list dan notifikasi. A lebih ringkas; B menambah persetujuan untuk order tanpa pembayaran. Eventbrite punya free/no-payment orders; pemetaan ke status kita tetap keputusan proyek.

4) Batas 3 hari untuk order yang perlu bukti pembayaran?
A. Mulai setelah bukti berhasil diupload dan masuk tahap konfirmasi.
B. Mulai sejak checkout dibuat.
Dampak: F1 timer/status dan F2 deadline keputusan organizer. A memberi waktu review penuh; B mengurangi waktu review sebesar jeda upload. Angka 3 hari dari PRD; titik awalnya yang perlu kita sepakati, bukan meniru aturan Ticketmaster.

5) Bukti sudah hadir sebelum bisa review?
A. Organizer tandai hadir secara manual di attendee list.
B. Check-in memakai kode/QR yang diverifikasi organizer.
Dampak: F2 attendee list menyimpan kehadiran; F1 review mengecek datanya. A lebih ringan untuk mini project; B menambah pekerjaan kode/scan. Eventbrite menyediakan manual check-in maupun QR.

Format balasan boleh singkat:
Wili: 1_, 2_, 3_, 4_, 5_
Rizky: 1_, 2_, 3_, 4_, 5_

Rujukan resmi dan penjelasan lengkap per pilihan:
https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/docs/shared-ux-ballot.md

## 3. F2 prototype and the F1 handoff

Saya juga sudah push prototype F2 di branch feature-2, folder feature-2, mengikuti tema TemuEvent: profil akun, tampilan referral/poin/kupon, profil organizer, dan demo API read-only untuk contoh data identitas serta rewards yang nanti dipakai checkout F1.

Saldo 20.000 poin dan kupon Rp25.000 saya pakai sebagai contoh agar cocok dengan demo mas. Itu belum menetapkan nominal kupon final atau aturan penggabungan diskon. Prototype ini belum login/database nyata dan belum memotong rewards atau mengubah transaksi.

Bagian yang bergantung hasil vote kita sambungkan setelah sepakat. Saya taruh usulan format datanya supaya mas bisa lihat dulu tanpa perlu mengubah checkout sekarang.

Kode dan cara menjalankan:
https://github.com/wilisail/event-management-platform-pwdk/tree/feature-2/feature-2

Usulan format data/API:
https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/contracts/README.md
