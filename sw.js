const CACHE_NAME = "dosecheck-v2";
const ASSETS = ["./index.html","./sw.js","./manifest.webmanifest","./style.css","./app.js","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",(e)=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener("activate",(e)=>{e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener("fetch",(e)=>{e.respondWith((async()=>{const cached=await caches.match(e.request);if(cached) return cached;try{const net=await fetch(e.request);return net;}catch(err){return cached||Response.error();}})());});