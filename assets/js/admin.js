import { CONFIG } from "./config.js";
import { getStore, isDemo } from "./store.js";
import { DBF } from "./dbf.js";
import { $, $$, esc, loginKey, semLabel, courseId, resultId, fmtTime, parseTime, fmtNum, uid, computeScore, toast, confirmBox, download, toCSV, LEVELS, demoBanner, normId, messageBox, inputBox, semShort, semId, semCompare, loginTerms, safeStorage, normName, normPhone, teacherKey, TEACHER_DOMAIN, maskEmail, isRealEmail, nameSimilarity, joinThaiName, firstName, teacherFirstKey, courseType, TYPE_LABEL, finalFullOf, hasFinalExam, DEFAULT_FINAL_FULL, midFulls, finalWindow, finalStatus, fmtThaiDT, TH_MONTHS } from "./common.js";
import { createPlayer } from "./player.js";

const app = $("#app");
let store, user, settings, roster, curSem;
let role = null, me = null; // role: "admin" | "teacher"
let loginMsg = "";
const isAdm = () => role === "admin";
const myGroups = () => new Set(me?.groups || []);
// นักศึกษาที่ผู้ใช้คนนี้เห็นได้: ผู้ดูแลเห็นทุกคน ครูเห็นเฉพาะกลุ่มของตนเอง
const seesAll = () => isAdm() || !!me?.allGroups; // ผู้ดูแล หรือครูที่ได้สิทธิ์ดูทุกกลุ่ม (เช่น ผอ.)
const canSee = sid => seesAll() || myGroups().has(roster?.students?.[sid]?.g);
const SS = safeStorage("session");
const semList = () => [...new Set(settings?.semesters || (settings?.semester ? [settings.semester] : []))].sort(semCompare);
async function useSem(sem) {
  curSem = sem || null;
  if (curSem) SS.set("itw51:adminSem", curSem);
  roster = curSem ? await store.get("admin/roster-" + semId(curSem)) : null;
}
let cleanup = [];
const onLeave = f => cleanup.push(f);

const NAV = [
  ["dash", "ภาพรวม", "◎", "all"],
  ["courses", "รายวิชา / บทเรียน", "▤", "all"],
  ["students", "นักศึกษาในกลุ่ม", "☺", "all"],
  ["results", "ผลคะแนน", "✓", "all"],
  ["teachers", "ครูผู้สอน", "♟", "admin"],
  ["groups", "กลุ่มเรียน / ครูประจำกลุ่ม", "▦", "admin"],
  ["export", "ดาวน์โหลดคะแนน (Excel)", "⇪", "admin"],
  ["import", "ภาคเรียน / นำเข้า ITW51", "⇩", "admin"],
];
const ADMIN_PAGES = new Set(NAV.filter(n => n[3] === "admin").map(n => n[0]));

