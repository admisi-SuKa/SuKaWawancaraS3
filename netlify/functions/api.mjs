import {database} from '../../server/db.mjs';
import {createApp} from '../../server/app.mjs';
export default async function handler(request){
 try{return await createApp(database())(request);}catch(error){console.error(error.message);return Response.json({error:'Database belum dikonfigurasi. Isi DATABASE_URL dan jalankan migrasi.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
