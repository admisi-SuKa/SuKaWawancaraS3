import {randomUUID} from 'node:crypto';
import {database,transaction} from '../server/db.mjs';
import {hashPassword} from '../server/security.mjs';
const username=(process.env.RESET_USERNAME||'').trim().toLowerCase(),password=process.env.RESET_PASSWORD||'';
if(!username||password.length<12)throw new Error('Isi RESET_USERNAME dan RESET_PASSWORD (minimal 12 karakter) dalam .env lokal.');
const db=database();
try{await transaction(db,async c=>{
 const u=(await c.query('SELECT id FROM users WHERE username=$1',[username])).rows[0];if(!u)throw new Error('Username tidak ditemukan.');
 await c.query('UPDATE users SET password_hash=$1,must_change=true WHERE id=$2',[await hashPassword(password),u.id]);
 await c.query('DELETE FROM auth_sessions WHERE user_id=$1',[u.id]);
 await c.query('INSERT INTO audit_logs(id,action,entity_id,detail) VALUES($1,$2,$3,$4)',[randomUUID(),'user.password-reset-cli',u.id,JSON.stringify({username,method:'local-admin-script'})]);
 });console.log('Password direset dan sesi dicabut. Pengguna wajib mengganti password saat login. Hapus RESET_PASSWORD dari .env setelah selesai.');
}finally{await db.end();}
