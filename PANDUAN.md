# Panduan Instalasi dan Penggunaan

## 1. Isi paket dan cara memulai

Ini adalah **aplikasi lengkap baru**, bukan potongan patch untuk Apps Script. Tidak ada peserta, nilai, password, atau dokumen pribadi dari berkas lama yang disertakan. Template CSV menggunakan data contoh sintetis.

Ekstrak ZIP terlebih dahulu. Semua perintah berikut dijalankan melalui Terminal dari folder yang berisi `package.json`.

```bash
npm ci
```

Gunakan Node.js 22 LTS atau versi lebih baru yang didukung. Jangan mengunggah `node_modules`, `.env`, atau hasil backup ke GitHub.

## 2. Siapkan database Neon baru

1. Buat proyek/database kosong di Neon.
2. Buka menu Connect, pilih koneksi PostgreSQL pooled. Host umumnya mengandung `-pooler`.
3. Salin connection string yang diberikan Neon, termasuk opsi TLS resminya. Jangan menonaktifkan verifikasi sertifikat dengan `rejectUnauthorized:false`.
4. Salin `.env.example` menjadi `.env`.

Contoh `.env` (ganti seluruh placeholder):

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.neon.tech/neondb?sslmode=verify-full"
APP_ORIGIN="http://localhost:8888"
ADMIN_USERNAME="admin"
ADMIN_NAME="Administrator Admisi"
ADMIN_PASSWORD="GANTI-DENGAN-PASSWORD-UNIK-MINIMAL-12-KARAKTER"
```

Jika connection string Neon memiliki opsi tambahan, pertahankan opsi tersebut. Kutip nilai `.env` terutama bila terdapat spasi atau tanda `#`. Jangan menampilkan connection string di screenshot publik.

Jalankan:

```bash
npm run db:migrate
npm run admin:create
```

Migrasi membuat tabel kosong. Perintah admin membuat satu akun baru dan **tidak mengubah akun yang sudah ada**. Tidak ada password bawaan. Password awal adalah nilai `ADMIN_PASSWORD` yang Anda isi sendiri.

Alternatif: jalankan isi `sql/001_initial.sql` melalui SQL Editor Neon, lalu tetap jalankan `npm run admin:create` dari komputer Anda. SQL dapat dijalankan ulang untuk skema versi awal ini. Perubahan struktur berikutnya harus dibuat sebagai migrasi baru, bukan menghapus tabel produksi.

Setelah akun berhasil dibuat, hapus `ADMIN_PASSWORD` dari `.env` bila tidak lagi dibutuhkan. Aplikasi berjalan hanya membutuhkan `DATABASE_URL` dan `APP_ORIGIN`.

## 3. Jalankan di komputer

```bash
npm run dev
```

Buka **http://localhost:8888**. Gunakan hostname `localhost`, bukan `127.0.0.1`, karena harus sama dengan `APP_ORIGIN`. Masuk memakai akun yang dibuat pada langkah 2, kemudian ganti password awal. Password baru minimal 12 karakter dan harus berbeda dari password awal.

Server lokal menyajikan frontend dan API. `vite preview` atau membuka `index.html` langsung hanya akan menampilkan frontend tanpa backend penilaian.

## 4. Upload ke GitHub

1. Buat repositori baru, disarankan private.
2. Unggah **seluruh isi folder proyek**, sehingga `package.json` berada langsung di root repositori.
3. Sertakan folder `src`, `server`, `netlify/functions`, `public`, `scripts`, `sql`, serta `netlify.toml`, `package-lock.json`, `tsconfig.json`, dan `index.html`.
4. File `.gitignore` boleh ikut; file `.env` tidak boleh ikut.
5. Jangan hanya mengunggah ZIP ke repositori. Ekstrak dan unggah isinya.

## 5. Deploy melalui Netlify

1. Tambahkan project Netlify dengan menghubungkan repositori GitHub.
2. Base directory kosong jika proyek berada di root repositori.
3. Build command: `npm run build`.
4. Publish directory: `dist`.
5. Functions directory sudah ditetapkan: `netlify/functions`.
6. Tambahkan environment variable:

