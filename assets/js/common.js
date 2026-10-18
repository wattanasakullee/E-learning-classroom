import { CONFIG } from "./config.js";

export const LEVELS = { "1": "ประถมศึกษา", "2": "มัธยมศึกษาตอนต้น", "3": "มัธยมศึกษาตอนปลาย" };

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function normId(s) { return String(s || "").replace(/[\s-]/g, "").toUpperCase(); }

export async function loginKey(sid, cardId) {
  const msg = `${CONFIG.keySalt}|${normId(sid)}|${normId(cardId)}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function semLabel(sem) {
  const [yy, t] = String(sem || "").split("/");
  if (!yy) return "";
  const year = 2500 + Number(yy);
  return `ภาคเรียนที่ ${t === "3" ? "ฤดูร้อน" : t} ปีการศึกษา ${year}`;
}
export const courseId = (sem, code) => `${String(sem).replace("/", "-")}_${code}`;
export const resultId = (key, cid) => `${key}__${cid}`;

export function fmtTime(t) {
  t = Math.max(0, Math.floor(t || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
}
export function parseTime(s) {
  const p = String(s).trim().split(":").map(Number);
  if (p.some(isNaN)) return null;
  return p.reduce((a, v) => a * 60 + v, 0);
}
export const fmtNum = n => (Math.round(n * 100) / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 });

export function uid() { return Math.random().toString(36).slice(2, 9); }

// คำนวณคะแนน: วิดีโอ (กี่ข้อก็ได้) = 5 คะแนน, แบบทดสอบ (กี่ข้อก็ได้) = 5 คะแนน
// ประเภทวิชา: ตามรหัสวิชา กศน. (หลักที่ 4: 1 = บังคับ, 2/3 = เลือก) เช่น ทช31001 = บังคับ, พว32023 = เลือก
// ครูกำหนดเองได้ในหน้าแก้ไขบทเรียน (course.type = "core" | "elective")
export const TYPE_LABEL = { core: "วิชาบังคับ", elective: "วิชาเลือก" };
export function courseType(code, override) {
  if (override === "core" || override === "elective") return override;
  const m = String(code || "").trim().match(/^\D{2}\d(\d)/);
  return m && m[1] !== "1" ? "elective" : "core";
}
export const DEFAULT_FINAL_FULL = 40;
// ช่วงเวลาสอบปลายภาค (admin กำหนด): ตั้งเฉพาะวิชา (course.final.openAt/closeAt) หรือทั้งภาคเรียน (settings.finalWindows[semId])
export const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const pad2 = n => String(n).padStart(2, "0");
export function fmtThaiDT(v, short = false) {
  const d = v ? new Date(v) : null; if (!d || isNaN(d)) return "";
  return `${d.getDate()} ${(short ? TH_MONTHS_SHORT : TH_MONTHS)[d.getMonth()]} ${d.getFullYear() + 543} ${short ? "" : "เวลา "}${pad2(d.getHours())}:${pad2(d.getMinutes())} น.`;
}
export function finalWindow(course, settings) {
  const f = course?.final || {};
  if (f.openAt && f.closeAt) return { openAt: new Date(f.openAt), closeAt: new Date(f.closeAt), own: true };
  const w = settings?.finalWindows?.[String(course?.sem || "").replace("/", "-")];
  if (w?.openAt && w?.closeAt) return { openAt: new Date(w.openAt), closeAt: new Date(w.closeAt), own: false };
  return null;
}
// "none" = ยังไม่กำหนด · "before" = ยังไม่ถึงเวลา · "open" = เปิดสอบ · "after" = ปิดแล้ว
export function finalStatus(course, settings, now = Date.now()) {
  const w = finalWindow(course, settings);
  if (!w) return "none";
  return now < w.openAt.getTime() ? "before" : now > w.closeAt.getTime() ? "after" : "open";
}
export const finalFullOf = course => Number(course?.final?.full) > 0 ? Number(course.final.full) : (CONFIG.finalFull || DEFAULT_FINAL_FULL);
// วิชาเลือกที่ครูสร้างข้อสอบปลายภาคไว้
export const hasFinalExam = course => !!course && courseType(course.code, course.type) === "elective" && (course.final?.questions || []).length > 0;

// คะแนนกลางภาคแต่ละส่วน ครูกำหนดเองได้ทีละวิชา (ค่าเริ่มต้น วิดีโอ 5 + แบบทดสอบ 5)
// ส่วนที่ไม่มีคำถาม (เช่น วิชาที่ไม่มีวิดีโอ) ไม่นับคะแนน
const partFull = (v, d) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? d : Math.max(0, Number(v)));
export function midFulls(course) {
  const vq = (course?.video?.questions || []).length, qq = (course?.quiz?.questions || []).length;
  const vFull = vq ? partFull(course?.video?.full, CONFIG.videoFull) : 0;
  const qFull = qq ? partFull(course?.quiz?.full, CONFIG.quizFull) : 0;
  return { vFull, qFull, midFull: vFull + qFull };
}

export function computeScore(course, key, result) {
  const vq = course?.video?.questions || [], qq = course?.quiz?.questions || [];
  const r = result || {};
  const vc = vq.filter(q => r.video && r.video[q.id] !== undefined && r.video[q.id] === key?.video?.[q.id]).length;
  const qc = qq.filter(q => r.quiz && r.quiz[q.id] !== undefined && r.quiz[q.id] === key?.quiz?.[q.id]).length;
  const { vFull, qFull, midFull } = midFulls(course);
  const video = vq.length ? (vc / vq.length) * vFull : 0;
  const quiz = qq.length ? (qc / qq.length) * qFull : 0;
  const total = video + quiz;
  // ปลายภาค (วิชาเลือก)
  const fq = hasFinalExam(course) ? course.final.questions : [];
  const fc = fq.filter(q => r.fin && r.fin[q.id] !== undefined && r.fin[q.id] === key?.final?.[q.id]).length;
  const ffull = finalFullOf(course);
  const fin = fq.length ? (fc / fq.length) * ffull : 0;
  return {
    video: Math.round(video * 100) / 100, quiz: Math.round(quiz * 100) / 100,
    total: Math.round(total * 100) / 100, itw: Math.round(total + 1e-9),
    vFull, qFull, midFull,
    videoCorrect: vc, videoCount: vq.length, quizCorrect: qc, quizCount: qq.length,
    attempted: !!(r.quizAt || (r.video && Object.keys(r.video).length)),
    hasFinal: fq.length > 0, finalDone: !!r.finAt, finalFull: ffull,
    final: Math.round(fin * 100) / 100, finalItw: Math.round(fin + 1e-9), finalCorrect: fc, finalCount: fq.length,
  };
}

let toastTimer;
export function toast(msg, type = "") {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.className = "toast show " + type; t.textContent = msg;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

export function confirmBox(message, okText = "ตกลง") {
  return new Promise(res => {
    const d = document.createElement("div");
    d.className = "modal-back";
    d.innerHTML = `<div class="modal small"><p>${esc(message)}</p><div class="row end"><button class="btn ghost" data-v="0">ยกเลิก</button><button class="btn primary" data-v="1">${esc(okText)}</button></div></div>`;
    d.addEventListener("click", e => { const v = e.target.dataset?.v; if (v !== undefined) { d.remove(); res(v === "1"); } });
    document.body.appendChild(d);
  });
}

export function download(name, data, type = "application/octet-stream") {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function toCSV(rows) {
  return "﻿" + rows.map(r => r.map(v => {
    const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\r\n");
}

export function demoBanner(isDemo, { page = "", onReset } = {}) {
  if (!isDemo) return;
  const b = document.createElement("div");
  b.className = "demo-banner";
  b.innerHTML = `<span><b>โหมดทดลอง</b> — ข้อมูลนักศึกษาเป็นข้อมูลสมมติ เก็บในเบราว์เซอร์นี้เท่านั้น</span>
    <span class="demo-links"><a href="index.html" class="${page === "student" ? "on" : ""}">หน้านักศึกษา</a><a href="admin.html" class="${page === "admin" ? "on" : ""}">หน้าครู (ผู้ดูแล)</a>${onReset ? `<button type="button" id="demoReset">เริ่มใหม่</button>` : ""}</span>`;
  document.body.prepend(b);
  if (onReset) b.querySelector("#demoReset").onclick = async () => { if (await confirmBox("ล้างข้อมูลทดลองทั้งหมด แล้วเริ่มใหม่ด้วยข้อมูลตัวอย่าง?", "เริ่มใหม่")) onReset(); };
}

// ที่เก็บข้อมูลในเบราว์เซอร์แบบปลอดภัย (ถ้าเบราว์เซอร์บล็อก จะเก็บในหน่วยความจำแทน)
const memStores = {};
export function safeStorage(kind = "local") {
  let s = null;
  try { s = kind === "local" ? window.localStorage : window.sessionStorage; s.setItem("__t", "1"); s.removeItem("__t"); } catch { s = null; }
  const mem = (memStores[kind] ||= new Map());
  return {
    get(k) { try { return s ? s.getItem(k) : (mem.has(k) ? mem.get(k) : null); } catch { return mem.has(k) ? mem.get(k) : null; } },
    set(k, v) { try { if (s) { s.setItem(k, v); return; } } catch (e) { if (e && e.name === "QuotaExceededError") throw e; } mem.set(k, v); },
    remove(k) { try { s && s.removeItem(k); } catch {} mem.delete(k); },
    keys() { let ks = []; try { if (s) for (let i = 0; i < s.length; i++) ks.push(s.key(i)); } catch {} return [...new Set([...ks, ...mem.keys()])]; },
  };
}

// กล่องข้อความแทน alert()
export function messageBox(title, lines = []) {
  return new Promise(res => {
    const d = document.createElement("div"); d.className = "modal-back";
    d.innerHTML = `<div class="modal small"><h3>${esc(title)}</h3>${lines.length ? `<ul class="small" style="padding-left:1.2em;margin:0 0 12px">${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}<div class="row end"><button class="btn primary">ตกลง</button></div></div>`;
    $("button", d).onclick = () => { d.remove(); res(); };
    document.body.appendChild(d); $("button", d).focus();
  });
}
// กล่องรับข้อความแทน prompt()
export function inputBox(label, placeholder = "https://") {
  return new Promise(res => {
    const d = document.createElement("div"); d.className = "modal-back";
    d.innerHTML = `<form class="modal small stack"><label class="f" for="ibx">${esc(label)}</label><input type="url" id="ibx" placeholder="${esc(placeholder)}" required>
      <div class="row end"><button type="button" class="btn ghost" data-x>ยกเลิก</button><button class="btn primary">ตกลง</button></div></form>`;
    $("[data-x]", d).onclick = () => { d.remove(); res(null); };
    $("form", d).onsubmit = e => { e.preventDefault(); const v = $("#ibx", d).value.trim(); d.remove(); res(v || null); };
    document.body.appendChild(d); $("#ibx", d).focus();
  });
}

