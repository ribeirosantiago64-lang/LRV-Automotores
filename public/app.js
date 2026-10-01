const WHATSAPP="59897135114";
let vehicles=[];
const $=(s)=>document.querySelector(s);
const money=(n)=>`USD ${Number(n).toLocaleString("es-UY")}`;
async function api(url,options={}){const r=await fetch(url,options);const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"No se pudo completar la operación");return data}
function filtered(){let list=[...vehicles],q=$("#search").value.toLowerCase(),c=$("#condition").value,t=$("#type").value,s=$("#sort").value;list=list.filter(v=>(`${v.brand} ${v.model} ${v.year}`.toLowerCase().includes(q))&&(!c||v.condition===c)&&(!t||v.type===t));if(s==="price-desc")list.sort((a,b)=>b.price-a.price);if(s==="price-asc")list.sort((a,b)=>a.price-b.price);if(s==="year-desc")list.sort((a,b)=>b.year-a.year);return list}
function render(){const list=filtered();$("#resultCount").textContent=`${list.length} vehículo${list.length===1?"":"s"}`;$("#vehicleGrid").innerHTML=list.map(v=>`<article class="vehicle-card" data-id="${v.id}"><img src="${v.images?.[0]||""}" alt="${v.brand} ${v.model}" loading="lazy"><div class="card-body"><div class="badges"><span class="badge red">${v.condition}</span><span class="badge">${v.type}</span></div><h3>${v.brand} ${v.model}</h3><div class="meta">${v.year} · ${Number(v.km).toLocaleString("es-UY")} km · ${v.transmission}</div><p class="price">${money(v.price)}</p></div></article>`).join("")||"<p>No encontramos vehículos con esos filtros.</p>";document.querySelectorAll(".vehicle-card").forEach(x=>x.onclick=()=>detail(x.dataset.id))}
function detail(id){const v=vehicles.find(x=>x.id===id);if(!v)return;const msg=encodeURIComponent(`Hola, quiero cotizar el ${v.brand} ${v.model} ${v.year}.`);$("#detailContent").innerHTML=`<div class="detail-layout"><div><img class="main-image" id="mainImage" src="${v.images?.[0]||""}" alt="${v.brand} ${v.model}"><div class="thumbs">${(v.images||[]).map(i=>`<img src="${i}" alt="Vista del vehículo">`).join("")}</div></div><div><div class="badges"><span class="badge red">${v.condition}</span><span class="badge">${v.type}</span></div><h2>${v.brand} ${v.model}</h2><p class="price">${money(v.price)}</p><div class="specs"><div class="spec"><small>Año</small><b>${v.year}</b></div><div class="spec"><small>Kilometraje</small><b>${Number(v.km).toLocaleString("es-UY")} km</b></div><div class="spec"><small>Combustible</small><b>${v.fuel}</b></div><div class="spec"><small>Transmisión</small><b>${v.transmission}</b></div></div><p>${v.description}</p><a class="button whatsapp" target="_blank" rel="noopener" href="https://wa.me/${WHATSAPP}?text=${msg}">Solicitar cotización</a></div></div>`;openModal("detailModal");document.querySelectorAll(".thumbs img").forEach(i=>i.onclick=()=>$("#mainImage").src=i.src)}
function openModal(id){$("#"+id).classList.add("open");$("#"+id).setAttribute("aria-hidden","false")}
function closeModal(id){$("#"+id).classList.remove("open");$("#"+id).setAttribute("aria-hidden","true")}
async function load(){try{vehicles=await api("/api/vehicles");render()}catch(e){$("#vehicleGrid").innerHTML=`<p class="error">${e.message}</p>`}}
$("#generalWhatsapp").href=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hola, quiero consultar por los vehículos disponibles.")}`;
["search","condition","type","sort"].forEach(id=>$("#"+id).addEventListener("input",render));
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
$("#adminOpen").onclick=async()=>{const me=await api("/api/me");if(me.admin){renderAdmin();openModal("adminModal")}else openModal("loginModal")};
$("#loginForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password:$("#password").value})});closeModal("loginModal");$("#password").value="";$("#loginError").textContent="";renderAdmin();openModal("adminModal")}catch(err){$("#loginError").textContent=err.message}};
$("#logout").onclick=async()=>{await api("/api/logout",{method:"POST"});closeModal("adminModal")};
function renderAdmin(){$("#adminList").innerHTML=vehicles.map(v=>`<div class="admin-row"><span><b>${v.brand} ${v.model}</b><br><small>${v.year} · ${money(v.price)}</small></span><span class="admin-row-actions"><button data-edit="${v.id}">Editar</button><button class="delete" data-delete="${v.id}">Eliminar</button></span></div>`).join("")||"<p>No hay vehículos cargados.</p>";document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editVehicle(b.dataset.edit));document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteVehicle(b.dataset.delete))}
function editVehicle(id){const v=vehicles.find(x=>x.id===id);$("#vehicleId").value=v.id;$("#vehicleBrand").value=v.brand;$("#vehicleModel").value=v.model;$("#vehicleYear").value=v.year;$("#vehiclePrice").value=v.price;$("#vehicleCondition").value=v.condition;$("#vehicleType").value=v.type;$("#vehicleKm").value=v.km;$("#vehicleFuel").value=v.fuel;$("#vehicleTransmission").value=v.transmission;$("#vehicleDescription").value=v.description;$("#existingPhotos").innerHTML=(v.images||[]).map(x=>`<img src="${x}" alt="Foto actual">`).join("");$("#formTitle").textContent="Editar vehículo";$("#vehicleForm").scrollIntoView({behavior:"smooth"})}
async function deleteVehicle(id){if(!confirm("¿Eliminar este vehículo y su carpeta de fotos?"))return;try{await api(`/api/vehicles/${encodeURIComponent(id)}`,{method:"DELETE"});await load();renderAdmin()}catch(e){alert(e.message)}}
function clearForm(){$("#vehicleForm").reset();$("#vehicleId").value="";$("#existingPhotos").innerHTML="";$("#formTitle").textContent="Agregar vehículo";$("#formError").textContent=""}
$("#cancelEdit").onclick=clearForm;
$("#vehicleForm").onsubmit=async e=>{e.preventDefault();const id=$("#vehicleId").value,current=vehicles.find(v=>v.id===id);const vehicle={id:id||undefined,brand:$("#vehicleBrand").value.trim(),model:$("#vehicleModel").value.trim(),year:+$("#vehicleYear").value,price:+$("#vehiclePrice").value,condition:$("#vehicleCondition").value,type:$("#vehicleType").value,km:+$("#vehicleKm").value,fuel:$("#vehicleFuel").value.trim(),transmission:$("#vehicleTransmission").value.trim(),description:$("#vehicleDescription").value.trim(),existingImages:current?.images||[]};const form=new FormData();form.append("vehicle",JSON.stringify(vehicle));if(id)form.append("originalId",id);for(const file of $("#vehiclePhotos").files)form.append("photos",file);const button=$("#saveVehicle");button.disabled=true;button.textContent="Guardando…";$("#formError").textContent="";try{await api("/api/vehicles",{method:"POST",body:form});await load();renderAdmin();clearForm()}catch(err){$("#formError").textContent=err.message}finally{button.disabled=false;button.textContent="Guardar vehículo"}};
const ORDER_EMAIL = "lucianoribeiroke@gmail.com";
// Public form endpoint, not a password or API key. Set after verifying the
// recipient lucianoribeiroke@gmail.com in the owner's Formspree account.
const CONTACT_FORM_ENDPOINT = "https://formspree.io/f/mnpnypdl";
const automaticEmailEnabled = /^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(CONTACT_FORM_ENDPOINT);
const originalDetail = detail;
detail = function(id) {
  originalDetail(id);
  const vehicle = vehicles.find(item => item.id === id);
  if (!vehicle) return;
  const form = document.createElement("form");
  form.className = "vehicle-form";
  form.innerHTML = `<h3 class="wide">Solicitar compra</h3>
    <label>Nombre<input name="name" autocomplete="name" maxlength="100" required></label>
    <label>Teléfono<input name="phone" type="tel" autocomplete="tel" maxlength="30" required></label>
    <label class="wide">Correo<input name="email" type="email" autocomplete="email" maxlength="200" required></label>
    <label class="wide">Consulta<textarea name="message" rows="3" maxlength="1500"></textarea></label>
    <p class="wide">Usaremos tus datos para responder sobre este vehículo. No se confirma ninguna compra ni se realiza un cobro.${automaticEmailEnabled ? " El envío por correo se procesa mediante Formspree." : ""}</p>
    <div class="form-actions wide"><button class="button whatsapp" type="submit" value="whatsapp">Enviar por WhatsApp</button>
    <button class="button secondary" type="submit" value="email" ${automaticEmailEnabled ? "" : "disabled"}>Enviar solicitud por correo</button></div>
    <p class="wide" role="status" id="orderStatus">${automaticEmailEnabled ? "La solicitud por correo se envía desde este formulario, sin abrir tu aplicación de correo." : "El envío automático por correo todavía no está disponible. Podés consultar por WhatsApp."}</p>`;
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
  form.onsubmit = function(event) {
    event.preventDefault();
    const data = new FormData(form);
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
      window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    }
    form.querySelector("[role=status]").textContent = "Confirmá el envío en WhatsApp. Si no se abrió, permití abrir WhatsApp en tu navegador.";
  };
  $("#detailContent").append(form);
};
load();