| Nama | Isi | Scope |
| --- | --- | --- |
| `DATABASE_URL` | Connection string Neon | Functions, atau semua scopes |
| `APP_ORIGIN` | URL situs Netlify, misalnya `https://wawancara-s3.netlify.app` | Functions, atau semua scopes |

`APP_ORIGIN` harus berupa origin saja, tanpa `/` di akhir dan tanpa path. Setelah domain situs ditentukan, isi nilai ini lalu deploy ulang. Jika menggunakan domain kustom, ganti dengan domain yang benar-benar dipakai pengguna. Satu deployment menerima satu origin untuk penulisan data.

Tidak perlu memasukkan `ADMIN_PASSWORD` ke Netlify: akun admin sudah tersimpan di database. Jangan memakai awalan `VITE_` untuk `DATABASE_URL`, karena awalan itu ditujukan untuk data frontend publik.

Build tidak menjalankan migrasi atau membuat admin secara otomatis. Ini disengaja agar setiap deploy tidak memodifikasi data pengguna.

Hubungkan deploy preview ke database uji yang terpisah. Set `APP_ORIGIN` ke URL preview yang sesuai jika preview akan digunakan untuk mencoba penyimpanan data. Jangan memakai database produksi untuk uji coba.

## 6. Persiapan admin pada aplikasi

### A. Akun pengguna

Buka **Akun pengguna → Tambah pengguna**. Isi nama, username, role, dan password awal. Username dapat menggunakan NIP sebagai teks. Password minimal 12 karakter; tanggal lahir tidak digunakan sebagai password otomatis.

Sampaikan password awal secara pribadi. Pengguna wajib menggantinya saat login. Menonaktifkan akun atau mereset password akan mencabut sesi aktif akun tersebut. Sistem mempertahankan minimal satu admin aktif.

Admin dapat diberi plotting sebagai penguji; penilaian dilakukan melalui **Penilaian saya**, bukan dengan mengedit nilai penguji lain dari rekap.

### B. Master prodi

Buka **Master prodi → Tambah prodi**. Isi nama prodi/konsentrasi, fakultas, dan alias jika diperlukan.

Contoh:

- Nama: `AFI - Konsentrasi Studi Agama Agama (SAA)`.
- Fakultas: `Fakultas Ushuluddin dan Pemikiran Islam`.
- Alias: nama berbeda yang benar-benar muncul dalam ekspor pendaftaran, satu per baris.

Pencocokan nama/alias tidak membedakan huruf besar kecil dan mengabaikan spasi di awal/akhir. Sistem tidak menebak fakultas berdasarkan potongan nama. Master yang sudah dipakai peserta dikunci untuk menjaga arsip. Lengkapi alias sebelum mengimpor; untuk perubahan kurikulum/nama di masa depan buat master baru.

### C. Buat periode

Buka **Periode penerimaan → Buat periode**. Isi nama, tahun akademik, gelombang, jalur, bobot, ambang, dan pedoman komponen.

**Bobot awal 30% Bahasa, 30% Signifikansi Akademik, 40% Proposal, serta ambang 70 hanyalah contoh pengaturan. Sesuaikan dengan keputusan institusi sebelum membuka penilaian.** Jumlah bobot harus 100%.

Rubrik pada versi ini berupa teks pedoman per komponen, sedangkan nilai diisi sebagai skor keseluruhan 0–100. Tidak ada perhitungan otomatis nilai per butir rubrik.

### D. Impor peserta

Pilih periode draf lalu **Peserta → Impor peserta**.

- Terima `.xlsx` dan `.csv`; file `.xls` lama perlu disimpan ulang menjadi `.xlsx`.
- Bila workbook berisi beberapa sheet, pilih `Data Master`. Sistem memilih sheet bernama Data Master/dataMaster secara otomatis jika ada.
- Maksimal file 10 MB dan 300 peserta per proses. Bagi file besar menjadi beberapa unggahan; setiap unggahan menjadi satu transaksi.
- Header wajib: `nomor_pendaftar`, `nomor_peserta`, `nama_lengkap`, `pilihan_1`.
- Prodi harus sudah tersedia di master atau alias.
- Klik **Validasi & pratinjau**, periksa kesalahan dan daftar peserta, kemudian **Konfirmasi impor peserta**.

