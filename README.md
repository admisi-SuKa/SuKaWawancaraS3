# Sistem Penilaian Ujian Wawancara S3

Aplikasi baru untuk UIN Sunan Kalijaga Yogyakarta. Dua role: **Admin** dan **Penguji**. Database Neon dimulai kosong; aplikasi tidak memigrasikan data Apps Script.

**Sudah memakai versi sebelumnya? Baca [UPDATE_DARI_V1.md](UPDATE_DARI_V1.md). Tidak perlu membuat ulang database atau admin.**

**Baca [PANDUAN.md](PANDUAN.md) untuk instalasi, pembuatan admin pertama, konfigurasi Netlify, dan penggunaan.**

## Cepat mulai

1. Install Node.js 22 LTS atau versi lebih baru yang didukung.
2. Jalankan `npm ci`.
3. Salin `.env.example` menjadi `.env`, lalu isi koneksi Neon dan akun admin pertama.
4. Jalankan `npm run db:migrate` dan `npm run admin:create`.
5. Jalankan `npm run dev`, buka **http://localhost:8888**.
6. Login dan ganti password awal.

## Deploy Netlify dari GitHub

- Unggah **isi folder proyek ini** ke root repositori, termasuk `netlify.toml`, `package-lock.json`, dan folder `netlify`.
- Build: `npm run build`; publish directory: `dist`.
- Isi environment variables `DATABASE_URL` (Functions) dan `APP_ORIGIN` (URL situs HTTPS tanpa garis miring penutup).
- Deploy ulang sesudah mengubah environment variables.
- Akun admin dibuat melalui script lokal, bukan pendaftaran publik atau endpoint setup terbuka.

## Fitur

- Periode terpisah dengan status draf → dibuka → ditutup → arsip.
- Salin pengaturan periode tanpa menyalin peserta atau nilai.
- Master prodi/konsentrasi, fakultas, dan alias nama impor.
- Impor Excel .xlsx berdasarkan nama kolom; urutan bebas, seluruh kolom disimpan, dengan validasi dan pratinjau profil lengkap.
- Jadwal sesi WIB, ruang, tautan pertemuan, kapasitas, dan daftar antrean.
- Plotting massal per fakultas/prodi atau peserta pilihan; mendukung tim penguji.
- Pemeriksaan bentrok jadwal peserta/penguji dan kapasitas sesi.
- Tiga komponen: Bahasa (Arab dan Inggris), Signifikansi Akademik, Proposal Disertasi.
- Dokumen peserta, kehadiran per penugasan, catatan, simpan draf otomatis, dan finalisasi.
- Pembukaan nilai final oleh admin dengan alasan dan riwayat perubahan.
- Rekap hasil, ekspor CSV rekap/detail penguji, dan cetak.
- Password hash scrypt, sesi HttpOnly, CSRF, batas percobaan login, dan pemeriksaan akses di server.
- Konflik versi untuk mencegah penimpaan nilai antarperangkat/tab.

## Struktur proyek

```text
src/                    Antarmuka React + TypeScript
server/                 API, aturan bisnis, autentikasi, koneksi PostgreSQL
netlify/functions/      Entry point API Netlify Functions
sql/001_initial.sql     Skema Neon/PostgreSQL
scripts/                Migrasi, admin pertama, server lokal, dan backup
tests/                  Pengujian integrasi menggunakan PostgreSQL WASM (PGlite)
public/                 Logo resmi yang diminta dan aset statis
tests/fixtures/         Daftar 83 judul kolom contoh (tanpa data pribadi)
```

`npm test` menjalankan pengujian domain dan integrasi database. `npm run build` memeriksa TypeScript dan menghasilkan frontend produksi. SQL ditulis eksplisit dan parametrik; proyek ini tidak membutuhkan ORM.

Logo bersumber dari https://uin-suka.ac.id/logo-white.png dan disertakan sebagai aset lokal agar tampilan tidak bergantung pada akses domain sumber saat aplikasi dibuka. Hak logo tetap pada pemiliknya.