const LOGO = `<img src="assets/img/logo.png" alt="ตราสัญลักษณ์">`;
// ช่องรหัสผ่านพร้อมปุ่มรูปดวงตา (แสดง/ซ่อนรหัสผ่าน)
const EYE_OPEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_SHUT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`;
const pwInput = attrs => `<div class="pw-wrap"><input type="password" ${attrs}><button type="button" class="eye" aria-label="แสดงรหัสผ่าน" title="แสดงรหัสผ่าน">${EYE_OPEN}</button></div>`;
function bindEyes(root = document) {
  $$(".pw-wrap .eye", root).forEach(b => b.onclick = () => {
    const i = b.previousElementSibling, show = i.type === "password";
    i.type = show ? "text" : "password";
    b.innerHTML = show ? EYE_SHUT : EYE_OPEN;
    b.setAttribute("aria-label", show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"); b.title = b.getAttribute("aria-label");
    i.focus();
  });
}

function shell(active, inner) {
  return `<header class="topbar"><div class="in">
    <div class="logo">${LOGO}</div>
    <div><div class="brand-name">${esc(CONFIG.schoolName)} · ${isAdm() ? "ผู้ดูแลระบบ" : "ครูผู้สอน"}</div><div class="brand-sub">ห้องเรียนออนไลน์ ↔ ITW51</div></div>
    <div class="spacer"></div>
    <div class="user"><div>${esc(me?.name || user.email)}</div>${!isAdm() && me?.allGroups ? `<div style="opacity:.7">ดูได้ทุกกลุ่ม</div>` : !isAdm() && me?.groups?.length ? `<div style="opacity:.7">กลุ่ม ${esc(me.groups.join(", "))}</div>` : ""}</div>
    ${me && !me.pwChanged ? `<button class="btn ghost sm" id="chPw">เปลี่ยนรหัสผ่าน</button>` : ""}
    ${isDemo ? "" : `<a class="btn ghost sm" href="index.html" target="_blank">หน้านักศึกษา</a>`}
    <button class="btn ghost sm" id="logout">ออก</button>
  </div></header>
  <div class="admin-layout">
    <nav class="side">${semList().length ? `<select id="semSel" aria-label="ภาคเรียนที่กำลังจัดการ">${semList().reverse().map(x => `<option value="${x}" ${x === curSem ? "selected" : ""}>${semShort(x)}${x === settings?.current ? " (ปัจจุบัน)" : ""}</option>`).join("")}</select>` : `<div class="sem">ยังไม่ได้นำเข้าข้อมูล</div>`}
      ${NAV.filter(n => n[3] === "all" || isAdm()).map(([k, t, i]) => `<a href="#/${k}" class="${active === k ? "on" : ""}"><span>${i}</span>${t}</a>`).join("")}
    </nav>
    <main id="main">${inner}</main>
  </div>`;
}
function bindShell() {
  $("#logout").onclick = async () => { await store.admin.signOut(); };
  if ($("#chPw")) $("#chPw").onclick = changePasswordModal;
  const sel = $("#semSel"); if (sel) sel.onchange = async () => { await useSem(sel.value); route(); };
}
function needRoster() {
  if (roster) return true;
  $("#main").innerHTML = isAdm() ? `<div class="card"><h2>ยังไม่มีข้อมูลนักศึกษา</h2><p>เริ่มต้นโดยนำเข้าข้อมูลจากโปรแกรม ITW51 ก่อน</p><a class="btn primary" href="#/import">นำเข้าข้อมูล ITW51</a></div>`
    : `<div class="card"><h2>ยังไม่มีข้อมูลภาคเรียน</h2><p>ผู้ดูแลระบบยังไม่ได้นำเข้าข้อมูล ITW51 กรุณาติดต่อผู้ดูแลระบบ</p></div>`;
  return false;
}
const courseList = () => Object.entries(roster?.courses || {}).map(([id, c]) => ({ id, ...c }))
  .sort((a, b) => (a.level + a.code).localeCompare(b.level + b.code, "th"));

// =================================================================== LOGIN
// หาอีเมลเข้าระบบของครูจาก "ชื่อ" (หรือ "ชื่อ นามสกุล" กรณีชื่อซ้ำ)
async function lookupTeacher(input) {
  const typed = String(input || "").trim();
  const hasSurname = typed.replace(/\s+/g, " ").split(" ").filter(Boolean).length > 1 && firstName(typed) !== normName(typed);
  if (hasSurname) {
    const full = await store.get("teacherLogin/" + await teacherKey(typed));
    if (full?.email) return full;
  }
  const f = await store.get("teacherLogin/" + await teacherFirstKey(typed));
  if (f?.ambiguous) return { ambiguous: true };
  if (f?.email) return f;
  if (!hasSurname) { const full = await store.get("teacherLogin/" + await teacherKey(typed)); if (full?.email) return full; }
  return null;
}
// สร้างตารางค้นชื่อ (ชื่ออย่างเดียว) ให้ครูทุกคน · ชื่อซ้ำ = ต้องพิมพ์นามสกุล
async function syncFirstNameLogins(staffList) {
  const want = {};
  for (const t of staffList) {
    if (!t.email) continue;
    const k = await teacherFirstKey(t.name);
    (want[k] ||= []).push(t.email);
  }
  const prev = (await store.get("admin/teacherFirstKeys").catch(() => null))?.keys || [];
  const ops = [];
  for (const [k, emails] of Object.entries(want)) ops.push({ type: "set", path: "teacherLogin/" + k, data: emails.length === 1 ? { email: emails[0] } : { ambiguous: true } });
  for (const k of prev) if (!want[k]) ops.push({ type: "del", path: "teacherLogin/" + k });
  ops.push({ type: "set", path: "admin/teacherFirstKeys", data: { keys: Object.keys(want) } });
  const sig = JSON.stringify(Object.entries(want).sort());
  if (sig === SS.get("itw51:fkSig")) return;
  await store.batch(ops);
  SS.set("itw51:fkSig", sig);
}

function renderLogin(msg = "", mode = "teacher") {
  const t = mode === "teacher";
  app.innerHTML = `<div class="login-page"><header class="topbar"><div class="in"><div class="logo">${LOGO}</div><div class="brand-name">${esc(CONFIG.schoolName)} · ${t ? "ครูผู้สอน" : "ผู้ดูแลระบบ"}</div></div></header>
  <div class="login-shell"><div class="login-card">
    <div class="tabs" style="justify-content:center"><button class="${t ? "on" : ""}" data-m="teacher">ครูผู้สอน</button><button class="${t ? "" : "on"}" data-m="admin">ผู้ดูแลระบบ (admin)</button></div>
    <form class="card stack" id="f">
    <h1>${t ? "เข้าสู่ระบบครู" : "เข้าสู่ระบบผู้ดูแล"}</h1>
    ${t ? `<div><label class="f" for="em">ชื่อผู้ใช้ (ชื่อ ไม่ต้องมีนามสกุล)</label><input type="text" id="em" required autocomplete="username" placeholder="เช่น สมศรี"></div>
      <div><label class="f" for="pw">รหัสผ่าน (เบอร์โทรศัพท์)</label>${pwInput(`id="pw" required autocomplete="current-password" placeholder="เช่น 0812345678"`)}
        <div class="row between" style="margin-top:6px"><span class="hint" style="margin:0">ไม่ต้องใส่คำนำหน้าชื่อและนามสกุล</span><button type="button" class="linkbtn" id="forgot">ลืมรหัสผ่าน?</button></div></div>
      <div id="fmsg"></div>`
    : `${isDemo ? `<div class="notice warn small">โหมดทดลอง: กรอกไว้ให้แล้ว กดเข้าสู่ระบบได้เลย</div>` : ""}
      <div><label class="f" for="em">อีเมล</label><input type="email" id="em" required autocomplete="username" value="${isDemo ? "admin@demo.local" : ""}"></div>
      <div><label class="f" for="pw">รหัสผ่าน</label>${pwInput(`id="pw" required autocomplete="current-password" value="${isDemo ? "demo1234" : ""}"`)}</div>`}
    <div class="err" id="err">${esc(msg)}</div>
    <button class="btn primary block" id="go">เข้าสู่ระบบ</button>
  </form>
  ${t && isDemo ? `<div class="card stack demo-acc" style="margin-top:14px"><div class="small"><b>บัญชีครูทดลอง</b> — แตะเพื่อกรอกให้อัตโนมัติ</div>
    <button type="button" class="btn sm block" data-u="สมศรี" data-p="0811111111">ครูสมศรี มีสุข · ที่ปรึกษากลุ่ม 99/3 · 0811111111 · มีอีเมล (ลองกดลืมรหัสผ่านได้)</button>
    <button type="button" class="btn sm block" data-u="วิชัย" data-p="0822222222">นายวิชัย ใจงาม · ยังไม่มีกลุ่มที่ดูแล · 0822222222</button></div>` : ""}
  </div></div></div>`;
  $$(".tabs [data-m]").forEach(b => b.onclick = () => renderLogin("", b.dataset.m));
  bindEyes(app);
  if ($("#forgot")) $("#forgot").onclick = async () => {
    const name = $("#em").value.trim();
    const box = $("#fmsg");
    if (!normName(name)) { box.innerHTML = `<div class="notice warn small">พิมพ์ชื่อในช่องชื่อผู้ใช้ก่อน แล้วกด "ลืมรหัสผ่าน?" อีกครั้ง</div>`; $("#em").focus(); return; }
    $("#forgot").disabled = true;
    try {
      const look = await lookupTeacher(name);
      if (look?.ambiguous) box.innerHTML = `<div class="notice warn small">มีครูชื่อนี้มากกว่า 1 คน กรุณาพิมพ์ชื่อและนามสกุล แล้วกด "ลืมรหัสผ่าน?" อีกครั้ง</div>`;
      else if (!look?.email) box.innerHTML = `<div class="notice bad small">ไม่พบชื่อ "${esc(name)}" ในระบบ ตรวจการสะกดชื่อ หรือติดต่อผู้ดูแลระบบ</div>`;
      else if (!isRealEmail(look.email)) box.innerHTML = `<div class="notice warn small">บัญชีนี้ไม่มีอีเมล กรุณาติดต่อผู้ดูแลระบบเพื่อตั้งรหัสผ่านใหม่</div>`;
      else {
        const r = await store.admin.sendReset(look.email);
        box.innerHTML = `<div class="notice small">ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมล <b>${esc(maskEmail(look.email))}</b> แล้ว เปิดอีเมลแล้วคลิกลิงก์เพื่อตั้งรหัสผ่านใหม่ (ถ้าไม่พบ ให้ดูในกล่องจดหมายขยะ)${r?.demo ? `<br><span class="muted">โหมดทดลอง: ไม่ได้ส่งอีเมลจริง</span>` : ""}</div>`;
      }
    } catch (err) { box.innerHTML = `<div class="notice bad small">ส่งไม่สำเร็จ: ${esc(err.code || err.message)} ลองใหม่ภายหลัง</div>`; }
    finally { $("#forgot").disabled = false; }
  };
  $$(".demo-acc [data-u]").forEach(b => b.onclick = () => { $("#em").value = b.dataset.u; $("#pw").value = b.dataset.p; });
  $("#f").onsubmit = async e => {
    e.preventDefault();
    $("#go").disabled = true;
    try {
      if (t) {
        const look = await lookupTeacher($("#em").value);
        if (look?.ambiguous) { $("#err").textContent = "มีครูชื่อนี้มากกว่า 1 คน กรุณาพิมพ์ชื่อและนามสกุล"; return; }
        if (!look?.email) throw Object.assign(new Error(), { code: "auth/invalid-credential" });
        const pw = $("#pw").value.trim();
        // เบอร์โทรพิมพ์มีขีด/เว้นวรรคได้ · ถ้าครูเปลี่ยนรหัสผ่านเองแล้ว ใช้ตามที่พิมพ์
        await store.admin.signIn(look.email, /^[\d\s\-().+]+$/.test(pw) ? normPhone(pw) : pw);
      } else await store.admin.signIn($("#em").value.trim(), $("#pw").value);
    } catch (err) {
      const bad = /invalid-credential|wrong-password|user-not-found|invalid-login/.test(err.code || err.message || "");
      $("#err").textContent = bad || !err.message ? (t ? "ชื่อหรือเบอร์โทรไม่ถูกต้อง" : "อีเมลหรือรหัสผ่านไม่ถูกต้อง") : "เข้าสู่ระบบไม่สำเร็จ: " + err.message;
    } finally { $("#go") && ($("#go").disabled = false); }
  };
}

function changePasswordModal() {
  const d = document.createElement("div"); d.className = "modal-back";
  d.innerHTML = `<form class="modal small stack"><h3>เปลี่ยนรหัสผ่าน</h3>
    <p class="small muted">ตั้งรหัสผ่านใหม่แทนเบอร์โทร (อย่างน้อย 6 ตัว) · <b>เปลี่ยนเองได้ 1 ครั้ง</b> ถ้าลืมภายหลัง ใช้ "ลืมรหัสผ่าน?" ที่หน้าเข้าสู่ระบบ ระบบจะส่งลิงก์ไปที่อีเมลของคุณ</p>
    <div><label class="f" for="np">รหัสผ่านใหม่</label>${pwInput(`id="np" minlength="6" required autocomplete="new-password"`)}</div>
    <div><label class="f" for="np2">ยืนยันรหัสผ่านใหม่</label>${pwInput(`id="np2" minlength="6" required autocomplete="new-password"`)}</div>
    <div class="err" id="npe"></div>
    <div class="row end"><button type="button" class="btn ghost" data-x>ยกเลิก</button><button class="btn primary">บันทึก</button></div></form>`;
  document.body.appendChild(d); bindEyes(d);
  $("[data-x]", d).onclick = () => d.remove();
  $("form", d).onsubmit = async e => {
    e.preventDefault();
    if ($("#np", d).value !== $("#np2", d).value) { $("#npe", d).textContent = "รหัสผ่านทั้งสองช่องไม่ตรงกัน"; return; }
    try {
      await store.admin.updatePassword($("#np", d).value);
      await store.set("staff/" + user.uid, { pwChanged: true, pwChangedAt: store.serverTime() }, true).catch(console.error);
      me = { ...me, pwChanged: true }; $("#chPw")?.remove();
      d.remove(); toast("เปลี่ยนรหัสผ่านแล้ว ครั้งหน้าใช้รหัสผ่านใหม่", "ok");
    }
    catch (err) { $("#npe", d).textContent = /recent-login/.test(err.code || "") ? "กรุณาออกจากระบบแล้วเข้าใหม่ก่อนเปลี่ยนรหัสผ่าน" : "เปลี่ยนไม่สำเร็จ: " + (err.message || err.code); }
  };
}

// =================================================================== DASHBOARD
async function pageDash() {
  app.innerHTML = shell("dash", `<h1>ภาพรวม</h1><div id="d"><div class="loading"><span class="spin"></span></div></div>`); bindShell();
  if (!needRoster()) return;
  const cl = courseList();
  const [courses, results] = await Promise.all([
    store.list("courses", [["sem", "==", roster.sem]]), store.list("results", [["sem", "==", roster.sem]]),
  ]);
  const pub = courses.filter(c => c.published).length;
  const enrol = cl.reduce((a, c) => a + (c.sids || []).filter(canSee).length, 0);
  const quizDone = results.filter(r => r.quizAt && canSee(r.sid)).length;
  const nStu = Object.keys(roster.students).filter(canSee).length;
  if (!isAdm()) {
    $("#d").innerHTML = `
      ${!me?.groups?.length && !me?.allGroups ? `<div class="notice warn" style="margin-bottom:14px">บัญชีนี้ยังไม่ได้กำหนดกลุ่มที่ดูแล — แก้ไขบทเรียนได้ แต่จะยังไม่เห็นรายชื่อนักศึกษา (ติดต่อผู้ดูแลระบบ)</div>` : ""}
      <div class="stat-row">
        <div class="stat"><div class="v">${nStu.toLocaleString()}</div><div class="l">${me?.allGroups ? "นักศึกษาทุกกลุ่ม" : "นักศึกษาในกลุ่มของฉัน"} (${esc(semShort(roster.sem))})</div></div>
        <div class="stat"><div class="v">${pub}<span class="muted" style="font-size:1rem">/${cl.length}</span></div><div class="l">รายวิชาที่เปิดบทเรียนแล้ว</div></div>
        <div class="stat"><div class="v">${quizDone.toLocaleString()}<span class="muted" style="font-size:1rem">/${enrol.toLocaleString()}</span></div><div class="l">ส่งแบบทดสอบแล้ว (คน-วิชา) ในกลุ่มของฉัน</div></div>
      </div>
      <div class="card"><h2>สิ่งที่ครูทำได้</h2>
        <ol style="margin:0;padding-left:1.2em;line-height:2">
          <li><a href="#/courses">รายวิชา / บทเรียน</a> — เพิ่มและแก้ไขวิดีโอ คำถาม ใบความรู้ แบบทดสอบ แล้วกด "เปิดให้นักศึกษาเรียน"</li>
          <li><a href="#/students">นักศึกษาในกลุ่ม</a> — ดูความก้าวหน้าและคะแนนของนักศึกษาในกลุ่มของตนเอง</li>
          <li><a href="#/results">ผลคะแนน</a> — ดูคะแนนรายวิชาของนักศึกษาในกลุ่มของตนเอง</li>
        </ol>
        <p class="small muted" style="margin:10px 0 0">การล้างผลให้นักศึกษาสอบใหม่ ดาวน์โหลดคะแนน และจัดการภาคเรียน เป็นสิทธิ์ของผู้ดูแลระบบ</p></div>`;
    return;
  }
  const staffList = (await store.list("staff").catch(() => [])).filter(t => t.role === "teacher");
  syncFirstNameLogins(staffList).catch(e => console.error("first-name sync", e));
  const staffAll = staffList.filter(t => t.active !== false);
  const assignedG = new Set(staffAll.flatMap(t => t.groups || []));
  const waitG = [...new Set(Object.values(roster.students).map(x => x.g))].filter(g => !assignedG.has(g));
  $("#d").innerHTML = `
    ${waitG.length && staffAll.length ? `<div class="notice warn" style="margin-bottom:14px">มี ${waitG.length} กลุ่มที่ยังไม่มีครูประจำกลุ่ม (${waitG.map(esc).join(", ")}) — <a href="#/groups">มอบหมายครู →</a></div>` : ""}
    <div class="stat-row">
      <div class="stat"><div class="v">${Object.keys(roster.students).length.toLocaleString()}</div><div class="l">นักศึกษาที่ลงทะเบียน ${esc(roster.sem)}</div></div>
      <div class="stat"><div class="v">${cl.length}</div><div class="l">รายวิชาที่เปิดสอน</div></div>
      <div class="stat"><div class="v">${pub}<span class="muted" style="font-size:1rem">/${cl.length}</span></div><div class="l">รายวิชาที่เปิดบทเรียนแล้ว</div></div>
      <div class="stat"><div class="v">${quizDone.toLocaleString()}<span class="muted" style="font-size:1rem">/${enrol.toLocaleString()}</span></div><div class="l">ส่งแบบทดสอบแล้ว (คน-วิชา)</div></div>
    </div>
    <div class="card"><h2>ขั้นตอนการใช้งาน</h2>
      <ol style="margin:0;padding-left:1.2em;line-height:2">
        <li><a href="#/import">นำเข้าข้อมูล ITW51</a> — นักศึกษา + รายวิชาที่ลงทะเบียนในภาคเรียน (ทำทุกต้นภาค หรือเมื่อมีการเพิ่ม/ถอนรายวิชา)</li>
        <li><a href="#/teachers">สร้างบัญชีครู</a> — ครูเข้าระบบด้วยชื่อ + เบอร์โทร แก้ไขบทเรียนและดูนักศึกษาในกลุ่มของตนเอง</li>
        <li><a href="#/courses">สร้างบทเรียน</a> — ใส่วิดีโอ ตั้งเวลาออกคำถาม · เขียนใบความรู้ · สร้างแบบทดสอบ แล้วกด "เปิดให้นักศึกษาเรียน"</li>
        <li>นักศึกษาเข้าเรียนที่หน้าแรก ด้วยรหัสนักศึกษา + เลขบัตรประชาชน/เลข G</li>
        <li><a href="#/results">ดูผลและประกาศคะแนน</a> — วิดีโอ 5 + แบบทดสอบ 5 = 10 คะแนน</li>
        <li><a href="#/export">ดาวน์โหลดคะแนน (Excel)</a> — นำไปนำเข้าคะแนนกลางภาคใน ITW51</li>
      </ol></div>
    <div class="card"><div class="row between"><h2 style="margin:0">ลิงก์สำหรับนักศึกษา</h2><button class="btn sm" id="copyLink">คัดลอกลิงก์</button></div>
      <p class="muted small" style="margin-top:8px"><code id="slink">${esc(new URL("index.html", location.href).href)}</code></p></div>`;
  $("#copyLink").onclick = () => {
    try { navigator.clipboard.writeText($("#slink").textContent).then(() => toast("คัดลอกแล้ว", "ok"), () => selectText($("#slink"))); }
    catch { selectText($("#slink")); }
  };
}

// =================================================================== COURSES
async function pageCourses() {
  app.innerHTML = shell("courses", `<div class="row between"><h1>รายวิชา / บทเรียน</h1>
      ${roster && isAdm() ? `<button class="btn primary" id="addCourse">+ เพิ่มรายวิชา</button>` : ""}</div>
    <p class="muted">${roster ? esc(semLabel(roster.sem)) : ""} · คลิกรายวิชาเพื่อสร้างหรือแก้ไขบทเรียน</p>
    ${roster && !Object.keys(roster.students || {}).length ? `<div class="notice small" style="margin-bottom:12px"><b>เตรียมล่วงหน้า</b> — ภาคเรียนนี้ยังไม่ได้นำเข้าข้อมูล ITW51 เพิ่มรายวิชาและสร้างบทเรียนรอไว้ได้เลย
      เมื่อเปิดเทอมแล้ว <a href="#/import">นำเข้า ITW51</a> ระบบจะจับคู่ตามรหัสวิชา นักศึกษาเห็นเฉพาะวิชาที่ตนลงทะเบียน พร้อมบทเรียนที่เตรียมไว้</div>` : ""}
    ${roster ? `<div id="finWin" style="margin-bottom:12px"></div>` : ""}
    <div class="row" style="margin-bottom:12px"><input type="text" id="q" placeholder="ค้นหารหัสหรือชื่อวิชา" style="max-width:320px">
      <select id="lv" style="max-width:220px"><option value="">ทุกระดับ</option>${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      ${!seesAll() && me?.groups?.length ? `<label class="row small"><input type="checkbox" id="mine" checked> เฉพาะวิชาที่นักศึกษาในกลุ่มของฉันลงทะเบียน</label>` : ""}</div>
    <div id="list"><div class="loading"><span class="spin"></span></div></div>`); bindShell();
  if (!needRoster()) return;
  if ($("#addCourse")) $("#addCourse").onclick = () => addCoursesModal(() => pageCourses());
  drawFinalWindowCard($("#finWin"));
  const cl = courseList();
  const docs = Object.fromEntries((await store.list("courses", [["sem", "==", roster.sem]])).map(c => [c.id, c]));
  const draw = () => {
    const q = $("#q").value.trim().toLowerCase(), lv = $("#lv").value;
    const mineOnly = $("#mine")?.checked && Object.keys(roster.students || {}).length;
    const rows = cl.filter(c => (!lv || c.level === lv) && (!q || (c.code + c.name).toLowerCase().includes(q)) && (!mineOnly || (c.sids || []).some(canSee)));
    $("#list").innerHTML = !cl.length ? `<div class="card"><p>ยังไม่มีรายวิชาในภาคเรียนนี้</p>${isAdm() ? `<button class="btn primary" id="addCourse2">+ เพิ่มรายวิชา</button>` : `<p class="muted small">ผู้ดูแลระบบเป็นผู้เพิ่มรายวิชา</p>`}</div>` :
      `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>ประเภท</th><th>ระดับ</th><th class="n">${seesAll() ? "นักศึกษา" : "กลุ่มฉัน / ทั้งหมด"}</th><th>วิดีโอ</th><th>ใบความรู้</th><th>แบบทดสอบ</th><th>ปลายภาค</th><th>สถานะ</th><th></th></tr></thead><tbody>
      ${rows.map(c => { const d = docs[c.id], n = c.sids?.length || 0, mine = isAdm() ? n : (c.sids || []).filter(canSee).length;
        const ty = courseType(c.code, d?.type);
        return `<tr class="click" data-id="${esc(c.id)}"><td>${esc(c.code)}</td><td>${esc(c.name)}</td><td><span class="type-tag ${ty}">${TYPE_LABEL[ty]}</span></td><td>${esc(LEVELS[c.level] || "")}</td>
        <td class="n">${n ? (seesAll() ? n : `${mine} <span class="muted small">/ ${n}</span>`) : `<span class="chip">รอลงทะเบียน</span>`}</td>
        <td>${d?.video?.url ? `<span class="chip ok">${d.video.questions?.length || 0} คำถาม</span>` : `<span class="chip">—</span>`}</td>
        <td>${d?.article?.html ? `<span class="chip ok">มี</span>` : `<span class="chip">—</span>`}</td>
        <td>${d?.quiz?.questions?.length ? `<span class="chip ok">${d.quiz.questions.length} ข้อ</span>` : `<span class="chip">—</span>`}</td>
        <td>${ty !== "elective" ? `<span class="muted small">ไม่มี</span>` : hasFinalExam(d) ? (s => `<span class="chip ${s === "open" ? "brand" : "ok"}">${d.final.questions.length} ข้อ${s === "open" ? " · เปิดสอบ" : s === "after" ? " · ปิดแล้ว" : ""}${finalWindow(d, settings)?.own ? " 📅" : ""}</span>`)(finalStatus(d, settings)) : `<span class="chip">—</span>`}</td>
        <td>${d?.published ? `<span class="chip brand">เปิดเรียนแล้ว</span>` : d ? `<span class="chip warn">ฉบับร่าง</span>` : `<span class="chip">ยังไม่สร้าง</span>`}</td>
        <td>${!n && isAdm() ? `<button class="btn sm ghost danger" data-del="${esc(c.id)}" title="ลบรายวิชาออกจากภาคเรียนนี้">ลบ</button>` : ""}</td></tr>`; }).join("")}
      </tbody></table></div>`;
    $("#addCourse2") && ($("#addCourse2").onclick = () => addCoursesModal(() => pageCourses()));
    $$("tr.click").forEach(tr => tr.onclick = e => { if (e.target.closest("[data-del]")) return; location.hash = "#/course/" + encodeURIComponent(tr.dataset.id); });
    $$("[data-del]").forEach(b => b.onclick = async () => {
      const c = roster.courses[b.dataset.del];
      if (!(await confirmBox(`ลบรายวิชา ${c.code} ${c.name} ออกจากภาคเรียนนี้? (บทเรียนที่สร้างไว้ยังเก็บอยู่ ถ้าเพิ่มรหัสวิชาเดิมกลับมาจะได้บทเรียนคืน)`, "ลบรายวิชา"))) return;
      delete roster.courses[b.dataset.del];
      await saveRoster(); toast("ลบรายวิชาแล้ว", "ok"); pageCourses();
    });
  };
  $("#q").oninput = draw; $("#lv").onchange = draw; if ($("#mine")) $("#mine").onchange = draw; draw();
}

async function saveRoster() {
  await store.set("admin/roster-" + semId(roster.sem), { ...roster, updatedAt: store.serverTime() }, false);
  roster = await store.get("admin/roster-" + semId(roster.sem));
}

// เพิ่มรายวิชาล่วงหน้า: พิมพ์เอง / เลือกจาก SUBJECT.DBF ของ ITW51 / คัดลอกจากภาคเรียนอื่น
function addCoursesModal(done) {
  const d = document.createElement("div"); d.className = "modal-back";
  d.innerHTML = `<div class="modal" style="max-width:760px">
    <div class="row between"><h2 style="margin:0">เพิ่มรายวิชา · ${esc(semShort(roster.sem))}</h2><button class="btn ghost sm" data-x>ปิด</button></div>
    <div class="tabs" style="margin-top:10px"><button data-t="type" class="on">พิมพ์เอง</button><button data-t="itw">เลือกจากรายวิชาใน ITW51</button><button data-t="copy">คัดลอกจากภาคเรียนอื่น</button></div>
    <div id="ac"></div></div>`;
  document.body.appendChild(d);
  const close = () => { d.remove(); done(); };
  $("[data-x]", d).onclick = () => d.remove();
  const exists = code => !!roster.courses[courseId(roster.sem, code)];
  const addMany = async list => {
    let n = 0;
    for (const c of list) {
      const code = String(c.code || "").trim().replace(/\s+/g, "");
      if (!code || exists(code)) continue;
      roster.courses[courseId(roster.sem, code)] = { code, name: String(c.name || code).trim(), level: String(c.level || ""), credit: c.credit ?? null, sids: [], manual: true };
      n++;
    }
    if (!n) { toast("ไม่มีรายวิชาใหม่ (อาจมีอยู่แล้ว)"); return; }
    await saveRoster(); toast(`เพิ่ม ${n} รายวิชาแล้ว`, "ok"); close();
  };
  // ---- รายการแบบเลือกได้ (ใช้ร่วมกันสองแท็บ)
  const picker = (items, hint) => {
    $("#ac", d).innerHTML = `<p class="small muted">${hint}</p>
      <div class="row" style="margin-bottom:8px"><input type="text" id="pq" placeholder="ค้นหารหัสหรือชื่อวิชา" style="flex:1;min-width:180px">
        <select id="pl" style="max-width:200px"><option value="">ทุกระดับ</option>${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <div class="tbl-wrap" style="max-height:340px;overflow:auto"><table class="tbl"><thead><tr><th></th><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>ระดับ</th><th class="n">หน่วยกิต</th></tr></thead><tbody id="pb"></tbody></table></div>
      <div class="row between" style="margin-top:12px"><span class="small muted" id="pc">เลือก 0 วิชา</span><button class="btn primary" id="padd">เพิ่มรายวิชาที่เลือก</button></div>`;
    const sel = new Set();
    const drawRows = () => {
      const q = $("#pq", d).value.trim().toLowerCase(), lv = $("#pl", d).value;
      const rows = items.filter(c => (!lv || c.level === lv) && (!q || (c.code + c.name).toLowerCase().includes(q))).slice(0, 400);
      $("#pb", d).innerHTML = rows.map(c => { const k = c.level + "|" + c.code, has = exists(c.code);
        return `<tr><td><input type="checkbox" data-k="${esc(k)}" ${has ? "disabled checked" : sel.has(k) ? "checked" : ""}></td><td>${esc(c.code)}</td><td>${esc(c.name)}${has ? ` <span class="chip ok">มีแล้ว</span>` : ""}</td><td>${esc(LEVELS[c.level] || "")}</td><td class="n">${c.credit ?? ""}</td></tr>`; }).join("")
        || `<tr><td colspan="5" class="muted">ไม่พบรายวิชา</td></tr>`;
      $$("#pb input[data-k]:not([disabled])", d).forEach(i => i.onchange = () => { i.checked ? sel.add(i.dataset.k) : sel.delete(i.dataset.k); $("#pc", d).textContent = `เลือก ${sel.size} วิชา`; });
    };
    $("#pq", d).oninput = drawRows; $("#pl", d).onchange = drawRows; drawRows();
    $("#padd", d).onclick = () => addMany(items.filter(c => sel.has(c.level + "|" + c.code)));
  };
  const tabs = {
    type: () => {
      $("#ac", d).innerHTML = `<form class="stack" id="tf">
        <div class="grid2"><div><label class="f" for="tc">รหัสวิชา</label><input type="text" id="tc" required placeholder="เช่น พว31001"></div>
          <div><label class="f" for="tn">ชื่อวิชา</label><input type="text" id="tn" required placeholder="เช่น วิทยาศาสตร์"></div></div>
        <div class="grid2"><div><label class="f" for="tl">ระดับ</label><select id="tl">${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
          <div><label class="f" for="tk">หน่วยกิต</label><input type="number" id="tk" min="0" step="0.5" placeholder="เช่น 3"></div></div>
        <p class="hint">รหัสวิชาต้องตรงกับใน ITW51 เพื่อให้ระบบจับคู่กับการลงทะเบียนของนักศึกษาได้</p>
        <div class="row end"><button class="btn primary">เพิ่มรายวิชา</button></div></form>`;
      const guess = code => { const m = code.match(/\d/); return m && "123".includes(m[0]) ? m[0] : null; };
      $("#tc", d).oninput = e => { const g = guess(e.target.value); if (g) $("#tl", d).value = g; };
      $("#tf", d).onsubmit = e => { e.preventDefault(); const code = $("#tc", d).value.trim();
        if (exists(code)) { toast("มีรายวิชานี้อยู่แล้ว", "bad"); return; }
        addMany([{ code, name: $("#tn", d).value, level: $("#tl", d).value, credit: $("#tk", d).value === "" ? null : Number($("#tk", d).value) }]); };
    },
    itw: () => {
      $("#ac", d).innerHTML = `<div class="drop" style="margin-top:6px"><p><b>เลือกโฟลเดอร์ข้อมูล ITW51</b><br><span class="muted small">ระบบจะอ่านรายวิชาทั้งหมดจาก SUBJECT.DBF ของแต่ละระดับ (ไม่อัปโหลดไฟล์)</span></p>
        <label class="btn primary">เลือกโฟลเดอร์ <input type="file" id="sf" webkitdirectory directory multiple class="hidden"></label></div>`;
      $("#sf", d).onchange = async e => {
        const { lv } = await collectFolder([...e.target.files]);
        const items = [];
        for (const [l, v] of Object.entries(lv)) {
          if (!v.subject) continue;
          const t = new DBF(await v.subject.arrayBuffer());
          const fields = ["SUB_CODE", "SUB_NAME", "SUB_CREDIT", "CANCEL_SEM", "DISABLE"].filter(f => t.has(f) || f === "SUB_CODE");
          for (const r of t.rows(fields)) if (r.SUB_CODE && !r.CANCEL_SEM && !r.DISABLE) items.push({ code: r.SUB_CODE, name: r.SUB_NAME || r.SUB_CODE, level: l, credit: r.SUB_CREDIT });
        }
        if (!items.length) { toast("ไม่พบ SUBJECT.DBF ในโฟลเดอร์ 1/2/3", "bad"); return; }
        items.sort((a, b) => (a.level + a.code).localeCompare(b.level + b.code, "th"));
        picker(items, `พบ ${items.length} รายวิชาใน ITW51 — ติ๊กเลือกวิชาที่จะเปิดสอนในภาคเรียนนี้`);
      };
    },
    copy: async () => {
      const others = semList().filter(x => x !== roster.sem).reverse();
      if (!others.length) { $("#ac", d).innerHTML = `<p class="muted">ยังไม่มีภาคเรียนอื่นในระบบ</p>`; return; }
      $("#ac", d).innerHTML = `<div class="row"><label class="f" style="margin:0" for="cs">คัดลอกจาก</label><select id="cs" style="max-width:260px">${others.map(x => `<option value="${x}">${semShort(x)}</option>`).join("")}</select></div><div id="cl"></div>`;
      const load = async () => {
        const r = await store.get("admin/roster-" + semId($("#cs", d).value));
        const items = Object.values(r?.courses || {}).map(c => ({ code: c.code, name: c.name, level: c.level, credit: c.credit }))
          .sort((a, b) => (a.level + a.code).localeCompare(b.level + b.code, "th"));
        const keep = $("#cs", d).value;
        picker(items, `รายวิชาของ ${semShort(keep)} (${items.length} วิชา) — ติ๊กเลือกวิชาที่จะเปิดสอนอีกครั้ง · บทเรียนใช้ปุ่ม "คัดลอกจากวิชาอื่น" ในหน้าแก้ไขบทเรียน`);
        const head = document.createElement("div"); head.className = "row"; head.style.marginBottom = "8px";
        head.innerHTML = `<label class="f" style="margin:0" for="cs">คัดลอกจาก</label><select id="cs" style="max-width:260px">${others.map(x => `<option value="${x}" ${x === keep ? "selected" : ""}>${semShort(x)}</option>`).join("")}</select>`;
        $("#ac", d).prepend(head); $("#cs", d).onchange = load;
      };
      $("#cs", d).onchange = load; load();
    },
  };
  $$(".tabs button", d).forEach(b => b.onclick = () => { $$(".tabs button", d).forEach(x => x.classList.toggle("on", x === b)); tabs[b.dataset.t](); });
  tabs.type();
}

// ช่วงเวลาสอบปลายภาค (วิชาเลือก) ของทั้งภาคเรียน — admin กำหนด · ครูดูได้อย่างเดียว
function drawFinalWindowCard(box) {
  if (!box || !roster) return;
  const sid = semId(roster.sem), w = settings?.finalWindows?.[sid];
  const has = w?.openAt && w?.closeAt;
  const stat = has ? finalStatus({ sem: roster.sem }, settings) : "none";
  const badge = { open: `<span class="chip brand">กำลังเปิดสอบ</span>`, before: `<span class="chip warn">รอเปิดสอบ</span>`, after: `<span class="chip">ปิดสอบแล้ว</span>`, none: `<span class="chip">ยังไม่กำหนด</span>` }[stat];
  const summary = has ? `เปิด <b>${fmtThaiDT(w.openAt)}</b> · ปิด <b>${fmtThaiDT(w.closeAt)}</b>` : "ยังไม่ได้กำหนดวันสอบ (นักศึกษายังทำข้อสอบปลายภาคไม่ได้)";
  if (!isAdm()) { box.innerHTML = `<div class="notice small">📅 <b>สอบปลายภาค (วิชาเลือก) ${esc(semShort(roster.sem))}</b> ${badge} · ${summary} · กำหนดโดยผู้ดูแลระบบ</div>`; return; }
  box.innerHTML = `<div class="card stack fin-win">
    <div class="row between"><div><b>📅 ช่วงเวลาสอบปลายภาค (วิชาเลือก) · ${esc(semShort(roster.sem))}</b> ${badge}<div class="small muted">${summary}</div></div>
      <button class="btn sm" id="fwToggle">${has ? "แก้ไขช่วงเวลา" : "กำหนดช่วงเวลา"}</button></div>
    <div id="fwForm" class="stack hidden">
      <div class="fw-row"><span class="fw-l">เปิดสอบ</span>${dtPicker("fwOpen", w?.openAt)}</div>
      <div class="fw-row"><span class="fw-l">ปิดสอบ</span>${dtPicker("fwClose", w?.closeAt)}</div>
      <p class="hint" style="margin:0">ถึงเวลาเปิด ระบบเปิดให้นักศึกษาทำข้อสอบปลายภาคของวิชาเลือกทุกวิชาในภาคเรียนนี้อัตโนมัติ · ถึงเวลาปิด ระบบปิดเอง (ปุ่มสอบปลายภาคเป็นสีเทา)
        · วิชาที่สอบคนละวัน ตั้งเฉพาะวิชาได้ในหน้าแก้ไขบทเรียน แท็บ 4</p>
      <div class="row end">${has ? `<button class="btn ghost danger" id="fwClear">ยกเลิกช่วงเวลา</button>` : ""}<button class="btn primary" id="fwSave">บันทึกช่วงเวลา</button></div>
    </div></div>`;
  $("#fwToggle", box).onclick = () => $("#fwForm", box).classList.toggle("hidden");
  const put = async (val, msg) => {
    await store.set("settings/app", { finalWindows: { [sid]: val } }, true);
    settings = (await store.get("settings/app")) || settings; toast(msg, "ok"); drawFinalWindowCard(box);
  };
  $("#fwSave", box).onclick = async () => {
    const a = readDT($("#fwOpen", box)), b = readDT($("#fwClose", box));
    if (!a || !b) return toast(a === undefined || b === undefined ? "วันที่ไม่ถูกต้อง (เช่น 31 กุมภาพันธ์)" : "เลือกวันที่ เดือน พ.ศ. ให้ครบทั้งเปิดและปิด", "bad");
    if (b <= a) return toast("เวลาปิดต้องหลังเวลาเปิด", "bad");
    try { await put({ openAt: a, closeAt: b }, "บันทึกช่วงเวลาสอบปลายภาคแล้ว"); } catch (e) { toast("บันทึกไม่สำเร็จ: " + e.message, "bad"); }
  };
  if ($("#fwClear", box)) $("#fwClear", box).onclick = async () => {
    if (!(await confirmBox("ยกเลิกช่วงเวลาสอบปลายภาคของภาคเรียนนี้? นักศึกษาจะทำข้อสอบปลายภาคไม่ได้จนกว่าจะกำหนดใหม่", "ยกเลิกช่วงเวลา"))) return;
    try { await put({ openAt: null, closeAt: null }, "ยกเลิกช่วงเวลาแล้ว"); } catch (e) { toast("ไม่สำเร็จ: " + e.message, "bad"); }
  };
}

// ------------------------------------------------------------------- editor
async function pageCourseEdit(cid) {
  app.innerHTML = shell("courses", `<div class="loading"><span class="spin"></span></div>`); bindShell();
  if (!needRoster()) return;
  const meta = roster.courses[cid];
  if (!meta) { $("#main").innerHTML = `<div class="notice bad">ไม่พบรายวิชา</div>`; return; }
  const [doc, key] = await Promise.all([store.get("courses/" + cid), store.get("keys/" + cid)]);
  const withKey = (qs, k) => (qs || []).map(q => ({ ...q, correct: k?.[q.id] ?? null }));
  const st = {
    published: !!doc?.published,
    video: { url: doc?.video?.url || "", title: doc?.video?.title || "", desc: doc?.video?.desc || "", full: fullOr(doc?.video?.full, CONFIG.videoFull), questions: withKey(doc?.video?.questions, key?.video) },
    article: { title: doc?.article?.title || "", html: doc?.article?.html || "", attach: doc?.article?.attach || "" },
    quiz: { title: doc?.quiz?.title || "", timeLimit: Number(doc?.quiz?.timeLimit) || 0, full: fullOr(doc?.quiz?.full, CONFIG.quizFull), questions: withKey(doc?.quiz?.questions, key?.quiz) },
    type: doc?.type === "core" || doc?.type === "elective" ? doc.type : "",
    final: finalState(doc, key),
  };
  const effType = () => courseType(meta.code, st.type);
  let dirty = false, tab = "video", player = null;
  const mark = () => { dirty = true; $("#saveState").textContent = "ยังไม่ได้บันทึก"; };
  const before = e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", before);
  onLeave(() => { window.removeEventListener("beforeunload", before); player?.destroy(); });

  $("#main").innerHTML = `
    <div class="crumb"><a href="#/courses">← รายวิชาทั้งหมด</a></div>
    <div class="row between" style="align-items:flex-start">
      <div><div class="muted small"><span class="type-tag ${effType()}" id="ttag">${TYPE_LABEL[effType()]}</span>${esc(meta.code)} · ${esc(LEVELS[meta.level] || "")} · ${meta.sids?.length ? meta.sids.length + " คน" : "รอลงทะเบียน"} · ${esc(semLabel(roster.sem))}</div>
      <h1 style="margin:0">${esc(meta.name)}</h1></div>
      <div class="row">
        <select id="ctype" title="ประเภทวิชา" style="width:auto">
          <option value="" ${st.type ? "" : "selected"}>ประเภท: ตามรหัสวิชา (${TYPE_LABEL[courseType(meta.code)]})</option>
          <option value="core" ${st.type === "core" ? "selected" : ""}>ประเภท: วิชาบังคับ</option>
          <option value="elective" ${st.type === "elective" ? "selected" : ""}>ประเภท: วิชาเลือก</option></select>
        <label class="row small" style="gap:6px"><input type="checkbox" id="pub" ${st.published ? "checked" : ""}> เปิดให้นักศึกษาเรียน</label>
        <button class="btn" id="copyFrom">คัดลอกจากวิชาอื่น</button>
        <button class="btn primary" id="save">บันทึก</button>
      </div>
    </div>
    <div class="small muted" id="saveState" style="margin:4px 0 4px">${doc ? "บันทึกแล้ว" : "ยังไม่ได้สร้างบทเรียน"}</div>
    <div class="notice small" id="midsum" style="margin:0 0 10px"></div>
    <div class="tabs" id="etabs"></div>
    <div id="pane"></div>`;
  $("#pub").onchange = e => { st.published = e.target.checked; mark(); };
  // สรุปคะแนนกลางภาคของวิชานี้ (ส่วนที่ไม่มีคำถามไม่นับ)
  const drawSum = () => {
    const f = midFulls({ video: st.video, quiz: st.quiz });
    const parts = [st.video.questions.length ? `วิดีโอ ${fmtNum(f.vFull)}` : "", st.quiz.questions.length ? `แบบทดสอบ ${fmtNum(f.qFull)}` : ""].filter(Boolean);
    $("#midsum").innerHTML = `คะแนน${effType() === "elective" ? "กลางภาค" : ""}ออนไลน์เต็ม <b>${fmtNum(f.midFull)}</b> คะแนน${parts.length ? ` (${parts.join(" + ")})` : " — ยังไม่มีคำถาม"}`
      + `${effType() === "elective" && st.final.questions.length ? ` · ปลายภาคเต็ม <b>${fmtNum(st.final.full)}</b>` : ""} · ตั้งคะแนนแต่ละส่วนได้ในแท็บวิดีโอและแท็บแบบทดสอบ`;
  };
  const markSum = () => { mark(); drawSum(); };
  // แท็บ: วิชาบังคับ = กลางภาคอย่างเดียว · วิชาเลือก = กลางภาค + ข้อสอบปลายภาค
  const drawTabBar = () => {
    const el = effType() === "elective";
    $("#etabs").innerHTML = `<button data-t="video">1 · วิดีโอ + คำถาม</button><button data-t="article">2 · ใบความรู้</button><button data-t="quiz">3 · ${el ? "แบบทดสอบกลางภาค" : "แบบทดสอบ"}</button>${el ? `<button data-t="final">4 · ข้อสอบปลายภาค</button>` : ""}`;
    $$("#etabs button").forEach(b => { b.classList.toggle("on", b.dataset.t === tab); b.onclick = () => { tab = b.dataset.t; drawTab(); }; });
  };
  $("#ctype").onchange = e => {
    st.type = e.target.value; mark();
    $("#ttag").className = "type-tag " + effType(); $("#ttag").textContent = TYPE_LABEL[effType()];
    if (tab === "final" && effType() !== "elective") tab = "quiz";
    drawTabBar(); drawTab();
    if (effType() === "elective") toast("วิชาเลือก: มีแท็บ 4 · ข้อสอบปลายภาค เพิ่มแล้ว");
  };

  const qEditor = (q, i, withTime) => `<div class="q-edit" data-i="${i}">
    <div class="head"><b>ข้อ ${i + 1}</b>
      ${withTime ? `<span class="small muted">เวลา</span><input type="text" class="time-in" data-k="t" value="${fmtTime(q.t)}" title="นาที:วินาที">
      <button class="btn sm" data-a="now">ใช้เวลาปัจจุบัน</button><button class="btn sm ghost" data-a="go">▶ ไปที่</button>` : ""}
      <span class="grow"></span>
      <button class="btn sm ghost" data-a="up" title="เลื่อนขึ้น">↑</button>
      <button class="btn sm ghost danger" data-a="del">ลบ</button></div>
    <textarea data-k="text" placeholder="พิมพ์คำถาม" rows="2">${esc(q.text)}</textarea>
    ${q.choices.map((c, j) => `<div class="opt"><input type="radio" name="c${i}" data-c="${j}" ${q.correct === j ? "checked" : ""} title="คำตอบที่ถูก">
      <span class="small muted" style="width:18px">${"กขคงจฉ"[j]}.</span><input type="text" data-o="${j}" value="${esc(c)}" placeholder="ตัวเลือก">
      <button class="btn sm ghost" data-a="rmopt" data-j="${j}" ${q.choices.length <= 2 ? "disabled" : ""}>✕</button></div>`).join("")}
    <div class="row" style="margin-top:8px">${q.choices.length < 6 ? `<button class="btn sm ghost" data-a="addopt">+ เพิ่มตัวเลือก</button>` : ""}
      <span class="small ${q.correct === null || q.correct === undefined ? "" : "muted"}" style="${q.correct === null || q.correct === undefined ? "color:var(--bad)" : ""}">${q.correct === null || q.correct === undefined ? "ยังไม่ได้เลือกคำตอบที่ถูก (คลิกวงกลมหน้าตัวเลือก)" : "เฉลย: " + "กขคงจฉ"[q.correct]}</span></div>
  </div>`;

  const bindQ = (box, list, withTime, redraw) => {
    $$(".q-edit", box).forEach(el => {
      const i = Number(el.dataset.i), q = list[i];
      $("textarea", el).oninput = e => { q.text = e.target.value; mark(); };
      $$("input[data-o]", el).forEach(inp => inp.oninput = () => { q.choices[Number(inp.dataset.o)] = inp.value; mark(); });
      $$("input[data-c]", el).forEach(r => r.onchange = () => { q.correct = Number(r.dataset.c); mark(); redraw(); });
      const ti = $("input[data-k=t]", el);
      if (ti) ti.onchange = () => { const v = parseTime(ti.value); if (v === null) { toast("รูปแบบเวลา เช่น 1:30", "bad"); ti.value = fmtTime(q.t); return; } q.t = v; mark(); };
      $$("button[data-a]", el).forEach(b => b.onclick = () => {
        const a = b.dataset.a;
        if (a === "del") { list.splice(i, 1); }
        else if (a === "up" && i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; }
        else if (a === "addopt") { q.choices.push(""); }
        else if (a === "rmopt") { const j = Number(b.dataset.j); q.choices.splice(j, 1); if (q.correct === j) q.correct = null; else if (q.correct > j) q.correct--; }
        else if (a === "now") { if (!player) return toast("โหลดวิดีโอก่อน", "bad"); q.t = Math.floor(player.time()); }
        else if (a === "go") { if (!player) return toast("โหลดวิดีโอก่อน", "bad"); player.seek(q.t); player.pause(); return; }
        else return;
        mark(); redraw();
      });
    });
  };

  const drawVideo = () => {
    const v = st.video;
    $("#pane").innerHTML = `<div class="grid2" style="align-items:start">
      <div class="card stack">
        <div><label class="f">ลิงก์วิดีโอ (YouTube หรือไฟล์ .mp4)</label>
          <div class="row"><input type="url" id="vurl" class="grow" value="${esc(v.url)}" placeholder="https://www.youtube.com/watch?v=..." style="flex:1;min-width:200px"><button class="btn" id="vload">โหลดวิดีโอ</button></div>
          <div class="hint">แนะนำอัปโหลดขึ้น YouTube แบบ "ไม่เป็นสาธารณะ (Unlisted)" แล้วนำลิงก์มาวาง</div></div>
        <div><label class="f">ชื่อวิดีโอ</label><input type="text" id="vtitle" value="${esc(v.title)}" placeholder="เช่น บทที่ 1 ..."></div>
        <div><label class="f">คำอธิบายสั้น ๆ (ไม่บังคับ)</label><input type="text" id="vdesc" value="${esc(v.desc)}"></div>
        <div class="video-box" id="vbox"><div id="vhost" style="display:grid;place-items:center;color:#aaa">ยังไม่ได้โหลดวิดีโอ</div></div>
        <div class="row"><span class="muted small">เวลาปัจจุบัน <b id="vnow">0:00</b></span><span class="grow"></span>
          <button class="btn accent" id="addAtNow">+ เพิ่มคำถาม ณ เวลานี้</button></div>
      </div>
      <div><div class="row" style="margin-bottom:8px;align-items:flex-end"><div style="width:170px"><label class="f" for="vfull">คะแนนส่วนวิดีโอ</label><input type="number" id="vfull" min="0" max="60" step="0.5" value="${v.full}"></div>
        <span class="hint" style="margin:0 0 10px">0 = ไม่นับคะแนนวิดีโอ</span></div>
        <div class="row between" style="margin-bottom:8px"><h3 style="margin:0" id="vqh">คำถามระหว่างวิดีโอ (${v.questions.length} ข้อ = ${fmtNum(v.full)} คะแนน)</h3>
        <button class="btn sm" id="sortT">เรียงตามเวลา</button></div>
        <div id="vqs"></div></div></div>`;
    const drawQs = () => {
      $("#vqs").innerHTML = v.questions.length ? v.questions.map((q, i) => qEditor(q, i, true)).join("") : `<div class="notice">ยังไม่มีคำถาม — เล่นวิดีโอไปยังจุดที่ต้องการ แล้วกด "เพิ่มคำถาม ณ เวลานี้"</div>`;
      bindQ($("#vqs"), v.questions, true, drawQs);
      const h = $("#vqh"); if (h) h.textContent = `คำถามระหว่างวิดีโอ (${v.questions.length} ข้อ = ${fmtNum(v.full)} คะแนน)`;
      drawSum();
    };
    drawQs();
    $("#vfull").onchange = e => { v.full = fullOr(e.target.value, 0, 60); e.target.value = v.full; markSum(); drawQs(); };
    $("#vtitle").oninput = e => { v.title = e.target.value; mark(); };
    $("#vdesc").oninput = e => { v.desc = e.target.value; mark(); };
    const load = async () => {
      const url = $("#vurl").value.trim(); if (!url) return;
      if (url !== v.url) { v.url = url; mark(); }
      player?.destroy(); player = null;
      $("#vhost").innerHTML = `<span class="spin"></span>`;
      try { player = await createPlayer($("#vhost"), url); }
      catch (e) { $("#vhost").innerHTML = `<div class="notice bad">${esc(e.message)}</div>`; }
    };
    $("#vload").onclick = load;
    $("#addAtNow").onclick = () => {
      const t = player ? Math.floor(player.time()) : 0;
      player?.pause();
      v.questions.push({ id: "v" + uid(), t, text: "", choices: ["", "", "", ""], correct: null });
      mark(); drawQs();
      const last = $$("#vqs .q-edit").pop(); last?.scrollIntoView({ behavior: "smooth", block: "center" }); $("textarea", last)?.focus();
    };
    $("#sortT").onclick = () => { v.questions.sort((a, b) => a.t - b.t); mark(); drawQs(); };
    const tm = setInterval(() => { if (player && $("#vnow")) $("#vnow").textContent = fmtTime(player.time()); }, 500);
    onLeave(() => clearInterval(tm));
    if (v.url) load();
  };

  const drawArticle = () => {
    const a = st.article;
    $("#pane").innerHTML = `<div class="card stack">
      <div><label class="f">หัวเรื่องใบความรู้</label><input type="text" id="atitle" value="${esc(a.title)}"></div>
      <div><div class="toolbar">
        <button data-cmd="formatBlock" data-v="h2" title="หัวข้อใหญ่">H2</button><button data-cmd="formatBlock" data-v="h3" title="หัวข้อย่อย">H3</button><button data-cmd="formatBlock" data-v="p" title="ย่อหน้าปกติ">¶</button>
        <button data-cmd="bold"><b>B</b></button><button data-cmd="italic"><i>I</i></button><button data-cmd="underline"><u>U</u></button>
        <button data-cmd="foreColor" data-v="#b23b3b" style="color:#b23b3b">A</button><button data-cmd="hiliteColor" data-v="#fff3a8" style="background:#fff3a8;color:#000">A</button>
        <button data-cmd="insertUnorderedList">• รายการ</button><button data-cmd="insertOrderedList">1. รายการ</button>
        <button data-cmd="formatBlock" data-v="blockquote">❝ กล่องเน้น</button>
        <button data-cmd="justifyCenter">จัดกลาง</button>
        <button data-a="link">🔗 ลิงก์</button><button data-a="img">🖼 รูปภาพ</button><button data-a="imgurl">🖼 รูปจากลิงก์</button>
        <button data-cmd="removeFormat">ล้างรูปแบบ</button><button data-cmd="undo">↶</button>
      </div><div class="editor article" id="ed" contenteditable="true">${a.html}</div>
      <input type="file" id="imgf" accept="image/*" class="hidden"></div>
      <div><label class="f">ลิงก์เอกสารประกอบ (ไม่บังคับ เช่น PDF บน Google Drive)</label><input type="url" id="aatt" value="${esc(a.attach)}" placeholder="https://drive.google.com/..."></div>
      <p class="hint">สามารถคัดลอกเนื้อหาจาก Word มาวางได้ · รูปภาพจะถูกย่อขนาดอัตโนมัติ (ควรใส่ไม่เกิน 5–6 รูปต่อใบความรู้)</p></div>`;
    const ed = $("#ed");
    ed.oninput = () => { a.html = ed.innerHTML; mark(); };
    $("#atitle").oninput = e => { a.title = e.target.value; mark(); };
    $("#aatt").oninput = e => { a.attach = e.target.value.trim(); mark(); };
    $$(".toolbar button").forEach(b => b.onmousedown = e => e.preventDefault());
    $$(".toolbar button[data-cmd]").forEach(b => b.onclick = () => { ed.focus(); document.execCommand(b.dataset.cmd, false, b.dataset.v || null); a.html = ed.innerHTML; mark(); });
    $$(".toolbar button[data-a]").forEach(b => b.onclick = async () => {
      if (b.dataset.a === "img") { $("#imgf").click(); return; }
      if (b.dataset.a === "pb") { ed.focus(); document.execCommand("insertHTML", false, `<hr class="page-break"><p><br></p>`); a.html = ed.innerHTML; mark(); return; }
      const sel = window.getSelection();
      const range = sel.rangeCount && ed.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
      const u = await inputBox(b.dataset.a === "link" ? "ใส่ลิงก์ (https://...)" : "ลิงก์รูปภาพ (https://...)");
      ed.focus();
      if (range) { sel.removeAllRanges(); sel.addRange(range); }
      if (!u) return;
      document.execCommand(b.dataset.a === "link" ? "createLink" : "insertImage", false, u);
      a.html = ed.innerHTML; mark();
    });
    $("#imgf").onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const url = await shrinkImage(f, 1000, 0.72);
      ed.focus(); document.execCommand("insertImage", false, url); a.html = ed.innerHTML; mark(); e.target.value = "";
    };
  };

  const drawFinal = () => {
    const z = st.final;
    $("#pane").innerHTML = `<div class="card stack" style="margin-bottom:12px">
      <div class="notice small" style="margin:0">ข้อสอบปลายภาคของ<b>วิชาเลือก</b> · นักศึกษาทำได้เฉพาะ<b>ช่วงเวลาที่ผู้ดูแลระบบกำหนด</b> (เปิด-ปิดอัตโนมัติ) · ส่งได้ครั้งเดียว · คะแนนแยกจากกลางภาค (ส่งเข้า ITW51 ช่องปลายภาค)</div>
      <div class="row" style="align-items:flex-end"><div class="grow" style="min-width:220px"><label class="f" for="ftitle">ชื่อข้อสอบ</label><input type="text" id="ftitle" value="${esc(z.title)}" placeholder="ข้อสอบปลายภาค"></div>
        <div style="width:150px"><label class="f" for="ffull">คะแนนเต็ม</label><input type="number" id="ffull" min="1" max="100" step="1" value="${z.full}"></div>
        <div style="width:150px"><label class="f" for="ftime">เวลาทำ (นาที)</label><input type="number" id="ftime" min="0" max="300" step="1" value="${z.timeLimit || 0}"></div></div>
      <div id="fwin"></div>
      <div class="row"><span class="muted small">${z.questions.length} ข้อ = ${z.full} คะแนน (ข้อละ ${z.questions.length ? fmtNum(z.full / z.questions.length) : 0} คะแนน)</span><span class="grow"></span>
        <button class="btn" id="bulk">วางข้อสอบจากข้อความ</button><button class="btn accent" id="addQ">+ เพิ่มข้อ</button></div></div>
      <div id="zqs"></div>`;
    $("#ftitle").oninput = e => { z.title = e.target.value; mark(); };
    $("#ffull").onchange = e => { z.full = Math.max(1, Math.min(100, Math.round(Number(e.target.value) || DEFAULT_FINAL_FULL))); markSum(); drawFinal(); };
    $("#ftime").oninput = e => { z.timeLimit = Math.max(0, Math.min(300, Math.round(Number(e.target.value) || 0))); mark(); };
    // ช่วงเวลาสอบ: admin กำหนด (ใช้ของภาคเรียน หรือเฉพาะวิชานี้) · ครูดูได้อย่างเดียว
    const semW = settings?.finalWindows?.[semId(roster.sem)];
    const semTxt = semW?.openAt && semW?.closeAt ? `${fmtThaiDT(semW.openAt)} – ${fmtThaiDT(semW.closeAt)}` : "ยังไม่กำหนด";
    const own = !!(z.openAt && z.closeAt);
    const cur = own ? `${fmtThaiDT(z.openAt)} – ${fmtThaiDT(z.closeAt)} (เฉพาะวิชานี้)` : `${semTxt} (ช่วงเวลาของภาคเรียน)`;
    const stat = finalStatus({ sem: roster.sem, final: z }, settings);
    const statChip = { open: `<span class="chip brand">กำลังเปิดสอบ</span>`, before: `<span class="chip warn">รอเปิดสอบ</span>`, after: `<span class="chip">ปิดสอบแล้ว</span>`, none: `<span class="chip">ยังไม่กำหนด</span>` }[stat];
    if (!isAdm()) $("#fwin").innerHTML = `<div class="notice small" style="margin:0">📅 <b>ช่วงเวลาสอบ</b> ${statChip}<br>${cur}<br><span class="muted">ผู้ดูแลระบบเป็นผู้กำหนดวันเปิด-ปิดสอบ · ครูเพิ่มและแก้ไขข้อสอบได้</span></div>`;
    else {
      $("#fwin").innerHTML = `<div class="fin-win stack" style="padding:12px;border:1px solid var(--line);border-radius:12px">
        <div><b>📅 ช่วงเวลาสอบ</b> ${statChip} <span class="small muted">${cur}</span></div>
        <label class="row small" style="gap:8px"><input type="checkbox" id="fown" ${own ? "checked" : ""}> กำหนดช่วงเวลาเฉพาะวิชานี้ (ไม่ติ๊ก = ใช้ช่วงเวลาของภาคเรียน ตั้งที่หน้า "รายวิชา / บทเรียน")</label>
        <div id="fownBox" class="stack ${own ? "" : "hidden"}">
          <div class="fw-row"><span class="fw-l">เปิดสอบ</span>${dtPicker("fo", z.openAt)}</div>
          <div class="fw-row"><span class="fw-l">ปิดสอบ</span>${dtPicker("fc", z.closeAt)}</div></div></div>`;
      const sync = () => {
        if (!$("#fown").checked) { z.openAt = null; z.closeAt = null; mark(); return; }
        const a = readDT($("#fo")), b = readDT($("#fc"));
        z.openAt = a || null; z.closeAt = b || null; mark();
      };
      $("#fown").onchange = () => { $("#fownBox").classList.toggle("hidden", !$("#fown").checked); sync(); };
      $$("#fownBox select").forEach(s => s.onchange = sync);
    }
    $("#zqs").innerHTML = z.questions.length ? z.questions.map((q, i) => qEditor(q, i, false)).join("") : `<div class="notice">ยังไม่มีข้อสอบปลายภาค</div>`;
    bindQ($("#zqs"), z.questions, false, () => drawFinal());
    drawSum();
    $("#addQ").onclick = () => { z.questions.push({ id: "f" + uid(), text: "", choices: ["", "", "", ""], correct: null }); mark(); drawFinal(); $$("#zqs .q-edit").pop()?.scrollIntoView({ block: "center" }); };
    $("#bulk").onclick = () => bulkImport(qs => { z.questions.push(...qs.map(q => ({ ...q, id: "f" + uid() }))); mark(); drawFinal(); });
  };

  const drawQuiz = () => {
    const z = st.quiz;
    $("#pane").innerHTML = `<div class="card stack" style="margin-bottom:12px">
      <div class="row" style="align-items:flex-end"><div class="grow" style="min-width:220px"><label class="f" for="ztitle">ชื่อแบบทดสอบ</label><input type="text" id="ztitle" value="${esc(z.title)}" placeholder="แบบทดสอบหลังเรียน"></div>
        <div style="width:150px"><label class="f" for="zfull">คะแนนแบบทดสอบ</label><input type="number" id="zfull" min="0" max="60" step="0.5" value="${z.full}"></div>
        <div style="width:150px"><label class="f" for="ztime">เวลาทำ (นาที)</label><input type="number" id="ztime" min="0" max="300" step="1" value="${z.timeLimit || 0}"></div></div>
      <p class="hint" style="margin:0">เวลาทำ: 0 = ไม่จับเวลา · ถ้าตั้งเวลา นักศึกษาต้องกด "เริ่มทำ" แล้วระบบนับถอยหลัง และส่งอัตโนมัติเมื่อหมดเวลา (ทำเสร็จก่อนกดส่งเองได้)</p>
      <div class="row"><span class="muted small">${z.questions.length} ข้อ = ${fmtNum(z.full)} คะแนน (ข้อละ ${z.questions.length ? fmtNum(z.full / z.questions.length) : 0} คะแนน)</span><span class="grow"></span>
        <button class="btn" id="bulk">วางข้อสอบจากข้อความ</button><button class="btn accent" id="addQ">+ เพิ่มข้อ</button></div></div>
      <div id="zqs"></div>`;
    $("#ztitle").oninput = e => { z.title = e.target.value; mark(); };
    $("#zfull").onchange = e => { z.full = fullOr(e.target.value, 0, 60); markSum(); drawQuiz(); };
    $("#ztime").oninput = e => { z.timeLimit = Math.max(0, Math.min(300, Math.round(Number(e.target.value) || 0))); mark(); };
    const drawQs = () => {
      $("#zqs").innerHTML = z.questions.length ? z.questions.map((q, i) => qEditor(q, i, false)).join("") : `<div class="notice">ยังไม่มีข้อสอบ</div>`;
      bindQ($("#zqs"), z.questions, false, () => drawQuiz());
      drawSum();
    };
    drawQs();
    $("#addQ").onclick = () => { z.questions.push({ id: "q" + uid(), text: "", choices: ["", "", "", ""], correct: null }); mark(); drawQuiz(); $$("#zqs .q-edit").pop()?.scrollIntoView({ block: "center" }); };
    $("#bulk").onclick = () => bulkImport(qs => { z.questions.push(...qs); mark(); drawQuiz(); });
  };

  const drawTab = () => {
    $$("#etabs button").forEach(b => b.classList.toggle("on", b.dataset.t === tab));
    player?.destroy(); player = null;
    ({ video: drawVideo, article: drawArticle, quiz: drawQuiz, final: drawFinal })[tab]();
    drawSum();
  };
  drawTabBar(); drawTab();

  $("#copyFrom").onclick = async () => {
    const all = (await store.list("courses")).filter(c => c.id !== cid);
    if (!all.length) return toast("ยังไม่มีบทเรียนวิชาอื่นให้คัดลอก");
    all.sort((a, b) => (a.code === meta.code ? -1 : 0) - (b.code === meta.code ? -1 : 0) || a.id.localeCompare(b.id));
    const d = document.createElement("div"); d.className = "modal-back";
    d.innerHTML = `<div class="modal"><h2>คัดลอกบทเรียนจากวิชาอื่น</h2><p class="muted small">เนื้อหาปัจจุบันของวิชานี้จะถูกแทนที่ (ยังไม่บันทึกจนกว่าจะกดบันทึก)</p>
      <select id="src" size="10" style="height:auto">${all.map(c => `<option value="${esc(c.id)}">${esc(c.id.replace("_", " · "))} ${esc(c.name || "")}</option>`).join("")}</select>
      <div class="row end" style="margin-top:12px"><button class="btn ghost" data-x>ยกเลิก</button><button class="btn primary" id="doCopy">คัดลอก</button></div></div>`;
    document.body.appendChild(d);
    $("[data-x]", d).onclick = () => d.remove();
    $("#doCopy", d).onclick = async () => {
      const sid = $("#src", d).value; if (!sid) return;
      const [c, k] = await Promise.all([store.get("courses/" + sid), store.get("keys/" + sid)]);
      st.video = { url: c.video?.url || "", title: c.video?.title || "", desc: c.video?.desc || "", full: fullOr(c.video?.full, CONFIG.videoFull), questions: withKey(c.video?.questions, k?.video) };
      st.article = { title: c.article?.title || "", html: c.article?.html || "", attach: c.article?.attach || "" };
      st.quiz = { title: c.quiz?.title || "", timeLimit: Number(c.quiz?.timeLimit) || 0, full: fullOr(c.quiz?.full, CONFIG.quizFull), questions: withKey(c.quiz?.questions, k?.quiz) };
      if (c.final?.questions?.length) st.final = { ...finalState(c, k), openAt: st.final.openAt, closeAt: st.final.closeAt }; // ช่วงเวลาสอบไม่คัดลอก
      d.remove(); mark(); drawTabBar(); drawTab(); toast("คัดลอกแล้ว อย่าลืมกดบันทึก");
    };
  };

  $("#save").onclick = async () => {
    const probs = [];
    const check = (qs, label) => qs.forEach((q, i) => {
      q.choices = q.choices.map(c => c.trim());
      if (!q.text.trim()) probs.push(`${label} ข้อ ${i + 1}: ยังไม่มีคำถาม`);
      if (q.choices.filter(Boolean).length < 2) probs.push(`${label} ข้อ ${i + 1}: ต้องมีตัวเลือกอย่างน้อย 2 ข้อ`);
      if (q.correct === null || q.correct === undefined || !q.choices[q.correct]) probs.push(`${label} ข้อ ${i + 1}: ยังไม่ได้เลือกคำตอบที่ถูก`);
    });
    check(st.video.questions, "คำถามวิดีโอ"); check(st.quiz.questions, "แบบทดสอบ");
    const elective = effType() === "elective";
    if (elective) check(st.final.questions, "ข้อสอบปลายภาค");
    if (isAdm() && $("#fown")?.checked) {
      if (!st.final.openAt || !st.final.closeAt) { await messageBox("ช่วงเวลาสอบปลายภาคเฉพาะวิชานี้ไม่ครบ", ["เลือกวันที่ เดือน พ.ศ. ของทั้งเปิดและปิดสอบ (แท็บ 4)", "หรือเอาติ๊ก \"กำหนดช่วงเวลาเฉพาะวิชานี้\" ออก"]); return; }
      if (st.final.closeAt <= st.final.openAt) { await messageBox("เวลาปิดสอบต้องหลังเวลาเปิดสอบ", []); return; }
    }
    if (!midFulls({ video: st.video, quiz: st.quiz }).midFull) probs.push("คะแนนกลางภาคเต็มเป็น 0 — ตั้งคะแนนส่วนวิดีโอหรือแบบทดสอบอย่างน้อย 1 ส่วน");
    if (st.published && probs.length) { await messageBox("ยังเปิดให้เรียนไม่ได้ แก้ไขรายการต่อไปนี้ก่อน", probs.slice(0, 12)); return; }
    if (st.published && st.video.url && !st.video.questions.length) toast("หมายเหตุ: วิดีโอยังไม่มีคำถาม จึงไม่นับคะแนนส่วนวิดีโอ", "");
    const strip = qs => qs.map(q => {
      // ตัดตัวเลือกว่าง และปรับเลขเฉลยให้ตรง
      const keep = q.choices.map((c, j) => [c, j]).filter(([c]) => c);
      const newCorrect = keep.findIndex(([, j]) => j === q.correct);
      return { q: { id: q.id, ...(q.t !== undefined ? { t: q.t } : {}), text: q.text.trim(), choices: keep.map(([c]) => c) }, correct: newCorrect < 0 ? null : newCorrect };
    });
    const vs = strip([...st.video.questions].sort((a, b) => a.t - b.t)), zs = strip(st.quiz.questions), fs = strip(st.final.questions);
    const course = {
      sem: roster.sem, code: meta.code, name: meta.name, level: meta.level, published: st.published,
      video: { url: st.video.url, title: st.video.title, desc: st.video.desc, full: st.video.full, questions: vs.map(x => x.q) },
      article: { title: st.article.title, html: st.article.html, attach: st.article.attach },
      quiz: { title: st.quiz.title, timeLimit: st.quiz.timeLimit || 0, full: st.quiz.full, questions: zs.map(x => x.q) },
      type: st.type || null,
      // ข้อสอบปลายภาค (เก็บไว้แม้เปลี่ยนเป็นวิชาบังคับ แต่นักศึกษาจะไม่เห็น)
      final: { title: st.final.title, timeLimit: st.final.timeLimit || 0, full: st.final.full, questions: fs.map(x => x.q),
        ...(st.final.openAt && st.final.closeAt ? { openAt: new Date(st.final.openAt), closeAt: new Date(st.final.closeAt) } : {}) },
      updatedAt: store.serverTime(), updatedBy: isAdm() ? user.email : (me?.name || user.email),
    };
    const size = new Blob([JSON.stringify(course)]).size;
    if (size > 950000) { await messageBox(`เนื้อหาใหญ่เกินไป (${Math.round(size / 1024)} KB)`, ["ลดจำนวนหรือขนาดรูปในใบความรู้", "หรือใช้รูปจากลิงก์แทนการแทรกไฟล์รูป"]); return; }
    const keys = { video: Object.fromEntries(vs.map(x => [x.q.id, x.correct])), quiz: Object.fromEntries(zs.map(x => [x.q.id, x.correct])), final: Object.fromEntries(fs.map(x => [x.q.id, x.correct])) };
    $("#save").disabled = true;
    try {
      await store.batch([{ type: "set", path: "courses/" + cid, data: course }, { type: "set", path: "keys/" + cid, data: keys }]);
      dirty = false; $("#saveState").textContent = "บันทึกแล้ว " + new Date().toLocaleTimeString("th-TH");
      toast("บันทึกเรียบร้อย", "ok");
      if (probs.length) toast(`บันทึกเป็นฉบับร่าง — ยังมี ${probs.length} จุดที่ต้องแก้ก่อนเปิดเรียน`);
    } catch (e) { console.error(e); toast("บันทึกไม่สำเร็จ: " + e.message, "bad"); }
    finally { $("#save").disabled = false; }
  };
}

// ตัวเลือกวันที่-เวลาแบบไทย (วัน · เดือน · พ.ศ. · ชั่วโมง:นาที)
function dtPicker(id, v) {
  const d = v ? new Date(v) : null, ok = d && !isNaN(d);
  const y0 = new Date().getFullYear(), years = [...new Set([y0 - 1, y0, y0 + 1, y0 + 2, ...(ok ? [d.getFullYear()] : [])])].sort();
  const mins = [...new Set([...Array(12)].map((_, i) => i * 5).concat(ok ? [d.getMinutes()] : []))].sort((a, b) => a - b);
  const o = (val, txt, sel) => `<option value="${val}" ${sel ? "selected" : ""}>${txt}</option>`;
  return `<span class="dt-pick" id="${id}">
    <select data-k="d" aria-label="วันที่"><option value="">วันที่</option>${[...Array(31)].map((_, i) => o(i + 1, i + 1, ok && d.getDate() === i + 1)).join("")}</select>
    <select data-k="m" aria-label="เดือน"><option value="">เดือน</option>${TH_MONTHS.map((t, i) => o(i, t, ok && d.getMonth() === i)).join("")}</select>
    <select data-k="y" aria-label="ปี พ.ศ."><option value="">พ.ศ.</option>${years.map(y => o(y, y + 543, ok && d.getFullYear() === y)).join("")}</select>
    <span class="muted small">เวลา</span>
    <select data-k="h" aria-label="ชั่วโมง">${[...Array(24)].map((_, i) => o(i, String(i).padStart(2, "0"), ok ? d.getHours() === i : i === 8)).join("")}</select><b>:</b>
    <select data-k="i" aria-label="นาที">${mins.map(m => o(m, String(m).padStart(2, "0"), ok ? d.getMinutes() === m : m === 0)).join("")}</select>
    <span class="muted small">น.</span></span>`;
}
// อ่านค่า: null = ไม่ได้เลือก · undefined = วันที่ไม่ถูกต้อง (เช่น 31 กุมภาพันธ์)
function readDT(el) {
  const g = k => el.querySelector(`[data-k=${k}]`).value;
  if (g("d") === "" || g("m") === "" || g("y") === "") return null;
  const d = new Date(+g("y"), +g("m"), +g("d"), +g("h"), +g("i"));
  return d.getDate() === +g("d") ? d : undefined;
}

// คะแนนเต็มของแต่ละส่วน (ทศนิยม .5 ได้)
function fullOr(v, d, max = 60) {
  if (v === undefined || v === null || v === "" || !Number.isFinite(Number(v))) return d;
  return Math.max(0, Math.min(max, Math.round(Number(v) * 2) / 2));
}

function finalState(doc, key) {
  return { title: doc?.final?.title || "", timeLimit: Number(doc?.final?.timeLimit) || 0, full: finalFullOf(doc),
    openAt: doc?.final?.openAt ? new Date(doc.final.openAt) : null, closeAt: doc?.final?.closeAt ? new Date(doc.final.closeAt) : null,
    questions: (doc?.final?.questions || []).map(q => ({ ...q, correct: key?.final?.[q.id] ?? null })) };
}

function selectText(el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("เลือกข้อความแล้ว กด Ctrl+C เพื่อคัดลอก"); }

function shrinkImage(file, max, q) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", q)); URL.revokeObjectURL(img.src);
    };
    img.onerror = rej; img.src = URL.createObjectURL(file);
  });
}

// วางข้อสอบจากข้อความ
export function parseBulk(text) {
  const out = []; let cur = null;
  const TH = "กขคงจฉ", EN = "abcdef";
  for (let line of text.split(/\r?\n/)) {
    line = line.trim(); if (!line) continue;
    const ans = line.match(/^(?:ตอบ|เฉลย|answer)\s*[:：.]?\s*([กขคงจฉ]|[a-fA-F])/i);
    if (ans && cur) { const k = ans[1]; cur.correct = TH.includes(k) ? TH.indexOf(k) : EN.indexOf(k.toLowerCase()); continue; }
    const opt = line.match(/^(\*)?\s*([กขคงจฉ]|[a-fA-F])\s*[.)]\s*(.+)$/);
    if (opt && cur) {
      let t = opt[3].trim(), star = !!opt[1];
      if (/\*$/.test(t)) { star = true; t = t.replace(/\s*\*$/, ""); }
      if (/\((ถูก|เฉลย)\)$/.test(t)) { star = true; t = t.replace(/\s*\((ถูก|เฉลย)\)$/, ""); }
      if (star) cur.correct = cur.choices.length;
      if (cur.choices.length < 6) cur.choices.push(t);
      continue;
    }
    const qm = line.match(/^(?:ข้อ\s*)?\d+\s*[.)]\s*(.+)$/);
    if (qm || !cur || cur.choices.length) { cur = { id: "q" + uid(), text: (qm ? qm[1] : line).trim(), choices: [], correct: null }; out.push(cur); continue; }
    cur.text += " " + line;
  }
  return out.filter(q => q.choices.length >= 2);
}
function bulkImport(onDone) {
  const d = document.createElement("div"); d.className = "modal-back";
  d.innerHTML = `<div class="modal"><h2>วางข้อสอบจากข้อความ</h2>
    <p class="small muted">พิมพ์หรือวางข้อสอบตามรูปแบบนี้ ใส่ * หน้าตัวเลือกที่ถูก (หรือบรรทัด "ตอบ ค")</p>
    <pre class="small" style="background:var(--surface-2);padding:10px;border-radius:8px;white-space:pre-wrap">1. ข้อใดคือเมืองหลวงของประเทศไทย
ก. เชียงใหม่
*ข. กรุงเทพมหานคร
ค. ขอนแก่น
ง. ภูเก็ต</pre>
    <textarea id="bt" rows="12" placeholder="วางข้อสอบที่นี่"></textarea>
    <div class="row between" style="margin-top:10px"><span class="small muted" id="bc"></span>
      <div class="row"><button class="btn ghost" data-x>ยกเลิก</button><button class="btn primary" id="bok">เพิ่มข้อสอบ</button></div></div></div>`;
  document.body.appendChild(d);
  const upd = () => { const p = parseBulk($("#bt", d).value); $("#bc", d).textContent = `อ่านได้ ${p.length} ข้อ · มีเฉลย ${p.filter(q => q.correct !== null).length} ข้อ`; };
  $("#bt", d).oninput = upd;
  $("[data-x]", d).onclick = () => d.remove();
  $("#bok", d).onclick = () => { const p = parseBulk($("#bt", d).value); if (!p.length) return toast("อ่านข้อสอบไม่ได้ ตรวจรูปแบบอีกครั้ง", "bad"); d.remove(); onDone(p); toast(`เพิ่ม ${p.length} ข้อแล้ว`, "ok"); };
}

// =================================================================== RESULTS
async function loadScores(sem, cids) {
  const results = await store.list("results", [["sem", "==", sem]]);
  const need = cids || [...new Set(results.map(r => r.courseId))];
  const pairs = await Promise.all(need.map(async id => [id, await store.get("courses/" + id), await store.get("keys/" + id)]));
  const courses = {}, keys = {};
  pairs.forEach(([id, c, k]) => { courses[id] = c; keys[id] = k; });
  return { results, courses, keys };
}

async function pageResults(cid) {
  app.innerHTML = shell("results", `<div id="r"><div class="loading"><span class="spin"></span></div></div>`); bindShell();
  if (!needRoster()) return;
  if (cid) return resultsCourse(cid);
  const cl = courseList().filter(c => isAdm() || (c.sids || []).some(canSee));
  const { results: allRes, courses, keys } = await loadScores(roster.sem, cl.map(c => c.id));
  const results = allRes.filter(r => canSee(r.sid));
  const by = {}; results.forEach(r => (by[r.courseId] ||= []).push(r));
  $("#r").innerHTML = `<div class="row between"><h1>ผลคะแนน${seesAll() ? "" : " · กลุ่มของฉัน"}</h1>
      ${isAdm() ? `<div class="row"><button class="btn" id="csvAll">ดาวน์โหลด CSV ทุกวิชา</button><button class="btn primary" id="pubAll">คำนวณและประกาศคะแนนทุกวิชา</button></div>` : ""}</div>
    ${!isAdm() && !cl.length ? `<div class="notice">ยังไม่มีนักศึกษาในกลุ่มของคุณลงทะเบียนในภาคเรียนนี้</div>` : ""}
    <p class="muted">${esc(semLabel(roster.sem))} · คะแนนเต็มของแต่ละวิชาตามที่ครูตั้ง · คลิกวิชาเพื่อดูรายคน</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th class="n">ลงทะเบียน</th><th class="n">เริ่มเรียน</th><th class="n">ส่งแบบทดสอบ</th><th class="n">เฉลี่ยกลางภาค</th><th class="n">เต็ม</th><th>สถานะบทเรียน</th></tr></thead><tbody>
    ${cl.map(c => { const rs = by[c.id] || [], co = courses[c.id];
      const sc = rs.map(r => computeScore(co, keys[c.id], r).total); const avg = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null;
      return `<tr class="click" data-id="${esc(c.id)}"><td>${esc(c.code)}</td><td>${esc(c.name)}</td><td class="n">${(c.sids || []).filter(canSee).length}</td><td class="n">${rs.length}</td><td class="n">${rs.filter(r => r.quizAt).length}</td><td class="n">${avg === null ? "—" : fmtNum(avg)}</td><td class="n">${co ? fmtNum(midFulls(co).midFull) : "—"}</td>
      <td>${co?.published ? `<span class="chip brand">เปิดเรียน</span>` : co ? `<span class="chip warn">ฉบับร่าง</span>` : `<span class="chip">ยังไม่สร้าง</span>`}</td></tr>`; }).join("")}
    </tbody></table></div>`;
  $$("tr.click").forEach(tr => tr.onclick = () => location.hash = "#/results/" + encodeURIComponent(tr.dataset.id));
  if (!isAdm()) return;
  $("#pubAll").onclick = async () => {
    if (!(await confirmBox(`ประกาศคะแนนให้นักศึกษาเห็น ${results.length} รายการ?`, "ประกาศ"))) return;
    await publishScores(results, courses, keys); pageResults();
  };
  $("#csvAll").onclick = () => {
    const rows = [["รหัสนักศึกษา", "ชื่อ-สกุล", "กลุ่ม", "รหัสวิชา", "ชื่อวิชา", "วิดีโอ", "แบบทดสอบ", "รวมกลางภาค", "ปัดเศษ", "กลางภาคเต็ม"]];
    cl.forEach(c => (c.sids || []).forEach(sid => {
      const r = (by[c.id] || []).find(x => x.sid === sid); const s = roster.students[sid] || {};
      const sc = r ? computeScore(courses[c.id], keys[c.id], r) : null;
      rows.push([sid, s.n, s.g, c.code, c.name, sc?.video ?? "", sc?.quiz ?? "", sc?.total ?? "", sc ? sc.itw : "", courses[c.id] ? midFulls(courses[c.id]).midFull : ""]);
    }));
    download(`คะแนนออนไลน์_${roster.sem.replace("/", "-")}.csv`, toCSV(rows), "text/csv;charset=utf-8");
  };
}

async function publishScores(results, courses, keys) {
  const ops = results.filter(r => courses[r.courseId]).map(r => {
    const s = computeScore(courses[r.courseId], keys[r.courseId], r);
    return { type: "set", merge: true, path: "results/" + r.id, data: { score: { video: s.video, quiz: s.quiz, total: s.total, itw: s.itw, quizCorrect: s.quizCorrect, quizCount: s.quizCount, vFull: s.vFull, qFull: s.qFull, midFull: s.midFull,
      ...(s.hasFinal && s.finalDone ? { final: s.final, finalItw: s.finalItw, finalCorrect: s.finalCorrect, finalCount: s.finalCount, finalFull: s.finalFull } : {}), at: store.serverTime() } } };
  });
  await store.batch(ops); toast(`ประกาศคะแนน ${ops.length} รายการแล้ว`, "ok");
}

async function resultsCourse(cid) {
  const meta = roster.courses[cid];
  const [course, key, results] = await Promise.all([store.get("courses/" + cid), store.get("keys/" + cid), store.list("results", [["courseId", "==", cid]])]);
  const byS = Object.fromEntries(results.map(r => [r.sid, r]));
  const rows = (meta.sids || []).filter(canSee).map(sid => ({ sid, s: roster.students[sid] || {}, r: byS[sid], sc: byS[sid] ? computeScore(course, key, byS[sid]) : null }))
    .sort((a, b) => (a.s.g || "").localeCompare(b.s.g || "") || a.sid.localeCompare(b.sid));
  const vq = course?.video?.questions?.length || 0;
  const fin = hasFinalExam(course), ffull = finalFullOf(course), ty = courseType(meta.code, course?.type), mf = midFulls(course);
  const awayCell = (n, done) => n ? `<span class="chip ${n >= 3 ? "warn" : ""}" title="จำนวนครั้งที่ออกจากหน้าข้อสอบหรือกดแคปหน้าจอ">${n}</span>` : done ? "0" : "";
  $("#r").innerHTML = `<div class="crumb"><a href="#/results">← ผลคะแนนทุกวิชา</a></div>
    <div class="row between"><div><div class="muted small"><span class="type-tag ${ty}">${TYPE_LABEL[ty]}</span>${esc(meta.code)} · ${esc(semLabel(roster.sem))}</div><h1 style="margin:0">${esc(meta.name)}</h1></div>
    ${isAdm() ? `<div class="row"><button class="btn" id="csv">ดาวน์โหลด CSV</button><button class="btn primary" id="pub">คำนวณและประกาศคะแนน</button></div>` : `<span class="chip">${rows.length} คน${seesAll() ? "" : "ในกลุ่มของฉัน"}</span>`}</div>
    ${!course ? `<div class="notice warn" style="margin-top:10px">ยังไม่ได้สร้างบทเรียนวิชานี้</div>` : ""}
    <div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>รหัสนักศึกษา</th><th>ชื่อ-สกุล</th><th>กลุ่ม</th>${mf.vFull ? `<th class="n">ตอบคำถามวิดีโอ</th><th class="n">วิดีโอ /${fmtNum(mf.vFull)}</th>` : ""}<th>ใบความรู้</th><th class="n">แบบทดสอบ /${fmtNum(mf.qFull)}</th><th class="n">กลางภาค /${fmtNum(mf.midFull)}</th><th class="n" title="จำนวนครั้งที่ออกจากหน้าข้อสอบหรือกดแคปหน้าจอระหว่างสอบ">ออกจากจอสอบ</th>${fin ? `<th class="n">ปลายภาค /${ffull}</th><th class="n">ออกจากจอ (ปลายภาค)</th>` : ""}<th>ประกาศแล้ว</th>${isAdm() ? "<th></th>" : ""}</tr></thead><tbody>
    ${rows.map(({ sid, s, r, sc }) => `<tr><td>${esc(sid)}</td><td>${esc(s.n)}</td><td>${esc(s.g)}</td>
      ${mf.vFull ? `<td class="n">${r ? `${Object.keys(r.video || {}).length}/${vq}` : "—"}</td><td class="n">${sc?.attempted ? fmtNum(sc.video) : "—"}</td>` : ""}
      <td>${r?.articleAt ? "✓" : ""}</td><td class="n">${r?.quizAt ? fmtNum(sc.quiz) : "—"}</td><td class="n"><b>${sc?.attempted ? fmtNum(sc.total) : "—"}</b></td><td class="n">${awayCell(r?.qaway, r?.quizAt)}</td>
      ${fin ? `<td class="n"><b>${r?.finAt ? fmtNum(sc.final) : "—"}</b></td><td class="n">${awayCell(r?.faway, r?.finAt)}</td>` : ""}
      <td>${r?.score ? `<span class="chip ok">${fmtNum(r.score.total)}${r.score.final !== undefined ? " · " + fmtNum(r.score.final) : ""}</span>` : ""}</td>
      ${isAdm() ? `<td>${r ? `<button class="btn sm ghost" data-reset="${esc(r.id)}">ล้างผล…</button>` : ""}</td>` : ""}</tr>`).join("")}
    </tbody></table></div>
    <p class="small muted" style="margin-top:8px">คะแนนคำนวณจากเฉลยปัจจุบัน${isAdm() ? ` ถ้าแก้เฉลยภายหลัง กด "คำนวณและประกาศคะแนน" ใหม่อีกครั้ง` : " · การล้างผลให้นักศึกษาสอบใหม่ ติดต่อผู้ดูแลระบบ"}</p>`;
  if (isAdm()) $("#pub").onclick = async () => { await publishScores(results, { [cid]: course }, { [cid]: key }); resultsCourse(cid); };
  if (isAdm()) $("#csv").onclick = () => download(`คะแนน_${meta.code}_${roster.sem.replace("/", "-")}.csv`, toCSV([
    ["รหัสนักศึกษา", "ชื่อ-สกุล", "กลุ่ม", `วิดีโอ(${mf.vFull})`, `แบบทดสอบ(${mf.qFull})`, `รวม(${mf.midFull})`, "ปัดเศษ", "ออกจากจอสอบ(ครั้ง)", ...(fin ? [`ปลายภาค(${ffull})`, "ปลายภาคปัดเศษ", "ออกจากจอปลายภาค(ครั้ง)"] : [])],
    ...rows.map(({ sid, s, r, sc }) => [sid, s.n, s.g, sc?.video ?? "", sc?.quiz ?? "", sc?.total ?? "", sc ? sc.itw : "", r?.qaway ?? "", ...(fin ? [r?.finAt ? sc.final : "", r?.finAt ? sc.finalItw : "", r?.faway ?? ""] : [])])]), "text/csv;charset=utf-8");
  // ล้างผล (ให้สอบใหม่) — ผู้ดูแลระบบเท่านั้น
  if (isAdm()) $$("[data-reset]").forEach(b => b.onclick = () => {
    const id = b.dataset.reset;
    const d = document.createElement("div"); d.className = "modal-back";
    d.innerHTML = `<div class="modal small"><h3>ล้างผลของนักศึกษา</h3><p class="small muted">ให้นักศึกษาทำใหม่ได้</p>
      <label class="row"><input type="checkbox" id="rq" checked> ล้าง${fin ? "แบบทดสอบกลางภาค" : "แบบทดสอบ"} (ให้สอบใหม่)</label>
      <label class="row"><input type="checkbox" id="rv"> ล้างคำตอบวิดีโอ (ให้ดูใหม่)</label>
      ${fin ? `<label class="row"><input type="checkbox" id="rf"> ล้างข้อสอบปลายภาค (ให้สอบปลายภาคใหม่)</label>` : ""}
      <div class="row end" style="margin-top:12px"><button class="btn ghost" data-x>ยกเลิก</button><button class="btn primary" id="ok">ล้างผล</button></div></div>`;
    document.body.appendChild(d);
    $("[data-x]", d).onclick = () => d.remove();
    $("#ok", d).onclick = async () => {
      const r = { ...byS[results.find(x => x.id === id).sid] }; delete r.id;
      if ($("#rq", d).checked) { delete r.quiz; delete r.quizAt; delete r.qc; delete r.quizStartAt; delete r.qaway; }
      if ($("#rv", d).checked) { delete r.video; delete r.videoDone; delete r.vc; }
      if ($("#rf", d)?.checked) { delete r.fin; delete r.finAt; delete r.fc; delete r.finStartAt; delete r.faway; }
      delete r.score;
      await store.set("results/" + id, r, false); d.remove(); toast("ล้างผลแล้ว", "ok"); resultsCourse(cid);
    };
  });
}


// =================================================================== STUDENTS (ครูเห็นเฉพาะกลุ่มตนเอง)
async function pageStudents() {
  app.innerHTML = shell("students", `<div id="st"><div class="loading"><span class="spin"></span></div></div>`); bindShell();
  if (!needRoster()) return;
  const all = Object.entries(roster.students || {}).map(([sid, x]) => ({ sid, ...x })).filter(x => canSee(x.sid));
  const groupsHere = [...new Set(all.map(x => x.g))].sort();
  const ginfo = roster.groups || {};
  if (!all.length) {
    $("#st").innerHTML = `<h1>นักศึกษาในกลุ่ม</h1><div class="notice">${seesAll() ? "ภาคเรียนนี้ยังไม่มีนักศึกษา (ยังไม่ได้นำเข้า ITW51)" : !me?.groups?.length ? "บัญชีของคุณยังไม่ได้กำหนดกลุ่มที่ดูแล กรุณาติดต่อผู้ดูแลระบบ" : `ไม่มีนักศึกษาในกลุ่ม ${esc(me.groups.join(", "))} ลงทะเบียนใน${esc(semShort(roster.sem))}`}</div>`;
    return;
  }
  const byStu = {}; for (const [cid, c] of Object.entries(roster.courses || {})) for (const sid of c.sids || []) (byStu[sid] ||= []).push(cid);
  const { results, courses, keys } = await loadScores(roster.sem, Object.keys(roster.courses || {}));
  const res = {}; for (const r of results) res[r.sid + "|" + r.courseId] = r;
  const summary = sid => {
    const cids = byStu[sid] || [];
    let done = 0, sum = 0, nScored = 0;
    for (const cid of cids) { const r = res[sid + "|" + cid]; if (!r) continue; if (r.quizAt) done++; const sc = computeScore(courses[cid], keys[cid], r); if (sc.attempted && sc.midFull) { sum += sc.total / sc.midFull * 100; nScored++; } }
    return { n: cids.length, done, avg: nScored ? sum / nScored : null };
  };
  $("#st").innerHTML = `<div class="row between"><h1>นักศึกษาในกลุ่ม</h1></div>
    <p class="muted">${esc(semLabel(roster.sem))} · ${seesAll() ? "เห็นทุกกลุ่ม" : "เห็นเฉพาะกลุ่มที่คุณดูแล"} · คลิกชื่อเพื่อดูคะแนนรายวิชา</p>
    <div class="row" style="margin-bottom:12px">
      <select id="gsel" style="max-width:360px">${groupsHere.length > 1 ? `<option value="">ทุกกลุ่ม (${all.length} คน)</option>` : ""}${groupsHere.map(g => `<option value="${esc(g)}">กลุ่ม ${esc(g)}${ginfo[g]?.name ? " · " + esc(ginfo[g].name) : ""} (${all.filter(x => x.g === g).length} คน)</option>`).join("")}</select>
      <input type="text" id="sq" placeholder="ค้นหารหัสหรือชื่อ" style="max-width:260px"></div>
    <div id="sl"></div>`;
  const draw = () => {
    const g = $("#gsel").value, q = $("#sq").value.trim().toLowerCase();
    const rows = all.filter(x => (!g || x.g === g) && (!q || (x.sid + x.n).toLowerCase().includes(q))).sort((a, b) => a.g.localeCompare(b.g) || a.sid.localeCompare(b.sid));
    $("#sl").innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>รหัสนักศึกษา</th><th>ชื่อ-สกุล</th><th>กลุ่ม</th><th>ระดับ</th><th class="n">รายวิชา</th><th class="n">ส่งแบบทดสอบแล้ว</th><th class="n">กลางภาคเฉลี่ย (%)</th></tr></thead><tbody>
      ${rows.map(x => { const m = summary(x.sid); return `<tr class="click" data-sid="${esc(x.sid)}"><td>${esc(x.sid)}</td><td>${esc(x.n)}</td><td>${esc(x.g)}</td><td>${esc(LEVELS[x.l] || "")}</td>
        <td class="n">${m.n}</td><td class="n">${m.done ? `${m.done}/${m.n}` : `<span class="muted">0/${m.n}</span>`}</td><td class="n">${m.avg === null ? "—" : fmtNum(m.avg)}</td></tr>`; }).join("")}
      </tbody></table></div><p class="small muted" style="margin-top:6px">${rows.length} คน</p>`;
    $$("#sl tr.click").forEach(tr => tr.onclick = () => {
      const sid = tr.dataset.sid, x = roster.students[sid];
      const d = document.createElement("div"); d.className = "modal-back";
      d.innerHTML = `<div class="modal"><div class="row between"><div><div class="muted small">${esc(sid)} · กลุ่ม ${esc(x.g)}</div><h2 style="margin:0">${esc(x.n)}</h2></div><button class="btn ghost sm" data-x>ปิด</button></div>
        <div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>รายวิชา</th><th class="n">วิดีโอ</th><th>ใบความรู้</th><th class="n">แบบทดสอบ</th><th class="n">กลางภาค</th><th class="n">ปลายภาค</th></tr></thead><tbody>
        ${(byStu[sid] || []).map(cid => { const c = roster.courses[cid], r = res[sid + "|" + cid], sc = r ? computeScore(courses[cid], keys[cid], r) : null;
          const ty = courseType(c.code, courses[cid]?.type);
          return `<tr><td><span class="type-tag ${ty}">${TYPE_LABEL[ty]}</span>${esc(c.code)} ${esc(c.name)}${courses[cid]?.published ? "" : ` <span class="chip">ยังไม่เปิดบทเรียน</span>`}</td><td class="n">${sc && r.video ? `${fmtNum(sc.video)}<span class="muted small">/${fmtNum(sc.vFull)}</span>` : "—"}</td><td>${r?.articleAt ? "✓" : ""}</td><td class="n">${r?.quizAt ? `${fmtNum(sc.quiz)}<span class="muted small">/${fmtNum(sc.qFull)}</span>` : "—"}</td><td class="n">${sc?.attempted ? `<b>${fmtNum(sc.total)}</b><span class="muted small">/${fmtNum(sc.midFull)}</span>` : "—"}</td><td class="n">${!hasFinalExam(courses[cid]) ? `<span class="muted small">${ty === "elective" ? "—" : "ไม่มี"}</span>` : r?.finAt ? `<b>${fmtNum(sc.final)}</b><span class="muted small">/${sc.finalFull}</span>` : "—"}</td></tr>`; }).join("")}
        </tbody></table></div></div>`;
      document.body.appendChild(d); $("[data-x]", d).onclick = () => d.remove();
      d.addEventListener("click", e => { if (e.target === d) d.remove(); });
    });
  };
  $("#gsel").onchange = draw; $("#sq").oninput = draw; draw();
}

// =================================================================== TEACHERS (ผู้ดูแลเท่านั้น)
async function pageTeachers() {
  app.innerHTML = shell("teachers", `<div class="row between"><h1>ครูผู้สอน</h1><div class="row"><button class="btn" id="impT">นำเข้าจากไฟล์ Excel</button><button class="btn primary" id="addT">+ เพิ่มครู</button></div></div>
    <p class="muted">ให้สิทธิ์ admin: กด <b>แก้ไข</b> ที่ชื่อครู → ติ๊ก <b>ผู้ดูแลระบบ (admin)</b> ·
    ครูเข้าระบบที่หน้านี้ (admin.html) ด้วย <b>ชื่อ</b> (ไม่ต้องมีนามสกุล) + <b>เบอร์โทร</b> · เพิ่ม/แก้ไขบทเรียนได้ทุกวิชา · เห็นนักศึกษาเฉพาะกลุ่มที่กำหนด ·
    ไม่มีสิทธิ์ดาวน์โหลดคะแนน ส่งคะแนนเข้า ITW51 หรือจัดการภาคเรียน</p>
    <div id="tl"><div class="loading"><span class="spin"></span></div></div><div id="tsug"></div>`); bindShell();
  const staff = (await store.list("staff")).filter(t => t.role === "teacher").sort((a, b) => a.name.localeCompare(b.name, "th"));
  await syncFirstNameLogins(staff).catch(e => console.error("first-name sync", e));
  // กลุ่มทั้งหมดที่รู้จัก (จากทุกภาคเรียน)
  const groupMap = {};
  for (const x of semList()) {
    const r = x === roster?.sem ? roster : await store.get("admin/roster-" + semId(x)).catch(() => null);
    for (const [g, info] of Object.entries(r?.groups || {})) groupMap[g] = info;
    for (const st of Object.values(r?.students || {})) groupMap[st.g] ||= { name: "", advisor: "" };
  }
  const allGroups = Object.keys(groupMap).sort();
  $("#tl").innerHTML = staff.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ชื่อ-สกุล (ชื่อผู้ใช้)</th><th>เบอร์โทร (รหัสผ่านเริ่มต้น)</th><th>E-mail (รับลิงก์ลืมรหัสผ่าน)</th><th>กลุ่มที่ดูแล</th><th>สถานะ</th><th></th></tr></thead><tbody>
    ${staff.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.phone || "")}${t.pwChanged ? ` <span class="chip" title="ครูเปลี่ยนรหัสผ่านเองแล้ว">เปลี่ยนรหัสแล้ว</span>` : ""}</td><td class="small">${isRealEmail(t.email) ? esc(t.email) : `<span class="muted">ไม่มี</span>`}</td><td>${t.admin ? `<span class="chip bad">ผู้ดูแลระบบ (admin)</span> ` : ""}${t.allGroups ? `<span class="chip ok">ทุกกลุ่ม (ผู้บริหาร)</span> ` : ""}${(t.groups || []).map(g => `<span class="chip brand">${esc(g)}</span>`).join(" ") || (t.allGroups ? "" : `<span class="chip warn">ยังไม่กำหนด</span>`)}</td>
      <td>${t.active === false ? `<span class="chip bad">ปิดใช้งาน</span>` : `<span class="chip ok">ใช้งาน</span>`}</td>
      <td><div class="row end">${isRealEmail(t.email) ? `<button class="btn sm ghost" data-rs="${esc(t.id)}" title="ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลครู">ส่งลิงก์รีเซ็ต</button>` : ""}<button class="btn sm" data-ed="${esc(t.id)}">แก้ไข</button><button class="btn sm ghost" data-tg="${esc(t.id)}">${t.active === false ? "เปิดใช้งาน" : "ปิดใช้งาน"}</button><button class="btn sm ghost danger" data-rm="${esc(t.id)}">ลบ</button></div></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="card"><p class="muted">ยังไม่มีบัญชีครู — กด "+ เพิ่มครู" หรือสร้างจากรายชื่อครูที่ปรึกษาใน ITW51 ด้านล่าง</p></div>`;

  // กลุ่มที่ยังไม่มีครูประจำกลุ่ม (ภาคเรียนที่เลือก)
  const assigned = new Set(staff.filter(t => t.active !== false).flatMap(t => t.groups || []));
  const waiting = Object.keys(roster?.students ? Object.fromEntries(Object.values(roster.students).map(x => [x.g, 1])) : {}).filter(g => !assigned.has(g));
  $("#tsug").innerHTML = waiting.length ? `<div class="notice warn" style="margin-top:16px">มี <b>${waiting.length}</b> กลุ่มที่ยังไม่มีครูประจำกลุ่มใน${esc(semShort(roster.sem))} (${waiting.join(", ")}) — <a href="#/groups">มอบหมายครูที่หน้า กลุ่มเรียน →</a></div>` : "";
  $("#addT").onclick = () => teacherModal(null, allGroups, groupMap);
  $("#impT").onclick = () => importTeachersModal(staff, groupMap);
  $$("[data-rs]").forEach(b => b.onclick = async () => {
    const t = staff.find(x => x.id === b.dataset.rs);
    try { const r = await store.admin.sendReset(t.email); toast(`ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${maskEmail(t.email)} แล้ว${r?.demo ? " (โหมดทดลอง: ไม่ได้ส่งจริง)" : ""}`, "ok"); }
    catch (e) { toast("ส่งไม่สำเร็จ: " + (e.code || e.message), "bad"); }
  });
  $$("[data-ed]").forEach(b => b.onclick = () => teacherModal(staff.find(t => t.id === b.dataset.ed), allGroups, groupMap));
  $$("[data-tg]").forEach(b => b.onclick = async () => {
    const t = staff.find(x => x.id === b.dataset.tg);
    if (t.id === user.uid) { toast("ปิดใช้งานบัญชีของตัวเองไม่ได้", "bad"); return; }
    await store.set("staff/" + t.id, { active: t.active === false }, true); toast(t.active === false ? "เปิดใช้งานแล้ว" : "ปิดใช้งานแล้ว", "ok"); pageTeachers();
  });
  $$("[data-rm]").forEach(b => b.onclick = async () => {
    const t = staff.find(x => x.id === b.dataset.rm);
    if (t.id === user.uid) { toast("ลบบัญชีของตัวเองไม่ได้", "bad"); return; }
    if (!(await confirmBox(`ลบบัญชีครู ${t.name}? ครูคนนี้จะเข้าระบบไม่ได้อีก (บทเรียนที่สร้างไว้ยังอยู่)`, "ลบบัญชี"))) return;
    await store.batch([{ type: "del", path: "staff/" + t.id }, { type: "del", path: "teacherLogin/" + t.nameKey }]);
    toast("ลบบัญชีแล้ว", "ok"); pageTeachers();
  });
}

async function createTeacher({ name, phone, groups, email, allGroups, admin }) {
  name = String(name || "").trim().replace(/\s+/g, " "); phone = normPhone(phone); email = String(email || "").trim().toLowerCase();
  if (!normName(name)) throw new Error("กรอกชื่อ-สกุล");
  if (phone.length < 9) throw new Error("เบอร์โทรต้องมีอย่างน้อย 9 หลัก");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`อีเมล "${email}" ไม่ถูกต้อง`);
  if (email && CONFIG.adminEmails.map(x => x.toLowerCase()).includes(email)) throw new Error(`${email} เป็นอีเมลเจ้าของระบบอยู่แล้ว (เข้าระบบแท็บผู้ดูแล)`);
  const key = await teacherKey(name);
  if (await store.get("teacherLogin/" + key)) throw new Error(`มีครูชื่อ "${name}" อยู่แล้ว`);
  // ใช้อีเมลจริงเป็นบัญชีเข้าระบบ เพื่อให้ส่งลิงก์ตั้งรหัสผ่านใหม่ได้ (ถ้าไม่มีอีเมล ใช้อีเมลภายในระบบแทน)
  const loginEmail = email || `t${Math.random().toString(36).slice(2, 12)}@${TEACHER_DOMAIN}`;
  let uid;
  try { uid = await store.admin.createUser(loginEmail, phone); }
  catch (e) { if (e.code === "auth/email-already-in-use") throw new Error(`อีเมล ${email} มีบัญชีในระบบอยู่แล้ว`); throw e; }
  await store.batch([
    { type: "set", path: "staff/" + uid, data: { name, nameKey: key, email: loginEmail, phone, groups: groups || [], allGroups: !!allGroups, admin: !!admin, role: "teacher", active: true, pwChanged: false, createdAt: store.serverTime(), createdBy: user.email } },
    { type: "set", path: "teacherLogin/" + key, data: { email: loginEmail } },
  ]);
  return uid;
}

// นำเข้ารายชื่อครูจาก Excel (อ่านเฉพาะ คำนำหน้า ชื่อ สกุล เบอร์โทร E-mail · ไม่อัปโหลดไฟล์)
let xlsxLib;
function loadXLSX() {
  if (xlsxLib) return xlsxLib;
  xlsxLib = new Promise((res, rej) => {
    if (window.XLSX) return res(window.XLSX);
    const sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    sc.onload = () => res(window.XLSX); sc.onerror = () => { xlsxLib = null; rej(new Error("โหลดตัวอ่านไฟล์ Excel ไม่สำเร็จ")); };
    document.head.appendChild(sc);
  });
  return xlsxLib;
}
export async function readTeacherSheet(file) {
  const XLSX = await loadXLSX();
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: "" });
    const hi = rows.findIndex(r => r.some(c => String(c).trim() === "ชื่อ") && r.some(c => /เบอร์/.test(String(c))));
    if (hi < 0) continue;
    const h = rows[hi].map(c => String(c).trim());
    const col = re => h.findIndex(c => re.test(c));
    const iPre = col(/^คำนำหน้า/), iName = col(/^ชื่อ$/), iSur = col(/^(นาม)?สกุล/), iPhone = col(/เบอร์/), iMail = col(/mail|อีเมล/i);
    const out = [];
    for (const r of rows.slice(hi + 1)) {
      const first = String(r[iName] || "").trim(); if (!first) continue;
      let phone = normPhone(r[iPhone]); if (phone.length === 9 && !phone.startsWith("0")) phone = "0" + phone;
      out.push({ name: joinThaiName(iPre >= 0 ? r[iPre] : "", first, iSur >= 0 ? r[iSur] : ""), phone, email: iMail >= 0 ? String(r[iMail]).trim().toLowerCase() : "" });
    }
    if (out.length) return { sheet: sn, teachers: out };
  }
  throw new Error("ไม่พบชีตที่มีคอลัมน์ ชื่อ และ เบอร์โทร");
}

function importTeachersModal(staff, groupMap) {
  const d = document.createElement("div"); d.className = "modal-back";
  d.innerHTML = `<div class="modal" style="max-width:860px"><div class="row between"><h2 style="margin:0">นำเข้ารายชื่อครูจากไฟล์ Excel</h2><button class="btn ghost sm" data-x>ปิด</button></div>
    <p class="small muted">ไฟล์ต้องมีคอลัมน์ <b>คำนำหน้า · ชื่อ · สกุล · เบอร์โทร · E-mail</b> · ระบบอ่านเฉพาะคอลัมน์เหล่านี้ในเบราว์เซอร์ ไม่อัปโหลดไฟล์ ·
    ชื่อผู้ใช้ = ชื่อ-สกุล · รหัสผ่านเริ่มต้น = เบอร์โทร · ลืมรหัสผ่าน ระบบส่งลิงก์ไปที่ E-mail · กลุ่มที่ดูแลกำหนดให้อัตโนมัติจากครูที่ปรึกษาใน ITW51</p>
    <label class="btn primary">เลือกไฟล์ Excel (.xlsx) <input type="file" id="xf" accept=".xlsx,.xls" class="hidden"></label>
    <div id="xp" style="margin-top:12px"></div></div>`;
  document.body.appendChild(d);
  $("[data-x]", d).onclick = () => { d.remove(); pageTeachers(); };
  const have = new Map(staff.map(t => [normName(t.name), t]));
  const byEmail = new Map(staff.filter(t => isRealEmail(t.email)).map(t => [t.email.toLowerCase(), t]));
  const adv = {}, advName = {};
  const exG = new Set(settings?.excludedGroups || []);
  for (const [g, info] of Object.entries(groupMap)) { if (exG.has(g)) continue; const k = normName(info.advisor); if (k) { (adv[k] ||= []).push(g); advName[k] = String(info.advisor).trim().replace(/\s+/g, " "); } }
  // กลุ่มจากครูที่ปรึกษาใน ITW51: ตรงกันทุกตัวอักษร หรือชื่อสะกดต่างเล็กน้อย (คล้าย ≥ 85%)
  const findGroups = name => {
    const k = normName(name), groups = new Set(), notes = [];
    for (const a of Object.keys(adv)) {
      if (a === k) adv[a].forEach(g => groups.add(g));
      else if (nameSimilarity(k, a) >= 0.85) { adv[a].forEach(g => groups.add(g)); notes.push(`${adv[a].join(", ")}: ใน ITW51 สะกดว่า "${advName[a]}"`); }
    }
    return { groups: [...groups].sort(), note: notes.join(" · ") };
  };
  const admins = CONFIG.adminEmails.map(x => x.toLowerCase());
  $("#xf", d).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    $("#xp", d).innerHTML = `<div class="loading"><span class="spin"></span></div>`;
    let data;
    try { data = await readTeacherSheet(f); } catch (err) { $("#xp", d).innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; return; }
    const rows = data.teachers.map(t => {
      const k = normName(t.name), fg = findGroups(t.name), auto = fg.groups;
      // จับคู่บัญชีเดิมด้วยอีเมลก่อน (กรณีแก้ชื่อในไฟล์) แล้วจึงใช้ชื่อ
      const old = (t.email && byEmail.get(t.email)) || have.get(k);
      if (admins.includes(t.email)) return { ...t, groups: auto, st: "admin" };
      if (!old) return { ...t, groups: auto, note: fg.note, st: t.phone.length < 9 ? "nophone" : "new" };
      const changes = [];
      if (normName(old.name) !== k) changes.push(`ชื่อ: ${old.name} → ${t.name}`);
      else if (old.name.replace(/\s+/g, " ") !== t.name.replace(/\s+/g, " ")) changes.push(`ชื่อ: ${old.name} → ${t.name}`);
      if (t.phone && normPhone(old.phone) !== t.phone) changes.push(`เบอร์: ${old.phone} → ${t.phone} (ส่งลิงก์ตั้งรหัสใหม่ทางอีเมล)`);
      const prevG = old.groups || [], addG = auto.filter(g => !prevG.includes(g));
      const groups = addG.length ? [...prevG, ...addG].sort() : prevG;
      if (addG.length) changes.push(`เพิ่มกลุ่ม: ${addG.join(", ")}`);
      return { ...t, groups, old, changes, note: addG.length ? fg.note : "", st: changes.length ? "update" : "have" };
    });
    // บัญชีเดิมที่ไม่อยู่ในไฟล์ใหม่ (เช่น ย้าย/ลาออก)
    const inFile = new Set(rows.map(r => r.old?.id).filter(Boolean));
    const missing = staff.filter(t => !inFile.has(t.id) && t.active !== false);
    const nNew = rows.filter(r => r.st === "new").length, nUpd = rows.filter(r => r.st === "update").length;
    const label = { new: `<span class="chip ok">สร้างใหม่</span>`, have: `<span class="chip">มีบัญชีแล้ว</span>`, update: `<span class="chip warn">ปรับปรุง</span>`, admin: `<span class="chip brand">เจ้าของระบบ</span>`, nophone: `<span class="chip bad">ไม่มีเบอร์โทร</span>` };
    $("#xp", d).innerHTML = `<p class="small">ชีต "${esc(data.sheet)}" · ${rows.length} คน · สร้างใหม่ <b>${nNew}</b> คน · ปรับปรุง <b>${nUpd}</b> คน · มีกลุ่มที่ดูแล ${rows.filter(r => r.groups.length).length} คน</p>
      <div class="tbl-wrap" style="max-height:380px;overflow:auto"><table class="tbl"><thead><tr><th>ชื่อ-สกุล</th><th>เบอร์โทร</th><th>E-mail</th><th>กลุ่มที่ดูแล (จาก ITW51)</th><th title="ผู้บริหาร เช่น ผอ. ดูนักศึกษาได้ทุกกลุ่ม">ดูทุกกลุ่ม</th><th>สถานะ</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td>${esc(r.name)}</td><td>${esc(r.phone)}</td><td class="small">${esc(r.email) || `<span class="muted">—</span>`}</td><td>${r.groups.map(g => `<span class="chip">${esc(g)}</span>`).join(" ") || `<span class="muted small">ไม่มีใน ITW51</span>`}${r.note ? `<div class="small" style="color:var(--warn)">${esc(r.note)}</div>` : ""}</td>
        <td style="text-align:center">${r.st === "admin" ? "" : `<input type="checkbox" data-all="${i}" ${(r.old?.allGroups) ? "checked" : ""} title="ดูได้ทุกกลุ่ม (ผู้บริหาร)">`}</td><td>${label[r.st]}${r.changes?.length ? `<div class="small muted">${r.changes.map(esc).join("<br>")}</div>` : ""}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="small muted" style="margin:6px 0 0">ติ๊ก "ดูทุกกลุ่ม" ให้ผู้บริหาร เช่น ผอ. · ครูที่ไม่มีกลุ่มใน ITW51 กำหนดกลุ่มภายหลังได้ที่ปุ่ม "แก้ไข"</p>
      ${missing.length ? `<label class="row small notice warn" style="margin-top:10px"><input type="checkbox" id="xoff"> ปิดใช้งานบัญชีที่ไม่อยู่ในไฟล์นี้ ${missing.length} คน: ${missing.map(t => esc(t.name)).join(", ")}</label>` : ""}
      <div class="progress" style="margin-top:12px"><i id="xpg"></i></div><div class="small muted" id="xpt"></div>
      <div class="row end" style="margin-top:8px"><button class="btn primary" id="xgo">บันทึก (สร้างใหม่ ${nNew} · ปรับปรุง ${nUpd}${missing.length ? ` · ปิดใช้งาน ${missing.length}` : ""})</button></div>`;
    $("#xgo", d).onclick = async () => {
      $("#xgo", d).disabled = true;
      // ช่อง "ดูทุกกลุ่ม" ที่เปลี่ยนจากเดิม ถือเป็นการปรับปรุง
      $$("[data-all]", d).forEach(c => {
        const r = rows[Number(c.dataset.all)]; r.allGroups = c.checked;
        if (r.old && !!r.old.allGroups !== c.checked && r.st === "have") r.st = "update";
      });
      const todo = rows.filter(r => r.st === "new" || r.st === "update"); let ok = 0; const fails = [], resetSent = [];
      for (const [i, r] of todo.entries()) {
        try {
          if (r.st === "new") await createTeacher(r);
          else {
            const key = await teacherKey(r.name), nameChanged = key !== r.old.nameKey;
            if (nameChanged && (await store.get("teacherLogin/" + key))) throw new Error(`มีครูชื่อ "${r.name}" อยู่แล้ว`);
            await store.batch([
              { type: "set", path: "staff/" + r.old.id, data: { name: r.name, nameKey: key, ...(r.phone ? { phone: r.phone } : {}), groups: r.groups, allGroups: !!r.allGroups, updatedAt: store.serverTime() }, merge: true },
              ...(nameChanged ? [{ type: "del", path: "teacherLogin/" + r.old.nameKey }, { type: "set", path: "teacherLogin/" + key, data: { email: r.old.email } }] : []),
            ]);
            // เบอร์โทรเปลี่ยน: รหัสผ่านเดิมยังเป็นเบอร์เก่า จึงส่งลิงก์ตั้งรหัสผ่านใหม่ให้ครูทางอีเมล
            if (r.phone && normPhone(r.old.phone) !== r.phone && isRealEmail(r.old.email) && !r.old.pwChanged) {
              await store.admin.sendReset(r.old.email).catch(() => {}); resetSent.push(r.name);
            }
          }
          ok++;
        } catch (err) { fails.push(`${r.name}: ${err.message}`); }
        $("#xpg", d).style.width = ((i + 1) / todo.length * 100) + "%"; $("#xpt", d).textContent = `สร้างแล้ว ${ok}/${todo.length}`;
      }
      let off = 0;
      if ($("#xoff", d)?.checked) for (const t of missing) { await store.set("staff/" + t.id, { active: false, updatedAt: store.serverTime() }, true); off++; }
      $("#xpt", d).innerHTML = `บันทึกสำเร็จ ${ok} คน${off ? ` · ปิดใช้งาน ${off} คน` : ""}${resetSent.length ? `<div class="notice small" style="margin-top:6px">เบอร์โทรเปลี่ยน ${resetSent.length} คน — รหัสผ่านยังเป็นเบอร์เดิม ระบบส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลของครูแล้ว: ${resetSent.map(esc).join(", ")}</div>` : ""}${fails.length ? `<div class="notice bad small" style="margin-top:6px">ไม่สำเร็จ ${fails.length} คน:<br>${fails.map(esc).join("<br>")}</div>` : ""}`;
      toast(`บันทึกบัญชีครู ${ok} คนแล้ว`, "ok");
    };
  };
}

function teacherModal(t, allGroups, groupMap) {
  const sel = new Set(t?.groups || []);
  const d = document.createElement("div"); d.className = "modal-back";
  d.innerHTML = `<form class="modal stack" style="max-width:620px"><h2 style="margin:0">${t ? "แก้ไขบัญชีครู" : "เพิ่มครู"}</h2>
    <div class="grid2"><div><label class="f" for="tn">ชื่อ-สกุล (ใช้เป็นชื่อผู้ใช้)</label><input type="text" id="tn" required value="${esc(t?.name || "")}" placeholder="เช่น นางสมศรี มีสุข"></div>
      <div><label class="f" for="tp">เบอร์โทร (ใช้เป็นรหัสผ่านเริ่มต้น)</label><input type="text" id="tp" inputmode="numeric" required value="${esc(t?.phone || "")}" placeholder="0812345678"></div></div>
    <div><label class="f" for="tm">E-mail (ใช้รับลิงก์เมื่อลืมรหัสผ่าน)</label><input type="email" id="tm" value="${esc(t && isRealEmail(t.email) ? t.email : "")}" ${t ? "disabled" : ""} placeholder="name@gmail.com"></div>
    ${t ? `<p class="hint">${isRealEmail(t.email) ? "อีเมลเปลี่ยนไม่ได้ (เป็นบัญชีเข้าระบบ) · ครูลืมรหัสผ่าน: กดปุ่ม \"ส่งลิงก์รีเซ็ต\" หรือให้ครูกด \"ลืมรหัสผ่าน?\" ที่หน้าเข้าสู่ระบบ" : "บัญชีนี้ไม่มีอีเมล — ถ้าเปลี่ยนเบอร์โทร รหัสผ่านของครูจะถูกตั้งใหม่เป็นเบอร์นี้"}</p>` : ""}
    <label class="row small" style="background:var(--bad-soft);padding:10px 12px;border-radius:10px"><input type="checkbox" id="tadm" ${t?.admin ? "checked" : ""}>
      <span><b>ผู้ดูแลระบบ (admin)</b> — ดาวน์โหลดคะแนน ส่งคะแนนเข้า ITW51 จัดการภาคเรียน จัดการบัญชีครูและสิทธิ์ admin (ควรมี 3–4 คน)</span></label>
    <label class="row small" style="background:var(--surface-2);padding:10px 12px;border-radius:10px"><input type="checkbox" id="tall" ${t?.allGroups ? "checked" : ""}>
      <span><b>ดูนักศึกษาและคะแนนได้ทุกกลุ่ม</b> (สำหรับผู้บริหาร เช่น ผอ.) — ยังไม่มีสิทธิ์ดาวน์โหลดคะแนนหรือจัดการระบบ</span></label>
    <div><label class="f">กลุ่มที่ดูแล (เห็นเฉพาะนักศึกษาในกลุ่มเหล่านี้)</label>
      <input type="text" id="gq" placeholder="ค้นหากลุ่ม" style="margin-bottom:6px">
      <div class="tbl-wrap" style="max-height:240px;overflow:auto" id="gl"></div>
      <div class="row" style="margin-top:6px"><input type="text" id="gx" placeholder="หรือพิมพ์รหัสกลุ่ม เช่น 004/3" style="max-width:220px"><button type="button" class="btn sm" id="gadd">เพิ่มกลุ่ม</button><span class="small muted" id="gc"></span></div></div>
    <div class="err" id="te"></div>
    <div class="row end"><button type="button" class="btn ghost" data-x>ยกเลิก</button><button class="btn primary" id="tsave">${t ? "บันทึก" : "สร้างบัญชี"}</button></div></form>`;
  document.body.appendChild(d);
  const drawG = () => {
    const q = $("#gq", d).value.trim().toLowerCase();
    const list = [...new Set([...allGroups, ...sel])].sort().filter(g => !q || (g + (groupMap[g]?.name || "") + (groupMap[g]?.advisor || "")).toLowerCase().includes(q));
    $("#gl", d).innerHTML = `<table class="tbl"><tbody>${list.map(g => `<tr><td style="width:30px"><input type="checkbox" data-g="${esc(g)}" ${sel.has(g) ? "checked" : ""}></td><td><b>${esc(g)}</b></td><td>${esc(groupMap[g]?.name || "")}</td><td class="muted small">${esc(groupMap[g]?.advisor || "")}</td></tr>`).join("") || `<tr><td class="muted">ไม่พบกลุ่ม</td></tr>`}</tbody></table>`;
    $$("[data-g]", d).forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.g) : sel.delete(c.dataset.g); $("#gc", d).textContent = `เลือก ${sel.size} กลุ่ม`; });
    $("#gc", d).textContent = `เลือก ${sel.size} กลุ่ม`;
  };
  drawG();
  $("#gq", d).oninput = drawG;
  $("#gadd", d).onclick = () => { const g = $("#gx", d).value.trim(); if (g) { sel.add(g); $("#gx", d).value = ""; drawG(); } };
  $("[data-x]", d).onclick = () => d.remove();
  $("form", d).onsubmit = async e => {
    e.preventDefault();
    const name = $("#tn", d).value.trim(), phone = normPhone($("#tp", d).value), groups = [...sel].sort(), allGroups = $("#tall", d).checked, admin = $("#tadm", d).checked;
    if (t && t.admin && !admin && t.id === user.uid && !(await confirmBox("ถอนสิทธิ์ admin ของตัวเอง? คุณจะใช้เมนูผู้ดูแลไม่ได้อีก", "ถอนสิทธิ์"))) return;
    if (admin && !t?.admin && !(await confirmBox(`ให้สิทธิ์ผู้ดูแลระบบ (admin) แก่ ${name}?`, "ให้สิทธิ์"))) return;
    $("#tsave", d).disabled = true;
    try {
      if (!t) await createTeacher({ name, phone, groups, allGroups, admin, email: $("#tm", d).value });
      else {
        const nameChanged = normName(name) !== normName(t.name), phoneChanged = phone !== normPhone(t.phone);
        if (phone.length < 9) throw new Error("เบอร์โทรต้องมีอย่างน้อย 9 หลัก");
        const key = nameChanged ? await teacherKey(name) : t.nameKey;
        if (nameChanged && await store.get("teacherLogin/" + key)) throw new Error(`มีครูชื่อ "${name}" อยู่แล้ว`);
        if (phoneChanged && isRealEmail(t.email)) {
          // บัญชีที่ใช้อีเมลจริง: เก็บเบอร์ใหม่ไว้อ้างอิง รหัสผ่านเปลี่ยนผ่านลิงก์ทางอีเมลเท่านั้น
          await store.batch([
            { type: "set", path: "staff/" + t.id, data: { name, nameKey: key, phone, groups, allGroups, admin, updatedAt: store.serverTime() }, merge: true },
            ...(nameChanged ? [{ type: "del", path: "teacherLogin/" + t.nameKey }, { type: "set", path: "teacherLogin/" + key, data: { email: t.email } }] : []),
          ]);
        } else if (phoneChanged) {
          // เปลี่ยนรหัสผ่านของผู้อื่นจากหน้าเว็บไม่ได้ จึงสร้างบัญชีเข้าระบบใหม่ด้วยเบอร์ใหม่ แล้วย้ายข้อมูลครูไป
          const email = `t${Math.random().toString(36).slice(2, 12)}@${TEACHER_DOMAIN}`;
          const uid = await store.admin.createUser(email, phone);
          const { id, ...rest } = t;
          await store.batch([
            { type: "set", path: "staff/" + uid, data: { ...rest, name, nameKey: key, email, phone, groups, allGroups, admin, updatedAt: store.serverTime() } },
            { type: "del", path: "staff/" + t.id },
            ...(nameChanged ? [{ type: "del", path: "teacherLogin/" + t.nameKey }] : []),
            { type: "set", path: "teacherLogin/" + key, data: { email } },
          ]);
        } else {
          await store.batch([
            { type: "set", path: "staff/" + t.id, data: { name, nameKey: key, groups, allGroups, admin, updatedAt: store.serverTime() }, merge: true },
            ...(nameChanged ? [{ type: "del", path: "teacherLogin/" + t.nameKey }, { type: "set", path: "teacherLogin/" + key, data: { email: t.email } }] : []),
          ]);
        }
      }
      d.remove(); toast("บันทึกแล้ว", "ok"); pageTeachers();
    } catch (err) { console.error(err); $("#te", d).textContent = err.code === "auth/email-already-in-use" ? "สร้างบัญชีไม่สำเร็จ ลองอีกครั้ง" : err.message || err.code; $("#tsave", d).disabled = false; }
  };
}

// =================================================================== GROUPS (มอบหมาย / เปลี่ยนครูประจำกลุ่ม)
async function pageGroups() {
  app.innerHTML = shell("groups", `<div class="row between"><h1>กลุ่มเรียน / ครูประจำกลุ่ม</h1></div>
    <p class="muted">${roster ? esc(semLabel(roster.sem)) : ""} · ครูประจำกลุ่มเห็นนักศึกษาและคะแนนของกลุ่มนั้น · เปลี่ยนครูได้ตลอด (เช่น ครูเกษียณ/ย้าย ครูใหม่มาแทน) มีผลทันที ข้อมูลนักศึกษาและคะแนนไม่เปลี่ยน</p>
    <div id="gp"><div class="loading"><span class="spin"></span></div></div>`); bindShell();
  if (!needRoster()) return;
  const staff = (await store.list("staff")).filter(t => t.role === "teacher").sort((a, b) => a.name.localeCompare(b.name, "th"));
  const active = staff.filter(t => t.active !== false);
  const cnt = {}; for (const x of Object.values(roster.students || {})) cnt[x.g] = (cnt[x.g] || 0) + 1;
  const ginfo = roster.groups || {};
  const gl = Object.keys(cnt).sort();
  const teachersOf = g => active.filter(t => (t.groups || []).includes(g));
  const draw = () => {
    const onlyWaiting = $("#gw")?.checked;
    const rows = gl.filter(g => !onlyWaiting || !teachersOf(g).length);
    const nWait = gl.filter(g => !teachersOf(g).length).length;
    $("#gp").innerHTML = `
      <div class="row" style="margin-bottom:10px"><label class="row small"><input type="checkbox" id="gw" ${onlyWaiting ? "checked" : ""}> แสดงเฉพาะกลุ่มที่ยังไม่มีครู (${nWait} กลุ่ม)</label></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>กลุ่ม</th><th>ชื่อกลุ่ม</th><th class="n">นักศึกษา</th><th>ครูที่ปรึกษาใน ITW51</th><th>ครูประจำกลุ่มในระบบนี้</th></tr></thead><tbody>
      ${rows.map(g => { const ts = teachersOf(g);
        return `<tr><td><b>${esc(g)}</b></td><td>${esc(ginfo[g]?.name || "")}</td><td class="n">${cnt[g]}</td><td class="small muted">${esc(ginfo[g]?.advisor || "")}</td>
        <td><div class="row" style="gap:6px;flex-wrap:nowrap">
          <select data-g="${esc(g)}" style="min-width:220px;min-height:36px;padding:4px 8px">
            <option value="">${ts.length ? "" : "⚠ รอครูประจำกลุ่ม"}</option>
            ${active.map(t => `<option value="${esc(t.id)}" ${ts.length === 1 && ts[0].id === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}
            ${ts.length > 1 ? `<option value="__multi" selected>${esc(ts.map(t => t.name).join(", "))}</option>` : ""}
          </select>
          ${ts.length ? "" : `<span class="chip warn">รอครู</span>`}</div></td></tr>`; }).join("")}
      </tbody></table></div>
      ${(settings?.excludedGroups || []).length ? `<p class="small muted" style="margin-top:10px">กลุ่มที่ไม่ได้นำเข้า (ใช้ออนไลน์ไม่ได้): ${settings.excludedGroups.map(esc).join(", ")} — แก้ไขได้ตอนนำเข้า ITW51</p>` : ""}`;
    $("#gw").onchange = draw;
    $$("select[data-g]").forEach(sel => sel.onchange = async () => {
      const g = sel.dataset.g, to = sel.value;
      if (to === "__multi") return;
      const ops = [];
      // ย้ายกลุ่ม: เอาออกจากครูคนเดิม แล้วใส่ให้ครูคนใหม่
      for (const t of staff) {
        const has = (t.groups || []).includes(g), want = t.id === to;
        if (has === want) continue;
        t.groups = want ? [...(t.groups || []), g].sort() : (t.groups || []).filter(x => x !== g);
        ops.push({ type: "set", path: "staff/" + t.id, data: { groups: t.groups, updatedAt: store.serverTime() }, merge: true });
      }
      if (!ops.length) return;
      await store.batch(ops);
      toast(to ? `กลุ่ม ${g} → ${staff.find(t => t.id === to).name}` : `กลุ่ม ${g} รอครูประจำกลุ่ม`, "ok");
      draw();
    });
  };
  draw();
}

// =================================================================== IMPORT
function semSort(a, b) { const [ya, ta] = a.split("/").map(Number), [yb, tb] = b.split("/").map(Number); return ya - yb || ta - tb; }

async function collectFolder(files) {
  // จัดกลุ่มไฟล์ตามโฟลเดอร์ระดับ 1/2/3
  const lv = {}; let group = null, rules = {};
  for (const f of files) {
    const p = (f.webkitRelativePath || f.name).replace(/\\/g, "/").split("/");
    const name = p[p.length - 1].toUpperCase(), parent = p[p.length - 2] || "";
    if (name === "GROUP.DBF" && !/^[0-3]$/.test(parent)) group = f;
    if (!/^[1-3]$/.test(parent)) continue;
    if (name === "STUDENT.DBF") (lv[parent] ||= {}).student = f;
    if (name === "GRADE.DBF") (lv[parent] ||= {}).grade = f;
    if (name === "SUBJECT.DBF") (lv[parent] ||= {}).subject = f;
    if (name === "RULE.DBF") rules[parent] = f;
  }
  return { lv, group, rules };
}

async function pageImport() {
  app.innerHTML = shell("import", `<h1>ภาคเรียน / นำเข้าข้อมูล ITW51</h1>
    <p class="muted">ระบบจะอ่านไฟล์ STUDENT.DBF, GRADE.DBF, SUBJECT.DBF ในเบราว์เซอร์ แล้วสร้างบัญชีเข้าเรียนเฉพาะนักศึกษาที่ลงทะเบียนในภาคเรียนที่เลือก
    (เก็บเฉพาะรหัส ชื่อ กลุ่ม และรายวิชา — เลขบัตรประชาชนจะไม่ถูกส่งขึ้นระบบ ใช้สร้างรหัสลับแบบเข้ารหัสทางเดียวเท่านั้น)</p>
    <div id="semMgr"></div>
    <div class="card stack" style="margin-top:16px">
      <h2>เพิ่ม / ปรับปรุงภาคเรียน จากข้อมูล ITW51</h2>
      <div class="drop" id="drop"><p><b>เลือกโฟลเดอร์ข้อมูลสถานศึกษาของ ITW51</b><br><span class="muted small">เช่น <code>ITW51\\DATA\\${esc(CONFIG.schoolCode)}</code> ที่มีโฟลเดอร์ย่อย 1 (ประถม), 2 (ม.ต้น), 3 (ม.ปลาย)</span></p>
        <label class="btn primary">เลือกโฟลเดอร์ <input type="file" id="dir" webkitdirectory directory multiple class="hidden"></label></div>
      <div id="found"></div>
    </div>
    <div id="step2"></div>`); bindShell();
  drawSemMgr();
  $("#dir").onchange = async e => {
    const { lv, group } = await collectFolder([...e.target.files]);
    const levels = Object.keys(lv).filter(k => lv[k].student && lv[k].grade).sort();
    if (!levels.length) { $("#found").innerHTML = `<div class="notice bad">ไม่พบไฟล์ STUDENT.DBF และ GRADE.DBF ในโฟลเดอร์ย่อย 1/2/3 — ตรวจว่าเลือกโฟลเดอร์รหัสสถานศึกษาถูกต้อง</div>`; return; }
    $("#found").innerHTML = `<div class="notice">พบข้อมูล: ${levels.map(l => LEVELS[l]).join(" · ")} <span class="spin"></span> กำลังอ่านไฟล์…</div>`;
    const data = {};
    for (const l of levels) {
      data[l] = { student: new DBF(await lv[l].student.arrayBuffer()), grade: new DBF(await lv[l].grade.arrayBuffer()), subject: lv[l].subject ? new DBF(await lv[l].subject.arrayBuffer()) : null };
    }
    const groups = {};
    const groupInfo = {};
    if (group) { const g = new DBF(await group.arrayBuffer()); for (const r of g.rows(["GRP_CODE", "GRP_NAME", "GRP_ADVIS", "GRP_MEET"])) { groups[r.GRP_CODE] = r.GRP_NAME; groupInfo[r.GRP_CODE] = { name: r.GRP_NAME, advisor: (r.GRP_ADVIS || "").trim().replace(/\s+/g, " "), meet: r.GRP_MEET || "" }; } }
    groups.__info = groupInfo;
    const sems = new Set();
    for (const l of levels) for (const r of data[l].grade.rows(["SEMESTRY"])) if (/^\d{2}\/\d$/.test(r.SEMESTRY)) sems.add(r.SEMESTRY);
    const semList = [...sems].sort(semSort).reverse();
    $("#found").innerHTML = `<div class="notice">พบข้อมูล: ${levels.map(l => LEVELS[l]).join(" · ")}</div>
      <div class="row"><label class="f" style="margin:0">ภาคเรียนที่จะเปิดสอนออนไลน์</label>
      <select id="sem" style="max-width:320px">${semList.slice(0, 8).map(s => `<option value="${s}">${s} — ${semLabel(s)}</option>`).join("")}</select>
      <button class="btn primary" id="check">ตรวจข้อมูล</button></div>
      <p class="small muted">นำเข้าทีละภาคเรียน · ภาคเรียนที่นำเข้าแล้วจะเป็นเมนูให้นักศึกษาเลือก · นำเข้าภาคเดิมซ้ำได้เมื่อมีการเพิ่ม/ถอนรายวิชา</p>`;
    $("#check").onclick = () => prepareImport($("#sem").value, levels, data, groups);
  };
}

// กลุ่มที่ใช้ระบบออนไลน์ไม่ได้ (เช่น เรือนจำ) — ไม่นำเข้า
const isPrisonGroup = info => /เรือนจำ|ทัณฑสถาน/.test(`${info?.name || ""} ${info?.meet || ""}`);

async function prepareImport(sem, levels, data, groups) {
  // อ่านนักศึกษาที่ลงทะเบียนในภาคเรียนนี้ทั้งหมดก่อน แล้วค่อยกรองกลุ่มที่ไม่นำเข้า
  const all = [], subjAll = {};
  for (const l of levels) {
    const { student, grade, subject } = data[l];
    const subj = (subjAll[l] = {});
    if (subject) for (const r of subject.rows(["SUB_CODE", "SUB_NAME", "SUB_CREDIT"])) subj[r.SUB_CODE] = r;
    const enr = {};
    for (const r of grade.rows(["STD_CODE", "SEMESTRY", "SUB_CODE"])) {
      if (r.SEMESTRY !== sem || !r.SUB_CODE) continue;
      (enr[r.STD_CODE] ||= new Set()).add(r.SUB_CODE);
    }
    for (const r of student.rows(["ID", "STD_CODE", "PRENAME", "NAME", "SURNAME", "GRP_CODE", "CARDID"])) {
      const codes = enr[r.STD_CODE]; if (!codes) continue;
      all.push({ sid: r.ID || r.STD_CODE.slice(-10), name: `${r.PRENAME}${r.NAME} ${r.SURNAME}`.trim(), g: r.GRP_CODE, l, cardId: r.CARDID, codes: [...codes].sort() });
    }
  }
  const info = groups.__info || {};
  const gCount = {}; for (const x of all) gCount[x.g] = (gCount[x.g] || 0) + 1;
  const gList = Object.keys(gCount).sort();
  const prevEx = new Set(settings?.excludedGroups || []);
  const excl = new Set(gList.filter(g => prevEx.has(g) || isPrisonGroup(info[g])));

  let students, courses, logins, noCard;
  const build = () => {
    students = {}; courses = {}; logins = []; noCard = [];
    for (const x of all) {
      if (excl.has(x.g)) continue;
      students[x.sid] = { n: x.name, g: x.g, l: x.l };
      const cids = [], sj = {};
      for (const code of x.codes) {
        const id = courseId(sem, code); cids.push(id);
        const sb = subjAll[x.l][code] || {};
        sj[id] = { code, name: sb.SUB_NAME || code, credit: sb.SUB_CREDIT ?? null };
        (courses[id] ||= { code, name: sb.SUB_NAME || code, level: x.l, credit: sb.SUB_CREDIT ?? null, sids: [] }).sids.push(x.sid);
      }
      if (!normId(x.cardId)) { noCard.push({ sid: x.sid, name: x.name, g: x.g }); continue; }
      logins.push({ sid: x.sid, cardId: x.cardId, doc: { sid: x.sid, name: x.name, level: x.l, grp: x.g, grpName: groups[x.g] || "", sem, courses: cids, subj: sj } });
    }
  };
  build();
  const prepRoster = await store.get("admin/roster-" + semId(sem)).catch(() => null);
  const exStudents = () => all.filter(x => excl.has(x.g)).length;
  $("#step2").innerHTML = `<div class="card stack" style="margin-top:16px"><h2>ตรวจสอบก่อนนำเข้า — ${esc(semLabel(sem))}</h2>
    <div id="impStats"></div>
    <details class="card" style="padding:12px 14px;box-shadow:none" ${excl.size ? "" : ""}>
      <summary><b>กลุ่มที่ไม่นำเข้า</b> (ใช้ระบบออนไลน์ไม่ได้ เช่น เรือนจำ) — <span id="exSum"></span> · คลิกเพื่อแก้ไข</summary>
      <p class="small muted" style="margin:8px 0">ติ๊ก = ไม่นำเข้า นักศึกษากลุ่มนี้จะไม่มีบัญชีเข้าเรียนออนไลน์ · ระบบติ๊กกลุ่มเรือนจำให้อัตโนมัติ และจำค่าที่เลือกไว้ใช้ครั้งต่อไป</p>
      <div class="tbl-wrap" style="max-height:300px;overflow:auto"><table class="tbl"><thead><tr><th>ไม่นำเข้า</th><th>กลุ่ม</th><th>ชื่อกลุ่ม / สถานที่พบกลุ่ม</th><th>ครูที่ปรึกษาใน ITW51</th><th class="n">นักศึกษา</th></tr></thead><tbody>
      ${gList.map(g => `<tr><td style="text-align:center"><input type="checkbox" data-ex="${esc(g)}" ${excl.has(g) ? "checked" : ""}></td><td><b>${esc(g)}</b></td><td>${esc(info[g]?.name || "")}${info[g]?.meet ? `<span class="muted small"> · ${esc(info[g].meet)}</span>` : ""}</td><td class="small">${esc(info[g]?.advisor || "")}</td><td class="n">${gCount[g]}</td></tr>`).join("")}
      </tbody></table></div>
    </details>
    <div class="notice small">${prepRoster && !Object.keys(prepRoster.students || {}).length ? `ภาคเรียนนี้ครูเตรียมไว้ล่วงหน้า ${Object.keys(prepRoster.courses || {}).length} รายวิชา — ระบบจะจับคู่ตามรหัสวิชา บทเรียนที่เตรียมไว้จะขึ้นให้นักศึกษาที่ลงทะเบียนทันที` : semList().includes(sem) ? `ภาคเรียนนี้มีอยู่แล้ว — รายวิชาที่ลงทะเบียนของภาคนี้จะถูกปรับตามข้อมูลใหม่` : `จะเพิ่มเมนู <b>${esc(semShort(sem))}</b> ให้นักศึกษา`} · ภาคเรียนอื่น บทเรียน และผลคะแนนเดิมไม่ถูกลบ</div>
    <label class="row small"><input type="checkbox" id="setCur" ${!settings?.current || semCompare(sem, settings.current) >= 0 ? "checked" : ""}> ตั้งเป็นภาคเรียนปัจจุบัน (นักศึกษาจะเห็นภาคนี้เป็นค่าเริ่มต้น)</label>
    <div class="progress"><i id="pg"></i></div><div class="small muted" id="pgt"></div>
    <div class="row end"><button class="btn primary" id="go"></button></div></div>`;
  const drawStats = () => {
    const byLevel = l => logins.filter(x => x.doc.level === l).length;
    $("#impStats").innerHTML = `<div class="stat-row">${levels.map(l => `<div class="stat"><div class="v">${byLevel(l)}</div><div class="l">${LEVELS[l]}</div></div>`).join("")}
      <div class="stat"><div class="v">${Object.keys(courses).length}</div><div class="l">รายวิชา</div></div></div>
      ${noCard.length ? `<div class="notice warn">มี ${noCard.length} คนที่ไม่มีเลขบัตรประชาชน/เลข G ใน ITW51 จึงเข้าระบบไม่ได้: ${noCard.map(x => esc(x.sid + " " + x.name)).join(", ")}</div>` : ""}`;
    $("#exSum").textContent = excl.size ? `${excl.size} กลุ่ม ${exStudents().toLocaleString()} คน` : "ไม่มี";
    $("#go").textContent = `นำเข้า ${logins.length.toLocaleString()} คน`;
  };
  drawStats();
  $$("[data-ex]").forEach(c => c.onchange = () => { c.checked ? excl.add(c.dataset.ex) : excl.delete(c.dataset.ex); build(); drawStats(); });
  $("#go").onclick = async () => {
    $("#go").disabled = true;
    try {
      $("#pgt").textContent = "กำลังสร้างรหัสเข้าระบบ…";
      const sid_ = semId(sem), ops = [], keep = new Set();
      const old = Object.fromEntries((await store.list("logins")).map(o => [o.id, o]));
      const withCourses = terms => [...new Set(Object.values(terms).flatMap(t => t.courses || []))];
      for (const x of logins) {
        const k = await loginKey(x.sid, x.cardId); keep.add(k);
        const terms = { ...loginTerms(old[k]) };
        const d = x.doc;
        terms[sid_] = { sem, level: d.level, grp: d.grp, grpName: d.grpName, courses: d.courses, subj: d.subj };
        ops.push({ type: "set", path: "logins/" + k, data: { sid: x.sid, name: d.name, terms, courses: withCourses(terms) } });
      }
      // นักศึกษาที่ไม่อยู่ในภาคนี้แล้ว: เอาภาคนี้ออก (ภาคอื่นยังอยู่)
      for (const [k, o] of Object.entries(old)) {
        if (keep.has(k)) continue;
        const terms = { ...loginTerms(o) };
        if (!terms[sid_] && o.terms) continue;
        delete terms[sid_];
        if (!Object.keys(terms).length) ops.push({ type: "del", path: "logins/" + k });
        else ops.push({ type: "set", path: "logins/" + k, data: { sid: o.sid, name: o.name, terms, courses: withCourses(terms) } });
      }
      // รวมกับรายวิชาที่ครูเตรียมไว้ล่วงหน้า (วิชาที่ยังไม่มีคนลงทะเบียนยังอยู่ บทเรียนไม่หาย)
      const prev = await store.get("admin/roster-" + sid_);
      const merged = {};
      for (const [id, c] of Object.entries(prev?.courses || {})) merged[id] = { ...c, sids: [] };
      for (const [id, c] of Object.entries(courses)) merged[id] = { ...(merged[id] || {}), ...c, manual: !!merged[id]?.manual };
      const usedGroups = new Set(Object.values(students).map(x => x.g));
      const groupsOut = Object.fromEntries(Object.entries(groups.__info || {}).filter(([k]) => usedGroups.has(k)));
      ops.push({ type: "set", path: "admin/roster-" + sid_, data: { sem, students, courses: merged, groups: groupsOut, importedAt: store.serverTime(), importedBy: user.email } });
      const sems = [...new Set([...semList(), sem])].sort(semCompare);
      const current = $("#setCur").checked ? sem : (settings?.current || sem);
      const exAll = [...new Set([...[...prevEx].filter(g => !gList.includes(g)), ...excl])].sort();
      ops.push({ type: "set", path: "settings/app", data: { semesters: sems, current, semester: current, excludedGroups: exAll, updatedAt: store.serverTime() }, merge: true });
      await store.batch(ops, (n, t) => { $("#pg").style.width = (n / t * 100) + "%"; $("#pgt").textContent = `บันทึก ${n.toLocaleString()}/${t.toLocaleString()}`; });
      settings = await store.get("settings/app"); await useSem(sem);
      toast("นำเข้าข้อมูลเรียบร้อย", "ok");
      $("#pgt").innerHTML = `เสร็จแล้ว — <a href="#/courses">ไปสร้างบทเรียน ${esc(semShort(sem))} →</a>`;
      drawSemMgr(); refreshSide();
    } catch (e) { console.error(e); toast("นำเข้าไม่สำเร็จ: " + e.message, "bad"); $("#go").disabled = false; }
  };
}

function refreshSide() {
  const side = $(".side"); if (!side) return;
  const tmp = document.createElement("div"); tmp.innerHTML = shell("import", "");
  side.replaceWith(tmp.querySelector(".side")); bindShell();
}

// เตรียมภาคเรียนล่วงหน้า (ก่อนมีข้อมูลลงทะเบียนใน ITW51)
function prepareSemesterModal() {
  const nowBE = new Date().getFullYear() + 543;
  const d = document.createElement("div"); d.className = "modal-back";
  d.innerHTML = `<form class="modal small stack"><h3>เตรียมภาคเรียนล่วงหน้า</h3>
    <div class="grid2"><div><label class="f" for="pt">ภาคเรียน</label><select id="pt"><option value="1">ภาคเรียนที่ 1</option><option value="2" selected>ภาคเรียนที่ 2</option><option value="3">ภาคเรียนฤดูร้อน</option></select></div>
    <div><label class="f" for="py">ปีการศึกษา</label><input type="number" id="py" value="${nowBE}" min="2550" max="2650" required></div></div>
    <p class="hint">สร้างภาคเรียนว่างไว้ แล้วเพิ่มรายวิชาและบทเรียนได้ทันที นักศึกษาจะเห็นภาคนี้เมื่อนำเข้า ITW51 หลังลงทะเบียนแล้ว</p>
    <div class="row end"><button type="button" class="btn ghost" data-x>ยกเลิก</button><button class="btn primary">สร้างภาคเรียน</button></div></form>`;
  document.body.appendChild(d);
  $("[data-x]", d).onclick = () => d.remove();
  $("form", d).onsubmit = async e => {
    e.preventDefault();
    const sem = `${String(Number($("#py", d).value) - 2500).padStart(2, "0")}/${$("#pt", d).value}`;
    if (semList().includes(sem)) { toast(semShort(sem) + " มีอยู่แล้ว", "bad"); return; }
    await store.set("admin/roster-" + semId(sem), { sem, students: {}, courses: {}, prepared: true, createdAt: store.serverTime() }, false);
    await store.set("settings/app", { semesters: [...semList(), sem].sort(semCompare), ...(settings?.current ? {} : { current: sem, semester: sem }) }, true);
    settings = await store.get("settings/app"); await useSem(sem);
    d.remove(); toast(`สร้าง ${semShort(sem)} แล้ว — เพิ่มรายวิชาได้เลย`, "ok");
    location.hash = "#/courses";
  };
}

// รายการภาคเรียนในระบบ: ตั้งเป็นภาคปัจจุบัน / ซ่อนจากนักศึกษา
async function drawSemMgr() {
  const box = $("#semMgr"); if (!box) return;
  const list = semList();
  const rosters = await Promise.all(list.map(x => store.get("admin/roster-" + semId(x)).catch(() => null)));
  box.innerHTML = `<div class="card"><div class="row between"><h2 style="margin:0">ภาคเรียนในระบบ</h2><button class="btn" id="prepSem">+ เตรียมภาคเรียนล่วงหน้า</button></div>
    <p class="small muted" style="margin-top:6px">นักศึกษาจะเห็นเป็นเมนูตามรายการนี้ (เฉพาะภาคที่ตนลงทะเบียน) · ภาคที่ยังไม่เปิดเทอม เตรียมรายวิชาและบทเรียนไว้ก่อนได้ แล้วนำเข้า ITW51 เมื่อนักศึกษาลงทะเบียนแล้ว</p>
    ${!list.length ? `<p class="muted">ยังไม่มีภาคเรียน</p>` : ""}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ภาคเรียน</th><th class="n">นักศึกษา</th><th class="n">รายวิชา</th><th>นำเข้าเมื่อ</th><th></th></tr></thead><tbody>
    ${list.slice().reverse().map(x => { const r = rosters[list.indexOf(x)];
      return `<tr><td><b>${esc(semShort(x))}</b> ${x === settings?.current ? `<span class="chip brand">ปัจจุบัน</span>` : ""}</td>
      <td class="n">${r && Object.keys(r.students || {}).length ? Object.keys(r.students).length.toLocaleString() : `<span class="chip warn">เตรียมล่วงหน้า</span>`}</td><td class="n">${r ? Object.keys(r.courses || {}).length : "—"}</td>
      <td class="small muted">${r?.importedAt ? new Date(r.importedAt).toLocaleString("th-TH") : "ยังไม่นำเข้า ITW51"}</td>
      <td><div class="row end">${x !== settings?.current ? `<button class="btn sm" data-cur="${x}">ตั้งเป็นปัจจุบัน</button>` : ""}<button class="btn sm ghost danger" data-rm="${x}">ลบออกจากเมนู</button></div></td></tr>`; }).join("")}
    </tbody></table></div></div>`;
  $("#prepSem", box).onclick = () => prepareSemesterModal();
  $$("[data-cur]", box).forEach(b => b.onclick = async () => {
    await store.set("settings/app", { current: b.dataset.cur, semester: b.dataset.cur }, true);
    settings = await store.get("settings/app"); toast("ตั้งเป็นภาคเรียนปัจจุบันแล้ว", "ok"); drawSemMgr(); refreshSide();
  });
  $$("[data-rm]", box).forEach(b => b.onclick = async () => {
    const x = b.dataset.rm;
    if (!(await confirmBox(`ลบ ${semShort(x)} ออกจากเมนูของนักศึกษา? (บทเรียนและผลคะแนนของภาคนี้ยังเก็บไว้ นำเข้าใหม่ได้ภายหลัง)`, "ลบออกจากเมนู"))) return;
    const sems = list.filter(y => y !== x);
    const current = settings?.current === x ? (sems[sems.length - 1] || null) : settings?.current;
    await store.set("settings/app", { semesters: sems, current, semester: current }, true);
    settings = await store.get("settings/app");
    if (curSem === x) await useSem(current);
    toast("ลบออกจากเมนูแล้ว", "ok"); drawSemMgr(); refreshSide();
  });
}

// =================================================================== EXPORT → Excel (นำไปนำเข้าใน ITW51)
async function pageExport() {
  app.innerHTML = shell("export", `<h1>ดาวน์โหลดคะแนน (Excel)</h1>
    <p class="muted">${roster ? esc(semLabel(roster.sem)) : ""} · คะแนนกลางภาคเต็มตามที่ครูตั้งในแต่ละวิชา (ค่าเริ่มต้น วิดีโอ ${CONFIG.videoFull} + แบบทดสอบ ${CONFIG.quizFull}) · วิชาเลือกมีคะแนนปลายภาคเพิ่ม (เต็มตามที่ครูตั้ง ปกติ ${DEFAULT_FINAL_FULL}) · ดาวน์โหลดเป็นไฟล์ Excel แล้วนำเข้าใน ITW51</p>
    <div id="ex"><div class="loading"><span class="spin"></span></div></div>`); bindShell();
  if (!needRoster()) return;
  const cl = courseList().filter(c => (c.sids || []).length);
  if (!cl.length) { $("#ex").innerHTML = `<div class="notice">ภาคเรียนนี้ยังไม่มีนักศึกษาลงทะเบียน</div>`; return; }
  const { results, courses, keys } = await loadScores(roster.sem, cl.map(c => c.id));
  const res = {}; for (const r of results) res[r.sid + "|" + r.courseId] = r;
  const groups = [...new Set(Object.values(roster.students).map(x => x.g))].sort();
  $("#ex").innerHTML = `<div class="card stack">
    <div class="grid2">
      <div><label class="f" for="xl">ระดับ</label><select id="xl"><option value="">ทุกระดับ</option>${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <div><label class="f" for="xg">กลุ่ม</label><select id="xg"><option value="">ทุกกลุ่ม</option>${groups.map(g => `<option value="${esc(g)}">${esc(g)}${roster.groups?.[g]?.name ? " · " + esc(roster.groups[g].name) : ""}</option>`).join("")}</select></div>
    </div>
    <div><label class="f" for="xc">รายวิชา</label><select id="xc"><option value="">ทุกรายวิชา</option>${cl.map(c => `<option value="${esc(c.id)}">${esc(c.code)} ${esc(c.name)}${courses[c.id]?.published ? "" : " (ยังไม่เปิดบทเรียน)"}</option>`).join("")}</select></div>
    <div class="grid2">
      <div><label class="f" for="xf">รูปแบบไฟล์</label><select id="xf">
        <option value="sheets">แยกชีตตามรายวิชา (1 วิชา = 1 ชีต)</option>
        <option value="one">ตารางเดียว ทุกคน-ทุกวิชา</option></select></div>
      <div><label class="f" for="xz">นักศึกษาที่ยังไม่ได้ทำออนไลน์</label><select id="xz">
        <option value="blank">เว้นว่าง</option><option value="zero">ใส่ 0</option><option value="skip">ไม่ใส่ในไฟล์</option></select></div>
    </div>
    <label class="row small"><input type="checkbox" id="xo" checked> <span>เฉพาะรายวิชาที่เปิดบทเรียนออนไลน์แล้ว</span></label>
    <div id="xs" class="notice small"></div>
    <div class="row end"><button class="btn primary" id="xd">⬇ ดาวน์โหลด Excel</button></div>
  </div>
  <div id="xprev" style="margin-top:14px"></div>`;

  const build = () => {
    const lv = $("#xl").value, g = $("#xg").value, c1 = $("#xc").value, zero = $("#xz").value, onlyPub = $("#xo").checked;
    const rows = [];
    for (const c of cl) {
      if (c1 && c.id !== c1) continue;
      if (lv && c.level !== lv) continue;
      if (onlyPub && !courses[c.id]?.published) continue;
      for (const sid of c.sids || []) {
        const st = roster.students[sid]; if (!st || (g && st.g !== g)) continue;
        const r = res[sid + "|" + c.id];
        const sc = r ? computeScore(courses[c.id], keys[c.id], r) : null;
        const ty = courseType(c.code, courses[c.id]?.type), fin = hasFinalExam(courses[c.id]), finDone = !!r?.finAt;
        const done = !!sc?.attempted;
        if (!done && !finDone && zero === "skip") continue;
        const blank = !done && zero === "blank";
        const fBlank = !finDone && zero !== "zero";
        const status = (done ? (r.quizAt ? "ทำกลางภาคครบ" : "ทำกลางภาคบางส่วน") : "ยังไม่ทำกลางภาค") + (fin ? (finDone ? " · ส่งปลายภาคแล้ว" : " · ยังไม่สอบปลายภาค") : "");
        rows.push({ sid, std: CONFIG.schoolCode + sid, name: st.n, grp: st.g, level: LEVELS[st.l] || "", code: c.code, subject: c.name, type: TYPE_LABEL[ty],
          video: blank ? "" : done ? sc.video : 0, quiz: blank ? "" : done ? sc.quiz : 0,
          total: blank ? "" : done ? sc.total : 0, itw: blank ? "" : done ? sc.itw : 0, midFull: courses[c.id] ? midFulls(courses[c.id]).midFull : "",
          fin: !fin ? "" : fBlank ? "" : finDone ? sc.finalItw : 0, finFull: fin ? sc?.finalFull ?? finalFullOf(courses[c.id]) : "",
          status, done: done || finDone });
      }
    }
    rows.sort((a, b) => a.code.localeCompare(b.code, "th") || a.grp.localeCompare(b.grp) || a.sid.localeCompare(b.sid));
    return rows;
  };
  // คอลัมน์ 8–13 เป็นตัวเลข · ปลายภาคมีเฉพาะวิชาเลือกที่มีข้อสอบปลายภาค
  const HEAD = ["ลำดับ", "รหัสนักศึกษา", "ชื่อ-สกุล", "กลุ่ม", "ระดับ", "รหัสวิชา", "ชื่อวิชา", "ประเภทวิชา", "วิดีโอ", "แบบทดสอบ", "รวมกลางภาค", "คะแนนกลางภาค (ปัดเศษ)", "กลางภาคเต็ม", "คะแนนปลายภาค (ปัดเศษ)", "ปลายภาคเต็ม", "สถานะ"];
  const toRow = (r, i) => [i + 1, r.sid, r.name, r.grp, r.level, r.code, r.subject, r.type, r.video, r.quiz, r.total, r.itw, r.midFull, r.fin, r.finFull, r.status];
  const draw = () => {
    const rows = build();
    const nSub = new Set(rows.map(r => r.code)).size, nDone = rows.filter(r => r.done).length;
    $("#xs").innerHTML = rows.length ? `จะได้ <b>${rows.length.toLocaleString()}</b> แถว · ${nSub} รายวิชา · ทำออนไลน์แล้ว ${nDone.toLocaleString()} คน-วิชา` : "ไม่มีข้อมูลตามเงื่อนไขที่เลือก";
    $("#xd").disabled = !rows.length;
    $("#xprev").innerHTML = rows.length ? `<div class="small muted" style="margin-bottom:6px">ตัวอย่าง ${Math.min(rows.length, 30)} แถวแรก</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>${HEAD.map((h, i) => `<th class="${i >= 8 && i <= 14 ? "n" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>
      ${rows.slice(0, 30).map((r, i) => `<tr>${toRow(r, i).map((v, j) => `<td class="${j >= 8 && j <= 14 ? "n" : ""}">${esc(typeof v === "number" && j >= 8 && j <= 10 ? fmtNum(v) : v)}</td>`).join("")}</tr>`).join("")}
      </tbody></table></div>` : "";
  };
  ["xl", "xg", "xc", "xf", "xz", "xo"].forEach(id => $("#" + id).onchange = draw);
  draw();

  $("#xd").onclick = async () => {
    const rows = build(); if (!rows.length) return;
    $("#xd").disabled = true; $("#xd").innerHTML = `<span class="spin"></span> กำลังสร้างไฟล์`;
    try {
      const XLSX = await loadXLSX();
      const wb = XLSX.utils.book_new();
      const mk = list => {
        const ws = XLSX.utils.aoa_to_sheet([HEAD, ...list.map(toRow)]);
        ws["!cols"] = [6, 13, 26, 9, 18, 10, 30, 11, 9, 10, 11, 12, 11, 12, 10, 30].map(w => ({ wch: w }));
        // รหัสนักศึกษาเป็นข้อความ (กันเลข 0 หน้าหาย)
        list.forEach((_, i) => { const a = XLSX.utils.encode_cell({ r: i + 1, c: 1 }); if (ws[a]) { ws[a].t = "s"; ws[a].z = "@"; } });
        return ws;
      };
      if ($("#xf").value === "one") XLSX.utils.book_append_sheet(wb, mk(rows), "คะแนนออนไลน์");
      else {
        const by = {}; rows.forEach(r => (by[r.code] ||= []).push(r));
        for (const [code, list] of Object.entries(by)) XLSX.utils.book_append_sheet(wb, mk(list), code.replace(/[\\/?*[\]:]/g, "-").slice(0, 31));
      }
      const parts = [roster.sem.replace("/", "-"), $("#xl").value && "ระดับ" + $("#xl").value, $("#xg").value && "กลุ่ม" + $("#xg").value.replace(/\//g, "-"), $("#xc").value && roster.courses[$("#xc").value]?.code].filter(Boolean);
      XLSX.writeFile(wb, `คะแนนออนไลน์_${parts.join("_")}.xlsx`);
      toast("ดาวน์โหลดแล้ว", "ok");
    } catch (e) { console.error(e); toast("สร้างไฟล์ไม่สำเร็จ: " + e.message, "bad"); }
    finally { $("#xd").disabled = false; $("#xd").textContent = "⬇ ดาวน์โหลด Excel"; }
  };
}

// =================================================================== ROUTER
async function route() {
  cleanup.forEach(f => { try { f(); } catch {} }); cleanup = [];
  if (!user) { const m = loginMsg; loginMsg = ""; return renderLogin(m); }
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const [p, arg] = [h.split("/")[0], h.split("/").slice(1).join("/")];
  try {
    if (p === "courses") return await pageCourses();
    if (p === "course") return await pageCourseEdit(arg);
    if (p === "results") return await pageResults(arg || null);
    if (ADMIN_PAGES.has(p) && !isAdm()) { location.hash = "#/dash"; return; }
    if (p === "students") return await pageStudents();
    if (p === "teachers") return await pageTeachers();
    if (p === "groups") return await pageGroups();
    if (p === "import") return await pageImport();
    if (p === "export") return await pageExport();
    return await pageDash();
  } catch (e) {
    console.error(e);
    const m = $("#main") || app;
    m.innerHTML = `<div class="notice bad">เกิดข้อผิดพลาด: ${esc(e.message)}${/permission/i.test(e.message) ? "<br>บัญชีนี้ไม่มีสิทธิ์ผู้ดูแล — ตรวจรายชื่ออีเมลในไฟล์ firestore.rules" : ""}</div>`;
  }
}

(async function init() {
  try { store = await getStore(); demoBanner(isDemo, { page: "admin", onReset: async () => { await store.reset(); await store.admin.signOut(); location.hash = ""; location.reload(); } }); }
  catch (e) { app.innerHTML = `<div class="wrap"><div class="notice bad">เชื่อมต่อ Firebase ไม่ได้: ${esc(e.message)}</div></div>`; return; }
  window.addEventListener("hashchange", route);
  store.admin.onChange(async u => {
    user = u; role = null; me = null;
    if (u) {
      // ผู้ดูแล = อีเมลในรายชื่อ (config.js + firestore.rules) · ครู = มีบัญชีใน staff ที่ยังใช้งานอยู่
      const adminEmail = CONFIG.adminEmails.map(x => x.toLowerCase()).includes(String(u.email).toLowerCase());
      const staffDoc = adminEmail ? null : await store.get("staff/" + u.uid).catch(() => null);
      if (adminEmail || (isDemo && !staffDoc)) role = "admin";
      else if (staffDoc && staffDoc.admin === true && staffDoc.active !== false) { role = "admin"; me = staffDoc; }
      else {
        me = staffDoc;
        if (me && me.active !== false && me.role === "teacher") role = "teacher";
        else { me = null; user = null; loginMsg = "บัญชีนี้ไม่มีสิทธิ์เข้าระบบ หรือถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ"; await store.admin.signOut(); return; }
      }
    }
    if (u) {
      try {
        settings = await store.get("settings/app");
        const list = semList(), saved = SS.get("itw51:adminSem");
        await useSem(list.includes(saved) ? saved : (settings?.current || settings?.semester || list[list.length - 1]));
      } catch (e) { settings = null; roster = null; console.error(e); }
    }
    route();
  });
})();
