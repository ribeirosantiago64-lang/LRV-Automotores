// Shopping tools keep only vehicle IDs on this device; customer data stays private.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let favorites=new Set(), comparison=new Set();
try{const ids=JSON.parse(localStorage.getItem('lrv-favorites')||'[]');if(Array.isArray(ids))favorites=new Set(ids.filter(x=>typeof x==='string'));}catch{}
const filters=document.querySelector('.filters');
filters.insertAdjacentHTML('beforeend',`<label>Presupuesto máximo (USD)<input id="budget" type="number" min="0" placeholder="Sin límite"></label><label>Kilómetros máximos<input id="maxKm" type="number" min="0" placeholder="Sin límite"></label><label>Caja<select id="gear"><option value="">Todas</option><option value="auto">Automática</option><option value="manual">Manual</option></select></label><label>Disponibilidad<select id="stock"><option value="">Todas</option><option>Disponible</option><option>Reservado</option><option>Vendido</option></select></label><label class="favorite-filter"><input type="checkbox" id="onlyFavorites"> Mis favoritos</label><button type="button" class="button secondary" id="resetFilters">Limpiar filtros</button>`);
const baseFiltered=filtered;
filtered=function(){return baseFiltered().filter(v=>(!$('#budget').value||v.price<=+$('#budget').value)&&(!$('#maxKm').value||v.km<=+$('#maxKm').value)&&(!$('#gear').value||(v.transmission||'').toLowerCase().includes($('#gear').value))&&(!$('#stock').value||(v.availability||'Disponible')===$('#stock').value)&&(!$('#onlyFavorites').checked||favorites.has(v.id)));};
['budget','maxKm','gear','stock','onlyFavorites'].forEach(id=>$('#'+id).addEventListener('input',()=>{render();}));
$('#resetFilters').onclick=()=>{filters.querySelectorAll('input').forEach(x=>x.type==='checkbox'?x.checked=false:x.value='');filters.querySelectorAll('select').forEach(x=>x.selectedIndex=0);render();};
document.body.insertAdjacentHTML('beforeend','<div id="compareBar" class="compare-bar" hidden><span id="compareCount"></span><button class="button primary" id="compareOpen">Comparar</button><button id="compareClear" class="button secondary">Vaciar</button></div><div class="modal" id="compareModal" aria-hidden="true"><div class="modal-card"><button class="close" id="compareClose" aria-label="Cerrar comparación">×</button><h2>Elegí con información</h2><div id="compareContent" class="comparison-grid"></div></div></div>');
function updateCompare(){ $('#compareBar').hidden=!comparison.size;$('#compareCount').textContent=`${comparison.size} de 3 vehículos`; }
const baseRender=render;
render=function(){
  // Escape all catalog text before the original HTML renderer consumes it.
  const raw=vehicles;vehicles=vehicles.map(v=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,typeof x==='string'&&k!=='id'?esc(x):x])));
  try{baseRender();}finally{vehicles=raw;}
  document.querySelectorAll('.vehicle-card').forEach(card=>{
    const v=vehicles.find(x=>x.id===card.dataset.id);if(!v)return;
    card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`Ver ${v.brand} ${v.model}`);card.onkeydown=e=>{if(e.target===card&&['Enter',' '].includes(e.key)){e.preventDefault();detail(v.id);}};
    const actions=document.createElement('div');actions.className='shopping-actions';
    const fav=document.createElement('button');fav.type='button';fav.textContent=favorites.has(v.id)?'♥ Guardado':'♡ Guardar';fav.setAttribute('aria-pressed',favorites.has(v.id));
    fav.onclick=e=>{e.stopPropagation();favorites.has(v.id)?favorites.delete(v.id):favorites.add(v.id);try{localStorage.setItem('lrv-favorites',JSON.stringify([...favorites]));}catch{}render();};
    const compare=document.createElement('button');compare.type='button';compare.textContent=comparison.has(v.id)?'✓ En comparación':'+ Comparar';compare.setAttribute('aria-pressed',comparison.has(v.id));
    compare.onclick=e=>{e.stopPropagation();if(comparison.has(v.id))comparison.delete(v.id);else if(comparison.size<3)comparison.add(v.id);else{alert('Podés comparar hasta 3 vehículos. Retirá uno para agregar otro.');return;}render();updateCompare();};
    actions.append(fav,compare);card.append(actions);
    const badge=document.createElement('span');badge.className='availability';badge.textContent=v.availability||'Disponible';card.querySelector('.badges').append(badge);
  });
};
$('#compareClose').onclick=()=>closeModal('compareModal');$('#compareClear').onclick=()=>{comparison.clear();updateCompare();render();};
$('#compareOpen').onclick=()=>{
  $('#compareContent').innerHTML=[...comparison].map(id=>vehicles.find(v=>v.id===id)).filter(Boolean).map(v=>`<article><img src="${esc(v.images?.[0])}" alt="${esc(v.brand+' '+v.model)}"><h3>${esc(v.brand)} ${esc(v.model)}</h3><p class="price">${money(v.price)}</p><dl>${[['Año',v.year],['Kilómetros',Number(v.km).toLocaleString('es-UY')],['Caja',v.transmission],['Combustible',v.fuel],['Estado',v.condition],['Disponibilidad',v.availability||'Disponible']].map(([k,x])=>`<dt>${k}</dt><dd>${esc(x||'A confirmar')}</dd>`).join('')}</dl><button class="button primary" data-compare-detail="${v.id}">Ver vehículo</button></article>`).join('');
  $('#compareContent').querySelectorAll('[data-compare-detail]').forEach(b=>b.onclick=()=>{closeModal('compareModal');detail(b.dataset.compareDetail);});openModal('compareModal');
};
const baseDetail=detail;
detail=function(id){
  const raw=vehicles;vehicles=vehicles.map(v=>({...v,brand:esc(v.brand),model:esc(v.model),description:esc(v.description),fuel:esc(v.fuel),transmission:esc(v.transmission),type:esc(v.type)}));
  try{baseDetail(id);}finally{vehicles=raw;}
  const v=vehicles.find(x=>x.id===id);if(!v)return;
  history.replaceState(null,'',`/vehiculo/${encodeURIComponent(id)}`);document.title=`${v.brand} ${v.model} ${v.year} | LRV Automotores`;
  const extra=document.createElement('section');extra.className='vehicle-information';
  extra.innerHTML=`<h3>Información para decidir</h3><dl>${[['Versión',v.version],['Disponibilidad',v.availability||'Disponible'],['Mantenimiento conocido',v.maintenance],['Revisión y estado',v.inspection],['El precio incluye',v.priceIncludes]].map(([k,x])=>`<dt>${k}</dt><dd>${esc(x||'Consultá al asesor para confirmar este dato.')}</dd>`).join('')}</dl>${v.features?.length?`<h3>Equipamiento informado</h3><ul>${v.features.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:''}<button class="button secondary" id="shareVehicle">Compartir vehículo</button>`;
  $('#detailContent .detail-layout').after(extra);
  $('#shareVehicle').onclick=async()=>{try{if(navigator.share)await navigator.share({title:document.title,url:location.href});else{await navigator.clipboard.writeText(location.href);$('#shareVehicle').textContent='Enlace copiado';}}catch{ $('#shareVehicle').textContent='Copiá el enlace de la barra del navegador';}};
  const form=$('#detailContent form');form.querySelector('h3').textContent='Consultar o coordinar una visita';
  const visit=document.createElement('button');visit.type='button';visit.className='button primary visit-action';visit.textContent='Coordinar una visita';visit.onclick=()=>{form.elements.message.value='Quiero coordinar una visita para ver este vehículo. Mi disponibilidad es: ';form.dispatchEvent(new Event('input'));form.elements.name.focus();form.scrollIntoView({behavior:'smooth',block:'center'});};extra.append(visit);
  if(v.availability==='Vendido'){form.hidden=true;visit.hidden=true;const note=document.createElement('p');note.textContent='Este vehículo fue vendido. Explorá el catálogo para encontrar otras opciones.';extra.append(note);}
  else if(v.availability==='Reservado'){const note=document.createElement('p');note.textContent='Vehículo reservado. Consultá por su disponibilidad antes de coordinar una visita.';extra.prepend(note);}
  const similar=vehicles.filter(x=>x.id!==id&&x.type===v.type&&x.availability!=='Vendido').slice(0,3);
  if(similar.length){const s=document.createElement('section');s.innerHTML='<h3>También te pueden interesar</h3>';similar.forEach(x=>{const b=document.createElement('button');b.className='button secondary';b.textContent=`${x.brand} ${x.model} · ${money(x.price)}`;b.onclick=()=>detail(x.id);s.append(b);});$('#detailContent').append(s);}
};
const baseClose=closeModal;closeModal=function(id){baseClose(id);if(id==='detailModal'){history.replaceState(null,'','/');document.title='LRV Automotores | Vehículos en Uruguay';}};
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal.open').forEach(m=>closeModal(m.id));});
const originalLoad=load;load=async function(){await originalLoad();const match=location.pathname.match(/^\/vehiculo\/([a-z0-9-]+)$/);if(match&&vehicles.some(v=>v.id===match[1]))detail(match[1]);};
// Additional catalog fields are saved with the same revision checks as the vehicle.
$('#vehicleDescription').closest('label').insertAdjacentHTML('afterend',`<label>Versión<input id="extraVersion" maxlength="100"></label><label>Disponibilidad<select id="extraAvailability"><option>Disponible</option><option>Reservado</option><option>Vendido</option></select></label><label class="wide">Equipamiento (uno por línea)<textarea id="extraFeatures" maxlength="4000"></textarea></label><label class="wide">Mantenimiento conocido<textarea id="extraMaintenance" maxlength="1500"></textarea></label><label class="wide">Revisión y estado real<textarea id="extraInspection" maxlength="1500"></textarea></label><label class="wide">Qué incluye el precio<textarea id="extraPriceIncludes" maxlength="800"></textarea></label>`);
const fields={version:'extraVersion',availability:'extraAvailability',features:'extraFeatures',maintenance:'extraMaintenance',inspection:'extraInspection',priceIncludes:'extraPriceIncludes'};
const baseEdit=editVehicle;editVehicle=function(id){baseEdit(id);const v=vehicles.find(x=>x.id===id);for(const [k,f] of Object.entries(fields))$('#'+f).value=k==='features'?(v[k]||[]).join('\n'):v[k]||(k==='availability'?'Disponible':'');};
const baseApi=api;api=async function(url,options={}){if(url==='/api/vehicles'&&options.body instanceof FormData){const v=JSON.parse(options.body.get('vehicle'));for(const [k,f] of Object.entries(fields))v[k]=k==='features'?$('#'+f).value.split('\n').map(x=>x.trim()).filter(Boolean):$('#'+f).value;options.body.set('vehicle',JSON.stringify(v));}return baseApi(url,options);};
// Enrich private history as records arrive; use DOM nodes for all customer data.

// Follow-up is rendered from the same paginated response, never from public data.
const inquiryApi=api;let followups={};
api=async function(url,options={}){const data=await inquiryApi(url,options);if(url.startsWith('/api/inquiries?')){
  try{const f=await inquiryApi('/api/followup');followups=Object.fromEntries(f.items.map(x=>[x.id,x]));}catch{}
  setTimeout(()=>{const articles=[...document.querySelectorAll('.inquiry-record')].slice(-data.items.length);data.items.forEach((item,i)=>{
    const article=articles[i];if(!article||article.querySelector('.followup'))return;const box=document.createElement('div');box.className='followup';
    const select=document.createElement('select');select.setAttribute('aria-label','Estado de seguimiento');['Nueva','Contactado','Visita coordinada','Venta cerrada','Perdida'].forEach(stage=>select.add(new Option(stage,stage)));select.value=followups[item.id]?.stage||'Nueva';
    const note=document.createElement('textarea');note.placeholder='Notas privadas de seguimiento';note.maxLength=1500;note.value=followups[item.id]?.note||'';note.setAttribute('aria-label','Notas privadas');
    const button=document.createElement('button');button.className='button secondary';button.textContent='Guardar seguimiento';const status=document.createElement('span');status.setAttribute('role','status');
    button.onclick=async()=>{button.disabled=true;try{await api('/api/followup/'+encodeURIComponent(item.id),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({stage:select.value,note:note.value})});status.textContent='Guardado';}catch(e){status.textContent=e.message;}finally{button.disabled=false;}};box.append(select,note,button,status);article.append(box);
  });},0);
}return data;};
document.querySelector('.hero-content').insertAdjacentHTML('beforeend','<p class="hero-benefits">Fotos reales del stock · Consulta directa · Visitas coordinadas</p>');
document.querySelector('#contacto').insertAdjacentHTML('beforebegin','<section class="section guidance"><p class="eyebrow">Una compra acompañada</p><h2>Encontrá el vehículo que encaja con vos</h2><div class="guidance-grid"><article><h3>1. Elegí y compará</h3><p>Filtrá por presupuesto, guardá favoritos y compará hasta tres vehículos.</p></article><article><h3>2. Resolvé tus dudas</h3><p>Consultá el estado, el equipamiento y las condiciones con atención personalizada.</p></article><article><h3>3. Coordiná una visita</h3><p>Conocé el vehículo y confirmá sus características antes de decidir.</p></article></div><button class="button primary" id="helpChoose">Ayudame a elegir</button><div id="helpPanel" hidden><label>¿Para qué lo buscás?<select id="helpUse"><option value="">Cualquier uso</option><option value="Hatch">Ciudad y uso diario</option><option value="SUV">Espacio y versatilidad</option><option value="Sedán">Baúl y viajes</option></select></label><label>Tu presupuesto máximo (USD)<input id="helpBudget" type="number" min="0"></label><button class="button secondary" id="helpResults">Ver opciones del stock</button><p>La selección se basa en carrocería y presupuesto. Confirmá que el vehículo cubra tus necesidades.</p></div></section>');
$('#helpChoose').onclick=()=>{$('#helpPanel').hidden=!$('#helpPanel').hidden;};$('#helpResults').onclick=()=>{$('#type').value=$('#helpUse').value;$('#budget').value=$('#helpBudget').value;$('#onlyFavorites').checked=false;render();$('#catalogo').scrollIntoView({behavior:'smooth'});};
if(vehicles.length)render();

let initialRouteOpened=false;const routeRender=render;render=function(){routeRender();if(!initialRouteOpened&&vehicles.length){initialRouteOpened=true;const match=location.pathname.match(/^\/vehiculo\/([a-z0-9-]+)$/);if(match&&vehicles.some(v=>v.id===match[1]))detail(match[1]);}};if(vehicles.length)render();
