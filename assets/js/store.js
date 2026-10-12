// ชั้นจัดการข้อมูล: ใช้ Firebase (Firestore + Auth) ถ้าตั้งค่าแล้ว ไม่เช่นนั้นใช้โหมดทดลอง (localStorage)
import { CONFIG } from "./config.js";
import { safeStorage, TEACHER_DOMAIN } from "./common.js";

const FB_VER = "10.12.2";
const SERVER_TIME = { __serverTime: true };
export const isDemo = !CONFIG.firebase.apiKey;

function stripServerTime(obj, iso) {
  if (obj === SERVER_TIME || (obj && obj.__serverTime)) return iso;
  if (Array.isArray(obj)) return obj.map(v => stripServerTime(v, iso));
  if (obj && typeof obj === "object") {
    const o = {};
    for (const [k, v] of Object.entries(obj)) if (v !== undefined) o[k] = stripServerTime(v, iso);
    return o;
  }
  return obj;
}
function deepMerge(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k]))
      out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }
  return out;
}
function match(doc, filters) {
  return filters.every(([f, op, v]) => {
    const x = doc[f];
    if (op === "==") return x === v;
    if (op === "array-contains") return Array.isArray(x) && x.includes(v);
    if (op === "in") return v.includes(x);
    throw new Error("unsupported op " + op);
  });
}

// ---------------- โหมดทดลอง ----------------
function demoStore() {
  const P = "itw51demo:";
  const LS = safeStorage("local"), SS = safeStorage("session");
  const listeners = new Set();
  let adminUser = null;
  try { adminUser = JSON.parse(SS.get(P + "admin") || "null"); } catch {}
  const read = p => { try { const s = LS.get(P + p); return s ? JSON.parse(s) : null; } catch { return null; } };
  const write = (p, d) => { try { LS.set(P + p, JSON.stringify(d)); } catch (e) { throw new Error("พื้นที่เก็บข้อมูลในเบราว์เซอร์เต็ม (โหมดทดลอง)"); } };
  return {
    mode: "demo",
    serverTime: () => SERVER_TIME,
    async get(path) { return read(path); },
    async set(path, data, merge = false) {
      const clean = stripServerTime(data, new Date().toISOString());
      write(path, merge ? deepMerge(read(path), clean) : clean);
    },
    async del(path) { LS.remove(P + path); },
    async list(col, filters = []) {
      const out = [], pre = P + col + "/";
      for (const k of LS.keys()) {
        if (!k || !k.startsWith(pre)) continue;
        const id = k.slice(pre.length);
        if (id.includes("/")) continue;
        const d = read(col + "/" + id);
        if (d && match(d, filters)) out.push({ id, ...d });
      }
      return out;
    },
    async batch(ops, onProgress) {
      let n = 0;
      for (const op of ops) {
        if (op.type === "del") await this.del(op.path); else await this.set(op.path, op.data, !!op.merge);
        if (++n % 200 === 0 && onProgress) onProgress(n, ops.length);
      }
      onProgress && onProgress(ops.length, ops.length);
    },
    // นับจำนวนข้อที่ตอบถูก (โหมดทดลอง: คำนวณจากเฉลยโดยตรง)
    async probeCount(path, base, field, max) {
      const rid = path.split("/")[1], cid = rid.split("__")[1];
      const r = read(path) || {}, k = read("keys/" + cid) || {};
      const part = field === "vc" ? "video" : "quiz";
      const n = Object.entries(r[part] || {}).filter(([q, v]) => k[part] && k[part][q] === v).length;
      write(path, deepMerge(r, { ...base, [field]: Math.min(n, max) }));
      return Math.min(n, max);
    },
    async reset() { for (const k of LS.keys()) if (k && k.startsWith(P)) LS.remove(k); },
    admin: {
      // ผู้ดูแล: อีเมลอะไรก็ได้ (โหมดทดลอง) · ครู: ตรวจรหัสผ่านกับบัญชีที่ผู้ดูแลสร้างไว้
      async signIn(email, pw) {
        if (!email || !pw) throw new Error("กรอกชื่อผู้ใช้และรหัสผ่าน");
        const acc = read("__auth/" + email.toLowerCase());
        if (acc) {
          if (acc.pw !== pw) { const e = new Error("ชื่อหรือรหัสผ่านไม่ถูกต้อง"); e.code = "auth/invalid-credential"; throw e; }
          adminUser = { email, uid: acc.uid };
        } else if (email.endsWith("@" + TEACHER_DOMAIN)) { const e = new Error(); e.code = "auth/invalid-credential"; throw e; }
        else adminUser = { email, uid: "admin:" + email };
        SS.set(P + "admin", JSON.stringify(adminUser));
        listeners.forEach(f => f(adminUser));
      },
      async signOut() { adminUser = null; SS.remove(P + "admin"); listeners.forEach(f => f(null)); },
      onChange(cb) { listeners.add(cb); setTimeout(() => cb(adminUser), 0); },
      async createUser(email, pw) {
        email = email.toLowerCase();
        if (read("__auth/" + email)) { const e = new Error("มีบัญชีนี้แล้ว"); e.code = "auth/email-already-in-use"; throw e; }
        const uid = "u" + Math.random().toString(36).slice(2, 12);
        write("__auth/" + email, { pw, uid }); return uid;
      },
      async updatePassword(pw) {
        const k = "__auth/" + adminUser.email.toLowerCase();
        const acc = read(k); if (!acc) throw new Error("บัญชีนี้เปลี่ยนรหัสผ่านไม่ได้");
        write(k, { ...acc, pw });
      },
      // โหมดทดลอง: ไม่ได้ส่งอีเมลจริง
      async sendReset(email) { return { demo: true }; },
    },
  };
}

