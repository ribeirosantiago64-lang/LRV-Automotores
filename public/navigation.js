const header=document.querySelector('.topbar');
const toggle=document.querySelector('#menuToggle');
const navigation=document.querySelector('#mainNavigation');
function setMenu(open){header.classList.toggle('menu-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');}
toggle.addEventListener('click',()=>setMenu(toggle.getAttribute('aria-expanded')!=='true'));
navigation.addEventListener('click',event=>{if(event.target.closest('a,button'))setMenu(false);});
document.addEventListener('pointerdown',event=>{if(!header.contains(event.target))setMenu(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){setMenu(false);toggle.focus();}});
window.addEventListener('resize',()=>{if(window.innerWidth>900)setMenu(false);});
