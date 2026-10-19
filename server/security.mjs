import {scrypt as rawScrypt,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(rawScrypt);
export const hashToken=t=>createHash('sha256').update(t).digest('hex');
export const token=()=>randomBytes(32).toString('hex');
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');return `scrypt:${salt}:${(await scrypt(password,salt,64)).toString('hex')}`;}
export async function verifyPassword(password,stored){try{const [,salt,hash]=stored.split(':');const calculated=await scrypt(password,salt,64);const original=Buffer.from(hash,'hex');return original.length===calculated.length&&timingSafeEqual(original,calculated);}catch{return false;}}
export function cookie(request,value,maxAge){const secure=new URL(request.url).hostname!=='localhost'&&new URL(request.url).hostname!=='127.0.0.1';return `s3_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure?'; Secure':''}`;}
