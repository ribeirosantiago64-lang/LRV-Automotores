const WHATSAPP="59897135114";
let vehicles=[];
const $=(s)=>document.querySelector(s);
const money=(n)=>`USD ${Number(n).toLocaleString("es-UY")}`;
async function api(url,options={}){const r=await fetch(url,options);const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"No se pudo completar la operación");return data}
function filtered(){let list=[...vehicles],q=$("#search").value.toLowerCase(),c=$("#condition").value,t=$("#type").value,s=$("#sort").value;list=list.filter(v=>(`${v.brand} ${v.model} ${v.year}`.toLowerCase().includes(q))&&(!c||v.condition===c)&&(!t||v.type===t));if(s==="price-desc")list.sort((a,b)=>b.price-a.price);if(s==="price-asc")list.sort((a,b)=>a.price-b.price);if(s==="year-desc")list.sort((a,b)=>b.year-a.year);return list}
function render(){const list=filtered();$("#resultCount").textContent=`${list.length} vehículo${list.length===1?"":"s"}`;$("#vehicleGrid").innerHTML=list.map(v=>`<article class="vehicle-card" data-id="${v.id}"><img src="${v.images?.[0]||""}" alt="${v.brand} ${v.model}" loading="lazy"><div class="card-body"><div class="badges"><span class="badge red">${v.condition}</span><span class="badge">${v.type}</span></div><h3>${v.brand} ${v.model}</h3><div class="meta">${v.year} · ${Number(v.km).toLocaleString("es-UY")} km · ${v.transmission}</div><p class="price">${money(v.price)}</p></div></article>`).join("")||"<p>No encontramos vehículos con esos filtros.</p>";document.querySelectorAll(".vehicle-card").forEach(x=>x.onclick=()=>detail(x.dataset.id))}
function detail(id){const v=vehicles.find(x=>x.id===id);if(!v)return;const msg=encodeURIComponent(`Hola, quiero cotizar el ${v.brand} ${v.model} ${v.year}.`);$("#detailContent").innerHTML=`<div class="detail-layout"><div><img class="main-image" id="mainImage" src="${v.images?.[0]||""}" alt="${v.brand} ${v.model}"><div class="thumbs">${(v.images||[]).map(i=>`<img src="${i}" alt="Vista del vehículo">`).join("")}</div></div><div><div class="badges"><span class="badge red">${v.condition}</span><span class="badge">${v.type}</span></div><h2>${v.brand} ${v.model}</h2><p class="price">${money(v.price)}</p><div class="specs"><div class="spec"><small>Año</small><b>${v.year}</b></div><div class="spec"><small>Kilometraje</small><b>${Number(v.km).toLocaleString("es-UY")} km</b></div><div class="spec"><small>Combustible</small><b>${v.fuel}</b></div><div class="spec"><small>Transmisión</small><b>${v.transmission}</b></div></div><p>${v.description}</p><a class="button whatsapp" target="_blank" rel="noopener" href="https://wa.me/${WHATSAPP}?text=${msg}">Solicitar cotización</a></div></div>`;openModal("detailModal");document.querySelectorAll(".thumbs img").forEach(i=>i.onclick=()=>$("#mainImage").src=i.src)}
function openModal(id){$("#"+id).classList.add("open");$("#"+id).setAttribute("aria-hidden","false");document.body.classList.add("modal-active")}
function closeModal(id){$("#"+id).classList.remove("open");$("#"+id).setAttribute("aria-hidden","true");document.body.classList.toggle("modal-active",!!document.querySelector(".modal.open"))}
async function load(){try{vehicles=await api("/api/vehicles");render()}catch(e){$("#vehicleGrid").innerHTML=`<p class="error">${e.message}</p>`}}
$("#generalWhatsapp").href=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hola, quiero consultar por los vehículos disponibles.")}`;
["search","condition","type","sort"].forEach(id=>$("#"+id).addEventListener("input",render));
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
$("#adminOpen").onclick=async()=>{const me=await api("/api/me");if(me.admin){renderAdmin();openModal("adminModal")}else openModal("loginModal")};
$("#loginForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password:$("#password").value})});closeModal("loginModal");$("#password").value="";$("#loginError").textContent="";renderAdmin();openModal("adminModal")}catch(err){$("#loginError").textContent=err.message}};
$("#logout").onclick=async()=>{await api("/api/logout",{method:"POST"});closeModal("adminModal")};
function renderAdmin(){$("#adminList").innerHTML=vehicles.map(v=>`<div class="admin-row"><span><b>${v.brand} ${v.model}</b><br><small>${v.year} · ${money(v.price)}</small></span><span class="admin-row-actions"><button data-edit="${v.id}">Editar</button><button class="delete" data-delete="${v.id}">Retirar</button></span></div>`).join("")||"<p>No hay vehículos cargados.</p>";document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editVehicle(b.dataset.edit));document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteVehicle(b.dataset.delete))}
function editVehicle(id){const v=vehicles.find(x=>x.id===id);$("#vehicleId").value=v.id;$("#vehicleBrand").value=v.brand;$("#vehicleModel").value=v.model;$("#vehicleYear").value=v.year;$("#vehiclePrice").value=v.price;$("#vehicleCondition").value=v.condition;$("#vehicleType").value=v.type;$("#vehicleKm").value=v.km;$("#vehicleFuel").value=v.fuel;$("#vehicleTransmission").value=v.transmission;$("#vehicleDescription").value=v.description;$("#existingPhotos").innerHTML=(v.images||[]).map(x=>`<img src="${x}" alt="Foto actual">`).join("");$("#formTitle").textContent="Editar vehículo";$("#vehicleForm").scrollIntoView({behavior:"smooth"})}
async function deleteVehicle(id){if(!confirm("¿Retirar este vehículo del catálogo? Sus fotos y solicitudes se conservarán en el historial."))return;try{await api(`/api/vehicles/${encodeURIComponent(id)}`,{method:"DELETE"});await load();renderAdmin()}catch(e){alert(e.message)}}
function clearForm(){$("#vehicleForm").reset();$("#vehicleId").value="";$("#existingPhotos").innerHTML="";$("#formTitle").textContent="Agregar vehículo";$("#formError").textContent=""}
$("#cancelEdit").onclick=clearForm;
$("#vehicleForm").onsubmit=async e=>{e.preventDefault();const id=$("#vehicleId").value,current=vehicles.find(v=>v.id===id);const vehicle={id:id||undefined,revision:current?.revision,brand:$("#vehicleBrand").value.trim(),model:$("#vehicleModel").value.trim(),year:+$("#vehicleYear").value,price:+$("#vehiclePrice").value,condition:$("#vehicleCondition").value,type:$("#vehicleType").value,km:+$("#vehicleKm").value,fuel:$("#vehicleFuel").value.trim(),transmission:$("#vehicleTransmission").value.trim(),description:$("#vehicleDescription").value.trim(),existingImages:current?.images||[]};const form=new FormData();form.append("vehicle",JSON.stringify(vehicle));if(id)form.append("originalId",id);for(const file of $("#vehiclePhotos").files)form.append("photos",file);const button=$("#saveVehicle");button.disabled=true;button.textContent="Guardando…";$("#formError").textContent="";try{await api("/api/vehicles",{method:"POST",body:form});await load();renderAdmin();clearForm()}catch(err){$("#formError").textContent=err.message}finally{button.disabled=false;button.textContent="Guardar vehículo"}};
const ORDER_EMAIL = "lucianoribeiroke@gmail.com";
// Public form endpoint, not a password or API key. Set after verifying the
// recipient lucianoribeiroke@gmail.com in the owner's Formspree account.
const CONTACT_FORM_ENDPOINT = "https://formspree.io/f/mnpnypdl";
const automaticEmailEnabled = /^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(CONTACT_FORM_ENDPOINT);
const originalDetail = detail;
const originalRenderAdmin = renderAdmin;
let statisticsVisitId;
try {
  statisticsVisitId = sessionStorage.getItem("lrv-stats-visit");
  if (!/^[0-9a-f-]{36}$/.test(statisticsVisitId || "")) {
    statisticsVisitId = crypto.randomUUID();
    sessionStorage.setItem("lrv-stats-visit", statisticsVisitId);
  }
} catch { statisticsVisitId = crypto.randomUUID(); }
const recordedViews = new Set();
function trackVehicleView(id) {
  if (recordedViews.has(id)) return;
  recordedViews.add(id);
  api(`/api/vehicle-views?vehicle=${encodeURIComponent(id)}&visit=${statisticsVisitId}`, {method: "POST", keepalive: true})
    .catch(() => recordedViews.delete(id));
}

