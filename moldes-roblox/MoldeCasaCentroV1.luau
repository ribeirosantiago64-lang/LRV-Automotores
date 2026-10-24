
-- Molde arquitectonico modular: casa moderna de dos plantas.
-- Sin personajes, puertas animadas ni mecanicas de juego.
local V=Vector3.new
local C=Color3.fromRGB
local House={}
function House.build(parent,worldFrame)
 local m=Instance.new("Model") m.Name="Casa_Centro_Molde_V1" m.WorldPivot=CFrame.identity
 m:SetAttribute("Tipo","Molde arquitectonico reutilizable")
 m:SetAttribute("Plantas",2) m:SetAttribute("CapacidadGaraje",2)
 m:SetAttribute("Referencia","Render de viviendas: casas del centro")
 m:SetAttribute("Version",1)
 local colors={stone=C(222,210,188),trim=C(239,229,208),plum=C(100,76,111),dark=C(36,38,37),wood=C(132,96,62),glass=C(171,205,213),green=C(65,98,54)}
 local groups={}
 local function group(name)
  local g=Instance.new("Model") g.Name=name g.WorldPivot=CFrame.identity g.Parent=m groups[name]=g return g
 end
 local function p(g,name,size,cf,color,material,solid)
  local a=Instance.new("Part") a.Name=name a.Size=size a.CFrame=typeof(cf)=="CFrame" and cf or CFrame.new(cf)
  a.Anchored=true a.CanCollide=solid~=false a.CanTouch=false a.Color=color or colors.stone
  a.Material=material or Enum.Material.Limestone
  if a.Material==Enum.Material.Limestone then a.MaterialVariant="CiudadV2_PiedraCaliza"
  elseif a.Material==Enum.Material.Pavement then a.MaterialVariant="CiudadV2_VeredaPiedra" end
  a.TopSurface=Enum.SurfaceType.Smooth a.BottomSurface=Enum.SurfaceType.Smooth
  if math.max(size.X,size.Y,size.Z)<1 then a.CastShadow=false end
  a.Parent=g return a
 end
 local function glass(g,cf,w,h)
  local a=p(g,"Cristal",V(w,h,.18),cf,colors.glass,Enum.Material.Glass,true)
  a.Transparency=.46 a.Reflectance=.12 a.CastShadow=false
  for _,s in {-1,1} do
   p(g,"Marco_aluminio",V(.22,h+.3,.38),cf*CFrame.new(s*w/2,0,.04),colors.dark,Enum.Material.Metal,false)
   p(g,"Travesano",V(w,.22,.38),cf*CFrame.new(0,s*h/2,.04),colors.dark,Enum.Material.Metal,false)
  end
  return a
 end
 local function subtract(a,b)
  local l,r=math.max(a.l,b.l),math.min(a.r,b.r) local d,u=math.max(a.d,b.d),math.min(a.u,b.u)
  if l>=r or d>=u then return {a} end
  local out={} local function add(l,r,d,u) if r-l>.03 and u-d>.03 then table.insert(out,{l=l,r=r,d=d,u=u}) end end
  add(a.l,l,a.d,a.u) add(r,a.r,a.d,a.u) add(l,r,a.d,d) add(l,r,u,a.u) return out
 end
 local function wall(g,name,frame,left,right,bottom,top,holes,col)
  local rects={{l=left,r=right,d=bottom,u=top}}
  for _,hole in holes do local new={} for _,a in rects do for _,v in subtract(a,hole) do table.insert(new,v) end end rects=new end
  for _,a in rects do p(g,name,V(a.r-a.l,a.u-a.d,.9),frame*CFrame.new((a.l+a.r)/2,(a.d+a.u)/2,0),col or colors.stone) end
  for _,a in holes do if not a.open then glass(g,frame*CFrame.new((a.l+a.r)/2,(a.d+a.u)/2,.18),a.r-a.l,a.u-a.d) end end
 end
 local function rail(g,a,b,height)
  local f=CFrame.lookAt((a+b)/2,b) local len=(b-a).Magnitude
  local a1=p(g,"Panel_baranda",V(.16,height,len),f*CFrame.new(0,height/2,0),colors.glass,Enum.Material.Glass,true)
  a1.Transparency=.62 a1.CastShadow=false
  p(g,"Pasamanos",V(.24,.23,len),f*CFrame.new(0,height,0),colors.dark,Enum.Material.Metal,false)
  local count=math.ceil(len/9) for j=0,count do p(g,"Poste_baranda",V(.24,height,.24),a:Lerp(b,j/count)+V(0,height/2,0),colors.dark,Enum.Material.Metal,false) end
 end
 local function sconce(g,x,y,z,normal)
  local cf=CFrame.new(x,y,z)*CFrame.Angles(0,math.rad(normal or 0),0)
  p(g,"Aplique_soporte",V(1.4,3.4,.45),cf,colors.dark,Enum.Material.Metal,false)
  local lens=p(g,"Aplique_difusor",V(.85,2.8,.24),cf*CFrame.new(0,0,.3),C(255,220,169),Enum.Material.Neon,false)
  local l=Instance.new("PointLight") l.Color=C(255,218,167) l.Range=12 l.Brightness=.45 l.Shadows=false l.Parent=lens
 end
 local g=group("01_Estructura")
 p(g,"Zapata",V(86,1.6,56),V(0,.8,-1),colors.stone)
 p(g,"Piso_planta_baja",V(84,.6,54),V(0,2.3,-1),C(185,180,166),Enum.Material.Concrete)
 -- Upper slab has a real opening for the stair.
 p(g,"Entrepiso_derecho",V(42,.7,40),V(21,18.85,-8),colors.trim)
 p(g,"Entrepiso_sala",V(32,.7,40),V(-26,18.85,-8),colors.trim)
 p(g,"Desembarco_escalera",V(10,.7,6),V(-5,18.85,-25),colors.trim)
 p(g,"Paso_frontal",V(10,.7,3),V(-5,18.85,10.5),colors.trim)
 for i=1,21 do local height=i*(16.6/21)
  p(g,"Escalon_interior_"..i,V(8,height,1.46),V(-5,2.6+height/2,9-(i-.5)*1.46),colors.trim)
 end
 wall(g,"Division_garaje",CFrame.new(0,0,-1)*CFrame.Angles(0,math.rad(90),0),-27,27,2.6,18.5,{{l=13,r=20,d=2.6,u=13,open=true}},colors.stone)
 rail(g,V(-10,19.2,-21.5),V(-10,19.2,10),3.6)
 rail(g,V(0,19.2,-21.5),V(0,19.2,10),3.6)
 task.wait()
 local f=group("02_Fachadas")
 -- Recessed entrance beside the plum tower.
 wall(f,"Muro_entrada",CFrame.new(0,0,17),-28,0,2.6,18.5,{
  {l=-23,r=-14,d=2.6,u=14.6,open=true},{l=-10.5,r=-2.5,d=5,u=14.3}},colors.stone)
 wall(f,"Torre_violeta",CFrame.new(0,0,19.4),-42,-28,1.6,39,{
  {l=-36.4,r=-33.2,d=6,u=17.5},{l=-36.4,r=-33.2,d=22,u=34.5}},colors.plum)
 p(f,"Remate_torre",V(15.5,1,7),V(-35,39.4,17),colors.trim)
 local backholes={}
 for _,x in {-27,22} do table.insert(backholes,{l=x-8,r=x+8,d=6,u=14}) end
 for _,x in {-29,-5,25} do table.insert(backholes,{l=x-8.5,r=x+8.5,d=23,u=33}) end
 wall(f,"Fachada_posterior",CFrame.new(0,0,-28)*CFrame.Angles(0,math.pi,0),-42,42,2.6,35.5,backholes)
 wall(f,"Fachada_oeste",CFrame.new(-42,0,-1)*CFrame.Angles(0,-math.pi/2,0),-27,18,2.6,35.5,{
  {l=-18,r=-5,d=6,u=14},{l=-18,r=-3,d=23,u=33}})
 wall(f,"Fachada_este_baja",CFrame.new(42,0,-1)*CFrame.Angles(0,math.pi/2,0),-27,27,2.6,18.5,{
  {l=8,r=22,d=10,u=14}})
 wall(f,"Fachada_este_alta",CFrame.new(42,0,-8)*CFrame.Angles(0,math.pi/2,0),-20,20,19.2,35.5,{
  {l=-18.5,r=-1,d=22,u=33},{l=5,r=16,d=23,u=33}})
 -- Upstairs sliding glass, open views into the upper room.
 p(f,"Antepecho_superior",V(70,1.2,1),V(7,19.8,12),colors.stone)
 p(f,"Dintel_superior",V(70,2.1,1),V(7,34.5,12),colors.trim)
 for i=0,3 do
  glass(f,CFrame.new(-19.25+i*17.5,26.9,12.25),17,13)
 end
 for _,x in {-28,-10.5,7,24.5,42} do p(f,"Montante_fachada",V(.5,13.1,.5),V(x,26.9,12.3),colors.dark,Enum.Material.Metal,false) end
 p(f,"Retorno_torre",V(.9,37.4,3.2),V(-42,20.3,18),colors.plum)
 p(f,"Puerta_principal",V(8.4,11.6,.3),V(-18.5,8.5,16.6),colors.wood,Enum.Material.WoodPlanks,true)
 p(f,"Tirador",V(.18,3,.25),V(-15.2,8.5,16.95),C(189,161,105),Enum.Material.Metal,false)
 p(f,"Alero_entrada",V(15,.7,7),V(-18.5,16,20),colors.trim)
 sconce(f,-25.5,11.5,17.6) sconce(f,-1.5,12,27)
 for _,x in {-27,41} do sconce(f,x,28,12.8) end
 task.wait()
 local roof=group("03_Cubiertas_y_Balcon")
 p(roof,"Cubierta_principal",V(87,1.1,44),V(0,36.1,-7),colors.trim)
 p(roof,"Cornisa_delantera",V(87,2.1,2.2),V(0,35.5,15),colors.trim)
 for _,x in {-42,42} do p(roof,"Petral_cubierta",V(1.1,1.8,44),V(x,37.2,-7),colors.stone) end
 p(roof,"Pretil_posterior",V(85,1.8,1.1),V(0,37.2,-28.5),colors.stone)
 p(roof,"Losa_balcon",V(71,.9,17.5),V(7,18.75,20.6),colors.trim)
 p(roof,"Pavimento_balcon",V(69,.12,16.8),V(7,19.27,20.6),C(197,183,159),Enum.Material.Pavement)
 rail(roof,V(-28,19.35,29.1),V(42,19.35,29.1),4.1)
 rail(roof,V(-28,19.35,12.2),V(-28,19.35,29.1),4.1)
 rail(roof,V(42,19.35,12.2),V(42,19.35,29.1),4.1)
 p(roof,"Voladizo_frontal",V(72,.65,6),V(7,35.1,15.5),colors.trim)
 p(roof,"Canalon",V(86,.35,.45),V(0,35.4,-29.1),C(95,91,80),Enum.Material.Metal,false)
 for _,x in {-41,41} do p(roof,"Bajada_pluvial",V(.4,32,.4),V(x,18,-29.3),C(126,118,103),Enum.Material.Metal,false) end
 local garage=group("04_Garaje_doble")
 wall(garage,"Marco_porton",CFrame.new(0,0,26),0,42,2.6,18.5,{{l=1.7,r=40.3,d=2.6,u=15.7,open=true}})
 p(garage,"Porton_prototipo",V(38.2,12.7,.5),V(21,9,25.65),C(51,49,46),Enum.Material.Metal,true)
 for y=3.6,15,1.05 do p(garage,"Junta_panel_porton",V(37.8,.07,.08),V(21,y,25.94),C(91,86,77),Enum.Material.Metal,false) end
 p(garage,"Jamba_izquierda",V(.6,13.5,1.2),V(1.1,9,26.3),colors.dark,Enum.Material.Metal)
 p(garage,"Jamba_derecha",V(.6,13.5,1.2),V(40.9,9,26.3),colors.dark,Enum.Material.Metal)
 p(garage,"Vierteaguas_garaje",V(44,.8,5),V(21,18.1,26),colors.trim)
 sconce(garage,43.1,12.3,26) sconce(garage,-1,12.3,26)
 for _,x in {11,31} do p(garage,"Lineas_garaje",V(.15,.025,31),V(x,2.62,-3),C(204,199,172),Enum.Material.SmoothPlastic,false) end
 task.wait()
 local int=group("05_Interiores_basicos")
 local function seat(x,y,z)
  p(int,"Sillon",V(7,1.5,6),V(x,y+2,z),C(208,196,174),Enum.Material.Fabric)
  p(int,"Respaldo_sillon",V(7,3,1),V(x,y+3.5,z-2.7),C(208,196,174),Enum.Material.Fabric)
  for _,dx in {-3,3} do p(int,"Brazo_sillon",V(.8,2.4,6),V(x+dx,y+2.8,z),C(208,196,174),Enum.Material.Fabric) end
 end
 seat(6,19.35,23) seat(28,19.35,23)
 p(int,"Mesa_terraza",V(9,.5,5),V(17,22.1,23),colors.wood,Enum.Material.WoodPlanks)
 for _,x in {13.5,20.5} do p(int,"Pie_mesa_terraza",V(.45,2.5,3.5),V(x,20.85,23),colors.dark,Enum.Material.Metal) end
 p(int,"Alfombra_sala",V(22,.08,16),V(-25,2.66,-1),C(155,139,116),Enum.Material.Fabric,false)
 p(int,"Sofa_sala",V(17,2.3,6),V(-28,4.5,-7),C(194,180,155),Enum.Material.Fabric)
 p(int,"Respaldo_sofa",V(17,3,1),V(-28,6.5,-9.6),C(194,180,155),Enum.Material.Fabric)
 p(int,"Mesa_sala",V(9,2.2,5),V(-28,3.8,2),colors.wood,Enum.Material.WoodPlanks)
 p(int,"Cocina_mueble",V(20,4,5),V(-26,4.6,-22),colors.trim)
 p(int,"Cocina_encimera",V(21,.5,6),V(-26,6.85,-22),C(92,86,79),Enum.Material.Marble)
 p(int,"Cama_muestra",V(13,2,16),V(24,20.3,-14),C(216,205,184),Enum.Material.Fabric)
 p(int,"Cabecera",V(14,5,1),V(24,22.5,-22),colors.wood,Enum.Material.WoodPlanks)
 p(int,"Manta_violeta",V(13,.15,6),V(24,21.38,-8),colors.plum,Enum.Material.Fabric,false)
 for _,a in {{-24,17.9,-6},{21,17.9,-2},{9,35.2,-4}} do
  local lp=p(int,"Luz_lineal_interior",V(12,.1,.6),V(a[1],a[2],a[3]),C(255,220,165),Enum.Material.Neon,false)
  local l=Instance.new("PointLight") l.Range=22 l.Color=C(255,222,177) l.Brightness=.7 l.Shadows=false l.Parent=lp
 end
 local site=group("06_Parcela_y_Accesos")
 p(site,"Basamento_muestra",V(150,3,150),V(0,-1.5,19),C(164,160,144),Enum.Material.Concrete)
 p(site,"Cesped",V(136,.16,103),V(0,.08,5),C(85,118,65),Enum.Material.Ground)
 -- Straight driveway joins a curb opening, with a mild actual slope.
 local a,b=V(21,2.2,26),V(21,.7,55)
 p(site,"Acceso_doble",V(43,.35,(b-a).Magnitude),CFrame.lookAt((a+b)/2,b),C(205,195,173),Enum.Material.Pavement)
 p(site,"Camino_entrada",V(9,.3,33),V(-18.5,.8,37),colors.trim,Enum.Material.Pavement)
 for i=1,3 do p(site,"Peldaño_entrada",V(11,.5,2.3),V(-18.5,.9+i*.48,24.4-i*2.3),colors.trim) end
 -- Side/rear walls and capping stones.
 for _,x in {-64,64} do
  p(site,"Muro_lateral",V(1.2,3.1,102),V(x,1.6,3),colors.stone)
  p(site,"Albarda",V(1.7,.35,103),V(x,3.3,3),colors.trim)
 end
 p(site,"Muro_posterior",V(129,3.1,1.2),V(0,1.6,-48),colors.stone)
 p(site,"Albarda_posterior",V(130,.35,1.7),V(0,3.3,-48),colors.trim)
 local function fence(x1,x2,z)
  local w=x2-x1
  p(site,"Zocalo_cerco",V(w,1.4,1.2),V((x1+x2)/2,.7,z),colors.stone)
  p(site,"Pasamanos_cerco",V(w,.3,.4),V((x1+x2)/2,5,z),colors.dark,Enum.Material.Metal,false)
  for x=x1+.4,x2-.2,1.3 do p(site,"Barrote_cerco",V(.16,3.6,.23),V(x,3.1,z),colors.dark,Enum.Material.Metal,true) end
 end
 fence(-63,-25,49) fence(-12,-1,49) fence(45,63,49)
 for _,x in {-63,-25,-12,-1,45,63} do
  p(site,"Pilar_entrada",V(2.1,5.8,2.1),V(x,2.9,49),colors.stone)
  p(site,"Tapa_pilar",V(2.7,.45,2.7),V(x,6,49),colors.trim)
  sconce(site,x,4.1,50.15)
 end
 -- Pedestrian gate is visual only.
 for x=-23.5,-13,1.4 do p(site,"Barrote_portillo",V(.16,4.6,.25),V(x,2.7,49),colors.dark,Enum.Material.Metal,true) end
 p(site,"Pasamanos_portillo",V(12,.25,.35),V(-18.5,5.05,49),colors.dark,Enum.Material.Metal,false)
 task.wait()
 local street=group("07_Calle_y_Vereda")
 p(street,"Calzada_muestra",V(150,.5,28),V(0,-.05,72),C(54,56,55),Enum.Material.Asphalt,true)
 p(street,"Vereda_izquierda",V(68,.7,8),V(-41,.35,54),colors.trim,Enum.Material.Pavement,true)
 p(street,"Vereda_derecha",V(29,.7,8),V(60.5,.35,54),colors.trim,Enum.Material.Pavement,true)
 p(street,"Vereda_acceso",V(43,.25,8),V(21,.32,54),colors.trim,Enum.Material.Pavement,true)
 for _,r in {{-75,-1},{45,75}} do p(street,"Cordon",V(r[2]-r[1],.7,.45),V((r[1]+r[2])/2,.35,58),C(205,200,181),Enum.Material.Concrete) end
 for x=-65,65,22 do p(street,"Linea_central",V(10,.02,.18),V(x,.22,72),C(222,196,104),Enum.Material.SmoothPlastic,false) end
 p(street,"Linea_borde",V(149,.02,.15),V(0,.22,59.2),C(220,216,202),Enum.Material.SmoothPlastic,false)
 local greenery=group("08_Paisajismo_y_Utileria")
 local lib=game.ServerStorage:FindFirstChild("BibliotecaVisual")
 local function asset(name,x,y,z,h,rot)
  local source=lib and lib:FindFirstChild(name) if not source then return end
  local model=source:Clone()
  local _,sz=model:GetBoundingBox() model:ScaleTo(model:GetScale()*h/sz.Y)
  model:PivotTo(CFrame.new(x,y,z)*CFrame.Angles(0,math.rad(rot or 0),0))
  for _,a in model:GetDescendants() do if a:IsA("BasePart") then a.Anchored=true a.CanCollide=false a.CanTouch=false
   if a:IsA("MeshPart") then a.RenderFidelity=Enum.RenderFidelity.Automatic end
  elseif a:IsA("BaseScript") then a:Destroy() end end
  model.Parent=greenery return model
 end
 local function planter(x,y,z,w,d,h)
  h=h or 1.4
  p(greenery,"Jardinera",V(w,h,d),V(x,y+h/2,z),colors.stone)
  p(greenery,"Tierra",V(w-.5,.12,d-.5),V(x,y+h+.06,z),C(82,66,48),Enum.Material.Ground,false)
  local n=math.max(1,math.floor(w/4))
  for i=1,n do
   local xx=x-w/2+(i-.5)*w/n
   asset("Arbusto_Optimizado",xx,y+h+.15,z,3.2,(i*63)%360)
   for _,dz in {-d/4,d/4} do
    p(greenery,"Tallo_lavanda",V(.12,1.8,.12),V(xx+.8,y+h+1,dz+z),colors.green,Enum.Material.SmoothPlastic,false)
    local bloom=p(greenery,"Flor_lavanda",V(.48,.9,.48),V(xx+.8,y+h+2,dz+z),C(135,103,155),Enum.Material.SmoothPlastic,false) bloom.Shape=Enum.PartType.Ball
   end
  end
 end
 planter(-45,0,41,30,10,1.4) planter(54,0,28,13,23,1.4)
 planter(-57,0,8,10,30,1.2) planter(57,0,-17,10,31,1.2)
 planter(-20,19.35,24,8,4,2.1) planter(37,19.35,22,6,5,2.1)
 asset("Palmera_Costera",-53,0,20,35,10)
 asset("Palmera_Costera",54,0,-7,38,170)
 asset("Arbol_Fondo_Optimizado",-53,0,-30,25,45)
 for x=-54,54,12 do asset("Arbusto_Optimizado",x,0,-41,5.5,x*7) end
 asset("SUV_Blanca",10,1.35,40,6.1,180)
 asset("Sedan_Optimizado",31,1.35,41,5.6,180)
 -- Compact address plate.
 local plate=p(greenery,"Numero_domicilio",V(3.4,1.8,.25),V(-11,9.7,17.7),colors.dark,Enum.Material.Metal,false)
 local gui=Instance.new("SurfaceGui") gui.Face=Enum.NormalId.Back gui.SizingMode=Enum.SurfaceGuiSizingMode.PixelsPerStud gui.PixelsPerStud=45 gui.LightInfluence=.3 gui.Parent=plate
 local label=Instance.new("TextLabel") label.Size=UDim2.fromScale(1,1) label.BackgroundTransparency=1 label.Text="01" label.TextScaled=true label.TextColor3=colors.trim label.Font=Enum.Font.GothamMedium label.Parent=gui
 m:PivotTo(worldFrame or CFrame.identity)
 m.Parent=parent
 return m
end
return House

