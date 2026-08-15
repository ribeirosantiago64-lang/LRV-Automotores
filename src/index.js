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
    existingImages: Array.isArray(raw.existingImages) ? raw.existingImages.filter((x) => /^https:\/\/(raw\.githubusercontent\.com|github\.com)\//.test(String(x))).slice(0, 20) : [],
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

async function createBlob(env, content, encoding = "utf-8") {
  const blob = await github(env, "/git/blobs", { method: "POST", body: JSON.stringify({ content, encoding }), headers: { "content-type": "application/json" } });
  return blob.sha;
}

async function commitTree(env, state, tree, message) {
  const madeTree = await github(env, "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: state.baseTree, tree }), headers: { "content-type": "application/json" } });
  const commit = await github(env, "/git/commits", { method: "POST", body: JSON.stringify({ message, tree: madeTree.sha, parents: [state.head] }), headers: { "content-type": "application/json" } });
  await github(env, `/git/refs/heads/${encodeURIComponent(env.GITHUB_BRANCH)}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }), headers: { "content-type": "application/json" } });
  return commit.sha;
}

async function listVehicles(env) {
  const state = await repositoryState(env);
  const dataFiles = state.entries.filter((x) => x.type === "blob" && /^vehiculos\/[^/]+\/datos\.json$/.test(x.path));
  const vehicles = await Promise.all(dataFiles.map(async (entry) => {
    const blob = await github(env, `/git/blobs/${entry.sha}`);
    return JSON.parse(base64ToText(blob.content));
  }));
  return vehicles.sort((a, b) => Number(b.year) - Number(a.year));
}

async function storeVehicle(env, vehicle, files, originalId) {
  const state = await repositoryState(env);
  const id = vehicle.id;
  const prefix = `vehiculos/${id}/`;
  if (!originalId && state.entries.some((x) => x.path === `${prefix}datos.json`)) throw new Error("Ya existe un vehículo con esa marca, modelo y año");
  const oldPrefix = originalId ? `vehiculos/${slugify(originalId)}/` : prefix;
  const tree = state.entries.filter((x) => x.path.startsWith(oldPrefix)).map((x) => ({ path: x.path, mode: "100644", type: "blob", sha: null }));
  const imageUrls = [...vehicle.existingImages];
  let imageNumber = 1;
  for (const file of files) {
    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_IMAGE) throw new Error("Cada foto debe ser JPG, PNG, WebP o AVIF y pesar menos de 5 MB");
    const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" })[file.type];
    const path = `${prefix}fotos/foto-${String(imageNumber++).padStart(2, "0")}.${extension}`;
    const sha = await createBlob(env, bytesToBase64(new Uint8Array(await file.arrayBuffer())), "base64");
    tree.push({ path, mode: "100644", type: "blob", sha });
    imageUrls.push(`https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH}/${path}`);
  }
  const saved = { ...vehicle, images: imageUrls, updatedAt: new Date().toISOString() };
  delete saved.existingImages;
  const dataSha = await createBlob(env, JSON.stringify(saved, null, 2));
  tree.push({ path: `${prefix}datos.json`, mode: "100644", type: "blob", sha: dataSha });
  const commit = await commitTree(env, state, tree, `${originalId ? "Actualizar" : "Agregar"} ${vehicle.brand} ${vehicle.model} ${vehicle.year}`);
  return { vehicle: saved, commit };
}

async function deleteVehicle(env, id) {
  const state = await repositoryState(env);
  const prefix = `vehiculos/${slugify(id)}/`;
  const targets = state.entries.filter((x) => x.path.startsWith(prefix) && x.type === "blob");
  if (!targets.length) throw new Error("Vehículo no encontrado");
  const tree = targets.map((x) => ({ path: x.path, mode: "100644", type: "blob", sha: null }));
  return commitTree(env, state, tree, `Eliminar vehículo ${id}`);
}

async function api(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/api/vehicles" && request.method === "GET") return responseJson(await listVehicles(env));
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
  if (url.pathname === "/api/vehicles" && request.method === "POST") {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > MAX_TOTAL) return responseJson({ error: "La carga completa supera 26 MB" }, 413);
    const form = await request.formData();
    const vehicle = validateVehicle(JSON.parse(String(form.get("vehicle") || "{}")));
    const files = form.getAll("photos");
    if (!files.length && !vehicle.existingImages.length) return responseJson({ error: "Agregá al menos una foto" }, 400);
    return responseJson(await storeVehicle(env, vehicle, files, cleanText(form.get("originalId"), 100)), 201);
  }
  if (url.pathname.startsWith("/api/vehicles/") && request.method === "DELETE") {
    return responseJson({ ok: true, commit: await deleteVehicle(env, decodeURIComponent(url.pathname.split("/").pop())) });
  }
  return responseJson({ error: "Ruta no encontrada" }, 404);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await api(request, env);
      return await env.ASSETS.fetch(request);
    } catch (error) {
      console.error(JSON.stringify({ message: "request_failed", error: error instanceof Error ? error.message : String(error) }));
      const message = error instanceof Error && !error.message.startsWith("GitHub respondió") ? error.message : "No se pudo completar la operación";
      return responseJson({ error: message }, 500);
    }
  },
};
