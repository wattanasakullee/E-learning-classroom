// ผลการเรียน เกรดเฉลี่ย ชั่วโมง กพช. คุณธรรม และคุณสมบัติการจบ (จากข้อมูล ITW51)
// profile: { gr: ["ภาค|รหัสวิชา|เกรด|คะแนนรวม"], act: ["ภาค|ชั่วโมง|ชื่อกิจกรรม"], vir: ["ภาค|ระดับ"] }
// subjects: { รหัสวิชา: "ชื่อวิชา|หน่วยกิต|core/elective" } · rule: { req, elec, act, tim }
import { courseType } from "./common.js";

export const VIRTUE = ["ไม่ผ่าน", "พอใช้", "ดี", "ดีมาก"];
export const semKey = s => { const [y, t] = String(s).split("/").map(Number); return (y || 0) * 10 + (t || 0); };

// ความหมายของเกรดใน ITW51
export function gradeInfo(g) {
  g = String(g ?? "").trim();
  if (!g) return { kind: "pending", label: "รอผล" };
  if (g === "ผ") return { kind: "pass", label: "ผ่าน" };
  if (g === "ข") return { kind: "absent", label: "ขาดสอบ" };
  if (g === "ม") return { kind: "noright", label: "ไม่มีสิทธิ์สอบ" };
  const n = Number(g);
  if (Number.isFinite(n)) return { kind: n >= 1 ? "pass" : "fail", num: n, label: n.toFixed(1) };
  return { kind: "other", label: g };
}
const rank = i => i.kind === "pass" ? (i.num ?? 0.5) + 10 : i.kind === "fail" ? 5 : i.kind === "pending" ? 1 : 2;

export function subjectOf(subjects, code) {
  const [name = "", credit = "", type = ""] = String(subjects?.[code] || "").split("|");
  return { name: name || code, credit: Number(credit) || 0, type: type || courseType(code) };
}

export function transcript(profile, subjects, rule) {
  const rows = (profile?.gr || []).map(x => { const [s, c, g, t] = String(x).split("|"); return { s, c, g, t: t === "" ? null : Number(t), info: gradeInfo(g) }; })
    .sort((a, b) => semKey(a.s) - semKey(b.s) || a.c.localeCompare(b.c));
  // ผลดีที่สุดของแต่ละวิชา (กรณีลงเรียนซ้ำ)
  const best = {};
  for (const r of rows) if (!best[r.c] || rank(r.info) > rank(best[r.c].info)) best[r.c] = r;
  let core = 0, elec = 0, gpaPts = 0, gpaCr = 0, pendCr = 0;
  for (const [code, r] of Object.entries(best)) {
    const sb = subjectOf(subjects, code);
    if (r.info.kind === "pass") { if (sb.type === "elective") elec += sb.credit; else core += sb.credit; }
    if (r.info.num !== undefined && sb.credit) { gpaPts += r.info.num * sb.credit; gpaCr += sb.credit; }
    if (r.info.kind === "pending") pendCr += sb.credit;
  }
  const gradedSems = new Set(rows.filter(r => r.info.kind !== "pending").map(r => r.s));
  const acts = (profile?.act || []).map(x => { const [s, h, ...n] = String(x).split("|"); return { s, h: Number(h) || 0, name: n.join("|") }; })
    .sort((a, b) => semKey(a.s) - semKey(b.s));
  const kph = acts.reduce((a, x) => a + x.h, 0);
  const virs = (profile?.vir || []).map(x => { const [s, l] = String(x).split("|"); return { s, l: Number(l) }; }).sort((a, b) => semKey(a.s) - semKey(b.s));
  const vir = virs.length ? virs[virs.length - 1].l : null;
  const R = { req: Number(rule?.req) || 0, elec: Number(rule?.elec) || 0, act: Number(rule?.act) || 200, tim: Number(rule?.tim) || 4 };
  const checks = [
    { key: "core", label: "หน่วยกิตวิชาบังคับ", have: core, need: R.req, unit: "หน่วยกิต" },
    { key: "elec", label: "หน่วยกิตวิชาเลือก", have: elec, need: R.elec, unit: "หน่วยกิต" },
    { key: "kph", label: "ชั่วโมง กพช.", have: kph, need: R.act, unit: "ชั่วโมง" },
    { key: "vir", label: "ผลการประเมินคุณธรรม", have: vir, need: 1, text: vir === null ? "ยังไม่มีผลประเมิน" : VIRTUE[vir] || String(vir), needText: "พอใช้ขึ้นไป" },
    { key: "tim", label: "จำนวนภาคเรียนที่เรียน", have: gradedSems.size, need: R.tim, unit: "ภาคเรียน" },
  ].map(c => ({ ...c, ok: c.have !== null && c.have >= c.need }));
  return {
    rows, best, core, elec, pendCr, kph, acts, virs, vir, rule: R, checks,
    gpa: gpaCr ? Math.floor(gpaPts / gpaCr * 100) / 100 : null,
    sems: [...new Set(rows.map(r => r.s))].sort((a, b) => semKey(b) - semKey(a)),
    ok: checks.every(c => c.ok), miss: checks.filter(c => !c.ok).length,
  };
}

// สรุปสั้นสำหรับตารางรายชื่อ
export const summaryOf = t => ({ cr: t.core, el: t.elec, gpa: t.gpa, kph: t.kph, vir: t.vir, ok: t.ok, miss: t.miss, pend: t.pendCr });

// เกรดเฉลี่ยรายภาคเรียน
export function semGpa(rows, subjects, sem) {
  let p = 0, c = 0;
  for (const r of rows) if (r.s === sem && r.info.num !== undefined) { const cr = subjectOf(subjects, r.c).credit; p += r.info.num * cr; c += cr; }
  return c ? Math.floor(p / c * 100) / 100 : null;
}
