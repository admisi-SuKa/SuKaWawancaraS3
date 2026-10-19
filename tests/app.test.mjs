import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createApp} from '../server/app.mjs';
import {hashPassword,verifyPassword} from '../server/security.mjs';
import {normalizeRows,validateScore,calculateResults} from '../server/domain.mjs';

test('Normalisasi, rentang nilai, nol, dan password',async()=>{
 const row={nomor_pendaftar:12345678,nomor_peserta:'001',nama_lengkap:'Peserta A',pilihan_1:'Prodi A',ipk:'3,75',file_disertasi:'javascript:alert(1)'};
 const r=normalizeRows([row])[0];assert.equal(r.participant_number,'001');assert.equal(r.applicant_number,'12345678');assert.equal(r.profile.ipk,'3.75');assert.equal(r.profile.file_disertasi,'');
 assert.throws(()=>normalizeRows([row,row]),/duplikat/);assert.throws(()=>normalizeRows([{...row,nomor_peserta:''}]),/wajib/);
 assert.deepEqual(validateScore('BAHASA',{arab:0,inggris:100},'present',true),{arab:0,inggris:100});
 assert.throws(()=>validateScore('BAHASA',{arab:70},'present',true),/Lengkapi/);assert.throws(()=>validateScore('PROPOSAL',{nilai:101},'present',false),/0–100/);
 assert.throws(()=>validateScore('PROPOSAL',{nilai:0},'absent',true),/Kosongkan/);
 const hash=await hashPassword('Password-awal-1234');assert.ok(await verifyPassword('Password-awal-1234',hash));assert.equal(await verifyPassword('salah',hash),false);
});

