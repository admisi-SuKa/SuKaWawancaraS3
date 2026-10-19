# Pembaruan 1.1 — Impor Excel Lengkap dan Profil Penguji

## Memperbarui aplikasi yang sudah berhasil digunakan

1. Ekstrak ZIP ini.
2. Ganti file proyek lama di GitHub dengan isi folder `wawancara-s3` pada paket ini. Struktur root tetap sama: `package.json`, `src`, `server`, `netlify`, dan seterusnya.
3. Pastikan file baru `src/Profile.tsx`, `src/full-profile.css`, `src/import-excel.mjs`, dan `src/import-excel.d.mts` ikut diunggah. Untuk patch lengkap, paling mudah mengganti seluruh kode sumber dengan versi ini.
4. Pertahankan environment variables Netlify `DATABASE_URL` dan `APP_ORIGIN` yang sudah benar. Pertahankan `.env` pribadi di komputer Anda; jangan unggah file itu ke GitHub.
5. Tunggu Netlify membangun dan menerbitkan versi baru, kemudian muat ulang halaman aplikasi.

**Tidak perlu membuat database, menjalankan ulang SQL, atau membuat akun admin baru.** Struktur tabel tidak berubah: data lengkap tersimpan pada kolom JSONB `profile` yang sudah tersedia. Akun, periode, plotting, dan nilai tetap menggunakan database yang sama.

## Cara impor sekarang

- Gunakan langsung ekspor pendaftaran **Excel .xlsx**. Tidak perlu mengubahnya ke CSV atau memindahkan kolom ke template lain.
- Pilih periode draf → Peserta → Impor peserta → pilih file dan sheet.
- Judul kolom menentukan pemetaan. Contoh `nama_lengkap` di kolom A ataupun Z tetap dibaca sebagai nama lengkap.
- Empat kolom wajib: `nomor_pendaftar`, `nomor_peserta`, `nama_lengkap`, `pilihan_1`.
- Semua kolom lain tetap disimpan, termasuk kolom baru yang belum dikenal aplikasi.
- Periksa jumlah peserta/kolom dan daftar judul yang terdeteksi. Pada pratinjau, buka Data lengkap untuk memeriksa seluruh kolom sebelum konfirmasi.
- Perbaiki judul duplikat, kolom wajib yang hilang, dan identitas kosong pada file Excel sebelum mengulang impor. Sistem tidak mengarang nomor peserta.

Maksimal 300 peserta, 300 kolom, dan file 10 MB per proses. Permintaan JSON maksimal 4 MB; file berisi teks sangat panjang perlu dibagi menjadi beberapa Excel. Isi per sel maksimal 250.000 karakter; jika melampaui batas, impor ditolak dengan pesan, bukan dipotong diam-diam.

## Peserta sudah pernah diimpor dengan versi lama

Versi lama hanya menyimpan beberapa kolom, sehingga memperbarui kode saja belum dapat mengembalikan kolom yang belum tersimpan.

1. Pilih periode yang sama.
2. Buka **Peserta → Lengkapi profil**.
3. Pilih ekspor Excel lengkap yang sesuai.
4. Pastikan nomor pendaftar, nomor peserta, nama, dan prodi sama dengan data yang tersimpan.
5. Validasi, periksa pratinjau, dan konfirmasi.

Mode ini hanya memperbarui profil peserta yang sudah ada. Sesi, plotting, kehadiran, nilai draf/final, dan hasil perhitungan tidak diubah. Dapat dipakai ketika periode draf, dibuka, atau ditutup. Periode yang sudah diarsipkan tetap dikunci.

Untuk peserta baru, gunakan **Impor peserta** ketika periode masih draf.

## Tampilan penguji

Pada **Penilaian saya**, penguji dapat membuka **Data lengkap** atau membuka formulir penilaian. Profil lengkap tersedia dalam kelompok:

- Identitas dan kontak.
- Alamat dan kewarganegaraan.
- Keluarga.
- Riwayat sekolah.
- Pendidikan tinggi dan bahasa.
- Penelitian, tesis, dan proposal.
- Kegiatan, organisasi, dan prestasi.
- Pendaftaran, pilihan prodi, dan jadwal sumber.
- Kolom tambahan jika file memiliki judul baru.

Gunakan pencarian, Buka semua, Tampilkan kolom kosong, atau Urutan kolom sumber untuk menelusuri data. Seluruh tautan http/https di dalam kolom dideteksi sebagai tautan yang dapat dibuka. Nilai sumber tetap ditampilkan, termasuk teks Arab, daftar karya tulis, dan baris baru.

Hak akses diperiksa di server: penguji hanya dapat memuat profil lengkap peserta yang ditugaskan kepadanya. Daftar peserta mengambil ringkasan; data lengkap dimuat ketika profil dibuka.

## Berkas dan tanggal Excel

Seluruh nilai sel dan kolom diimpor sebagai data; format visual workbook, merge, grafik, dan rumus Excel tidak dipindahkan ke website. Untuk sel rumus, pastikan hasil rumus tersimpan dengan membuka dan menyimpan workbook di Excel sebelum unggah. Tanggal Excel dikonversi ke bentuk tanggal ISO untuk tampilan data. Identitas dan nomor telepon sebaiknya berformat teks agar nol depan tetap utuh.

Dokumen PDF/gambar masih diakses melalui tautan sumber yang ada di Excel. File fisik tersebut tidak ikut disalin ke Neon.

## Pemeriksaan

`npm test`: 17 pengujian lulus. `npm run build`: berhasil. Uji mencakup pembalikan urutan 83 kolom, seluruh kolom tersimpan, hak akses profil, dan pembaruan profil tanpa mengubah nilai/plotting. Perubahan ini belum dideploy otomatis ke akun Netlify Anda; unggah pembaruan ke repositori yang terhubung.
