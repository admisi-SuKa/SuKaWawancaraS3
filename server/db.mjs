import pg from 'pg';
let pool;
export function database() {
 if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum diatur. Ikuti PANDUAN.md.');
 pool ||= new pg.Pool({connectionString:process.env.DATABASE_URL,max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:10000});
 return pool;
}
export async function transaction(db, fn) {
 const c = await db.connect();
 try { await c.query('BEGIN'); const result = await fn(c); await c.query('COMMIT'); return result; }
 catch(e){await c.query('ROLLBACK');throw e;} finally {c.release();}
}