Identitas dicocokkan menggunakan **periode + nomor pendaftar**. Nomor peserta harus unik dalam periode. Peserta periode lain tidak tertimpa meskipun nomornya sama.

Impor ulang memperbarui profil yang dipakai aplikasi, termasuk nilai kosong pada sumber. Jadwal ujian dari sumber hanya disimpan sebagai referensi biodata. Sesi, plotting, kehadiran, dan nilai tidak diubah. Peserta yang hilang dari file unggahan berikutnya tetap tersimpan; tidak dihapus otomatis.

Jika prodi peserta berubah sesudah plotting, sistem menolak impor sampai plotting peserta tersebut dihapus dalam periode draf.

Simpan nomor pendaftar, nomor peserta, dan telepon sebagai **teks** di file sumber. Angka yang sudah kehilangan nol depan atau mengalami pembulatan di Excel tidak dapat dipulihkan otomatis.

Kolom dokumen yang digunakan termasuk `file_disertasi`, `ijazah_pasca`, `transkrip_pasca`, `sertifikat_toefl`, `sertifikat_toafl`, `sertifikat_pendukung`, `rekomendasi_penelitian`, serta tautan pada `id_karya_tulis` dan `data_khusus`. Tautan harus http/https. Berkas tidak disalin ke database; akses mengikuti sistem pendaftaran sumber.

Kolom sensitif yang tidak digunakan untuk penilaian, seperti NIK, data orang tua, dan penghasilan keluarga, tidak disimpan oleh proses impor ini. Data TOEFL/TOAFL pendaftaran bukan nilai wawancara Bahasa Arab/Inggris.

### E. Jadwal dan sesi

Tambahkan sesi untuk setiap komponen. Semua input waktu menggunakan **WIB (UTC+7)**; database menyimpan timestamp dengan zona waktu.

Satu sesi adalah blok antrean untuk satu komponen/tim, misalnya:

| Komponen | Waktu | Ruang |
| --- | --- | --- |
| Bahasa | 08.00–09.00 WIB | Virtual 1 |
| Signifikansi Akademik | 09.00–10.00 WIB | Virtual 2 |
| Proposal | 10.00–11.00 WIB | Virtual 3 |

Peserta pada sesi yang sama dilayani bergiliran dengan urutan nomor peserta. Aplikasi tidak menghitung durasi per orang atau menyediakan video conference bawaan; tautan Zoom/Meet dapat dicantumkan.

Kapasitas dihitung sebagai jumlah peserta unik, bukan jumlah penugasan penguji. Jika sesi sudah memiliki plotting, hapus plotting terkait sebelum mengedit sesi.

### F. Plotting penguji

Pilih sesi, satu atau beberapa penguji aktif, lalu peserta. Filter fakultas/prodi mempermudah pemilihan massal. Tombol **Pilih hasil filter** menambahkan semua peserta hasil filter ke pilihan; pilihan sebelumnya tetap dipertahankan sampai dikosongkan.

Sistem menolak:

- Penguji atau peserta yang terjadwal pada sesi lain dengan waktu tumpang tindih.
- Peserta yang sudah mempunyai sesi berbeda untuk komponen yang sama.
- Peserta melebihi kapasitas.
- Penguji tidak aktif atau peserta dari periode lain.

Penguji ganda untuk peserta dan komponen yang sama harus berada pada sesi yang sama. Nilainya disimpan terpisah dan dirata-ratakan. Penguji dalam satu sesi merupakan satu tim; untuk tim paralel, buat sesi/ruang terpisah.

### G. Buka penilaian

Setelah semua peserta memiliki penguji dan sesi untuk **ketiga komponen**, buka penilaian melalui kartu periode.

