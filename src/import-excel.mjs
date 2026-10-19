export const requiredHeaders=['nomor_pendaftar','nomor_peserta','nama_lengkap','pilihan_1'];
export function canonicalHeader(value){return String(value??'').replace(/^\uFEFF/,'').trim().toLowerCase().replace(/\s+/g,'_');}
function cellText(value){
 if(value===null||value===undefined)return '';
 if(value instanceof Date){if(Number.isNaN(value.getTime()))throw new Error('Ada tanggal Excel yang tidak valid.');return value.toISOString().slice(0,10);}
 return value;
}
export function parseExcelMatrix(matrix){
 if(!Array.isArray(matrix)||!matrix.length)throw new Error('Sheet kosong. Pilih sheet yang memuat data peserta.');
 const headerIndex=matrix.findIndex(row=>row.map(canonicalHeader).includes('nomor_pendaftar')&&row.map(canonicalHeader).includes('nama_lengkap'));
 if(headerIndex<0)throw new Error('Judul kolom nomor_pendaftar dan nama_lengkap tidak ditemukan pada baris yang sama. Pilih sheet data peserta.');
 const headers=matrix[headerIndex].map(canonicalHeader),used=headers.filter(Boolean);
 const duplicates=[...new Set(used.filter((h,i)=>used.indexOf(h)!==i))];
 if(duplicates.length)throw new Error('Judul kolom duplikat: '+duplicates.join(', ')+'. Setiap kolom harus memiliki judul yang unik.');
 const missing=requiredHeaders.filter(h=>!used.includes(h));if(missing.length)throw new Error('Kolom wajib tidak ditemukan: '+missing.join(', ')+'. Urutan kolom bebas, tetapi judulnya harus tersedia.');
 const width=Math.max(headers.length,...matrix.slice(headerIndex+1).map(row=>row.length));
 for(let i=0;i<width;i++)if(!headers[i]&&matrix.slice(headerIndex+1).some(row=>row[i]!==null&&row[i]!==undefined&&row[i]!==''))throw new Error(`Kolom ke-${i+1} terisi tanpa judul. Lengkapi judulnya agar semua data dapat disimpan.`);
 if(used.length>300)throw new Error('Maksimal 300 kolom per peserta.');
 const rows=[],issues=[],sourceRows=[];const seen={nomor_pendaftar:new Map(),nomor_peserta:new Map()};
 for(let i=headerIndex+1;i<matrix.length;i++){
  if(!matrix[i].some(v=>v!==null&&v!==undefined&&v!==''))continue;
  const record=Object.fromEntries(headers.flatMap((key,col)=>key?[[key,cellText(matrix[i][col])]]:[]));
  rows.push(record);sourceRows.push(i+1);
  for(const key of requiredHeaders)if(String(record[key]??'').trim()==='')issues.push(`Baris ${i+1}: ${key} belum diisi.`);
  for(const key of ['nomor_pendaftar','nomor_peserta']){
   const value=record[key],normalized=String(value??'').trim();
   if(typeof value==='number'&&!Number.isSafeInteger(value))issues.push(`Baris ${i+1}: ${key} harus bilangan bulat aman atau teks. Simpan nomor sebagai teks di Excel.`);
   if(normalized){if(seen[key].has(normalized))issues.push(`Baris ${i+1}: ${key} duplikat dengan baris ${seen[key].get(normalized)}.`);else seen[key].set(normalized,i+1);}
  }
 }
 if(!rows.length)throw new Error('Tidak ada peserta setelah baris judul kolom.');
 if(rows.length>300)throw new Error('Maksimal 300 peserta per unggahan. Bagi file Excel menjadi beberapa file.');
 return {rows,columns:used,headerRow:headerIndex+1,sourceRows,issues};
}
