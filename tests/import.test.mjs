import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseExcelMatrix,canonicalHeader} from '../src/import-excel.mjs';
import {normalizeRows,profileSummary} from '../server/domain.mjs';
const headers=JSON.parse(await readFile(new URL('./fixtures/headers.json',import.meta.url),'utf8'));
const row=Object.fromEntries(headers.map(k=>[k,'']));
Object.assign(row,{nomor_pendaftar:'0001',nomor_peserta:'0002',nama_lengkap:'Peserta Sintetis',pilihan_1:'Prodi A',nik:'IDENTITAS-SINTETIS',ipk:'3,75',nama_lengkap_ibu:'Ibu Contoh',id_karya_tulis:'عنوان البحث — https://example.com/karya.pdf\nPenelitian kedua — https://example.com/karya2.pdf',judul_disertasi:'Penelitian contoh',nohp:'081200000000'});

test('Excel 83 kolom tetap tepat saat seluruh urutan kolom dibalik',()=>{
 const original=parseExcelMatrix([headers,headers.map(k=>row[k])]);
 const reversed=[...headers].reverse();const moved=parseExcelMatrix([reversed,reversed.map(k=>row[k])]);
 assert.equal(original.columns.length,83);assert.equal(moved.columns.length,83);
 assert.deepEqual(original.rows[0],moved.rows[0]);assert.deepEqual(original.issues,[]);assert.deepEqual(moved.issues,[]);
 const stored=normalizeRows(moved.rows)[0].profile;
 for(const key of headers)assert.equal(stored.source_data[key],String(row[key]));
 assert.deepEqual(stored.source_columns,reversed);assert.equal(stored.source_data.ipk,'3,75');assert.equal(stored.ipk,'3.75');
 assert.equal(stored.source_data.nik,'IDENTITAS-SINTETIS');assert.equal(stored.source_data.id_karya_tulis,row.id_karya_tulis);
});
test('Judul di bawah baris pengantar, kapital/spasi, tanggal, dan kolom tambahan',()=>{
 assert.equal(canonicalHeader(' Nomor Pendaftar '),'nomor_pendaftar');
 const h=[' PILIHAN_1 ','Nama Lengkap','nomor_peserta','Nomor Pendaftar','tgl_lahir','kolom_baru'];
 const r=parseExcelMatrix([['REKAP PENDAFTARAN'],[],h,['Prodi A','Peserta Contoh','0002','0001',new Date('2000-01-02T00:00:00Z'),'Nilai baru']]);
 assert.equal(r.headerRow,3);assert.equal(r.rows[0].tgl_lahir,'2000-01-02');assert.equal(r.rows[0].kolom_baru,'Nilai baru');assert.deepEqual(r.issues,[]);
 assert.equal(normalizeRows(r.rows)[0].profile.source_data.kolom_baru,'Nilai baru');
});
test('Kolom wajib hilang, judul duplikat, atau data tanpa judul ditolak',()=>{
 assert.throws(()=>parseExcelMatrix([['nomor_pendaftar','nama_lengkap'],['0001','Nama']]),/Kolom wajib/);
 assert.throws(()=>parseExcelMatrix([[...headers,'NAMA_LENGKAP'],[...headers.map(k=>row[k]),'Tertimpa']]),/duplikat/);
 assert.throws(()=>parseExcelMatrix([[...headers,''],[...headers.map(k=>row[k]),'Tidak boleh hilang']]),/tanpa judul/);
});
test('Nomor kosong, duplikat, dan nomor melebihi presisi angka ditampilkan sebelum impor',()=>{
 const missing={...row,nomor_peserta:''};
 const r=parseExcelMatrix([headers,headers.map(k=>missing[k])]);assert.match(r.issues[0],/Baris 2: nomor_peserta/);
 const duplicate=parseExcelMatrix([headers,headers.map(k=>row[k]),headers.map(k=>row[k])]);assert.equal(duplicate.issues.length,2);
 const unsafe={...row,nomor_peserta:9007199254740992};assert.ok(parseExcelMatrix([headers,headers.map(k=>unsafe[k])]).issues.some(e=>e.includes('teks')));
});
test('Data panjang tidak dipotong; tautan tidak aman tetap teks di sumber',()=>{
 const profile=normalizeRows([{...row,data_khusus:'A'.repeat(22000),file_disertasi:'javascript:alert(1)'}])[0].profile;
 assert.equal(profile.source_data.data_khusus.length,22000);assert.equal(profile.file_disertasi,'');assert.equal(profile.source_data.file_disertasi,'javascript:alert(1)');
 const summary=profileSummary(profile);assert.equal(summary.source_column_count,83);assert.equal(summary.source_data,undefined);assert.equal(summary.nik,undefined);
 assert.throws(()=>normalizeRows([{...row,data_khusus:'A'.repeat(250001)}]),/tidak dipotong/);
});
