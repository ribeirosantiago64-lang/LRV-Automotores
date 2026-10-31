import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=','base64');
const mf=new Miniflare(convertV4MiniflareOptions({modules:[{type:'ESModule',path:'test-main.js',contents:`import {seedShowcase} from './src/showcase.js';export default {async fetch(r,env){await seedShowcase(env);return new Response('ok')}}`},...['showcase','showcase-data','storage'].map(name=>({type:'ESModule',path:`src/${name}.js`,contents:readFileSync(`src/${name}.js`,'utf8')}))],compatibilityDate:'2026-08-15',d1Databases:['INQUIRIES_DB'],r2Buckets:['VEHICLE_PHOTOS'],outboundService:request=>{assert.ok(new URL(request.url).hostname.endsWith('wikimedia.org'));return new Response(png);}}));
try{
 const db=await mf.getD1Database('INQUIRIES_DB');
 await db.exec("CREATE TABLE storage_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);INSERT INTO storage_meta VALUES('catalog_ready','1');");
 for(let i=0;i<3;i++)assert.equal((await mf.dispatchFetch('https://test.local/')).status,200);
 assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM vehicles').first()).count,6);
 const {results}=await db.prepare('SELECT data FROM vehicles').all();
 for(const {data} of results){const v=JSON.parse(data);assert.equal(v.demo,true);assert.equal(v.availability,'Demostración');assert.ok(v.images[0].startsWith('/media/vehicles/demo-'));assert.ok(v.photoCredit.licenseUrl.startsWith('https://creativecommons.org/'));}
 await db.prepare("UPDATE vehicles SET active=0 WHERE id='demo-honda-fit'").run();await mf.dispatchFetch('https://test.local/');
 assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM vehicles WHERE active=1').first()).count,5);
 console.log('PASS six licensed demos, R2 photos, resumable import and no resurrection');
}finally{await mf.dispose();}