Pada status **Dibuka**, impor, perubahan jadwal, dan plotting dikunci. Siapkan peserta utama dan susulan yang telah diketahui sebelum membuka periode. Versi ini belum menyediakan pemindahan sesi/ujian ulang setelah penilaian dimulai; ujian tambahan dengan konfigurasi berbeda dapat diselenggarakan sebagai periode terpisah. Jangan mengubah langsung relasi database untuk memindahkan nilai.

## 7. Alur penguji

1. Login dan ganti password awal.
2. Pilih periode, lalu **Penilaian saya**.
3. Buka peserta yang ditugaskan. Gunakan **Profil & dokumen** untuk membaca biodata dan tautan proposal.
4. Tentukan kehadiran komponen: Hadir atau Tidak hadir.
5. Isi nilai 0–100 dan catatan.
6. Draf disimpan otomatis sekitar 1,6 detik setelah perubahan. Tombol **Simpan draf** juga tersedia.
7. Pastikan indikator **Tersimpan di server** terlihat. Jika gagal/koneksi putus, data belum terjamin tersimpan; gunakan Simpan draf setelah koneksi pulih sebelum menutup formulir.
8. Klik **Kirim nilai final**, periksa konfirmasi, lalu kirim.

Nilai Bahasa terdiri dari Arab dan Inggris. Signifikansi Akademik dan Proposal masing-masing satu nilai. Nilai `0` sah dan berbeda dari kolom kosong. Untuk peserta Tidak hadir, nilai dikosongkan dan status tetap dapat difinalisasi.

Kehadiran dicatat per penugasan penguji. Jika anggota tim memberi status berbeda, rekap tidak menghasilkan nilai akhir sampai perbedaan diperbaiki. Admin dapat membuka nilai final dengan alasan; penguji memperbaikinya ketika periode dibuka.

Penguji tidak dapat melihat nilai penguji lain, daftar akun, atau rekap keseluruhan. Pembatasan dilakukan di API, bukan hanya menyembunyikan menu.

## 8. Rekap dan finalisasi periode

Rumus:

1. Nilai Bahasa per penguji = `(Arab + Inggris) / 2`.
2. Nilai komponen = rata-rata seluruh penguji yang ditugaskan pada komponen.
3. Nilai akhir = jumlah `nilai komponen × bobot komponen / 100`.

Perhitungan tersedia hanya bila **semua penugasan ketiga komponen berstatus final dan hadir**. Belum dinilai/tidak hadir tidak diubah menjadi nol. Perhitungan menggunakan nilai asli; tampilan dibulatkan maksimal dua desimal.

Label Memenuhi ambang/Di bawah ambang adalah rekomendasi berdasarkan ambang periode, bukan penetapan kelulusan resmi.

Admin dapat mengekspor rekap, detail nilai per penguji, dan mencetak halaman rekap. CSV menggunakan pemisah titik koma dan UTF-8 BOM agar mudah dibuka di Excel berbahasa Indonesia. Input yang berpotensi menjadi formula pada ekspor CSV dinetralkan.

Status periode:

| Status | Kegiatan yang tersedia |
| --- | --- |
| Draf | Edit pengaturan, impor, sesi, dan plotting |
| Dibuka | Penguji menyimpan draf dan mengirim final |
| Ditutup | Hasil dapat dibaca; admin dapat membuka ulang periode dengan alasan |
| Diarsipkan | Hanya baca; tidak dapat dibuka kembali melalui aplikasi |

Arsip mensyaratkan seluruh komponen terplot dan seluruh penugasan final, termasuk tidak hadir. Penutupan boleh dilakukan sementara walaupun belum semua final. Pembukaan kembali satu nilai akan menghapus sementara hasil akhir peserta sampai nilai itu difinalisasi ulang.

## 9. Periode berikutnya

Klik ikon **Salin pengaturan** pada kartu periode. Sesuaikan nama dan tahun, lalu simpan. Yang disalin hanya pengaturan/form periode. Peserta, sesi, plotting, kehadiran, dan nilai tidak ikut disalin.

Akun dan master prodi tetap tersedia. Unggah peserta baru, buat jadwal, lalu plotting kembali.

## 10. Backup dan perawatan

