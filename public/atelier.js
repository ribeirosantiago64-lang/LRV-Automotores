// Editorial collection: extends the existing catalogue without replacing its data or controls.
(()=>{
 const catalog=document.getElementById('catalogo');
 if(!catalog||typeof render!=='function')return;
 const section=document.createElement('section');
 section.className='atelier-showcase';
 section.setAttribute('aria-labelledby','atelierTitle');
 section.innerHTML='<div class="atelier-heading"><div><p class="eyebrow">THE LRV SELECTION / 2026</p><h2 id="atelierTitle">Una nueva forma<br>de elegir.</h2></div><p>Diseño, personalidad y libertad de movimiento. Explorá nuestros vehículos destacados.</p></div><div class="atelier-items" id="atelierItems"></div>';
 catalog.before(section);
 const container=section.querySelector('#atelierItems');
 const observe='IntersectionObserver' in window&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const observer=observe?new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target);}}},{threshold:.1}):null;
 function reveal(){
  if(!observer)return;
  section.querySelectorAll('.atelier-reveal:not(.is-visible)').forEach(el=>observer.observe(el));
 }
 function update(){
  if(typeof vehicles==='undefined'||!Array.isArray(vehicles))return;
  const available=vehicles.filter(v=>v&&Array.isArray(v.images)&&v.images[0]&&v.availability!=='Vendido');
  const real=available.filter(v=>!v.demo);
  const chosen=[...real,...available.filter(v=>v.demo)].slice(0,3);
  container.replaceChildren();
  if(!chosen.length){const p=document.createElement('p');p.className='atelier-empty';p.textContent='Pronto vas a encontrar vehículos destacados aquí.';container.append(p);return;}
  chosen.forEach((v,i)=>{
   const card=document.createElement('button');card.type='button';card.className='atelier-feature atelier-reveal';card.setAttribute('aria-label','Ver '+v.brand+' '+v.model);
   const img=document.createElement('img');img.src=v.images[0];img.alt=v.brand+' '+v.model;img.loading=i===0?'eager':'lazy';img.decoding='async';
   const content=document.createElement('div');content.className='atelier-feature-content';
   const eyebrow=document.createElement('small');eyebrow.textContent=v.demo?'Concepto demostrativo · no a la venta':(v.condition||'Selección LRV')+' / '+(v.year||'');
   const name=document.createElement('strong');name.textContent=v.brand+' '+v.model;
   const price=document.createElement('span');price.textContent=v.demo?'Precio ilustrativo, no disponible':(typeof money==='function'?money(v.price):'Consultar precio');
   const cta=document.createElement('em');cta.textContent='Explorar vehículo ↗';
   content.append(eyebrow,name,price,cta);card.append(img,content);
   card.addEventListener('click',()=>{if(typeof detail==='function')detail(v.id);});
   container.append(card);
  });
  if(observer)reveal();else container.querySelectorAll('.atelier-reveal').forEach(el=>el.classList.add('is-visible'));
 }
 const baseRender=render;
 render=function(...args){const result=baseRender.apply(this,args);update();return result;};
 update();
})();
