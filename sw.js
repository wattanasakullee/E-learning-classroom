// จำไฟล์ของเว็บไว้ในเครื่อง (คอมพิวเตอร์/โทรศัพท์) ให้เปิดเร็ว
// · ไฟล์ของเว็บนี้ (หน้า/โค้ด/รูป): แสดงจากที่จำไว้ทันที แล้วตรวจของใหม่ตามมา — มีอัปเดตจะแจ้งให้แตะโหลดใหม่
// · ชุดคำสั่ง Firebase / ฟอนต์ / ไลบรารี (มีเลขรุ่นในที่อยู่ ไม่เปลี่ยน): จำไว้ใช้ได้เลย
// · ข้อมูลใน Firestore (คะแนน ข้อสอบ) ไม่ผ่านไฟล์นี้ — โหลดสดเสมอ
const VER = "v1";
const RT = "itw51-files-" + VER;
const CDN = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/|cdn\.jsdelivr\.net\/npm\/)/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("itw51-files-") && k !== RT) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || r.headers.has("range")) return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (/\.(mp4|webm|mov|zip|dbf)$/i.test(u.pathname) || u.pathname.includes("/__data/")) return;
    e.respondWith(fastThenUpdate(e, r));
  } else if (CDN.test(r.url)) {
    e.respondWith(cacheFirst(r));
  }
});

async function cacheFirst(r) {
  const c = await caches.open(RT);
  const hit = await c.match(r);
  if (hit) return hit;
  const res = await fetch(r);
  if (res.ok || res.type === "opaque") c.put(r, res.clone());
  return res;
}

async function fastThenUpdate(e, r) {
  const c = await caches.open(RT);
  const key = r.mode === "navigate" ? new Request(new URL(r.url).pathname || "./") : r;
  const hit = await c.match(key, { ignoreSearch: r.mode === "navigate" });
  const net = fetch(r, { cache: "no-cache" }).then(async res => {
    if (res.ok && res.type === "basic") {
      const changed = hit && (res.headers.get("etag") || res.headers.get("last-modified")) !==
        (hit.headers.get("etag") || hit.headers.get("last-modified"));
      await c.put(key, res.clone());
      if (changed) for (const cl of await self.clients.matchAll({ type: "window" })) cl.postMessage({ type: "itw51-updated" });
    }
    return res;
  });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net.catch(() => hit || Response.error());
}
