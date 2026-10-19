import React,{useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,FileText,Search,FolderOpen,RefreshCw} from 'lucide-react';
import {api} from './api';
type Row=Record<string,any>;
const groups=[
 {id:'identity',title:'Identitas & kontak',keys:['nama_lengkap','nomor_pendaftar','nomor_peserta','email','tgl_lahir','jenis_kelamin','nama_agama','nik','telp','nohp','difabel']},
 {id:'address',title:'Alamat & kewarganegaraan',keys:['alamat_lengkap','alamat_asal','provinsi_asal','kabupaten_asal','kode_pos_asal','negara_asal','ext_sertifikat_wna']},
 {id:'family',title:'Data keluarga',keys:['nama_lengkap_ibu','nama_lengkap_ayah','nohp_ibu','nohp_ayah','telp_ibu','telp_ayah','gaji_ayah','gaji_ibu','kartu_keluarga','keterangan_pengasilan_ayah','keterangan_pengasilan_ibu']},
 {id:'school',title:'Riwayat sekolah',keys:['npsn','jenjang_sekolah','nama_sekolah','jurusan_sekolah','tahun_masuk','tahun_lulus','nisn','nomor_ijazah','nilai_uan','nilai_sttb']},
 {id:'academic',title:'Pendidikan tinggi & bahasa',keys:['ijazah_s1','jenis_univ','nama_pt','tahun_ijazah','ipk','akreditasi_universitas','akreditasi_jurusan','asal_jurusan','ijazah_pasca','transkrip_pasca','nilai_toefl','nilai_toafl','sertifikat_toefl','sertifikat_toafl','sertifikat_pendukung']},
 {id:'research',title:'Penelitian, tesis & proposal disertasi',keys:['judul_penelitian','tahun_penelitian','sponsor_penelitian','rekomendasi_penelitian','judul_tesis','rekomendasi_tesis','file_tesis','judul_disertasi','file_disertasi','id_karya_tulis']},
 {id:'achievements',title:'Kegiatan, organisasi & prestasi',keys:['nama_kegiatan','sertifikat_kegiatan','id_organisasi','id_riwayat_pesantren','kategori_prestasi','id_prestasi','id_nilai_pendidikan_formal','data_khusus']},
 {id:'registration',title:'Pendaftaran, pilihan & jadwal sumber',keys:['jalur_masuk','kelas','lokasi_ujian','name_gedung','name_ruang','tanggal_ujian','pilihan','pilihan_1','pilihan_2','pilihan_3','pilihan_4']}
];
const names:Record<string,string>={nomor_pendaftar:'Nomor pendaftar',nomor_peserta:'Nomor peserta',nama_lengkap:'Nama lengkap',tgl_lahir:'Tanggal lahir',telp:'Telepon',nohp:'Nomor HP',nama_agama:'Agama',nik:'NIK / identitas',jenis_kelamin:'Jenis kelamin',nama_lengkap_ibu:'Nama ibu',nama_lengkap_ayah:'Nama ayah',nohp_ibu:'Nomor HP ibu',nohp_ayah:'Nomor HP ayah',telp_ibu:'Telepon ibu',telp_ayah:'Telepon ayah',gaji_ayah:'Penghasilan ayah',gaji_ibu:'Penghasilan ibu',keterangan_pengasilan_ayah:'Keterangan penghasilan ayah',keterangan_pengasilan_ibu:'Keterangan penghasilan ibu',nama_pt:'Nama perguruan tinggi',asal_jurusan:'Program studi asal',jenis_univ:'Jenis perguruan tinggi',tahun_ijazah:'Tahun ijazah',ipk:'IPK',nilai_toefl:'TOEFL dari pendaftaran',nilai_toafl:'TOAFL dari pendaftaran',sertifikat_toefl:'Sertifikat TOEFL',sertifikat_toafl:'Sertifikat TOAFL',ijazah_s1:'Ijazah S1',ijazah_pasca:'Ijazah pascasarjana',transkrip_pasca:'Transkrip pascasarjana',id_karya_tulis:'Daftar karya tulis',id_organisasi:'Riwayat organisasi',id_riwayat_pesantren:'Riwayat pesantren',id_prestasi:'Daftar prestasi',id_nilai_pendidikan_formal:'Nilai pendidikan formal',data_khusus:'Data khusus / dokumen tambahan',name_gedung:'Nama gedung',name_ruang:'Nama ruang',ext_sertifikat_wna:'Dokumen WNA',npsn:'NPSN',nisn:'NISN'};
function caption(key:string){return names[key]||key.split('_').map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(' ');}
function links(text:string){return [...text.matchAll(/https?:\/\/[^\s<>"，,]+/gu)].map(m=>({url:m[0].replace(/[).;]+$/,''),index:m.index!})).filter(m=>{try{const u=new URL(m.url);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}});}
function FieldValue({value}:{value:string}){
 if(!value)return <span className="source-empty">Tidak diisi pada sumber</span>;
 const urls=links(value);if(!urls.length)return <span>{value}</span>;
 const parts:React.ReactNode[]=[];let start=0;
 for(const m of urls){parts.push(value.slice(start,m.index));parts.push(<a key={m.index} href={m.url} target="_blank" rel="noreferrer">{m.url}<ArrowUpRight size={12}/></a>);start=m.index+m.url.length;}parts.push(value.slice(start));return <span>{parts}</span>;
}
export function Profile({item}:{item:Row}){
 const[loaded,setLoaded]=useState<Row|null>(item.id?null:item),[error,setError]=useState(''),[query,setQuery]=useState(''),[showEmpty,setShowEmpty]=useState(true),[expanded,setExpanded]=useState<Set<string>>(new Set(['identity','academic','research'])),[view,setView]=useState('grouped'),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setError('');if(!item.id){setLoaded(item);return;}setLoaded(null);api('participant?id='+encodeURIComponent(item.id)).then(r=>{if(active)setLoaded(r);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[item.id,item.profile,retry]);
 const p=loaded?.profile||{};
 const source:Record<string,string>=useMemo(()=>{
  const isSource=p.source_data&&typeof p.source_data==='object';
  const values=isSource?p.source_data:p;
  const keys=isSource&&Array.isArray(p.source_columns)?p.source_columns:Object.keys(values).filter(k=>!['source_data','source_columns','import_schema','source_column_count'].includes(k));
  return Object.fromEntries(keys.map((k:string)=>[k,values[k]===null||values[k]===undefined?'':String(values[k])]));
 },[loaded]);
 const entries=Object.entries(source),q=query.trim().toLowerCase();
 const visible=entries.filter(([k,v])=>(showEmpty||v!=='')&&(!q||`${caption(k)} ${k} ${v}`.toLowerCase().includes(q)));
 const match=new Set(visible.map(([key])=>key));
 const known=new Set(groups.flatMap(g=>g.keys));
 const sections=[...groups,{id:'other',title:'Kolom tambahan dari sumber',keys:entries.map(([key])=>key).filter(key=>!known.has(key))}].map(g=>({...g,keys:g.keys.filter(k=>match.has(k))})).filter(g=>g.keys.length);
 const documents=new Map<string,string>();for(const [key,value] of entries)for(const link of links(value))if(!documents.has(link.url))documents.set(link.url,caption(key));
 if(error)return <div className="notice error" role="alert">{error}<button className="btn white" onClick={()=>setRetry(retry+1)}><RefreshCw size={15}/>Coba lagi</button></div>;
 if(!loaded)return <div className="profile-loading">Memuat seluruh data peserta…</div>;
 const full=p.import_schema===2&&p.source_data;
 const renderFields=(keys:string[])=><dl className="full-profile-grid">{keys.map(key=><div className={source[key].length>150||links(source[key]).length?'long-field':''} key={key}><dt>{caption(key)}<code>{key}</code></dt><dd><FieldValue value={source[key]}/></dd></div>)}</dl>;
 return <section className="full-profile">
  <div className="profile-heading"><span className="avatar big">{loaded.name?.[0]||'P'}</span><div><h2>{loaded.name}</h2><p>{loaded.participant_number} · {loaded.applicant_number}</p><span className="badge draft">{loaded.program}</span><small className="profile-faculty">{loaded.faculty||''}</small></div></div>
  <div className="profile-data-summary"><div><strong>{entries.length}</strong><span>kolom sumber</span></div><div><strong>{entries.filter(([,v])=>v!=='').length}</strong><span>kolom terisi</span></div><div><strong>{documents.size}</strong><span>tautan dokumen</span></div></div>
  {!full&&<div className="notice">Data ini diimpor dengan versi sebelumnya. Admin perlu mengunggah ulang ekspor lengkap untuk melengkapi seluruh kolom. Data yang tersedia tetap dapat dibaca.</div>}
  {source.judul_disertasi&&<div className="proposal-title"><small>JUDUL USULAN DISERTASI</small><h3>{source.judul_disertasi}</h3></div>}
  {documents.size>0&&<details className="profile-documents"><summary><FolderOpen size={17}/>Dokumen & tautan pendukung <span>{documents.size}</span></summary><div className="document-grid">{[...documents].map(([url,title],i)=><a href={url} key={url} target="_blank" rel="noreferrer"><FileText size={18}/><span>{title}<small>Dokumen {i+1}</small></span><ArrowUpRight size={15}/></a>)}</div><small className="muted">Tautan dibuka di tab baru. Akses berkas mengikuti izin sistem pendaftaran sumber.</small></details>}
  <div className="profile-controls"><label className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari kolom atau isi data…" aria-label="Cari profil lengkap"/></label><label className="check-label"><input type="checkbox" checked={showEmpty} onChange={e=>setShowEmpty(e.target.checked)}/>Tampilkan kolom kosong</label></div>
  <div className="profile-view-controls"><div className="button-row"><button className={'btn small '+(view==='grouped'?'primary':'white')} onClick={()=>setView('grouped')}>Per kelompok</button><button className={'btn small '+(view==='source'?'primary':'white')} onClick={()=>setView('source')}>Urutan kolom sumber</button></div>{view==='grouped'&&<div className="button-row"><button className="btn subtle small" onClick={()=>setExpanded(new Set(sections.map(g=>g.id)))}>Buka semua</button><button className="btn subtle small" onClick={()=>setExpanded(new Set())}>Tutup semua</button></div>}</div>
  <p className="profile-visible-count">Menampilkan {visible.length} dari {entries.length} kolom. Nilai kosong tetap dipertahankan sesuai berkas sumber.</p>
  {view==='source'?renderFields(visible.map(([k])=>k)):sections.map(g=><details className="profile-section" key={g.id} open={!!q||expanded.has(g.id)}><summary onClick={event=>{event.preventDefault();const next=new Set(expanded);if(next.has(g.id))next.delete(g.id);else next.add(g.id);setExpanded(next);}}><span>{g.title}</span><small>{g.keys.length} kolom</small><span className="profile-chevron">⌄</span></summary>{renderFields(g.keys)}</details>)}
  {visible.length===0&&<div className="empty"><h3>Tidak ada data yang cocok</h3><p>Ubah kata pencarian atau tampilkan kolom kosong.</p></div>}
 </section>;
}