Kode di GitHub tidak mencadangkan data Neon. Pasang PostgreSQL client tools yang kompatibel dengan versi server Neon, lalu jalankan:

```bash
npm run db:backup
```

Hasilnya ada di folder `backups/` (diabaikan Git). Cadangkan sebelum/sesudah ujian dan sebelum perubahan struktur. Simpan salinan di tempat terpisah dengan akses terbatas.

Untuk backup otomatis, jadwalkan script backup tersebut di komputer/server administrasi yang selalu berjalan dan memiliki `pg_dump`, atau gunakan fasilitas backup penyedia sesuai paket. Penjadwalan belum diaktifkan hanya dengan mengunduh ZIP ini.

Pemulihan harus diuji pada database uji kosong terlebih dahulu. Contoh untuk administrator yang memahami PostgreSQL:

```bash
pg_restore --no-owner --no-acl --dbname="KONEKSI_DATABASE_UJI" backups/NAMA_BACKUP.dump
```

Jangan menjalankan restore ke produksi tanpa prosedur dan backup yang teruji. Dokumen peserta hanya berupa tautan; backup database tidak mencadangkan berkas dari sistem pendaftaran.

Sebelum ujian nyata: uji login kedua role, buka dokumen sumber, lakukan simulasi alur beberapa peserta, lalu uji beban sesuai jumlah penguji. Pantau penggunaan dan kuota Netlify/Neon; paket gratis tidak menjamin kapasitas atau ketersediaan tanpa batas.

## 11. Pemecahan masalah

| Masalah | Tindakan |
| --- | --- |
| Server/database belum siap | Isi `DATABASE_URL` di environment Functions; jalankan migrasi dan deploy ulang |
| Asal permintaan tidak diizinkan | Cocokkan `APP_ORIGIN` dengan origin di browser, tanpa slash akhir; deploy ulang |
| Username/password salah | Gunakan akun yang dibuat sendiri; admin dapat mereset password penguji |
| Login dibatasi | Tunggu 15 menit setelah terlalu banyak percobaan gagal |
| Prodi belum dipetakan | Tambahkan nama/alias di master sebelum impor |
| Sesi bentrok | Gunakan blok waktu berbeda atau satukan anggota tim pada satu sesi |
| Nilai berubah di tab lain | Muat ulang data terbaru; perubahan lama tidak menimpa data server |
| Draf tidak tersimpan | Pertahankan formulir terbuka; periksa koneksi, rentang nilai, status periode, dan sesi login |
| Dokumen tidak terbuka | Periksa izin/tautan pada sistem pendaftaran; coba tab baru |
| Admin pertama sudah ada | Script tidak mereset password; gunakan menu reset dari admin aktif lain |
| API 404 setelah deploy | Pastikan folder `netlify/functions` dan `netlify.toml` berada di root proyek |

Jika semua admin kehilangan password, administrator yang memiliki akses database dapat memakai script lokal berikut. Tambahkan `RESET_USERNAME` (akun yang akan dipulihkan) dan `RESET_PASSWORD` (password awal baru minimal 12 karakter) ke `.env`, lalu jalankan:

```bash
npm run user:reset-password
```

Script mencabut sesi akun dan mencatat reset pada audit. Pengguna wajib mengganti password saat login. Hapus kedua nilai reset dari `.env` sesudah selesai. Script ini tidak mengaktifkan akun yang sudah dinonaktifkan. Tidak ada endpoint reset password publik.

## 12. Verifikasi paket

```bash
npm test
npm run build
```

Pengujian otomatis menggunakan PGlite, mesin PostgreSQL dalam WASM, untuk memeriksa skema dan alur API tanpa data Neon pengguna. Koneksi Neon nyata, deploy Netlify, pengiriman kredensial ke pengguna, dan uji browser serentak tetap dilakukan pada lingkungan Anda sesudah konfigurasi.

## Referensi teknis

- [Netlify Functions](https://docs.netlify.com/build/functions/overview/)
- [Netlify environment variables](https://docs.netlify.com/build/functions/environment-variables/)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Logo UIN Sunan Kalijaga](https://uin-suka.ac.id/logo-white.png)
