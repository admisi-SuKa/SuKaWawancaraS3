import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL belum diisi.');
mkdirSync('backups',{recursive:true,mode:0o700});
const filename=`backups/wawancara-${new Date().toISOString().replace(/[:.]/g,'-')}.dump`;
// URL is supplied through the child environment, never through arguments/logs.
const result=spawnSync('pg_dump',['--format=custom','--no-owner','--no-acl','--file',filename],{env:{...process.env,PGDATABASE:process.env.DATABASE_URL},stdio:['ignore','pipe','pipe']});
if(result.error?.code==='ENOENT')throw new Error('Install PostgreSQL client tools (pg_dump) terlebih dahulu.');
if(result.status!==0){console.error('Backup gagal. Periksa versi pg_dump, koneksi, dan izin database.');process.exit(1);}
console.log(`Backup selesai: ${filename}. Simpan salinannya di tempat terpisah dan uji pemulihan pada database uji.`);