// ---------------- Firebase ----------------
async function firebaseStore() {
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
  const [{ initializeApp, getApps }, fs, au] = await Promise.all([
    import(base + "firebase-app.js"), import(base + "firebase-firestore.js"), import(base + "firebase-auth.js"),
  ]);
  const app = initializeApp(CONFIG.firebase);
  const db = fs.initializeFirestore(app, { ignoreUndefinedProperties: true });
  const auth = au.getAuth(app);
  const conv = v => {
    if (v instanceof fs.Timestamp) return v.toDate().toISOString();
    if (Array.isArray(v)) return v.map(conv);
    if (v && typeof v === "object") { const o = {}; for (const k in v) o[k] = conv(v[k]); return o; }
    return v;
  };
  const toFs = d => {
    if (d === SERVER_TIME || (d && d.__serverTime)) return fs.serverTimestamp();
    if (Array.isArray(d)) return d.map(toFs);
    if (d && typeof d === "object") { const o = {}; for (const k in d) if (d[k] !== undefined) o[k] = toFs(d[k]); return o; }
    return d;
  };
  return {
    mode: "firebase",
    serverTime: () => SERVER_TIME,
    async get(path) { const s = await fs.getDoc(fs.doc(db, path)); return s.exists() ? conv(s.data()) : null; },
    async set(path, data, merge = false) { await fs.setDoc(fs.doc(db, path), toFs(data), { merge }); },
    async del(path) { await fs.deleteDoc(fs.doc(db, path)); },
    async list(col, filters = []) {
      const q = fs.query(fs.collection(db, col), ...filters.map(([f, op, v]) => fs.where(f, op, v)));
      const s = await fs.getDocs(q);
      return s.docs.map(d => ({ id: d.id, ...conv(d.data()) }));
    },
    async batch(ops, onProgress) {
      for (let i = 0; i < ops.length; i += 400) {
        const b = fs.writeBatch(db);
        for (const op of ops.slice(i, i + 400)) {
          const ref = fs.doc(db, op.path);
          if (op.type === "del") b.delete(ref); else b.set(ref, toFs(op.data), { merge: !!op.merge });
        }
        await b.commit();
        onProgress && onProgress(Math.min(i + 400, ops.length), ops.length);
      }
    },
    // นับจำนวนข้อที่ตอบถูกโดยไม่เปิดเฉลยให้นักศึกษา: กฎ Firestore ยอมให้บันทึกค่า <= จำนวนข้อถูกจริง
    // จึงค้นหาแบบ binary search หาค่าสูงสุดที่บันทึกได้ (ทำได้หลังส่งคำตอบแล้วเท่านั้น เพราะคำตอบแก้ไม่ได้)
    async probeCount(path, base, field, max) {
      let lo = 0, hi = max, wrote = false;
      const ref = fs.doc(db, path);
      while (lo < hi) {
        const m = Math.ceil((lo + hi) / 2);
        try { await fs.setDoc(ref, { ...base, [field]: m }, { merge: true }); lo = m; wrote = true; }
        catch (e) { if (e.code !== "permission-denied") throw e; hi = m - 1; }
      }
      if (!wrote) await fs.setDoc(ref, { ...base, [field]: lo }, { merge: true });
      return lo;
    },
    admin: {
      async signIn(email, pw) { await au.signInWithEmailAndPassword(auth, email, pw); },
      async signOut() { await au.signOut(auth); },
      onChange(cb) { au.onAuthStateChanged(auth, u => cb(u ? { email: u.email, uid: u.uid } : null)); },
      // สร้างบัญชีครูผ่านแอปสำรอง เพื่อไม่ให้ผู้ดูแลถูกออกจากระบบ
      async createUser(email, pw) {
        const sec = getApps().find(a => a.name === "staff-create") || initializeApp(CONFIG.firebase, "staff-create");
        const sa = au.getAuth(sec);
        const cred = await au.createUserWithEmailAndPassword(sa, email, pw);
        await au.signOut(sa); return cred.user.uid;
      },
      async updatePassword(pw) { await au.updatePassword(auth.currentUser, pw); },
      // ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลของบัญชี (Firebase ส่งให้)
      async sendReset(email) { auth.languageCode = "th"; await au.sendPasswordResetEmail(auth, email); return {}; },
    },
  };
}

let _store;
export async function getStore() {
  if (!_store) {
    if (isDemo) {
      _store = demoStore();
      // โหมดทดลอง: ใส่ข้อมูลตัวอย่าง (นักศึกษาสมมติ) ถ้ายังไม่มีข้อมูล
      try { const { seedDemo } = await import("./demo-seed.js"); await seedDemo(_store); } catch (e) { console.warn("seed", e); }
    } else _store = await firebaseStore();
  }
  return _store;
}