test('Alur integrasi database PostgreSQL: periode → impor → plotting → nilai → arsip',async t=>{
 const pg=new PGlite();await pg.exec(await readFile(new URL('../sql/001_initial.sql',import.meta.url),'utf8'));
 const db={query:async(sql,params)=>{const r=await pg.query(sql,params);return {...r,rowCount:r.affectedRows??r.rows.length};},connect:async()=>({...db,release(){}})};
 const app=createApp(db),adminId=randomUUID(),examinerId=randomUUID(),otherId=randomUUID();
 const originalPassword='Initial-Password-1234';
 for(const [id,username,role] of [[adminId,'admin','admin'],[examinerId,'penguji','penguji'],[otherId,'lain','penguji']])await db.query('INSERT INTO users(id,username,name,role,password_hash,must_change) VALUES($1,$2,$2,$3,$4,false)',[id,username,role,await hashPassword(originalPassword)]);
 let cookie='',csrf='';
 async function request(action,body,auth={cookie,csrf},origin='http://localhost:8888'){
  const res=await app(new Request('http://localhost:8888/api/'+action,{method:body===undefined?'GET':'POST',headers:{origin,'Content-Type':'application/json',cookie:auth.cookie,'x-csrf-token':auth.csrf},body:body===undefined?undefined:JSON.stringify(body)}));
  return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')};
 }
 async function ok(action,body,auth){const r=await request(action,body,auth);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
 async function login(username){const r=await request('login',{username,password:originalPassword});assert.equal(r.status,200);return {cookie:r.cookie.split(';')[0],csrf:r.data.csrf};}
 const adminAuth=await login('admin');({cookie,csrf}=adminAuth);const examinerAuth=await login('penguji'),otherAuth=await login('lain');
 await t.test('Autorisasi dan CSRF dicek pada backend',async()=>{
  assert.equal((await request('bootstrap',undefined,{cookie:'',csrf:''})).status,401);
  assert.equal((await request('period-save',{},examinerAuth)).status,403);
  assert.equal((await request('period-save',{},adminAuth,'https://evil.example')).status,403);
  assert.equal((await request('period-save',{}, {...adminAuth,csrf:'wrong'})).status,403);
 });
 await t.test('Akun baru wajib mengganti password dan reset mencabut sesi',async()=>{
  const u=await ok('user-save',{username:'baru',name:'Penguji Baru',role:'penguji',active:true,password:originalPassword});
  const auth=await login('baru');assert.equal((await request('bootstrap',undefined,auth)).status,403);
  await ok('password',{current:originalPassword,password:'Password-Baru-5678'},auth);
  assert.equal((await request('bootstrap',undefined,auth)).status,200);
  await ok('user-save',{id:u.id,username:'baru',name:'Penguji Baru',role:'penguji',active:true,password:'Password-Reset-9012'});
  assert.equal((await request('me',undefined,auth)).status,401);
 });
 const settings={weights:{BAHASA:30,SIGNIFIKANSI:30,PROPOSAL:40},passing:70,rubrics:{BAHASA:'Bahasa',SIGNIFIKANSI:'Akademik',PROPOSAL:'Proposal'}};
 const period=await ok('period-save',{name:'S3 Periode A',academic_year:'2027/2028',wave:'Gelombang 1',pathway:'Reguler',settings});
 const period2=await ok('period-save',{name:'S3 Periode B',academic_year:'2028/2029',wave:'Gelombang 1',pathway:'Reguler',settings});
 const program=await ok('program-save',{name:'Prodi A',faculty:'Fakultas A',aliases:['Konsentrasi A']});
 const rows=[{nomor_pendaftar:'001',nomor_peserta:'P001',nama_lengkap:'Peserta A',pilihan_1:'Konsentrasi A',judul_disertasi:'Judul A',nik:'IDENTITAS-SINTETIS',nama_lengkap_ibu:'Ibu Contoh',kolom_tambahan:'Semua kolom disimpan'}];
 const payload={period_id:period.id,filename:'peserta.xlsx',rows};
 await t.test('Pratinjau, duplikat, impor ulang, dan isolasi periode',async()=>{
  const preview=await ok('import-preview',payload);assert.equal(preview.newCount,1);assert.deepEqual(preview.errors,[]);
  assert.equal((await request('import-preview',{...payload,filename:'peserta.csv'})).status,400);
  assert.equal((await request('import-commit',{...payload,rows:[...rows,...rows]})).status,400);
  await ok('import-commit',payload);await ok('import-commit',{...payload,rows:[{...rows[0],nama_lengkap:'Peserta A Revisi'}]});
  const boot=await ok('bootstrap?period='+period.id);assert.equal(boot.enrollments.length,1);assert.equal(boot.enrollments[0].name,'Peserta A Revisi');
  await ok('import-commit',{...payload,period_id:period2.id});assert.equal((await ok('bootstrap?period='+period2.id)).enrollments.length,1);
  const missing=await ok('import-preview',{...payload,rows:[{...rows[0],pilihan_1:'Tidak dikenal'}]});assert.equal(missing.errors.length,1);
 });
 const boot=await ok('bootstrap?period='+period.id),eid=boot.enrollments[0].id;let assignments=[];
 await t.test('Sesi, plotting, kapasitas, bentrok, dan penguji ganda',async()=>{
  assert.equal((await request('period-status',{id:period.id,status:'open'})).status,400);
  for(let i=0;i<3;i++){
   const component=['BAHASA','SIGNIFIKANSI','PROPOSAL'][i];
   const session=await ok('session-save',{period_id:period.id,name:component,component,starts_at:`2027-04-01T${String(8+i).padStart(2,'0')}:00:00+07:00`,ends_at:`2027-04-01T${String(9+i).padStart(2,'0')}:00:00+07:00`,room:'Ruang 1',meeting_url:'',capacity:1});
   await ok('assignment-create',{period_id:period.id,session_id:session.id,examiner_ids:i===0?[examinerId,otherId]:[examinerId],enrollment_ids:[eid]});
  }
  const extra=await ok('import-commit',{...payload,rows:[{...rows[0],nomor_pendaftar:'002',nomor_peserta:'P002',nama_lengkap:'Peserta B'}]});assert.equal(extra.count,1);
  const newEnrollment=(await ok('bootstrap?period='+period.id)).enrollments.find(e=>e.applicant_number==='002');
  const firstSession=(await ok('bootstrap?period='+period.id)).sessions.find(s=>s.component==='BAHASA');
  const capacity=await request('assignment-create',{period_id:period.id,session_id:firstSession.id,examiner_ids:[examinerId],enrollment_ids:[newEnrollment.id]});assert.equal(capacity.status,400);assert.match(capacity.data.error,/Kapasitas/);
  await ok('enrollment-delete',{id:newEnrollment.id});
  const overlapping=await ok('session-save',{period_id:period.id,name:'Bentrok',component:'BAHASA',starts_at:'2027-04-01T08:30:00+07:00',ends_at:'2027-04-01T09:30:00+07:00',room:'Ruang 2',meeting_url:'',capacity:10});
  const conflict=await request('assignment-create',{period_id:period.id,session_id:overlapping.id,examiner_ids:[examinerId],enrollment_ids:[eid]});assert.equal(conflict.status,400);assert.match(conflict.data.error,/bentrok/);
  const b=await ok('bootstrap?period='+period.id);assignments=b.assignments;assert.equal(assignments.length,4);
  await ok('period-status',{id:period.id,status:'open'});
  assert.equal((await request('import-commit',payload)).status,400);
  assert.equal((await request('assignment-delete',{id:assignments[0].id})).status,400);
 });
 await t.test('Penguji hanya melihat tugas sendiri dan tidak dapat menilai tugas orang lain',async()=>{
  const b=await ok('bootstrap?period='+period.id,undefined,otherAuth);assert.equal(b.assignments.length,1);assert.equal(b.users.length,0);assert.equal(b.results.length,0);
  const a=assignments.find(a=>a.component==='PROPOSAL');const r=await request('score',{assignment_id:a.id,version:0,values:{nilai:80},notes:'',attendance:'present',final:false},otherAuth);assert.equal(r.status,403);
 });
 await t.test('Profil lengkap hanya dimuat untuk penguji yang ditugaskan',async()=>{
  const b=await ok('bootstrap?period='+period.id,undefined,examinerAuth);assert.equal(b.enrollments[0].profile.source_data,undefined);assert.equal(b.enrollments[0].profile.nik,undefined);
  const detail=await ok('participant?id='+eid,undefined,examinerAuth);assert.equal(detail.profile.source_data.nik,'IDENTITAS-SINTETIS');assert.equal(detail.profile.source_data.kolom_tambahan,'Semua kolom disimpan');
  const other=(await ok('bootstrap?period='+period2.id)).enrollments[0];assert.equal((await request('participant?id='+other.id,undefined,examinerAuth)).status,403);
 });
 await t.test('Draf, konflik versi, final, nol, dan pembukaan koreksi',async()=>{
  const a=assignments.find(a=>a.component==='PROPOSAL');const body={assignment_id:a.id,version:0,values:{nilai:0},notes:'Nilai nol adalah nilai yang sah',attendance:'present',final:false};
  const saved=await ok('score',body,examinerAuth);assert.equal(saved.version,1);
  assert.equal((await request('score',body,examinerAuth)).status,409);
  const final=await ok('score',{...body,version:1,final:true},examinerAuth);assert.equal(final.values.nilai,0);
  assert.equal((await request('score',{...body,version:2},examinerAuth)).status,409);
  await ok('score-reopen',{assignment_id:a.id,reason:'Koreksi setelah verifikasi'});
  await ok('score',{...body,version:3,values:{nilai:90},final:true},examinerAuth);
  for(const a of assignments.filter(a=>a.component!=='PROPOSAL'))await ok('score',{assignment_id:a.id,version:0,values:a.component==='BAHASA'?{arab:80,inggris:90}:{nilai:80},notes:'Catatan penguji',attendance:'present',final:true},a.examiner_id===otherId?otherAuth:examinerAuth);
  const b=await ok('bootstrap?period='+period.id);assert.equal(b.results[0].total,85.5);assert.equal(b.results[0].complete,true);assert.ok(b.logs.some(l=>l.action==='score.reopen'));
 });
 await t.test('Lengkapi profil saat periode dibuka mempertahankan nilai dan plotting',async()=>{
  const before=await ok('bootstrap?period='+period.id);
  const complete={...payload,mode:'profile-only',rows:[{...rows[0],nama_lengkap:'Peserta A Revisi',kolom_tambahan:'Data lengkap baru',alamat_lengkap:'Alamat sintetis'}]};
  const preview=await ok('import-preview',complete);assert.equal(preview.errors.length,0);await ok('import-commit',complete);
  const after=await ok('bootstrap?period='+period.id);assert.deepEqual(after.assignments,before.assignments);assert.equal(after.results[0].total,before.results[0].total);
  assert.equal((await ok('participant?id='+eid,undefined,examinerAuth)).profile.source_data.alamat_lengkap,'Alamat sintetis');
  const invalid=await ok('import-preview',{...complete,rows:[{...complete.rows[0],nomor_peserta:'P999'}]});assert.ok(invalid.errors.length>0);
  assert.equal((await request('import-commit',{...complete,rows:[{...complete.rows[0],nomor_peserta:'P999'}]})).status,400);
 });
 await t.test('Penutupan, arsip, dan perlindungan akun admin terakhir',async()=>{
  assert.equal((await request('user-save',{id:adminId,username:'admin',name:'Admin',role:'penguji',active:true})).status,400);
  await ok('period-status',{id:period.id,status:'closed'});
  assert.equal((await request('period-status',{id:period.id,status:'open',reason:''})).status,400);
  await ok('period-status',{id:period.id,status:'archived'});
  assert.equal((await request('import-commit',{...payload,mode:'profile-only'})).status,400);
  assert.equal((await request('period-status',{id:period.id,status:'open',reason:'Coba'})).status,400);
  assert.equal((await request('score-reopen',{assignment_id:assignments[0].id,reason:'Arsip tidak boleh diubah'})).status,400);
  assert.equal((await request('program-save',{id:program.id,name:'Nama Baru',faculty:'Baru',aliases:[]})).status,400);
 });
 await pg.close();
});

test('Rekap tidak menganggap tidak hadir/nilai kosong sebagai nol',()=>{
 const e=[{id:'a'}],s={weights:{BAHASA:30,SIGNIFIKANSI:30,PROPOSAL:40},passing:70};
 const as=['BAHASA','SIGNIFIKANSI','PROPOSAL'].map(component=>({enrollment_id:'a',component,score_status:'final',attendance:'present',values:{arab:80,inggris:80,nilai:80}}));
 assert.equal(calculateResults(e,as,s)[0].total,80);as[0].attendance='absent';assert.equal(calculateResults(e,as,s)[0].total,null);
});
