export const COMPONENTS=['BAHASA','SIGNIFIKANSI','PROPOSAL'];
export class AppError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export function requireThat(condition,message,status=400){if(!condition)throw new AppError(message,status);}
export function normalizeID(v){return typeof v==='number'&&Number.isSafeInteger(v)?String(v):String(v??'').trim();}
export function safeURL(value){try{const url=new URL(String(value));return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}}
export function normalizeRows(rows){
 requireThat(Array.isArray(rows)&&rows.length>0&&rows.length<=300,'Unggah 1–300 peserta per proses. Pecah file besar menjadi beberapa unggahan.');
 const applicants=new Set(),participants=new Set();
 return rows.map((r,i)=>{
  const applicant_number=normalizeID(r.nomor_pendaftar),participant_number=normalizeID(r.nomor_peserta),name=String(r.nama_lengkap??'').trim(),program=String(r.pilihan_1??'').trim();
  requireThat(applicant_number&&participant_number&&name&&program,`Baris ${i+2}: nomor pendaftar, nomor peserta, nama, dan pilihan_1 wajib diisi.`);
  requireThat(applicant_number.length<=80&&participant_number.length<=80&&name.length<=250&&program.length<=250,`Baris ${i+2}: data terlalu panjang.`);
  requireThat(!applicants.has(applicant_number)&&!participants.has(participant_number),`Baris ${i+2}: nomor peserta/pendaftar duplikat dalam file.`);
  applicants.add(applicant_number);participants.add(participant_number);
  const entries=Object.entries(r);
  requireThat(entries.length<=300,`Baris ${i+2}: maksimal 300 kolom per peserta.`);
  const sourceData=Object.create(null);
  for(const [key,value] of entries){
   requireThat(key.length>0&&key.length<=250,`Baris ${i+2}: nama kolom tidak valid.`);
   requireThat(value===null||value===undefined||['string','number','boolean'].includes(typeof value),`Baris ${i+2}: kolom ${key} harus berupa teks, angka, atau tanggal yang sudah dikonversi.`);
   const original=value===null||value===undefined?'':String(value);
   requireThat(original.length<=250000,`Baris ${i+2}: isi kolom ${key} melebihi 250.000 karakter. Data tidak dipotong; perbaiki sumber lalu ulangi.`);
   sourceData[key]=original;
  }
  // Preserve every source column verbatim; normalized fields are convenience copies.
  const profile={...sourceData,source_data:sourceData,source_columns:entries.map(([key])=>key),import_schema:2};
  profile.ipk=String(profile.ipk??'').replace(',','.');
  for(const k of ['file_disertasi','ijazah_pasca','transkrip_pasca','sertifikat_toefl','sertifikat_toafl','sertifikat_pendukung','rekomendasi_penelitian']) profile[k]=safeURL(r[k]);
  return {applicant_number,participant_number,name,program,profile};
 });
}
export function profileSummary(profile={}){
 return {judul_disertasi:profile.judul_disertasi||'',file_disertasi:profile.file_disertasi||'',import_schema:profile.import_schema||1,source_column_count:profile.source_columns?.length||0};
}
export function validateScore(component,values,attendance,final){
 const keys=component==='BAHASA'?['arab','inggris']:['nilai'];const result={};
 for(const key of keys){const v=values?.[key];if(v===undefined||v===null||v==='')continue;requireThat(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100,'Nilai harus berupa angka 0–100.');result[key]=v;}
 if(attendance==='absent')requireThat(Object.keys(result).length===0,'Kosongkan nilai untuk peserta tidak hadir.');
 if(final){requireThat(attendance!=='unknown','Tentukan kehadiran sebelum mengirim nilai final.');if(attendance==='present')requireThat(keys.every(k=>result[k]!==undefined),'Lengkapi seluruh nilai sebelum mengirim.');}
 return result;
}
export function calculateResults(enrollments,assignments,settings){
 return enrollments.map(e=>{
  const list=assignments.filter(a=>a.enrollment_id===e.id);const components={};let complete=true;
  for(const c of COMPONENTS){const group=list.filter(a=>a.component===c);const ready=group.length>0&&group.every(a=>a.score_status==='final'&&a.attendance==='present');
   if(!ready){complete=false;components[c]=null;continue;}
   components[c]=group.reduce((sum,a)=>sum+(c==='BAHASA'?(Number(a.values.arab)+Number(a.values.inggris))/2:Number(a.values.nilai)),0)/group.length;
  }
  const total=complete?COMPONENTS.reduce((sum,c)=>sum+components[c]*Number(settings.weights[c])/100,0):null;
  return {...e,components,total,complete,recommendation:complete?(total>=settings.passing?'Memenuhi ambang':'Di bawah ambang'):'Belum lengkap',assignments:list};
 });
}
