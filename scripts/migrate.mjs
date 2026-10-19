import {readFile} from 'node:fs/promises';
import {database} from '../server/db.mjs';
const db=database();
try{await db.query(await readFile(new URL('../sql/001_initial.sql',import.meta.url),'utf8'));console.log('Database siap. Migrasi 001 berhasil; tidak mengimpor data lama.');}finally{await db.end();}
