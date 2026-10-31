import examples from './showcase-data.js';
import {storageDatabase,putPhoto} from './storage.js';
// Fixed licensed sources. This import never overwrites a vehicle.
export async function seedShowcase(env){
 if(!env.VEHICLE_PHOTOS)return;
 const db=await storageDatabase(env);
 if(await db.prepare("SELECT 1 FROM storage_meta WHERE key='showcase_seed_v1'").first())return;
 if(!await db.prepare("SELECT 1 FROM storage_meta WHERE key='catalog_ready' AND value='1'").first())return;
 const owner=crypto.randomUUID(),now=Date.now();
 const lock=await db.prepare("INSERT INTO storage_jobs VALUES ('showcase',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,lease_until=excluded.lease_until WHERE storage_jobs.lease_until<? RETURNING owner").bind(owner,now+120000,now).first();
 if(lock?.owner!==owner)return;
 try{
  let imported=0;
  for(const example of examples){
   if(await db.prepare('SELECT 1 FROM vehicles WHERE id=?').bind(example.id).first())continue;
   if(imported>=2)break;
   const url=new URL(example.photoCredit.url);
   if(!['thumb.wikimedia.org','upload.wikimedia.org'].includes(url.hostname))throw new Error('Invalid showcase source');
   const response=await fetch(url,{headers:{'user-agent':'LRV-Automotores/1.0 (licensed reference image import)'}});
   if(!response.ok)throw new Error('Showcase image download failed: '+response.status);
   const reader=response.body.getReader(),chunks=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>5_000_000){await reader.cancel();throw new Error('Showcase image too large');}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
   const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
   const image=await putPhoto(env,example.id,bytes,digest),date=new Date().toISOString();
   await db.prepare('INSERT OR IGNORE INTO vehicles (id,data,created_at,updated_at) VALUES (?,?,?,?)').bind(example.id,JSON.stringify({...example,images:[image]}),date,date).run();imported++;
  }
  const {count}=await db.prepare("SELECT COUNT(*) AS count FROM vehicles WHERE id IN ('demo-nissan-kicks','demo-suzuki-swift','demo-renault-kwid','demo-hyundai-hb20','demo-ford-ranger','demo-honda-fit')").first();
  if(count===examples.length)await db.prepare("INSERT OR REPLACE INTO storage_meta VALUES ('showcase_seed_v1','1')").run();
 }finally{await db.prepare("UPDATE storage_jobs SET lease_until=0 WHERE name='showcase' AND owner=?").bind(owner).run();}
}
