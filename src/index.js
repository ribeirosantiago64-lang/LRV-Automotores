import {StorageError,storageDatabase,storageStatus,migrateCatalog,getCatalog,getVehicle,saveVehicle,archiveVehicle,servePhoto} from "./storage.js";

const enc = new TextEncoder();
const dec = new TextDecoder();
const COOKIE = "lrv_admin";
const MAX_TOTAL = 26_000_000;
const MAX_IMAGE = 5_000_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

const responseJson = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
});

const base64Url = (bytes) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
};

const bytesToBase64 = (bytes) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

const base64ToText = (value) => {
  const binary = atob(value.replaceAll("\n", ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return dec.decode(bytes);
};

const slugify = (value) => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);

const cleanText = (value, max = 300) => String(value || "").trim().slice(0, max);

async function sameSecret(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(String(a || ""))),
    crypto.subtle.digest("SHA-256", enc.encode(String(b || ""))),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value))));
}

async function makeSession(secret) {
  const payload = base64Url(enc.encode(JSON.stringify({ exp: Date.now() + 86_400_000, nonce: crypto.randomUUID() })));
  return `${payload}.${await sign(payload, secret)}`;
}

async function isAdmin(request, env) {
  const token = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`))?.[1];
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !(await sameSecret(signature, await sign(payload, env.SESSION_SECRET)))) return false;
  try {
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    return JSON.parse(base64ToText(padded)).exp > Date.now();
  } catch { return false; }
}

function secureCookie(value, maxAge = 86400) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function validateOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function validateVehicle(raw) {
  const v = {
    id: slugify(raw.id || `${raw.brand}-${raw.model}-${raw.year}`),
    brand: cleanText(raw.brand, 80), model: cleanText(raw.model, 100),
    year: Number(raw.year), price: Number(raw.price), condition: cleanText(raw.condition, 20),
    type: cleanText(raw.type, 20), km: Number(raw.km || 0), fuel: cleanText(raw.fuel, 50),
    transmission: cleanText(raw.transmission, 50), description: cleanText(raw.description, 3000),
    features: Array.isArray(raw.features) ? raw.features.map((x) => cleanText(x, 100)).filter(Boolean).slice(0, 40) : [],
    existingImages: Array.isArray(raw.existingImages) ? raw.existingImages.slice(0, 20) : [],
    revision: Number(raw.revision),
  };
  if (!v.id || !v.brand || !v.model || !Number.isInteger(v.year) || v.year < 1950 || v.year > 2100 || !Number.isFinite(v.price) || v.price < 0 || !v.description) throw new Error("Datos del vehículo incompletos o inválidos");
  if (!["0 km", "Usado"].includes(v.condition) || !["SUV", "Hatch", "Sedán"].includes(v.type)) throw new Error("Estado o tipo de vehículo inválido");
  return v;
}

async function github(env, path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}${path}`, {
    ...init,
    headers: {
      "accept": "application/vnd.github+json",
      "authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "LRV-Automotores-Worker",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500);
    throw new Error(`GitHub respondió ${res.status}: ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

async function repositoryState(env) {
  const ref = await github(env, `/git/ref/heads/${encodeURIComponent(env.GITHUB_BRANCH)}`);
  const commit = await github(env, `/git/commits/${ref.object.sha}`);
  const tree = await github(env, `/git/trees/${commit.tree.sha}?recursive=1`);
  return { head: ref.object.sha, baseTree: commit.tree.sha, entries: tree.tree || [] };
}

async function listLegacyVehicles(env) {
  const state = await repositoryState(env);
  const dataFiles = state.entries.filter((x) => x.type === "blob" && /^vehiculos\/[^/]+\/datos\.json$/.test(x.path));
  const vehicles = await Promise.all(dataFiles.map(async (entry) => {
    const blob = await github(env, `/git/blobs/${entry.sha}`);
    const vehicle = JSON.parse(base64ToText(blob.content));
    // Freeze image references to the same commit as the imported vehicle records.
    vehicle.images = (vehicle.images || []).map(value => {
      const url = new URL(value);
      const prefix = `/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH}/`;
      if (url.origin !== "https://raw.githubusercontent.com" || !url.pathname.startsWith(prefix)) throw new Error("Una foto anterior no pertenece al repositorio del catálogo.");
      return `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${state.head}/${url.pathname.slice(prefix.length)}`;
    });
    return vehicle;
  }));
  return vehicles.sort((a, b) => Number(b.year) - Number(a.year));
}

async function loadLegacyPhoto(env, value) {
  const url = new URL(value);
  const prefix = `/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/`;
  if (url.origin !== "https://raw.githubusercontent.com" || !url.pathname.startsWith(prefix)) throw new Error("Origen de foto anterior inválido.");
  const [ref, ...parts] = url.pathname.slice(prefix.length).split("/");
  const path = parts.join("/");
  if (!/^[a-f0-9]{40}$/.test(ref) || !/^vehiculos\/[a-z0-9-]{1,90}\/fotos\/[^/]+\.(?:jpg|jpeg|png|webp|avif)$/i.test(path)) throw new Error("Referencia de foto anterior inválida.");
  let file = await github(env, `/contents/${path}?ref=${ref}`);
  if (file.size > MAX_IMAGE) throw new Error("La foto anterior supera el tamaño permitido.");
  if(file.encoding!=="base64" && /^[a-f0-9]{40}$/.test(file.sha))file=await github(env,`/git/blobs/${file.sha}`);
  if(file.encoding!=="base64")throw new Error("No se pudo leer la foto anterior.");
  const content=file.content.replaceAll("\n","");
  if(typeof Uint8Array.fromBase64==="function")return Uint8Array.fromBase64(content);
  const binary=atob(content),bytes=new Uint8Array(binary.length);
  for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
  return bytes;
}

async function importCatalog(env) {
  await inquiriesDatabase(env);
  return migrateCatalog(env,listLegacyVehicles,loadLegacyPhoto,2);
}

async function listVehicles(env, ctx) {
  const catalog = await getCatalog(env,listLegacyVehicles);
  const status = await storageStatus(env);
  if (!status.ready && env.VEHICLE_PHOTOS && ctx?.waitUntil) {
    ctx.waitUntil(importCatalog(env).catch(error=>console.error(JSON.stringify({message:"catalog_import_pending",error:error.message}))));
  }
  return catalog;
}

async function inquiriesDatabase(env) {
  if (!env.INQUIRIES_DB) throw new Error("El historial todavía no está disponible. Intentá nuevamente más tarde.");
  await env.INQUIRIES_DB.prepare(`CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, vehicle_id TEXT NOT NULL,
    vehicle TEXT NOT NULL, price REAL NOT NULL, name TEXT NOT NULL,
    phone TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL,
    channel TEXT NOT NULL, ip_hash TEXT NOT NULL
  )`).run();
  await env.INQUIRIES_DB.prepare("CREATE INDEX IF NOT EXISTS inquiries_created ON inquiries(created_at DESC)").run();
  await env.INQUIRIES_DB.prepare("CREATE INDEX IF NOT EXISTS inquiries_rate ON inquiries(ip_hash, created_at)").run();
  return env.INQUIRIES_DB;
}

async function recordInquiry(request, env) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return responseJson({ error: "Origen no permitido" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return responseJson({ error: "Formato inválido" }, 415);
  // Enforce the real body limit, including chunked requests.
  const reader = request.body?.getReader();
  if (!reader) return responseJson({ error: "Faltan datos" }, 400);
  const bodyDecoder = new TextDecoder();
  let text = "", size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 12000) { await reader.cancel(); return responseJson({ error: "Solicitud demasiado extensa" }, 413); }
    text += bodyDecoder.decode(value, { stream: true });
  }
  text += bodyDecoder.decode();
  let raw;
  try { raw = JSON.parse(text); } catch { return responseJson({ error: "Datos inválidos" }, 400); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return responseJson({ error: "Datos inválidos" }, 400);
  if (raw.honeypot) return responseJson({ error: "Solicitud no permitida" }, 400);
  const name = cleanText(raw.name, 100), phone = cleanText(raw.phone, 30), email = cleanText(raw.email, 200), message = cleanText(raw.message, 1500);
  if (!name || !message || !/^[0-9]{9}$/.test(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-z0-9-]{1,90}$/.test(raw.vehicleId || "") || !/^[0-9a-f-]{36}$/.test(raw.id || "") || !["email", "whatsapp"].includes(raw.channel)) {
    return responseJson({ error: "Completá nombre, celular de 9 dígitos, correo válido y descripción." }, 400);
  }
  const db = await inquiriesDatabase(env);
  const ipHash = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`${env.SESSION_SECRET}:${request.headers.get("cf-connecting-ip") || "local"}`))));
  const existing = await db.prepare("SELECT id FROM inquiries WHERE id = ? AND ip_hash = ?").bind(raw.id, ipHash).first();
  if (existing) return responseJson({ ok: true, id: existing.id });
  const recent = await db.prepare("SELECT COUNT(*) AS count FROM inquiries WHERE ip_hash = ? AND created_at >= ?").bind(ipHash, new Date(Date.now() - 60000).toISOString()).first();
  if (Number(recent.count) >= 5) return responseJson({ error: "Esperá un minuto antes de enviar otra solicitud." }, 429);
  // Take the vehicle snapshot from the server, never from client-supplied prices.
  const vehicle = await getVehicle(env,raw.vehicleId,listLegacyVehicles);
  if (!vehicle) return responseJson({error:"El vehículo ya no está disponible."},404);
  await storageDatabase(env);
  const timestamp = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT INTO users (id,email,name,phone,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,phone=excluded.phone,updated_at=excluded.updated_at").bind(crypto.randomUUID(),email.toLowerCase(),name,phone,timestamp),
    db.prepare("INSERT INTO inquiries (id, created_at, vehicle_id, vehicle, price, name, phone, email, message, channel, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(raw.id,timestamp,raw.vehicleId,`${vehicle.brand} ${vehicle.model} ${vehicle.year}`,Number(vehicle.price),name,phone,email,message,raw.channel,ipHash)
  ]);
  return responseJson({ ok: true, id: raw.id }, 201);
}

async function analyticsDatabase(env) {
  const db = await inquiriesDatabase(env);
  await db.prepare(`CREATE TABLE IF NOT EXISTS vehicle_views (
    vehicle_id TEXT NOT NULL, visit_id TEXT NOT NULL, vehicle TEXT NOT NULL,
    created_at TEXT NOT NULL, PRIMARY KEY (vehicle_id, visit_id)
  )`).run();
  return db;
}

async function recordVehicleView(request, env) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return responseJson({ error: "Origen no permitido" }, 403);
  const url = new URL(request.url);
  const id = url.searchParams.get("vehicle"), visit = url.searchParams.get("visit");
  if (!/^[a-z0-9-]{1,90}$/.test(id || "") || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(visit || "")) return responseJson({ error: "Datos inválidos" }, 400);
  if (await isAdmin(request, env)) return responseJson({ ok: true });
  const db = await analyticsDatabase(env);
  const found = await db.prepare("SELECT 1 FROM vehicle_views WHERE vehicle_id = ? AND visit_id = ?").bind(id, visit).first();
  if (found) return responseJson({ ok: true });
  const vehicle = await getVehicle(env,id,listLegacyVehicles);
  if (!vehicle) return responseJson({error:"Vehículo no encontrado."},404);
  await db.prepare("INSERT OR IGNORE INTO vehicle_views (vehicle_id, visit_id, vehicle, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, visit, `${vehicle.brand} ${vehicle.model} ${vehicle.year}`, new Date().toISOString()).run();
  return responseJson({ ok: true }, 201);
}

async function vehicleStatistics(env, url) {
  const month = url.searchParams.get("month") || new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 7);
  if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month)) return responseJson({ error: "Seleccioná un mes válido." }, 400);
  // Calendar months in Uruguay (UTC-03:00), including midnight boundaries.
  const start = new Date(`${month}-01T00:00:00-03:00`);
  const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  const db = await analyticsDatabase(env);
  // Aggregate before joining so views and requests never multiply each other.
  const { results } = await db.prepare(`WITH views AS (
    SELECT vehicle_id, MAX(vehicle) AS vehicle, COUNT(*) AS views FROM vehicle_views WHERE created_at >= ? AND created_at < ? GROUP BY vehicle_id
  ), requests AS (
    SELECT vehicle_id, MAX(vehicle) AS vehicle, COUNT(*) AS requests,
      SUM(CASE WHEN channel = 'email' THEN 1 ELSE 0 END) AS email_requests,
      SUM(CASE WHEN channel = 'whatsapp' THEN 1 ELSE 0 END) AS whatsapp_requests
    FROM inquiries WHERE created_at >= ? AND created_at < ? GROUP BY vehicle_id
  ), ids AS (SELECT vehicle_id FROM views UNION SELECT vehicle_id FROM requests)
  SELECT ids.vehicle_id, COALESCE(requests.vehicle, views.vehicle) AS vehicle,
    COALESCE(views.views, 0) AS views, COALESCE(requests.requests, 0) AS requests,
    COALESCE(requests.email_requests, 0) AS email_requests,
    COALESCE(requests.whatsapp_requests, 0) AS whatsapp_requests
  FROM ids LEFT JOIN views USING (vehicle_id) LEFT JOIN requests USING (vehicle_id)
  ORDER BY requests DESC, views DESC, vehicle ASC`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).all();
  return responseJson({ month, items: results });
}

async function api(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname === "/api/vehicle-views" && request.method === "POST") return recordVehicleView(request, env);
  if (url.pathname === "/api/inquiries" && request.method === "POST") return recordInquiry(request, env);
  if (url.pathname === "/api/vehicles" && request.method === "GET") return responseJson(await listVehicles(env,ctx));
  if (url.pathname === "/api/login" && request.method === "POST") {
    if (!validateOrigin(request)) return responseJson({ error: "Origen no permitido" }, 403);
    const body = await request.json();
    if (!(await sameSecret(body.password, env.ADMIN_PASSWORD))) return responseJson({ error: "Contraseña incorrecta" }, 401);
    return responseJson({ ok: true }, 200, { "set-cookie": secureCookie(await makeSession(env.SESSION_SECRET)) });
  }
  if (url.pathname === "/api/logout" && request.method === "POST") return responseJson({ ok: true }, 200, { "set-cookie": secureCookie("", 0) });
  if (url.pathname === "/api/me" && request.method === "GET") return responseJson({ admin: await isAdmin(request, env) });
  if (!(await isAdmin(request, env))) return responseJson({ error: "No autorizado" }, 401);
  if (!validateOrigin(request)) return responseJson({ error: "Origen no permitido" }, 403);
  if (url.pathname === "/api/storage" && request.method === "GET") return responseJson(await storageStatus(env));
  if (url.pathname === "/api/storage/migrate" && request.method === "POST") return responseJson(await importCatalog(env));
  if (url.pathname === "/api/statistics" && request.method === "GET") return vehicleStatistics(env, url);
  if (url.pathname === "/api/inquiries" && request.method === "GET") {
    const db = await inquiriesDatabase(env);
    const offset = Math.max(0, Math.floor(Number(url.searchParams.get("offset")) || 0));
    const { results } = await db.prepare("SELECT id, created_at, vehicle_id, vehicle, price, name, phone, email, message, channel FROM inquiries ORDER BY created_at DESC, id DESC LIMIT 51 OFFSET ?").bind(offset).all();
    return responseJson({ items: results.slice(0, 50), hasMore: results.length > 50 });
  }
  if (url.pathname === "/api/vehicles" && request.method === "POST") {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > MAX_TOTAL) return responseJson({ error: "La carga completa supera 26 MB" }, 413);
    const contentType=request.headers.get("content-type") || "";
    if(!contentType.startsWith("multipart/form-data"))return responseJson({error:"Formato de carga inválido."},415);
    const reader=request.body?.getReader();
    if(!reader)return responseJson({error:"Faltan los datos del vehículo."},400);
    const chunks=[];let total=0;
    while(true){
      const {value,done}=await reader.read();if(done)break;
      total+=value.byteLength;
      if(total>MAX_TOTAL){await reader.cancel();return responseJson({error:"La carga completa supera 26 MB."},413);}
      chunks.push(value);
    }
    const bytes=new Uint8Array(total);let cursor=0;
    for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.length;}
    let form;
    try{form=await new Response(bytes,{headers:{"content-type":contentType}}).formData();}
    catch{return responseJson({error:"No se pudo leer el formulario del vehículo."},400);}
    const vehicle = validateVehicle(JSON.parse(String(form.get("vehicle") || "{}")));
    const files = form.getAll("photos");
    const uploadedBytes = files.reduce((total, file) => total + (file instanceof File ? file.size : 0), 0);
    if (uploadedBytes > 25_000_000) return responseJson({ error: "Las fotos superan 25 MB en total" }, 413);
    if (!files.length && !vehicle.existingImages.length) return responseJson({ error: "Agregá al menos una foto" }, 400);
    return responseJson(await saveVehicle(env, vehicle, files, cleanText(form.get("originalId"), 100)), 201);
  }
  if (url.pathname.startsWith("/api/vehicles/") && request.method === "DELETE") {
    await archiveVehicle(env,decodeURIComponent(url.pathname.split("/").pop()));
    return responseJson({ok:true});
  }
  return responseJson({ error: "Ruta no encontrada" }, 404);
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await api(request, env, ctx);
      if (url.pathname.startsWith("/media/")) return await servePhoto(request,env);
      return await env.ASSETS.fetch(request);
    } catch (error) {
      console.error(JSON.stringify({ message: "request_failed", error: error instanceof Error ? error.message : String(error) }));
      const message = error instanceof Error && !error.message.startsWith("GitHub respondió") ? error.message : "No se pudo completar la operación";
      return responseJson({ error: message }, error instanceof StorageError ? error.status : 500);
    }
  },
  async scheduled(controller,env,ctx) {
    ctx.waitUntil(importCatalog(env).catch(error=>console.error(JSON.stringify({message:"catalog_import_pending",error:error.message}))));
  },
};
