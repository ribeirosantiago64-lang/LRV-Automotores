import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

const origin='https://local.test',head='a'.repeat(40);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=','base64');
const legacy=Array.from({length:3},(_,i)=>({id:'legacy-'+i,brand:'Marca',model:'Modelo '+i,year:2026,price:20000,condition:'Usado',type:'SUV',km:100,fuel:'Nafta',transmission:'Automática',description:'Vehículo existente',images:[`https://raw.githubusercontent.com/test/test/main/vehiculos/legacy-${i}/fotos/foto-01.png`]}));
let rejectThird=true,githubReads=0;
const mf=new Miniflare(convertV4MiniflareOptions({workers:[
  {name:'backend',modules:[{type:'ESModule',path:'src/index.js',contents:readFileSync('src/index.js','utf8')},{type:'ESModule',path:'src/storage.js',contents:readFileSync('src/storage.js','utf8')}],compatibilityDate:'2026-08-15',d1Databases:['INQUIRIES_DB'],r2Buckets:['VEHICLE_PHOTOS'],bindings:{ADMIN_PASSWORD:'local-test-password',SESSION_SECRET:'local-test-secret-only',GITHUB_OWNER:'test',GITHUB_REPO:'test',GITHUB_BRANCH:'main',GITHUB_TOKEN:'local'},
    outboundService:request=>{
      assert.equal(request.method,'GET','Migration must never write GitHub');
      githubReads++;
      const path=new URL(request.url).pathname;
      let data;
      if(path.endsWith('/git/ref/heads/main'))data={object:{sha:head}};
      else if(path.endsWith('/git/commits/'+head))data={tree:{sha:'tree'}};
      else if(path.endsWith('/git/trees/tree'))data={tree:legacy.map((v,i)=>({type:'blob',path:`vehiculos/${v.id}/datos.json`,sha:'blob-'+i}))};
      else if(path.includes('/git/blobs/blob-'))data={content:Buffer.from(JSON.stringify(legacy[Number(path.split('blob-')[1])])).toString('base64')};
      else if(path.includes('/contents/vehiculos/')){
        if(path.includes('/legacy-2/') && rejectThird)return new Response('Temporary simulated failure',{status:502});
        data={size:png.length,encoding:'base64',content:png.toString('base64')};
      }else throw new Error('Unexpected outbound request: '+path);
      return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
    }},
  {name:'pages',modules:true,scriptPath:'pages/src/_worker.js',compatibilityDate:'2026-08-15',routes:['site.pages.dev/*'],serviceBindings:{BACKEND:'backend'}}
]}));
const request=(path,options={})=>mf.dispatchFetch(origin+path,options);
let cookie;
const auth=()=>({cookie,origin});
const postVehicle=async (vehicle,photos=[],originalId='')=>{
  const form=new FormData();form.append('vehicle',JSON.stringify(vehicle));
  if(originalId)form.append('originalId',originalId);
  for(const photo of photos)form.append('photos',photo);
  const encoded=new Request(origin+'/api/vehicles',{method:'POST',headers:auth(),body:form});
  return request('/api/vehicles',{method:'POST',headers:Object.fromEntries(encoded.headers),body:await encoded.arrayBuffer()});
};
try{
  const db=await mf.getD1Database('INQUIRIES_DB','backend');
  await db.exec("CREATE TABLE inquiries (id TEXT PRIMARY KEY,created_at TEXT NOT NULL,vehicle_id TEXT NOT NULL,vehicle TEXT NOT NULL,price REAL NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,email TEXT NOT NULL,message TEXT NOT NULL,channel TEXT NOT NULL,ip_hash TEXT NOT NULL);");
  await db.prepare("INSERT INTO inquiries VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind('old-request','2026-09-01T10:00:00.000Z','legacy-0','Marca Modelo 0 2026',20000,'Cliente anterior','097135114','cliente@example.com','Consulta anterior','email','old-hash').run();
  assert.equal((await request('/api/storage')).status,401);
  assert.equal((await request('/api/storage/migrate',{method:'POST',headers:{origin}})).status,401);
  const login=await request('/api/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({password:'local-test-password'})});
  cookie=login.headers.get('set-cookie').split(';')[0];
  const step=await request('/api/storage/migrate',{method:'POST',headers:auth()});
  assert.equal(step.status,200);assert.equal((await step.json()).imported,2);
  const failure=await request('/api/storage/migrate',{method:'POST',headers:auth()});
  assert.equal(failure.status,500);
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM inquiries").first()).count,1);
  assert.equal((await (await request('/api/storage',{headers:auth()})).json()).ready,false);
  rejectThird=false;
  const resumed=await request('/api/storage/migrate',{method:'POST',headers:auth()});
  assert.equal(resumed.status,200);assert.equal((await resumed.json()).ready,true);
  const reads=githubReads;
  let catalog=await (await request('/api/vehicles')).json();
  assert.equal(catalog.length,3);assert.ok(catalog.every(v=>v.images.every(url=>url.startsWith('/media/vehicles/'))));
  assert.equal(githubReads,reads,'Ready catalog must not depend on GitHub');
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM users").first()).count,1);
  const photoUrl=catalog[0].images[0];
  const photo=await request(photoUrl);assert.equal(photo.status,200);assert.equal(photo.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()),png);
  assert.equal((await request(photoUrl,{headers:{'if-none-match':photo.headers.get('etag')}})).status,304);
  assert.equal((await request(photoUrl,{method:'HEAD'})).status,200);
  assert.equal((await request(photoUrl,{method:'POST'})).status,405);
  const sample={id:'new-vehicle',brand:'Prueba',model:'Nuevo',year:2026,price:12345,condition:'0 km',type:'Hatch',km:0,fuel:'Nafta',transmission:'Manual',description:'Nuevo vehículo',existingImages:[]};
  assert.equal((await postVehicle(sample,[new File(['not an image'],'fake.png',{type:'image/png'})])).status,400);
  const made=await postVehicle(sample,[new File([png],'real.png',{type:'image/png'})]);
  assert.equal(made.status,201);
  const saved=(await made.json()).vehicle;
  assert.ok(saved.images[0].startsWith('/media/vehicles/new-vehicle/'));assert.equal(saved.revision,1);
  assert.equal((await postVehicle(sample,[new File([png],'real.png',{type:'image/png'})])).status,409);
  assert.equal((await postVehicle({...saved,existingImages:[photoUrl]},[],saved.id)).status,400);
  const edited=await postVehicle({...saved,description:'Descripción actualizada',existingImages:saved.images},[],saved.id);
  assert.equal(edited.status,201);assert.equal((await edited.json()).vehicle.revision,2);
  assert.equal((await postVehicle({...saved,existingImages:saved.images},[],saved.id)).status,409);
  const active=await (await request('/api/vehicles')).json();
  const current=active.find(v=>v.id===saved.id);
  const attempts=await Promise.all([1,2].map(i=>postVehicle({...current,description:'Edición concurrente '+i,existingImages:current.images},[new File([png],'new.png',{type:'image/png'})],current.id)));
  assert.deepEqual(attempts.map(r=>r.status).sort(),[201,409]);
  const bucket=await mf.getR2Bucket('VEHICLE_PHOTOS','backend');
  assert.equal((await bucket.list({prefix:'vehicles/new-vehicle/'})).objects.length,2,'Failed save must clean up only its newly uploaded photo');
  assert.equal((await request('/api/vehicles/'+saved.id,{method:'DELETE',headers:auth()})).status,200);
  assert.ok(!(await (await request('/api/vehicles')).json()).some(v=>v.id===saved.id));
  assert.equal((await request(saved.images[0])).status,200,'Archive must retain photos');
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM inquiries").first()).count,1,'Archive must retain historical inquiries');
  assert.equal((await (await request('/api/storage/migrate',{method:'POST',headers:auth()})).json()).ready,true);
  assert.equal((await request('/api/vehicles',{method:'POST',body:new FormData()})).status,401);
  const pages={fetch:(url,options)=>mf.dispatchFetch(url,options)};
  const pagesLogin=await pages.fetch('https://site.pages.dev/api/login',{method:'POST',headers:{origin:'https://site.pages.dev','content-type':'application/json'},body:JSON.stringify({password:'local-test-password'})});
  assert.equal(pagesLogin.status,200,'Pages proxy must preserve same-origin authentication');
  const pagesCookie=pagesLogin.headers.get('set-cookie').split(';')[0];
  assert.equal((await pages.fetch('https://site.pages.dev/api/storage',{headers:{cookie:pagesCookie}})).status,200);
  assert.equal((await pages.fetch('https://site.pages.dev'+photoUrl)).status,200);
  assert.equal((await pages.fetch('https://site.pages.dev/api/storage/migrate',{method:'POST',headers:{cookie:pagesCookie,origin:'https://evil.example'}})).status,403);
  console.log('PASS: resumable migration, D1 catalog/users, R2 image serving, upload validation, edit conflicts, rollback cleanup, history preservation and Pages proxy.');
}finally{await mf.dispose();}
