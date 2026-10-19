import {createServer} from 'node:http';
import {createServer as createViteServer} from 'vite';
import handler from '../netlify/functions/api.mjs';
const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});
createServer(async(req,res)=>{
 if(req.url.startsWith('/api/')){
  try{
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4_000_000){res.writeHead(413);res.end('Data terlalu besar');return;}chunks.push(chunk);}
   const request=new Request(`http://localhost:8888${req.url}`,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
   const result=await handler(request);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
  }catch(e){console.error(e);res.writeHead(500);res.end('Server error');}
 }else vite.middlewares(req,res,()=>{res.writeHead(404);res.end();});
}).listen(8888,()=>console.log('Aplikasi lokal: http://localhost:8888 (gunakan hostname ini sesuai APP_ORIGIN)'));
