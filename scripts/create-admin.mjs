import {randomUUID} from 'node:crypto';
import {database} from '../server/db.mjs';
import {hashPassword} from '../server/security.mjs';
const username=(process.env.ADMIN_USERNAME||'').trim().toLowerCase(),name=(process.env.ADMIN_NAME||'Administrator Admisi').trim(),password=process.env.ADMIN_PASSWORD||'';
if(!/^[a-z0-9._-]{3,80}$/.test(username)||password.length<12)throw new Error('Isi ADMIN_USERNAME (3–80 karakter), ADMIN_NAME, dan ADMIN_PASSWORD (minimal 12 karakter) di .env.');
const db=database();
try{
 const r=await db.query('INSERT INTO users(id,username,name,role,password_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT(username) DO NOTHING RETURNING id',[randomUUID(),username,name,'admin',await hashPassword(password)]);
 console.log(r.rowCount?'Admin berhasil dibuat. Login memakai ADMIN_USERNAME dan ADMIN_PASSWORD Anda, lalu ganti password awal.':'Username sudah ada. Akun/password tidak diubah; reset melalui admin lain.');
}finally{await db.end();}
