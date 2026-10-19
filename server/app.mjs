import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {transaction} from './db.mjs';
import {token,hashToken,hashPassword,verifyPassword,cookie} from './security.mjs';
import {AppError,requireThat,normalizeRows,validateScore,calculateResults,COMPONENTS,safeURL,profileSummary} from './domain.mjs';
const id=z.string().uuid(),text=z.string().trim().min(1).max(250);
const settingsSchema=z.object({weights:z.object({BAHASA:z.number().min(0).max(100),SIGNIFIKANSI:z.number().min(0).max(100),PROPOSAL:z.number().min(0).max(100)}),passing:z.number().min(0).max(100),rubrics:z.object({BAHASA:z.string().max(5000),SIGNIFIKANSI:z.string().max(5000),PROPOSAL:z.string().max(5000)})}).refine(s=>Math.abs(Object.values(s.weights).reduce((a,b)=>a+b,0)-100)<0.001,'Jumlah bobot wajib 100%.');
const publicUser=u=>({id:u.id,username:u.username,name:u.name,role:u.role,active:u.active,must_change:u.must_change});
async function audit(c,u,action,entity,detail={}){await c.query('INSERT INTO audit_logs(id,actor_id,action,entity_id,detail) VALUES($1,$2,$3,$4,$5)',[randomUUID(),u?.id||null,action,String(entity),JSON.stringify(detail)]);}
async function getPeriod(c,periodId,states){const r=await c.query('SELECT * FROM periods WHERE id=$1 FOR UPDATE',[id.parse(periodId)]);const p=r.rows[0];requireThat(p,'Periode tidak ditemukan.',404);if(states)requireThat(states.includes(p.status),'Periode terkunci atau belum dibuka.');return p;}
function admin(u){requireThat(u.role==='admin','Akses hanya untuk admin.',403);}
function parseBody(raw){try{return JSON.parse(raw);}catch{throw new AppError('Format JSON tidak valid.');}}
async function rateLimit(db,key,max){const r=await db.query(`INSERT INTO login_limits(key,attempts) VALUES($1,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_limits.started_at < now()-interval '15 minutes' THEN 1 ELSE login_limits.attempts+1 END, started_at=CASE WHEN login_limits.started_at < now()-interval '15 minutes' THEN now() ELSE login_limits.started_at END RETURNING attempts`,[hashToken(key)]);requireThat(r.rows[0].attempts<=max,'Terlalu banyak percobaan login. Tunggu 15 menit.',429);}
export function createApp(db){return async function app(request){
 const response=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
 try{
  const url=new URL(request.url),action=url.pathname.split('/').filter(Boolean).at(-1);
  requireThat(['GET','POST'].includes(request.method),'Metode tidak didukung.',405);
  let body={};
  if(request.method==='POST'){
   const origin=request.headers.get('origin');const expected=process.env.APP_ORIGIN||url.origin;
   requireThat(origin===expected,'Asal permintaan tidak diizinkan. Periksa APP_ORIGIN.',403);
   requireThat(request.headers.get('content-type')?.includes('application/json'),'Gunakan JSON.',415);
   const raw=await request.text();requireThat(Buffer.byteLength(raw)<4_000_000,'Data terlalu besar. Unggah maksimal 300 baris atau 4 MB per proses.',413);body=parseBody(raw);
  }
  if(action==='login'&&request.method==='POST'){
   const b=z.object({username:text,password:z.string().min(1).max(200)}).parse(body);
   const ip=request.headers.get('x-nf-client-connection-ip')||'local';
   await rateLimit(db,`ip:${ip}`,100);await rateLimit(db,`account:${b.username.toLowerCase()}`,12);
   const u=(await db.query('SELECT * FROM users WHERE username=$1',[b.username.toLowerCase()])).rows[0];
   // Do a password derivation for unknown usernames too.
   const valid=await verifyPassword(b.password,u?.password_hash||'scrypt:00000000000000000000000000000000:'+ '00'.repeat(64));
   requireThat(u&&u.active&&valid,'Username atau password salah, atau akun tidak aktif.',401);
   const sessionToken=token(),csrf=token();
   await db.query('DELETE FROM auth_sessions WHERE expires_at < now()');
   await db.query("INSERT INTO auth_sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",[hashToken(sessionToken),u.id,csrf]);
   await db.query('DELETE FROM login_limits WHERE key=$1',[hashToken(`account:${b.username.toLowerCase()}`)]);
   return response({user:publicUser(u),csrf},200,{'Set-Cookie':cookie(request,sessionToken,28800)});
  }
  const sessionToken=request.headers.get('cookie')?.match(/(?:^|;\s*)s3_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  requireThat(sessionToken,'Silakan login terlebih dahulu.',401);
  const auth=(await db.query('SELECT u.*,s.csrf FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[hashToken(sessionToken)])).rows[0];
  requireThat(auth,'Sesi berakhir. Silakan login ulang.',401);
  if(request.method==='POST')requireThat(request.headers.get('x-csrf-token')===auth.csrf,'Sesi keamanan tidak cocok. Muat ulang halaman.',403);
  if(action==='me')return response({user:publicUser(auth),csrf:auth.csrf});
  if(action==='logout') {requireThat(request.method==='POST','Gunakan POST.',405);await db.query('DELETE FROM auth_sessions WHERE token_hash=$1',[hashToken(sessionToken)]);return response({ok:true},200,{'Set-Cookie':cookie(request,'',0)});}
  if(action==='password'){
   requireThat(request.method==='POST','Gunakan POST.',405);
   const b=z.object({current:z.string().max(200),password:z.string().min(12).max(200)}).parse(body);
   requireThat(await verifyPassword(b.current,auth.password_hash),'Password lama tidak sesuai.');
   requireThat(b.current!==b.password,'Gunakan password baru yang berbeda.');
   await transaction(db,async c=>{await c.query('UPDATE users SET password_hash=$1,must_change=false WHERE id=$2',[await hashPassword(b.password),auth.id]);await c.query('DELETE FROM auth_sessions WHERE user_id=$1 AND token_hash<>$2',[auth.id,hashToken(sessionToken)]);await audit(c,auth,'password.change',auth.id);});
   return response({ok:true});
  }
  requireThat(!auth.must_change,'Ganti password awal sebelum melanjutkan.',403);
  if(action==='participant'&&request.method==='GET'){
   const enrollmentId=id.parse(url.searchParams.get('id'));
   const e=(await db.query('SELECT e.*,p.name AS program,p.faculty FROM enrollments e JOIN programs p ON p.id=e.program_id WHERE e.id=$1',[enrollmentId])).rows[0];
   requireThat(e,'Peserta tidak ditemukan.',404);
   if(auth.role!=='admin'){
    const assigned=(await db.query('SELECT id FROM assignments WHERE enrollment_id=$1 AND examiner_id=$2',[enrollmentId,auth.id])).rows;
    requireThat(assigned.length>0,'Anda tidak ditugaskan pada peserta ini.',403);
   }
   return response(e);
  }
  if(action==='bootstrap'&&request.method==='GET'){
   const periods=(await db.query('SELECT * FROM periods ORDER BY created_at DESC')).rows;
   const chosen=url.searchParams.get('period')||periods[0]?.id;
   if(chosen)id.parse(chosen);
   const programs=(await db.query('SELECT * FROM programs ORDER BY faculty,name')).rows;
   const users=auth.role==='admin'?(await db.query('SELECT id,username,name,role,active,must_change FROM users ORDER BY name')).rows:[];
   let enrollments=[],assignments=[],sessions=[];
   if(chosen){
    if(auth.role==='admin'){
     enrollments=(await db.query('SELECT e.*,p.name AS program,p.faculty FROM enrollments e JOIN programs p ON p.id=e.program_id WHERE e.period_id=$1 ORDER BY e.participant_number',[chosen])).rows;
     sessions=(await db.query('SELECT * FROM exam_sessions WHERE period_id=$1 ORDER BY starts_at',[chosen])).rows;
    }else{
     enrollments=(await db.query('SELECT DISTINCT e.*,p.name AS program,p.faculty FROM enrollments e JOIN programs p ON p.id=e.program_id JOIN assignments a ON a.enrollment_id=e.id WHERE e.period_id=$1 AND a.examiner_id=$2 ORDER BY e.participant_number',[chosen,auth.id])).rows;
     sessions=(await db.query('SELECT DISTINCT s.* FROM exam_sessions s JOIN assignments a ON a.session_id=s.id WHERE s.period_id=$1 AND a.examiner_id=$2 ORDER BY s.starts_at',[chosen,auth.id])).rows;
    }
    assignments=(await db.query(`SELECT a.*,u.name AS examiner_name,s.values,s.notes,s.attendance,s.status AS score_status,s.version,s.updated_at,s.finalized_at FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN users u ON u.id=a.examiner_id LEFT JOIN scores s ON s.assignment_id=a.id WHERE e.period_id=$1 ${auth.role==='admin'?'':'AND a.examiner_id=$2'} ORDER BY a.component`,auth.role==='admin'?[chosen]:[chosen,auth.id])).rows;
   }
   const logs=auth.role==='admin'?(await db.query('SELECT a.id,a.action,a.entity_id,a.detail,a.created_at,u.name AS actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 150')).rows:[];
   const imports=auth.role==='admin'&&chosen?(await db.query('SELECT * FROM import_batches WHERE period_id=$1 ORDER BY created_at DESC LIMIT 20',[chosen])).rows:[];
   const period=periods.find(p=>p.id===chosen);
   const summarized=enrollments.map(e=>({...e,profile:profileSummary(e.profile)}));
   const results=auth.role==='admin'&&period?calculateResults(summarized,assignments,period.settings):[];
   return response({user:publicUser(auth),periods,programs,users,enrollments:summarized,assignments,sessions,logs,imports,results,selectedPeriod:chosen});
  }
  requireThat(request.method==='POST','Rute tidak ditemukan.',404);
  if(action==='score'){
   const b=z.object({assignment_id:id,version:z.number().int().min(0),values:z.record(z.any()),notes:z.string().max(10000),attendance:z.enum(['unknown','present','absent']),final:z.boolean()}).parse(body);
   const result=await transaction(db,async c=>{
    const a=(await c.query('SELECT a.*,e.period_id FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id WHERE a.id=$1',[b.assignment_id])).rows[0];
    requireThat(a,'Penugasan tidak ditemukan.',404);requireThat(a.examiner_id===auth.id,'Anda tidak ditugaskan pada penilaian ini.',403);
    await getPeriod(c,a.period_id,['open']);
    await c.query('SELECT id FROM assignments WHERE id=$1 FOR UPDATE',[a.id]);
    const old=(await c.query('SELECT * FROM scores WHERE assignment_id=$1 FOR UPDATE',[a.id])).rows[0];
    requireThat(!old||old.status!=='final','Nilai sudah final. Hubungi admin untuk membukanya.',409);
    requireThat((old?.version||0)===b.version,'Nilai berubah pada perangkat/tab lain. Muat ulang sebelum melanjutkan.',409);
    const values=validateScore(a.component,b.values,b.attendance,b.final);
    const saved=(await c.query(`INSERT INTO scores(assignment_id,values,notes,attendance,status,version,finalized_at) VALUES($1,$2,$3,$4,$5,1,$6) ON CONFLICT(assignment_id) DO UPDATE SET values=$2,notes=$3,attendance=$4,status=$5,version=scores.version+1,updated_at=now(),finalized_at=$6 RETURNING *`,[a.id,JSON.stringify(values),b.notes,b.attendance,b.final?'final':'draft',b.final?new Date():null])).rows[0];
    await audit(c,auth,b.final?'score.final':'score.draft',a.id,{before:old?{values:old.values,notes:old.notes,attendance:old.attendance,version:old.version}:null,after:{values,notes:b.notes,attendance:b.attendance,version:saved.version}});
    return saved;
   });return response(result);
  }
  admin(auth);
  const result=await transaction(db,async c=>{
   if(action==='user-save'){
    const b=z.object({id:id.optional(),username:z.string().trim().regex(/^[a-zA-Z0-9._-]{3,80}$/),name:text,role:z.enum(['admin','penguji']),active:z.boolean(),password:z.string().min(12).max(200).optional()}).parse(body);
    const uid=b.id||randomUUID();
    if(b.id){
     const old=(await c.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[uid])).rows[0];requireThat(old,'Akun tidak ditemukan.',404);
     if(old.role==='admin'&&(b.role!=='admin'||!b.active)){
      await c.query("SELECT id FROM users WHERE role='admin' AND active=true FOR UPDATE");
      const count=Number((await c.query("SELECT count(*) AS n FROM users WHERE role='admin' AND active=true AND id<>$1",[uid])).rows[0].n);requireThat(count>0,'Harus ada minimal satu admin aktif.');
     }
     requireThat(uid!==auth.id||b.active,'Tidak dapat menonaktifkan akun sendiri.');
     await c.query('UPDATE users SET username=$1,name=$2,role=$3,active=$4 WHERE id=$5',[b.username.toLowerCase(),b.name,b.role,b.active,uid]);
     if(b.password)await c.query('UPDATE users SET password_hash=$1,must_change=true WHERE id=$2',[await hashPassword(b.password),uid]);
     if(b.password||!b.active||old.role!==b.role)await c.query('DELETE FROM auth_sessions WHERE user_id=$1',[uid]);
    }else{requireThat(b.password,'Password awal wajib diisi.');await c.query('INSERT INTO users(id,username,name,role,active,password_hash) VALUES($1,$2,$3,$4,$5,$6)',[uid,b.username.toLowerCase(),b.name,b.role,b.active,await hashPassword(b.password)]);}
    await audit(c,auth,'user.save',uid,{name:b.name,role:b.role,active:b.active});return {id:uid};
   }
   if(action==='program-save'){
    const b=z.object({id:id.optional(),name:text,faculty:text,aliases:z.array(text).max(100)}).parse(body);const uid=b.id||randomUUID();
    const all=(await c.query('SELECT * FROM programs')).rows;
    const names=[b.name,...b.aliases].map(n=>n.toLowerCase());requireThat(new Set(names).size===names.length,'Nama dan alias harus berbeda.');
    requireThat(!all.some(p=>p.id!==uid&&[p.name,...p.aliases].some(n=>names.includes(n.toLowerCase()))),'Nama/alias sudah digunakan prodi lain.');
    if(b.id){const used=Number((await c.query('SELECT count(*) AS n FROM enrollments WHERE program_id=$1',[uid])).rows[0].n);requireThat(!used,'Prodi sudah dipakai. Buat prodi baru untuk menjaga arsip.');}
    await c.query('INSERT INTO programs(id,name,faculty,aliases) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=$2,faculty=$3,aliases=$4',[uid,b.name,b.faculty,JSON.stringify(b.aliases)]);await audit(c,auth,'program.save',uid,b);return {id:uid};
   }
   if(action==='period-save'){
    const b=z.object({id:id.optional(),name:text,academic_year:text,wave:text,pathway:text,settings:settingsSchema}).parse(body);const uid=b.id||randomUUID();
    if(b.id)await getPeriod(c,uid,['draft']);
    await c.query('INSERT INTO periods(id,name,academic_year,wave,pathway,settings) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=$2,academic_year=$3,wave=$4,pathway=$5,settings=$6',[uid,b.name,b.academic_year,b.wave,b.pathway,JSON.stringify(b.settings)]);await audit(c,auth,'period.save',uid,b);return {id:uid};
   }
   if(action==='period-status'){
    const b=z.object({id,status:z.enum(['draft','open','closed','archived']),reason:z.string().max(2000).default('')}).parse(body);const p=await getPeriod(c,b.id);
    const allowed={draft:['open'],open:['closed'],closed:['open','archived'],archived:[]};requireThat(allowed[p.status].includes(b.status),'Perubahan status tidak diizinkan.');
    if(b.status==='open'){
     const e=(await c.query('SELECT id FROM enrollments WHERE period_id=$1',[p.id])).rows;requireThat(e.length,'Impor peserta terlebih dahulu.');
     const a=(await c.query('SELECT a.* FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id WHERE e.period_id=$1',[p.id])).rows;
     requireThat(e.every(row=>COMPONENTS.every(comp=>a.some(x=>x.enrollment_id===row.id&&x.component===comp))),'Setiap peserta harus memiliki penguji dan sesi untuk ketiga komponen.');
     const inactive=(await c.query('SELECT a.id FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN users u ON u.id=a.examiner_id WHERE e.period_id=$1 AND u.active=false',[p.id])).rows;requireThat(!inactive.length,'Ada penguji tidak aktif pada plotting.');
    }
    if(p.status==='closed'&&b.status==='open')requireThat(b.reason.trim(),'Isi alasan membuka kembali periode.');
    if(b.status==='archived'){
     const e=(await c.query('SELECT * FROM enrollments WHERE period_id=$1',[p.id])).rows;
     const a=(await c.query('SELECT a.*,s.status AS score_status,s.attendance,s.values FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id LEFT JOIN scores s ON s.assignment_id=a.id WHERE e.period_id=$1',[p.id])).rows;
     requireThat(e.every(row=>COMPONENTS.every(comp=>a.some(x=>x.enrollment_id===row.id&&x.component===comp)))&&a.every(x=>x.score_status==='final'),'Finalisasi seluruh penugasan, termasuk status tidak hadir, sebelum arsip.');
    }
    await c.query('UPDATE periods SET status=$1 WHERE id=$2',[b.status,p.id]);await audit(c,auth,'period.status',p.id,{from:p.status,to:b.status,reason:b.reason});return {ok:true};
   }
   if(action==='import-preview'||action==='import-commit'){
    const b=z.object({period_id:id,filename:text,rows:z.array(z.record(z.any())),mode:z.enum(['full','profile-only']).default('full')}).parse(body);
    requireThat(/\.xlsx$/i.test(b.filename),'Gunakan file Excel .xlsx, bukan CSV.');
    await getPeriod(c,b.period_id,b.mode==='profile-only'?['draft','open','closed']:['draft']);
    const rows=normalizeRows(b.rows),programs=(await c.query('SELECT * FROM programs')).rows;
    const existing=(await c.query('SELECT * FROM enrollments WHERE period_id=$1',[b.period_id])).rows;
    const errors=[],preview=[];
    for(const row of rows){const p=programs.find(p=>[p.name,...p.aliases].some(n=>n.toLowerCase()===row.program.toLowerCase()));
     const old=existing.find(e=>e.applicant_number===row.applicant_number);const collision=existing.find(e=>e.participant_number===row.participant_number&&e.applicant_number!==row.applicant_number);
     if(b.mode==='profile-only'){
      if(!old)errors.push(`${row.name}: peserta belum ada pada periode ini. Gunakan impor peserta dalam periode draf.`);
      else if(old.participant_number!==row.participant_number||old.name!==row.name||old.program_id!==p?.id)errors.push(`${row.name}: identitas/prodi berbeda dari data tersimpan. Mode lengkapi profil tidak mengubah identitas atau plotting.`);
     }
     if(!p)errors.push(`Prodi belum dipetakan: ${row.program}`);if(collision)errors.push(`Nomor peserta ${row.participant_number} dipakai pendaftar lain.`);
     if(old&&p&&old.program_id!==p.id){const assigned=(await c.query('SELECT id FROM assignments WHERE enrollment_id=$1',[old.id])).rows.length;if(assigned)errors.push(`${row.name}: prodi berubah setelah plotting; hapus plotting dahulu.`);}
     preview.push({...row,program_id:p?.id,faculty:p?.faculty||'',existing_id:old?.id,operation:b.mode==='profile-only'?'Lengkapi profil (nilai tetap)':old?'Perbarui biodata':'Peserta baru'});
    }
    if(action==='import-preview')return {rows:preview,errors:[...new Set(errors)],newCount:preview.filter(r=>!r.existing_id).length,updateCount:preview.filter(r=>r.existing_id).length};
    requireThat(!errors.length,errors[0]||'Data impor bermasalah.');
    for(const row of preview){
     if(b.mode==='profile-only')await c.query('UPDATE enrollments SET profile=$1,updated_at=now() WHERE id=$2',[JSON.stringify(row.profile),row.existing_id]);
     else await c.query('INSERT INTO enrollments(id,period_id,applicant_number,participant_number,name,program_id,profile) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(period_id,applicant_number) DO UPDATE SET participant_number=$4,name=$5,program_id=$6,profile=$7,updated_at=now()',[row.existing_id||randomUUID(),b.period_id,row.applicant_number,row.participant_number,row.name,row.program_id,JSON.stringify(row.profile)]);
    }
    const batch=randomUUID();await c.query('INSERT INTO import_batches(id,period_id,actor_id,filename,row_count) VALUES($1,$2,$3,$4,$5)',[batch,b.period_id,auth.id,b.filename,rows.length]);await audit(c,auth,b.mode==='profile-only'?'profile.refresh':'import.commit',b.period_id,{batch,rows:rows.length,filename:b.filename,mode:b.mode});return {ok:true,count:rows.length};
   }
   if(action==='enrollment-delete'){
    const b=z.object({id}).parse(body);const e=(await c.query('SELECT * FROM enrollments WHERE id=$1',[b.id])).rows[0];requireThat(e,'Peserta tidak ditemukan.',404);await getPeriod(c,e.period_id,['draft']);
    const scored=(await c.query('SELECT s.assignment_id FROM scores s JOIN assignments a ON a.id=s.assignment_id WHERE a.enrollment_id=$1',[e.id])).rows;requireThat(!scored.length,'Peserta yang sudah dinilai tidak dapat dihapus.');
    await c.query('DELETE FROM assignments WHERE enrollment_id=$1',[e.id]);await c.query('DELETE FROM enrollments WHERE id=$1',[e.id]);await audit(c,auth,'enrollment.delete',e.id,{participant_number:e.participant_number,name:e.name});return {ok:true};
   }
   if(action==='session-save'){
    const b=z.object({id:id.optional(),period_id:id,name:text,component:z.enum(COMPONENTS),starts_at:z.string().datetime({offset:true}),ends_at:z.string().datetime({offset:true}),room:text,meeting_url:z.string().max(2000),capacity:z.number().int().min(1).max(10000)}).parse(body);await getPeriod(c,b.period_id,['draft']);
    requireThat(new Date(b.ends_at)>new Date(b.starts_at),'Waktu selesai harus setelah waktu mulai.');requireThat(!b.meeting_url||safeURL(b.meeting_url),'Tautan rapat harus http/https.');
    const uid=b.id||randomUUID();if(b.id){const old=(await c.query('SELECT * FROM exam_sessions WHERE id=$1',[uid])).rows[0];requireThat(old?.period_id===b.period_id,'Sesi tidak ditemukan.',404);const used=(await c.query('SELECT id FROM assignments WHERE session_id=$1',[uid])).rows.length;requireThat(!used,'Hapus plotting sesi terlebih dahulu sebelum mengubahnya.');}
    await c.query('INSERT INTO exam_sessions(id,period_id,name,component,starts_at,ends_at,room,meeting_url,capacity) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET name=$3,component=$4,starts_at=$5,ends_at=$6,room=$7,meeting_url=$8,capacity=$9',[uid,b.period_id,b.name,b.component,b.starts_at,b.ends_at,b.room,b.meeting_url,b.capacity]);await audit(c,auth,'session.save',uid,b);return {id:uid};
   }
   if(action==='assignment-create'){
    const b=z.object({period_id:id,session_id:id,examiner_ids:z.array(id).min(1).max(20),enrollment_ids:z.array(id).min(1).max(300)}).parse(body);await getPeriod(c,b.period_id,['draft']);
    const s=(await c.query('SELECT * FROM exam_sessions WHERE id=$1 FOR UPDATE',[b.session_id])).rows[0];requireThat(s?.period_id===b.period_id,'Sesi tidak sesuai periode.');
    const examinerIds=[...new Set(b.examiner_ids)],enrollmentIds=[...new Set(b.enrollment_ids)];
    for(const uid of examinerIds){const u=(await c.query('SELECT * FROM users WHERE id=$1',[uid])).rows[0];requireThat(u?.active,'Penguji tidak aktif atau tidak ditemukan.');
     const conflicts=(await c.query('SELECT a.id FROM assignments a JOIN exam_sessions s ON s.id=a.session_id WHERE a.examiner_id=$1 AND s.id<>$2 AND s.starts_at<$3 AND s.ends_at>$4',[uid,s.id,s.ends_at,s.starts_at])).rows;
     requireThat(!conflicts.length,`Jadwal ${u.name} bentrok dengan sesi lain.`);
    }
    const assigned=(await c.query('SELECT DISTINCT enrollment_id FROM assignments WHERE session_id=$1',[s.id])).rows.map(r=>r.enrollment_id);
    requireThat(new Set([...assigned,...enrollmentIds]).size<=s.capacity,'Kapasitas sesi tidak cukup.');
    let count=0;
    for(const eid of enrollmentIds){const e=(await c.query('SELECT * FROM enrollments WHERE id=$1',[eid])).rows[0];requireThat(e?.period_id===b.period_id,'Peserta tidak sesuai periode.');
     const conflicts=(await c.query('SELECT a.id FROM assignments a JOIN exam_sessions s ON s.id=a.session_id WHERE a.enrollment_id=$1 AND s.id<>$2 AND (a.component=$3 OR (s.starts_at<$4 AND s.ends_at>$5))',[eid,s.id,s.component,s.ends_at,s.starts_at])).rows;
     requireThat(!conflicts.length,`${e.name}: komponen sudah memiliki sesi lain atau jadwal bentrok.`);
     for(const uid of examinerIds){const r=await c.query('INSERT INTO assignments(id,enrollment_id,examiner_id,component,session_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(enrollment_id,examiner_id,component) DO NOTHING',[randomUUID(),eid,uid,s.component,s.id]);count+=r.rowCount;}
    }
    await audit(c,auth,'assignment.create',s.id,{count,enrollment_ids:enrollmentIds,examiner_ids:examinerIds});return {count};
   }
   if(action==='assignment-delete'){
    const b=z.object({id}).parse(body);const a=(await c.query('SELECT a.*,e.period_id FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id WHERE a.id=$1',[b.id])).rows[0];requireThat(a,'Plotting tidak ditemukan.',404);await getPeriod(c,a.period_id,['draft']);
    requireThat(!(await c.query('SELECT assignment_id FROM scores WHERE assignment_id=$1',[b.id])).rows.length,'Plotting yang sudah dinilai tidak dapat dihapus.');await c.query('DELETE FROM assignments WHERE id=$1',[b.id]);await audit(c,auth,'assignment.delete',b.id,a);return {ok:true};
   }
   if(action==='score-reopen'){
    const b=z.object({assignment_id:id,reason:z.string().trim().min(5).max(2000)}).parse(body);const a=(await c.query('SELECT a.*,e.period_id FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id WHERE a.id=$1',[b.assignment_id])).rows[0];requireThat(a,'Plotting tidak ditemukan.',404);await getPeriod(c,a.period_id,['open','closed']);
    const old=(await c.query('SELECT * FROM scores WHERE assignment_id=$1 FOR UPDATE',[a.id])).rows[0];requireThat(old?.status==='final','Nilai belum final.');await c.query("UPDATE scores SET status='draft',finalized_at=NULL,version=version+1,updated_at=now() WHERE assignment_id=$1",[a.id]);await audit(c,auth,'score.reopen',a.id,{reason:b.reason,before:old});return {ok:true};
   }
   throw new AppError('Rute tidak ditemukan.',404);
  });
  return response(result);
 }catch(error){
  if(error instanceof z.ZodError)return response({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')},400);
  if(error?.code==='23505')return response({error:'Data duplikat. Username, nomor peserta, atau nomor pendaftar sudah digunakan.'},409);
  if(error instanceof AppError)return response({error:error.message},error.status);
  console.error('API error',error?.code||error?.name,error?.message);
  return response({error:'Server belum siap atau terjadi kesalahan database. Periksa konfigurasi dan log Functions.'},500);
 }
};}
