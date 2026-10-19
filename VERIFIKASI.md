# Hasil Pemeriksaan Paket

- TypeScript: lulus pemeriksaan `tsc --noEmit`.
- Frontend produksi: `npm run build` berhasil menghasilkan `dist`.
- Bundle backend: entry point Netlify Functions berhasil dibundle menggunakan esbuild untuk Node.js 22.
- Pengujian otomatis: **17 lulus, 0 gagal**, menggunakan PGlite (PostgreSQL WASM).
- Audit dependensi runtime saat pengemasan: tidak ada kerentanan yang dilaporkan `npm audit --omit=dev`.
- Pembaca Excel dapat membaca Sheet1 dari ekspor terbaru: 15 peserta, 83 kolom. Pembalikan urutan seluruh kolom pada berkas nyata menghasilkan data identik. Baris Excel 15 dan 16 masih memiliki nomor_peserta dan pilihan_1 kosong; data sumber tidak diubah atau disalin ke paket.
- Pengujian 83 kolom sintetis tetap identik ketika urutan kolom dibalik.
- Judul kolom hilang/duplikat, kolom tanpa judul, nomor kosong/duplikat, dan presisi identitas diperiksa sebelum impor.
- Hak akses endpoint profil lengkap dan pembaruan profil tanpa mengubah nilai/plotting telah diuji.

## Cakupan pengujian

- Normalisasi nomor sebagai teks, format IPK, dan penyaringan tautan dokumen.
- Validasi nilai 0–100, nilai nol, data kosong, dan peserta tidak hadir.
- Hash password serta kewajiban mengganti password awal.
- Pencabutan sesi ketika password direset.
- Login, pemeriksaan role, CSRF, dan pembatasan origin.
- Pratinjau impor, duplikat, impor ulang, alias prodi, serta isolasi antarperiode.
- Plotting penguji ganda, kapasitas sesi, dan bentrok jadwal.
- Pembatasan tugas yang dapat dilihat/dinilai penguji.
- Draf, konflik versi antarpenyimpanan, nilai final, dan pembukaan koreksi.
- Rata-rata beberapa penguji, perhitungan bobot, dan audit perubahan.
- Penutupan periode, arsip permanen, dan perlindungan admin aktif terakhir.

## Yang masih dilakukan pada lingkungan pengguna

Belum dihubungkan ke proyek Neon pengguna dan belum dideploy ke akun Netlify pengguna karena kredensial/configuration proyek belum diberikan. Interaksi browser visual dan uji beban banyak penguji belum dijalankan dalam lingkungan pembuatan ini. Setelah konfigurasi, lakukan simulasi satu periode dengan beberapa akun sebelum digunakan untuk ujian nyata.

Fitur yang belum tersedia pada versi ini: unggah/arsip berkas PDF sendiri, undangan email otomatis, video conference bawaan, penilaian per butir rubrik, dan pemindahan sesi/ujian ulang setelah periode dibuka. Dokumen peserta menggunakan tautan dari sistem pendaftaran. Backup dijalankan melalui script; penjadwalan backup perlu diatur pada lingkungan administrasi.
