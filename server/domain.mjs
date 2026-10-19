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
  const profile={};
  for(const k of ['email','nohp','nama_pt','asal_jurusan','ipk','nilai_toefl','nilai_toafl','judul_disertasi','jalur_masuk','pilihan_2','pilihan_3','pilihan_4','tanggal_ujian','lokasi_ujian','name_gedung','name_ruang']) profile[k]=String(r[k]??'').slice(0,2500);
  profile.ipk=profile.ipk.replace(',','.');
  for(const k of ['file_disertasi','ijazah_pasca','transkrip_pasca','sertifikat_toefl','sertifikat_toafl','sertifikat_pendukung','rekomendasi_penelitian']) profile[k]=safeURL(r[k]);
  for(const k of ['id_karya_tulis','data_khusus']) profile[k]=String(r[k]??'').slice(0,20000);
  return {applicant_number,participant_number,name,program,profile};
 });
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
