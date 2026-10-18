# WhatsApp ballot

Draft for discussion; results are recorded in [UX choices](ux-votes.md).

---

Mas, untuk titik pertemuan fitur 1 + 2, saya rangkum pilihannya di bawah ya. Rekomendasi awal mengikuti pola UX website referensi sejauh sesuai PRD. Untuk aturan yang tidak dijelaskan referensi, saya tandai sebagai usulan proyek. Kalau ada masukan perubahan, boleh disampaikan.

1. Login saat beli tiket
A. Pilih tiket dulu → login/register sebelum checkout → kembali ke pilihan tadi. [Rekomendasi]
B. Login sebelum memilih tiket.
Referensi: Ticketmaster menyarankan login sebelum membeli; Live Nation Asia memakai akun ticketing agent untuk pembelian. Alur kembali ke pilihan tiket kita tentukan sendiri.
Dampak: checkout F1 ↔ login F2.

2. Pemakaian diskon
A. Voucher event + kupon platform + poin, mengikuti interaksi prototype sekarang. [Rekomendasi]
B. Voucher ATAU kupon platform, ditambah poin.
Referensi: Eventbrite/Ticketmaster punya input kode promo; aturan gabung tiga jenis reward ini belum dijelaskan di referensi. A adalah usulan mempertahankan prototype; B mengurangi kombinasi.
Dampak: checkout/pengembalian F1 ↔ reward/keputusan organizer F2.

3. Event gratis / total pembayaran nol
A. Tanpa bukti bayar; langsung terkonfirmasi dan masuk daftar attendee. [Rekomendasi]
B. Tanpa bukti bayar, tetapi tetap menunggu accept/reject organizer.
Referensi: Eventbrite mendokumentasikan pesanan tanpa pembayaran. Pemetaan ke status done adalah usulan kita. A mengurangi satu langkah persetujuan.
Dampak: pembayaran/status F1 ↔ dashboard/attendee/email F2.

4. Awal hitung tiga hari keputusan organizer
A. Sejak bukti bayar berhasil diunggah. [Rekomendasi]
B. Sejak checkout awal.
Ini aturan proyek: PRD menyebut tiga hari, tetapi awal hitungnya belum rinci. A memberi organizer waktu review penuh; belum ada padanan persis yang dikonfirmasi dari website referensi.
Dampak: expiry/status F1 ↔ batas keputusan di dashboard F2.

5. Konfirmasi kehadiran sebelum review
A. Organizer menandai hadir secara manual di daftar attendee. [Rekomendasi]
B. Verifikasi kode tiket / scan QR oleh organizer.
Referensi: Eventbrite dan LOKET mendukung check-in manual maupun scan. A lebih ringan untuk tugas MVP.
Dampak: attendee F2 ↔ izin review F1.

Bisa balas misalnya: 1A, 2A, 3A, 4A, 5A, atau tambahkan usulan perubahan. Hasilnya nanti saya catat di referensi bersama:
https://github.com/wilisail/event-management-platform-pwdk/blob/main/docs/shared/ux-votes.md
