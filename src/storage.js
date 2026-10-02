const TYPES = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/avif":"avif"};
const MEDIA = /^\/media\/vehicles\/[a-z0-9-]{1,90}\/(?:[a-f0-9]{64}|[a-f0-9-]{36})\.(?:jpg|png|webp|avif)$/;
export const validPhotoUrl = value => typeof value === "string" && MEDIA.test(value);
export class StorageError extends Error {
  constructor(message, status = 503) { super(message); this.status = status; }
}

export async function storageDatabase(env) {
  if (!env.INQUIRIES_DB) throw new StorageError("La base de datos todavía no está conectada.");
  const db = env.INQUIRIES_DB;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS vehicles (id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS storage_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS storage_jobs (name TEXT PRIMARY KEY, owner TEXT NOT NULL, lease_until INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT NOT NULL, updated_at TEXT NOT NULL)")
  ]);
  return db;
}

async function ready(db) {
  return !!(await db.prepare("SELECT 1 FROM storage_meta WHERE key='catalog_ready' AND value='1'").first());
}

export async function storageStatus(env) {
  const db = await storageDatabase(env);
  const complete = await ready(db);
  const count = await db.prepare("SELECT COUNT(*) AS count FROM vehicles").first();
  const error = await db.prepare("SELECT value FROM storage_meta WHERE key='import_error'").first();
  return {ready:complete,photosConnected:!!env.VEHICLE_PHOTOS,imported:Number(count.count),error:complete?null:error?.value || null};
}

async function manifest(db, env, loadLegacy) {
  let row = await db.prepare("SELECT value FROM storage_meta WHERE key='import_manifest'").first();
  if (!row) {
    const source = await loadLegacy(env);
    if (!Array.isArray(source)) throw new StorageError("No se pudo leer el catálogo anterior.");
    await db.prepare("INSERT OR IGNORE INTO storage_meta (key,value) VALUES ('import_manifest',?)").bind(JSON.stringify(source)).run();
    row = await db.prepare("SELECT value FROM storage_meta WHERE key='import_manifest'").first();
  }
  return JSON.parse(row.value);
}

