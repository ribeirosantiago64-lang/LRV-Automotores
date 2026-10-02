import {cp,mkdir,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
const root=new URL("../",import.meta.url);
const output=new URL("pages/dist/",root);
await mkdir(output,{recursive:true});
await cp(fileURLToPath(new URL("public/",root)),fileURLToPath(output),{recursive:true});
await cp(fileURLToPath(new URL("pages/src/_worker.js",root)),fileURLToPath(new URL("_worker.js",output)));
await writeFile(new URL("_routes.json",output),JSON.stringify({version:1,include:["/api/*","/media/*"],exclude:[]},null,2));
console.log("Sitio preparado para Cloudflare Pages: pages/dist");