// ---------- หลายภาคเรียน ----------
export const semId = sem => String(sem || "").replace("/", "-");
export function semShort(sem) {
  const [yy, t] = String(sem || "").split("/");
  if (!yy) return "";
  return t === "3" ? `ภาคเรียนฤดูร้อน/${2500 + Number(yy)}` : `ภาคเรียนที่ ${t}/${2500 + Number(yy)}`;
}
export function semCompare(a, b) {
  const [ya, ta] = String(a).split(/[\/-]/).map(Number), [yb, tb] = String(b).split(/[\/-]/).map(Number);
  return ya - yb || ta - tb;
}
// คืนค่าภาคเรียนของนักศึกษา {semId: {sem, level, grp, grpName, courses, subj}} (รองรับข้อมูลรูปแบบเดิม)
export function loginTerms(doc) {
  if (!doc) return {};
  if (doc.terms) return doc.terms;
  if (doc.sem) return { [semId(doc.sem)]: { sem: doc.sem, level: doc.level, grp: doc.grp, grpName: doc.grpName, courses: doc.courses || [], subj: doc.subj || {} } };
  return {};
}

// ---------- บัญชีครู: ชื่อผู้ใช้ = ชื่อ-สกุล, รหัสผ่าน = เบอร์โทร ----------
export const TEACHER_DOMAIN = "teacher.itw51.local";
export const PREFIXES = ["ว่าที่ร้อยตรีหญิง", "ว่าที่ร้อยตรี", "ว่าที่ ร.ต.หญิง", "ว่าที่ ร.ต.", "ว่าที่ร.ต.", "นางสาว", "น.ส.", "นาง", "นาย", "ดร.", "อาจารย์", "อ.", "ครู"];
export function normName(name) {
  let s = String(name || "").trim().replace(/\s+/g, " ");
  for (let changed = true; changed;) {
    changed = false;
    for (const p of PREFIXES) if (s.startsWith(p)) { s = s.slice(p.length).trim(); changed = true; }
  }
  return s.replace(/[\s.]/g, "").toLowerCase();
}
export const normPhone = p => String(p || "").replace(/\D/g, "");
export async function teacherKey(name) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${CONFIG.keySalt}|T|${normName(name)}`));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export function maskEmail(e) {
  const [u, d] = String(e || "").split("@");
  if (!d) return "";
  return (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "*".repeat(Math.min(6, u.length - 2))) + "@" + d;
}
export const isRealEmail = e => !!e && !String(e).endsWith("@" + TEACHER_DOMAIN);

// ความคล้ายของชื่อ 0..1 (ใช้จับคู่ชื่อที่สะกดต่างกันเล็กน้อยระหว่างไฟล์รายชื่อกับ ITW51)
export function nameSimilarity(a, b) {
  a = normName(a); b = normName(b);
  if (!a || !b) return 0;
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
// ตัดคำนำหน้าที่ซ้ำกับคอลัมน์คำนำหน้า เช่น "นาย" + "นายธวัชชัย" → "นายธวัชชัย"
export function joinThaiName(prefix, first, last) {
  prefix = String(prefix || "").trim(); first = String(first || "").trim(); last = String(last || "").trim();
  if (prefix && PREFIXES.some(p => first.startsWith(p))) prefix = "";
  return `${prefix}${first} ${last}`.trim().replace(/\s+/g, " ");
}

// ---------- ครูเข้าระบบด้วย "ชื่อ" อย่างเดียว (ไม่ต้องมีนามสกุล) ----------
export function firstName(name) {
  let s = String(name || "").trim().replace(/\s+/g, " ");
  for (let changed = true; changed;) {
    changed = false;
    for (const p of PREFIXES) if (s.startsWith(p)) { s = s.slice(p.length).trim(); changed = true; }
  }
  return s.split(" ")[0] || "";
}
export async function teacherFirstKey(name) {
  const f = firstName(name).replace(/\./g, "").toLowerCase();
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${CONFIG.keySalt}|TF|${f}`));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