export function imageType(bytes) {
  const ascii = (start,end) => String.fromCharCode(...bytes.subarray(start,end));
  if (bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return "image/jpeg";
  if (bytes.length>=8 && [...bytes.subarray(0,8)].join(",")==="137,80,78,71,13,10,26,10") return "image/png";
  if (bytes.length>=12 && ascii(0,4)==="RIFF" && ascii(8,12)==="WEBP") return "image/webp";
  if (bytes.length>=16 && ascii(4,8)==="ftyp" && /avif|avis/.test(ascii(8,Math.min(bytes.length,64)))) return "image/avif";
  throw new StorageError("La foto no es una imagen JPG, PNG, WebP o AVIF válida.",400);
}

async function putPhoto(env,id,bytes,keyPart) {
  if (bytes.length>5_000_000) throw new StorageError("Cada foto debe pesar menos de 5 MB.",400);
  const type = imageType(bytes);
  const key = `vehicles/${id}/${keyPart}.${TYPES[type]}`;
  await env.VEHICLE_PHOTOS.put(key,bytes,{httpMetadata:{contentType:type,cacheControl:"public, max-age=31536000, immutable"}});
  return "/media/" + key;
}

// Import is additive and resumable. GitHub is read only; never delete the source backup.
export async function migrateCatalog(env,loadLegacy,loadPhoto,limit=2) {
  const db = await storageDatabase(env);
  if (await ready(db)) return storageStatus(env);
  if (!env.VEHICLE_PHOTOS) throw new StorageError("Falta conectar el almacenamiento de fotos en Cloudflare R2.");
  const owner = crypto.randomUUID(), now=Date.now();
  const lease=await db.prepare("INSERT INTO storage_jobs (name,owner,lease_until) VALUES ('catalog',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,lease_until=excluded.lease_until WHERE storage_jobs.lease_until < ? RETURNING owner").bind(owner,now+120000,now).first();
  if (!lease || lease.owner!==owner) return storageStatus(env);
  try {
    const source=await manifest(db,env,loadLegacy);
    let imported=0;
    for (const vehicle of source) {
      if (await db.prepare("SELECT 1 FROM vehicles WHERE id=?").bind(vehicle.id).first()) continue;
      if (imported>=limit) break;
      if (!/^[a-z0-9-]{1,90}$/.test(vehicle.id) || !Array.isArray(vehicle.images) || !vehicle.images.length) throw new StorageError("Hay un vehículo anterior con datos o fotos incompletos.");
      const images=[];
      for (const url of vehicle.images) {
        const bytes=await loadPhoto(env,url);
        const digest=[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(byte=>byte.toString(16).padStart(2,"0")).join("");
        images.push(await putPhoto(env,vehicle.id,bytes,digest));
      }
      const timestamp=new Date().toISOString();
      const saved={...vehicle,images}; delete saved.existingImages;
      await db.prepare("INSERT OR IGNORE INTO vehicles (id,data,created_at,updated_at) VALUES (?,?,?,?)").bind(vehicle.id,JSON.stringify(saved),timestamp,vehicle.updatedAt || timestamp).run();
      imported++;
    }
    const count=await db.prepare("SELECT COUNT(*) AS count FROM vehicles").first();
    if (Number(count.count)===source.length) {
      // Keep existing inquiries intact and derive the contact list from their latest entries.
      await db.batch([
        db.prepare("INSERT OR IGNORE INTO users (id,email,name,phone,updated_at) SELECT id,lower(email),name,phone,created_at FROM inquiries ORDER BY created_at DESC,id DESC"),
        db.prepare("INSERT OR REPLACE INTO storage_meta (key,value) VALUES ('catalog_ready','1')")
      ]);
    }
    await db.prepare("DELETE FROM storage_meta WHERE key='import_error'").run();
    return storageStatus(env);
  } catch(error) {
    await db.prepare("INSERT OR REPLACE INTO storage_meta (key,value) VALUES ('import_error',?)").bind("No se completó la importación. El catálogo anterior sigue disponible.").run();
    throw error;
  } finally {
    await db.prepare("UPDATE storage_jobs SET lease_until=0 WHERE name='catalog' AND owner=?").bind(owner).run();
  }
}

export async function getCatalog(env,loadLegacy) {
  const db=await storageDatabase(env);
  if (!(await ready(db))) return manifest(db,env,loadLegacy);
  const {results}=await db.prepare("SELECT data,version FROM vehicles WHERE active=1 ORDER BY json_extract(data,'$.year') DESC,id ASC").all();
  return results.map(row=>({...JSON.parse(row.data),revision:Number(row.version)}));
}

export async function getVehicle(env,id,loadLegacy) {
  const db=await storageDatabase(env);
  if (!(await ready(db))) return (await manifest(db,env,loadLegacy)).find(vehicle=>vehicle.id===id) || null;
  const row=await db.prepare("SELECT data,version FROM vehicles WHERE id=? AND active=1").bind(id).first();
  return row?{...JSON.parse(row.data),revision:Number(row.version)}:null;
}

async function writableDatabase(env) {
  const db=await storageDatabase(env);
  if (!env.VEHICLE_PHOTOS || !(await ready(db))) throw new StorageError("La migración del catálogo todavía no terminó. Los vehículos actuales siguen disponibles; intentá guardar más tarde.");
  return db;
}

export async function saveVehicle(env,vehicle,files,originalId) {
  const db=await writableDatabase(env);
  if (originalId && originalId!==vehicle.id) throw new StorageError("La referencia del vehículo no se puede cambiar.",400);
  const row=await db.prepare("SELECT data,version,active FROM vehicles WHERE id=?").bind(vehicle.id).first();
  if (!originalId && row) throw new StorageError("Ya existe un vehículo con esa referencia.",409);
  if (originalId && (!row || !row.active)) throw new StorageError("Vehículo no encontrado.",404);
  if (originalId && Number(vehicle.revision)!==Number(row.version)) throw new StorageError("El vehículo cambió desde que lo abriste. Actualizá el catálogo antes de editarlo.",409);
  const existing=originalId?JSON.parse(row.data).images:[];
  if (vehicle.existingImages.some(url=>!existing.includes(url) || !validPhotoUrl(url))) throw new StorageError("Una de las fotos no pertenece a este vehículo.",400);
  if (files.length+vehicle.existingImages.length>20) throw new StorageError("Podés guardar hasta 20 fotos por vehículo.",400);
  const buffers=[];
  for(const file of files) {
    if (!(file instanceof File) || !TYPES[file.type] || file.size>5_000_000) throw new StorageError("Cada foto debe ser JPG, PNG, WebP o AVIF y pesar menos de 5 MB.",400);
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(imageType(bytes)!==file.type) throw new StorageError("El contenido de la foto no coincide con su formato.",400);
    buffers.push(bytes);
  }
  const uploaded=[];
  try {
    for(const bytes of buffers) uploaded.push(await putPhoto(env,vehicle.id,bytes,crypto.randomUUID()));
    const timestamp=new Date().toISOString(),saved={...vehicle,images:[...vehicle.existingImages,...uploaded],updatedAt:timestamp};
    delete saved.existingImages;delete saved.revision;
    if(originalId) {
      const changed=await db.prepare("UPDATE vehicles SET data=?,version=version+1,updated_at=? WHERE id=? AND version=? AND active=1").bind(JSON.stringify(saved),timestamp,vehicle.id,Number(vehicle.revision)).run();
      if(!changed.meta.changes) throw new StorageError("El vehículo cambió mientras lo guardabas. Actualizá el catálogo.",409);
    } else {
      try {await db.prepare("INSERT INTO vehicles (id,data,created_at,updated_at) VALUES (?,?,?,?)").bind(vehicle.id,JSON.stringify(saved),timestamp,timestamp).run();}
      catch(error){if(/UNIQUE|PRIMARY KEY/.test(error.message))throw new StorageError("Ya existe un vehículo con esa referencia.",409);throw error;}
    }
    return {vehicle:{...saved,revision:originalId?Number(row.version)+1:1}};
  }catch(error){
    await Promise.allSettled(uploaded.map(url=>env.VEHICLE_PHOTOS.delete(url.slice("/media/".length))));
    throw error;
  }
}

export async function archiveVehicle(env,id) {
  const db=await writableDatabase(env);
  const result=await db.prepare("UPDATE vehicles SET active=0,version=version+1,updated_at=? WHERE id=? AND active=1").bind(new Date().toISOString(),id).run();
  if(!result.meta.changes)throw new StorageError("Vehículo no encontrado.",404);
  // Retain photos and prior requests so archiving never destroys history.
}

export async function servePhoto(request,env) {
  const path=new URL(request.url).pathname;
  if(!validPhotoUrl(path))return new Response("Foto no encontrada",{status:404});
  if(!["GET","HEAD"].includes(request.method))return new Response("Método no permitido",{status:405,headers:{Allow:"GET, HEAD"}});
  if(!env.VEHICLE_PHOTOS)return new Response("Fotos no disponibles",{status:503});
  const key=path.slice("/media/".length);
  const photo=await env.VEHICLE_PHOTOS[request.method==="HEAD"?"head":"get"](key);
  if(!photo)return new Response("Foto no encontrada",{status:404});
  const headers=new Headers({"cache-control":"public, max-age=31536000, immutable","x-content-type-options":"nosniff"});
  photo.writeHttpMetadata(headers);headers.set("etag",photo.httpEtag);headers.set("content-length",String(photo.size));
  if(request.headers.get("if-none-match")?.split(",").map(value=>value.trim()).includes(photo.httpEtag))return new Response(null,{status:304,headers});
  return new Response(request.method==="HEAD"?null:photo.body,{headers});
}
