Setup development Fitur 1

1. Di checkout Fitur 1, jalankan git pull origin feature-1.
2. Ekstrak isi ZIP ini ke folder project yang sama. File .env.rizky dan folder certs berada di root project.
3. Jalankan perintah yang biasa dipakai:

   npx prisma migrate dev --name initial_f1
   npm run db:generate
   npm run db:seed
   npm run dev

Prisma otomatis memakai database development dan shadow yang sudah disiapkan. Untuk perubahan berikutnya, jalankan migrate dev dengan nama perubahan, lalu generate lagi.

Kolom imagePublicId untuk poster sudah tersedia di database shared.

Akses SQL untuk tabel Fitur 1 di database shared juga tersedia. Perubahan incremental bisa dijalankan dengan:

   npm run db:shared -- --file path/to/incremental-migration.sql

Migration awal initial_f1 membuat tabel di database development yang baru. Simpan migration awal itu sebagai history development.

File .env.rizky berisi akses privat dan sudah termasuk pola ignore Git.
Panduan source ada di docs/feature-1-developer-database.md.
Setup commit: https://github.com/wilisail/event-management-platform-pwdk/commit/13ec0d464bf80a8f0fdac01619dc7155b06493e2
