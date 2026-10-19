export let csrf='';
export function setCSRF(value:string){csrf=value;}
export async function api(action:string,body?:unknown){
 const r=await fetch(`/api/${action}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});
 let result;try{result=await r.json();}catch{throw new Error('API tidak dapat dihubungi. Jalankan npm run dev atau deploy melalui Netlify.');}
 if(!r.ok)throw Object.assign(new Error(result.error||'Permintaan gagal.'),{status:r.status});
 if(result.csrf)setCSRF(result.csrf);return result;
}
export function csvDownload(filename:string,rows:Record<string,unknown>[]){
 if(!rows.length)return;
 const keys=Object.keys(rows[0]);const cell=(v:unknown)=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const csv='\uFEFF'+[keys,...rows.map(r=>keys.map(k=>r[k]))].map(row=>row.map(cell).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}
