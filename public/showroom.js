// Editorial showroom, transparent demo stock and a personal shopping workspace.
let recentlyViewed=[];
try{const saved=JSON.parse(localStorage.getItem('lrv-recent')||'[]');if(Array.isArray(saved))recentlyViewed=saved.filter(x=>typeof x==='string').slice(0,6);}catch{}
const storedSearch=['search','condition','type','sort','budget','maxKm','gear','stock'];
try{const saved=JSON.parse(localStorage.getItem('lrv-search')||'{}');storedSearch.forEach(id=>{if(typeof saved[id]==='string'&&$('#'+id))$('#'+id).value=saved[id];});}catch{}
for(const id of storedSearch)$('#'+id)?.addEventListener('input',()=>{try{localStorage.setItem('lrv-search',JSON.stringify(Object.fromEntries(storedSearch.map(id=>[id,$('#'+id)?.value||'']))));}catch{}});
for(const id of ['type','vehicleType']){const select=$('#'+id);if(select&&!select.querySelector('option[value="Pickup"]'))select.add(new Option('Pickup','Pickup'));}
$('#stock').add(new Option('Demostración','Demostración'));
filters.insertAdjacentHTML('beforebegin',`<div class="catalog-intro"><div class="quick-choices"><button data-quick="city">Para la ciudad</button><button data-quick="suv">Espacio SUV</button><button data-quick="auto">Automáticos</button><button data-quick="budget">Hasta USD 15.000</button><button data-quick="pickup">Pickups</button></div><p class="catalog-disclosure">Las fichas marcadas <b>Demostración</b> tienen fotos de referencia y datos simulados. No son unidades a la venta.</p></div>`);
$('.quick-choices').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('#resetFilters').click();if(b.dataset.quick==='city')$('#type').value='Hatch';if(b.dataset.quick==='suv')$('#type').value='SUV';if(b.dataset.quick==='pickup')$('#type').value='Pickup';if(b.dataset.quick==='auto')$('#gear').value='auto';if(b.dataset.quick==='budget')$('#budget').value='15000';render();});
const hero=$('.hero');hero.innerHTML=`<div class="hero-content"><p class="eyebrow">LRV / Selección automotriz</p><h1>El próximo capítulo<br>empieza al volante.</h1><p>Descubrí, compará y elegí con información. Una experiencia pensada alrededor de tu próximo auto.</p><div class="hero-actions"><a class="button primary" href="#catalogo">Explorar vehículos <span aria-hidden="true">↗</span></a></div><div class="hero-signature"><span>01 / Explorá</span><span>02 / Compará</span><span>03 / Coordiná</span></div></div><div id="heroVehicle" class="hero-vehicle"></div>`;
$('#catalogo .section-heading .eyebrow').textContent='Una selección para cada camino';
$('#catalogo .section-heading h2').textContent='Encontrá tu próxima historia.';
$('#contacto').insertAdjacentHTML('beforebegin',`<section class="section recent-section" id="recentSection" hidden><p class="eyebrow">Tu recorrido</p><h2>Volvé a los que te gustaron</h2><div id="recentVehicles" class="recent-grid"></div></section>`);
function renderRecent(){const items=recentlyViewed.map(id=>vehicles.find(v=>v.id===id)).filter(Boolean);$('#recentSection').hidden=!items.length;$('#recentVehicles').innerHTML=items.map(v=>`<button class="recent-card" data-recent="${v.id}"><img src="${esc(v.images?.[0])}" alt="${esc(v.brand+' '+v.model)}" loading="lazy"><span>${esc(v.brand)} ${esc(v.model)}</span><small>${v.demo?'Demostración · precio simulado':money(v.price)}</small></button>`).join('');$('#recentVehicles').querySelectorAll('button').forEach(b=>b.onclick=()=>detail(b.dataset.recent));}
let heroReady=false;
const showroomRender=render;
render=function(){showroomRender();
 document.querySelectorAll('.vehicle-card').forEach(card=>{const v=vehicles.find(v=>v.id===card.dataset.id);if(!v)return;card.querySelector('img').decoding='async';if(v.demo){card.classList.add('demo-card');card.querySelector('.availability').textContent='Demostración · no está a la venta';const p=document.createElement('p');p.className='reference-label';p.textContent='Foto de referencia · precio y km simulados';card.querySelector('.card-body').append(p);}});
 if(!heroReady&&vehicles.length){heroReady=true;const v=vehicles.find(x=>x.demo&&x.brand==='Hyundai')||vehicles.find(x=>!x.demo)||vehicles[0];$('#heroVehicle').innerHTML=`<button class="hero-car-link" aria-label="Explorar ${esc(v.brand+' '+v.model)}"><img src="${esc(v.images?.[0])}" alt="${esc(v.brand+' '+v.model)}${v.demo?' · imagen de referencia':''}" fetchpriority="high"><span class="hero-image-label">${v.demo?'Imagen de referencia / Demostración':'Del catálogo LRV'}<b>${esc(v.brand)} ${esc(v.model)}</b><span>Conocelo <span aria-hidden="true">↗</span></span></span></button>`;$('#heroVehicle button').onclick=()=>detail(v.id);}
 renderRecent();
};
const showroomDetail=detail;
let galleryIndex=0,galleryImages=[],galleryReturn,detailLayoutCleanup=()=>{};
document.body.insertAdjacentHTML('beforeend',`<div class="gallery-viewer" id="galleryViewer" role="dialog" aria-modal="true" aria-label="Galería ampliada" hidden><button id="galleryClose" aria-label="Cerrar galería">Cerrar ×</button><button id="galleryPrev" aria-label="Foto anterior">←</button><figure><img id="galleryImage" alt=""><figcaption id="galleryCaption"></figcaption></figure><button id="galleryNext" aria-label="Foto siguiente">→</button></div>`);
function updateGallery(){const image=galleryImages[galleryIndex];$('#galleryImage').src=image;$('#galleryCaption').textContent=`Foto ${galleryIndex+1} de ${galleryImages.length}`;$('#galleryPrev').disabled=$('#galleryNext').disabled=galleryImages.length<2;}
function galleryClose(){ $('#galleryViewer').hidden=true;galleryReturn?.focus();}
$('#galleryClose').onclick=galleryClose;$('#galleryPrev').onclick=()=>{galleryIndex=(galleryIndex-1+galleryImages.length)%galleryImages.length;updateGallery();};$('#galleryNext').onclick=()=>{galleryIndex=(galleryIndex+1)%galleryImages.length;updateGallery();};
let gallerySwipe;
$('#galleryViewer').addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'||galleryImages.length<2)return;gallerySwipe={x:event.clientX,y:event.clientY,id:event.pointerId};$('#galleryViewer').setPointerCapture?.(event.pointerId);});
$('#galleryViewer').addEventListener('pointerup',event=>{if(!gallerySwipe||gallerySwipe.id!==event.pointerId)return;const dx=event.clientX-gallerySwipe.x,dy=event.clientY-gallerySwipe.y;gallerySwipe=null;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.2)(dx<0?$('#galleryNext'):$('#galleryPrev')).click();});
$('#galleryViewer').addEventListener('pointercancel',()=>{gallerySwipe=null;});
document.addEventListener('keydown',e=>{if($('#galleryViewer').hidden)return;if(e.key==='Escape'){e.stopImmediatePropagation();galleryClose();}if(e.key==='ArrowLeft')$('#galleryPrev').click();if(e.key==='ArrowRight')$('#galleryNext').click();if(e.key==='Tab'){const buttons=[...$('#galleryViewer').querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement);e.preventDefault();buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}},true);
detail=function(id){showroomDetail(id);const v=vehicles.find(v=>v.id===id);if(!v)return;
 detailLayoutCleanup();detailLayoutCleanup=()=>{};
 recentlyViewed=[id,...recentlyViewed.filter(x=>x!==id)].slice(0,6);try{localStorage.setItem('lrv-recent',JSON.stringify(recentlyViewed));}catch{}renderRecent();
 const form=$('#detailContent form');
 let interestButton;
 const layout=$('#detailContent .detail-layout'),visual=layout?.firstElementChild,summary=layout?.lastElementChild;
 if(summary){
  summary.classList.add('vehicle-summary-panel');
  const badges=summary.querySelector('.badges');
  if(badges&&!badges.querySelector('.availability')){const availability=document.createElement('span');availability.className='badge availability';availability.textContent=v.availability||'Disponible';badges.append(availability);}
  const specs=summary.querySelector('.specs');
  if(specs&&visual){const heading=document.createElement('h3');heading.className='specs-title';heading.textContent='Características principales';const mobile=matchMedia('(max-width: 900px)');const placeSpecs=()=>{if(mobile.matches){summary.querySelector('.price')?.after(heading,specs);}else visual.append(heading,specs);};placeSpecs();mobile.addEventListener?.('change',placeSpecs);detailLayoutCleanup=()=>mobile.removeEventListener?.('change',placeSpecs);}
  const title=summary.querySelector('h2');
  if(title&&v.version){const version=document.createElement('p');version.className='vehicle-version';version.textContent=v.version;title.after(version);}
  const description=[...summary.children].find(node=>node.tagName==='P'&&!node.classList.contains('price')&&!node.classList.contains('vehicle-version'));
  if(description&&v.features?.length){const equipment=document.createElement('section');equipment.className='vehicle-equipment';equipment.innerHTML=`<h3>Equipamiento</h3><ul>${v.features.map(feature=>`<li>${esc(feature)}</li>`).join('')}</ul>`;description.after(equipment);}
  const actions=$('#detailContent .detail-actions');
  const advance=document.createElement('section');advance.className='advance-card';advance.innerHTML='<h3>Elegí cómo avanzar</h3><p>Consultá o coordiná una visita sin compromiso.</p>';
  interestButton=document.createElement('button');interestButton.type='button';interestButton.className='button whatsapp interest-button';interestButton.textContent='Consultar por WhatsApp';interestButton.setAttribute('aria-expanded','false');advance.append(interestButton);
  if(actions)advance.append(actions);summary.append(advance);
  if(form){form.classList.add('detail-contact-form');form.hidden=true;summary.append(form);}
  const revealForm=()=>{if(!form)return;form.hidden=false;interestButton.setAttribute('aria-expanded','true');interestButton.textContent='Completar consulta';form.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});};
  interestButton.onclick=revealForm;
  actions?.querySelector('.visit-action')?.addEventListener('click',revealForm,true);
 }
 if(visual){
  visual.classList.add('vehicle-gallery-panel');
  const hint=document.createElement('p');hint.className='photo-expand-hint';hint.innerHTML=window.matchMedia('(max-width: 600px)').matches?'<b>Galería del vehículo</b><span>Deslizá las miniaturas o tocá la foto para ampliar</span>':'<b>Vista interactiva</b><span>Mové el puntero para explorar · tocá para ampliar</span>';visual.prepend(hint);
  const main=visual.querySelector('.main-image');
  if(main){
   const stage=document.createElement('div');stage.className='vehicle-explorer';main.before(stage);stage.append(main);
   const controls=document.createElement('div');controls.className='explorer-controls';controls.innerHTML='<button type="button" data-zoom-out aria-label="Alejar">−</button><button type="button" data-zoom-in aria-label="Acercar">+</button><button type="button" data-fullscreen aria-label="Abrir pantalla completa">↗</button>';stage.append(controls);
   let zoom=1,rotateX=0,rotateY=0;
   const update=()=>{main.style.transform=`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${zoom})`;};
   stage.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;const rect=stage.getBoundingClientRect();rotateY=((event.clientX-rect.left)/rect.width-.5)*5;rotateX=-((event.clientY-rect.top)/rect.height-.5)*4;update();});
   stage.addEventListener('pointerleave',()=>{rotateX=rotateY=0;update();});
   controls.querySelector('[data-zoom-in]').onclick=event=>{event.stopPropagation();zoom=Math.min(1.5,zoom+.15);update();};
   controls.querySelector('[data-zoom-out]').onclick=event=>{event.stopPropagation();zoom=Math.max(1,zoom-.15);update();};
   controls.querySelector('[data-fullscreen]').onclick=event=>{event.stopPropagation();main.click();};
  }
 }
 if(v.demo){interestButton?.setAttribute('hidden','');form.hidden=true;$('#detailContent .visit-action').hidden=true;const banner=document.createElement('p');banner.className='demo-notice';banner.textContent='DEMOSTRACIÓN · Este vehículo no está a la venta. Precio, kilometraje y datos simulados; fotografía de referencia de otro mercado.';$('#detailContent').prepend(banner);}
 let currentPhoto=0;
 const openGallery=(index,returnElement)=>{galleryImages=v.images||[];if(!galleryImages.length)return;galleryIndex=index;galleryReturn=returnElement;$('#galleryImage').alt=`${v.brand} ${v.model}${v.demo?' · referencia':''}`;updateGallery();$('#galleryViewer').hidden=false;$('#galleryClose').focus();};
 const mainImage=$('#detailContent .main-image'),thumbs=$('#detailContent .thumbs'),thumbImages=[...(thumbs?.querySelectorAll('img')||[])];
 if(mainImage){mainImage.tabIndex=0;mainImage.setAttribute('role','button');mainImage.setAttribute('aria-label',`Ampliar foto de ${v.brand} ${v.model}`);mainImage.onclick=()=>openGallery(currentPhoto,mainImage);mainImage.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openGallery(currentPhoto,mainImage);}};}
 if(thumbs&&thumbImages.length<=1)thumbs.remove();
 else thumbImages.forEach((image,index)=>{image.loading='lazy';image.setAttribute('role','button');image.tabIndex=0;image.setAttribute('aria-label',`Mostrar foto ${index+1} de ${v.brand} ${v.model}`);image.setAttribute('aria-pressed',index===0?'true':'false');const select=()=>{currentPhoto=index;mainImage.src=v.images[index];mainImage.alt=`${v.brand} ${v.model} · foto ${index+1}`;thumbImages.forEach((thumb,i)=>thumb.setAttribute('aria-pressed',i===index?'true':'false'));};image.onclick=select;image.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}};});
 if(v.photoCredit){const c=v.photoCredit;const credit=document.createElement('p');credit.className='photo-credit';credit.innerHTML=`Fotografía de referencia: ${esc(c.author)} · <a href="${esc(c.source)}" target="_blank" rel="noopener">Fuente original</a> · <a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener">${esc(c.license)}</a>. Miniatura redimensionada; sin cambios de contenido.`;($('#detailContent .thumbs')||$('#detailContent .vehicle-explorer'))?.after(credit);}
};
// Demo flags must remain explicit when a vehicle appears in a comparison.
const compareClick=$('#compareOpen').onclick;$('#compareOpen').onclick=()=>{compareClick();$('#compareContent').querySelectorAll('article').forEach((a,i)=>{const id=[...comparison][i],v=vehicles.find(v=>v.id===id);if(v?.demo){const p=document.createElement('p');p.className='reference-label';p.textContent='Demostración · foto de referencia y datos simulados';a.prepend(p);}});};
if(vehicles.length)render();