function renderStatistics() {
  let section = $("#adminStatistics");
  if (!section) {
    section = document.createElement("section"); section.id = "adminStatistics";
    section.className = "inquiry-history";
    $("#adminList").before(section);
  }
  section.innerHTML = `<h3>Estadísticas mensuales</h3><p>Qué vehículos despiertan más interés.</p><div class="stats-controls"><label>Mes<input id="statsMonth" type="month" min="2000-01" max="2100-12" required></label><label>Ordenar por<select id="statsSort"><option value="requests">Más solicitudes</option><option value="views">Más vistos</option></select></label><button class="button secondary" type="button" id="refreshStats">Actualizar estadísticas</button><button class="button secondary" type="button" id="downloadStats" disabled>Descargar PDF</button></div><p id="statsStatus" role="status"></p><div class="stats-summary" id="statsSummary"></div><div class="stats-table-wrap"><table class="stats-table"><caption>Interés por vehículo · mes seleccionado</caption><thead><tr><th scope="col">Vehículo</th><th scope="col">Vistas</th><th scope="col">Solicitudes</th><th scope="col">Correo</th><th scope="col">WhatsApp</th></tr></thead><tbody id="statsRows"></tbody></table></div><p class="stats-note">Meses según la hora de Uruguay. Vistas desde el 02/10/2026: una por vehículo y sesión de pestaña; no son personas únicas. No se cuentan las vistas con sesión de administrador iniciada. Las solicitudes del mes incluyen el historial previo y reflejan la intención de contacto, no la entrega confirmada del mensaje.</p>`;
  let items = [], loadedMonth = "", refreshVersion = 0;
  const monthInput = section.querySelector("#statsMonth");
  const download = section.querySelector("#downloadStats");
  monthInput.value = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 7);
  download.onclick = async () => {
    if (!loadedMonth || loadedMonth !== monthInput.value) return;
    const exportMonth = loadedMonth;
    const sort = section.querySelector("#statsSort").value;
    const ordered = [...items].sort((a,b) => b[sort] - a[sort] || a.vehicle.localeCompare(b.vehicle));
    try {
    const {statisticsPdf} = await import("/statistics-pdf.js");
    const blob = statisticsPdf(exportMonth, ordered);
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = `LRV-estadisticas-${exportMonth}.pdf`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { section.querySelector("#statsStatus").textContent = "No se pudo descargar el PDF. Intentá nuevamente."; }
  };
  function showStatistics() {
    const sort = section.querySelector("#statsSort").value;
    const ordered = [...items].sort((a,b) => b[sort] - a[sort] || a.vehicle.localeCompare(b.vehicle));
    const rows = section.querySelector("#statsRows"); rows.replaceChildren();
    for (const item of ordered) {
      const row = document.createElement("tr");
      for (const value of [item.vehicle, item.views, item.requests, item.email_requests, item.whatsapp_requests]) {
        const cell = document.createElement("td"); cell.textContent = value; row.append(cell);
      }
      rows.append(row);
    }
    const summary = section.querySelector("#statsSummary"); summary.replaceChildren();
    for (const [field, label] of [["requests","Más solicitudes"],["views","Más visto"]]) {
      const highest = Math.max(0, ...items.map(item => item[field]));
      const leaders = items.filter(item => item[field] === highest && highest > 0);
      const card = document.createElement("div"); card.className = "stats-card";
      const title = document.createElement("strong"); title.textContent = label;
      const name = document.createElement("p"); name.textContent = leaders.length ? leaders.map(item => item.vehicle).join(" · ") : "Todavía sin registros";
      const count = document.createElement("span"); count.textContent = `${highest} ${field === "views" ? "vistas" : "solicitudes"}${leaders.length > 1 ? " por vehículo (empate)" : ""}`;
      card.append(title,name,count); summary.append(card);
    }
  }
  section.querySelector("#statsSort").onchange = showStatistics;
  async function refresh() {
    const version = ++refreshVersion, month = monthInput.value;
    const button = section.querySelector("#refreshStats"), status = section.querySelector("#statsStatus");
    download.disabled = true; loadedMonth = ""; items = [];
    section.querySelector("#statsRows").replaceChildren();
    section.querySelector("#statsSummary").replaceChildren();
    section.querySelector("caption").textContent = `Interés por vehículo · ${month || "seleccioná un mes"}`;
    if (!monthInput.validity.valid || !/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month)) {
      button.disabled = false; status.textContent = "Seleccioná un mes válido."; return;
    }
    button.disabled = true; status.textContent = "Cargando estadísticas…";
    try {
      const data = await api(`/api/statistics?month=${encodeURIComponent(month)}`);
      if (version !== refreshVersion) return;
      const byId = new Map(data.items.map(item => [item.vehicle_id, item]));
      for (const vehicle of vehicles) {
        if (!byId.has(vehicle.id)) byId.set(vehicle.id, {vehicle_id:vehicle.id,vehicle:`${vehicle.brand} ${vehicle.model} ${vehicle.year}`,views:0,requests:0,email_requests:0,whatsapp_requests:0});
      }
      items = [...byId.values()]; loadedMonth = data.month;
      showStatistics(); download.disabled = false; status.textContent = "Estadísticas del mes actualizadas.";
    } catch (error) { if (version === refreshVersion) status.textContent = error.message; }
    finally { if (version === refreshVersion) button.disabled = false; }
  }
  monthInput.onchange = refresh;
  section.querySelector("#refreshStats").onclick = refresh;
  refresh();
}
renderAdmin = function() {
  originalRenderAdmin();
  const storageNote = document.querySelector("#adminModal .admin-note");
  api("/api/storage").then(status => {
    storageNote.textContent = status.ready
      ? "El catálogo se guarda en Cloudflare D1 y las fotografías en Cloudflare R2. Los cambios se muestran para todos."
      : "Estamos trasladando el catálogo a Cloudflare. Los vehículos actuales siguen disponibles; esperá a que termine la importación antes de editarlos.";
  }).catch(() => { storageNote.textContent = "No se pudo comprobar el almacenamiento del catálogo. Intentá nuevamente más tarde."; });
  renderStatistics();
  let history = $("#inquiryHistory");
  if (!history) {
    history = document.createElement("section");
    history.id = "inquiryHistory";
    history.className = "inquiry-history";
    $("#adminList").before(history);
  }
  history.innerHTML = `<h3>Historial de solicitudes</h3><p>Registros del formulario. El canal indica la opción elegida; no confirma la entrega del correo o mensaje.</p><button class="button secondary" type="button" id="refreshInquiries">Actualizar historial</button><div id="inquiryRows" aria-live="polite"></div><button class="button secondary" type="button" id="moreInquiries" hidden>Ver anteriores</button>`;
  let offset = 0;
  async function fetchHistory(reset = false) {
    const rows = history.querySelector("#inquiryRows");
    const more = history.querySelector("#moreInquiries");
    const refresh = history.querySelector("#refreshInquiries");
    if (reset) { offset = 0; rows.replaceChildren(); }
    more.disabled = refresh.disabled = true;
    try {
      const result = await api(`/api/inquiries?offset=${offset}`);
      if (!result.items.length && !offset) rows.textContent = "Todavía no hay solicitudes registradas.";
      for (const inquiry of result.items) {
        const article = document.createElement("article");
        article.className = "inquiry-record";
        const heading = document.createElement("h4");
        heading.textContent = inquiry.vehicle;
        article.append(heading);
        const fields = {Fecha: new Date(inquiry.created_at).toLocaleString("es-UY", {timeZone: "America/Montevideo"}), Nombre: inquiry.name, Celular: inquiry.phone, Correo: inquiry.email, Descripción: inquiry.message || "Sin descripción", Canal: inquiry.channel === "email" ? "Correo solicitado" : "WhatsApp iniciado"};
        for (const [label, value] of Object.entries(fields)) {
          const p = document.createElement("p");
          const strong = document.createElement("strong"); strong.textContent = `${label}: `;
          p.append(strong, document.createTextNode(value)); article.append(p);
        }
        rows.append(article);
      }
      offset += result.items.length;
      more.hidden = !result.hasMore;
    } catch (error) {
      const p = document.createElement("p"); p.className = "error"; p.textContent = error.message; rows.append(p);
    } finally { more.disabled = refresh.disabled = false; }
  }
  history.querySelector("#refreshInquiries").onclick = () => fetchHistory(true);
  history.querySelector("#moreInquiries").onclick = () => fetchHistory();
  fetchHistory(true);
};
const originalLogout = $("#logout").onclick;
$("#logout").onclick = async () => { await originalLogout(); $("#inquiryHistory")?.remove(); $("#adminStatistics")?.remove(); };
detail = function(id) {
  originalDetail(id);
  const vehicle = vehicles.find(item => item.id === id);
  if (!vehicle) return;
  trackVehicleView(id);
  const form = document.createElement("form");
  form.className = "vehicle-form";
  // All vehicle requests use the form so the administrator has customer details.
  $("#detailContent .whatsapp")?.remove();
  form.innerHTML = `<h3 class="wide">Solicitar compra</h3>
    <label>Nombre<input name="name" autocomplete="name" maxlength="100" required></label>
    <label>Celular<input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" minlength="9" maxlength="9" pattern="[0-9]{9}" placeholder="097135114" title="Ingresá exactamente 9 dígitos, sin espacios ni símbolos" required></label>
    <label class="wide">Correo<input name="email" type="email" autocomplete="email" maxlength="200" required></label>
    <label class="wide">Consulta<textarea name="message" rows="3" maxlength="1500" required></textarea></label>
    <p class="wide">Usaremos tus datos para responder sobre este vehículo. No se confirma ninguna compra ni se realiza un cobro.${automaticEmailEnabled ? " El envío por correo se procesa mediante Formspree." : ""}</p>
    <p class="wide form-notice" id="formCompletionNotice" aria-live="polite" aria-atomic="true">Completá todos los campos del formulario para continuar.</p>
    <div class="form-actions wide"><button class="button whatsapp" type="submit" value="whatsapp">Enviar por WhatsApp</button>
    <button class="button secondary" type="submit" value="email" ${automaticEmailEnabled ? "" : "disabled"}>Enviar solicitud por correo</button></div>
    <p class="wide" role="status" id="orderStatus">${automaticEmailEnabled ? "La solicitud por correo se envía desde este formulario, sin abrir tu aplicación de correo." : "El envío automático por correo todavía no está disponible. Podés consultar por WhatsApp."}</p>`;
  let pending = false;
  function updateSendButtons() {
    for (const name of ["name", "message"]) {
      const field = form.elements.namedItem(name);
      field.setCustomValidity(field.value.trim() ? "" : "Completá este campo.");
    }
    const complete = form.checkValidity();
    const notice = form.querySelector("#formCompletionNotice");
    const missing = ["name", "phone", "email", "message"].some(name => !form.elements.namedItem(name).value.trim());
    notice.hidden = complete;
    notice.textContent = missing ? "Completá todos los campos del formulario para continuar."
      : !form.elements.namedItem("phone").validity.valid ? "El celular debe tener exactamente 9 números para continuar."
      : !form.elements.namedItem("email").validity.valid ? "Ingresá un correo electrónico válido para continuar."
      : "Revisá los datos del formulario para continuar.";
    form.querySelectorAll("button").forEach(button => {
      button.disabled = pending || !complete || (button.value === "email" && !automaticEmailEnabled);
    });
  }
  const phoneInput = form.elements.namedItem("phone");
  phoneInput.addEventListener("input", () => {
    phoneInput.value = phoneInput.value.replace(/[^0-9]/g, "").slice(0, 9);
  });
  const extraFields = {vehicle: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`, reference: vehicle.id, published_price: money(vehicle.price), _subject: `Solicitud de vehículo — ${vehicle.brand} ${vehicle.model} ${vehicle.year}`};
  for (const [name, value] of Object.entries(extraFields)) {
    const input = document.createElement("input");
    input.type = "hidden"; input.name = name; input.value = value;
    form.append(input);
  }
  if (automaticEmailEnabled) {
    form.action = CONTACT_FORM_ENDPOINT;
    form.method = "POST";
    // Honeypot in addition to the provider's spam protection.
    const honeypot = document.createElement("input");
    honeypot.name = "_gotcha"; honeypot.type = "text";
    honeypot.hidden = true; honeypot.tabIndex = -1; honeypot.autocomplete = "off";
    form.append(honeypot);
  }
  form.addEventListener("input", updateSendButtons);
  form.addEventListener("change", updateSendButtons);
  updateSendButtons();
  const requestIds = {};
  form.onsubmit = async function(event) {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    const data = new FormData(form);
    const channel = event.submitter?.value === "email" ? "email" : "whatsapp";
    if (channel === "email" && !automaticEmailEnabled) return;
    pending = true;
    form.querySelectorAll("button").forEach(button => button.disabled = true);
    form.querySelector("[role=status]").textContent = "Registrando solicitud…";
    const fingerprint = JSON.stringify([channel, data.get("name"), data.get("phone"), data.get("email"), data.get("message")]);
    requestIds[fingerprint] ||= crypto.randomUUID();
    try {
      await api("/api/inquiries", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({id: requestIds[fingerprint], vehicleId: vehicle.id, name: data.get("name"), phone: data.get("phone"), email: data.get("email"), message: data.get("message"), channel, honeypot: data.get("_gotcha") || ""})});
    } catch (error) {
      form.querySelector("[role=status]").textContent = `${error.message} No se envió la solicitud. Intentá nuevamente.`;
      pending = false;
      updateSendButtons();
      return;
    }
    const message = `Solicitud de compra — LRV Automotores\nVehículo: ${vehicle.brand} ${vehicle.model} ${vehicle.year}\nReferencia: ${vehicle.id}\nPrecio publicado: ${money(vehicle.price)}\nNombre: ${data.get("name")}\nTeléfono: ${data.get("phone")}\nCorreo: ${data.get("email")}\nConsulta: ${data.get("message") || "Solicito información para comprar este vehículo."}\nSitio: ${location.origin}\nSolicitud sujeta a disponibilidad y confirmación.`;
    if (event.submitter?.value === "email") {
      if (!automaticEmailEnabled) return;
      // The provider handles any CAPTCHA, errors, and the receipt page.
      // Do not claim delivery until the provider accepts the submission.
      form.querySelector("[role=status]").textContent = "Enviando solicitud…";
      form.querySelectorAll("button").forEach(button => button.disabled = true);
      HTMLFormElement.prototype.submit.call(form);
      return;
    } else {
      location.assign(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`);
    }
    pending = false;
    updateSendButtons();
    form.querySelector("[role=status]").textContent = "Confirmá el envío en WhatsApp. Si no se abrió, permití abrir WhatsApp en tu navegador.";
  };
  $("#detailContent").append(form);
};
load();
