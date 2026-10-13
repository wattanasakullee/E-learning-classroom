import { CONFIG } from "./config.js";
import { getStore, isDemo } from "./store.js";
import { $, $$, esc, loginKey, semLabel, semShort, semId, semCompare, loginTerms, resultId, fmtTime, fmtNum, toast, confirmBox, LEVELS, demoBanner, safeStorage } from "./common.js";
import { createPlayer, runInteractive } from "./player.js";

const ICON_CAP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-4.5L21 9l-9 4.5z"/><path d="M7 11v4.5c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5V11"/><path d="M21 9v5"/></svg>`;
const SKEY = "itw51:session";
const app = $("#app");
const LS = safeStorage("local"), SS = safeStorage("session");
let store, login, settings, activePlayer, activeRun, activeTimer;
const stopTimer = () => { if (activeTimer) { clearInterval(activeTimer); activeTimer = null; } };

function getSession() {
  try { return JSON.parse(LS.get(SKEY) || SS.get(SKEY) || "null"); } catch { return null; }
}
function setSession(s, remember) {
  LS.remove(SKEY); SS.remove(SKEY);
  if (s) (remember ? LS : SS).set(SKEY, JSON.stringify(s));
}

function topbar(user) {
  return `<header class="topbar"><div class="in">
    <div class="logo">${ICON_CAP}</div>
    <div><div class="brand-name">${esc(CONFIG.schoolName)}</div><div class="brand-sub">${esc(CONFIG.schoolSub)}</div></div>
    <div class="spacer"></div>
    ${user ? `<div class="user"><div>${esc(user.name)}</div><div style="opacity:.7">${esc(user.sid)}</div></div>
      <button class="btn ghost sm" id="logout">ออก</button>` : ""}
  </div></header>`;
}

// ------------------------------------------------------------------ login
function renderLogin(msg = "") {
  stopVideo();
  app.innerHTML = `<div class="login-page">${topbar()}
  <div class="login-shell"><div class="login-card">
    <div class="login-hero">
      <div class="big-logo">${ICON_CAP}</div>
      <h1>เข้าสู่ห้องเรียนออนไลน์</h1>
    </div>
    <form class="card stack" id="loginForm" autocomplete="on">
      <div>
        <label class="f" for="sid">ชื่อผู้ใช้ (รหัสนักศึกษา)</label>
        <input type="text" id="sid" inputmode="numeric" autocomplete="username" placeholder="เช่น 6813000186" required>
      </div>
      <div>
        <label class="f" for="pw">รหัสผ่าน (เลขบัตรประชาชน / เลข G)</label>
        <div class="pw-wrap"><input type="password" id="pw" autocomplete="current-password" placeholder="13 หลัก ไม่ต้องมีขีด" required>
        <button type="button" id="togglePw">แสดง</button></div>
        <div class="hint">นักศึกษาที่ไม่มีเลขบัตรประชาชน ใช้เลข G ตามที่ลงทะเบียนไว้</div>
      </div>
      <label class="row small"><input type="checkbox" id="remember" checked> จดจำการเข้าระบบในเครื่องนี้</label>
      <div class="err" id="err">${esc(msg)}</div>
      <button class="btn primary block" id="go">เข้าสู่ระบบ</button>
    </form>
    ${isDemo && settings?.demo ? `<div class="card stack demo-acc" style="margin-top:14px">
      <div class="small"><b>บัญชีทดลอง</b> (นักศึกษาสมมติ) — แตะเพื่อกรอกให้อัตโนมัติ</div>
      <button type="button" class="btn sm block" data-u="6913999001" data-p="1100000000001">นายสมชาย ใจดี · ยังไม่เริ่มเรียน</button>
      <button type="button" class="btn sm block" data-u="6913999005" data-p="G100000000005">Mr. Aung Kyaw · ใช้เลข G</button>
      <button type="button" class="btn sm block" data-u="6913999002" data-p="1100000000002">นางสาวมาลี ศรีสุข · เรียนครบ ประกาศคะแนนแล้ว</button>
    </div>` : ""}
    <p class="small muted" style="text-align:center;margin-top:14px">เข้าไม่ได้? ติดต่อครูประจำกลุ่ม</p>
  </div></div></div>`;
  $$(".demo-acc [data-u]").forEach(b => b.onclick = () => { $("#sid").value = b.dataset.u; $("#pw").value = b.dataset.p; $("#go").focus(); });
  $("#togglePw").onclick = e => { const i = $("#pw"); i.type = i.type === "password" ? "text" : "password"; e.target.textContent = i.type === "password" ? "แสดง" : "ซ่อน"; };
  $("#loginForm").onsubmit = async e => {
    e.preventDefault();
    const btn = $("#go"); btn.disabled = true; btn.innerHTML = `<span class="spin"></span> กำลังตรวจสอบ`;
    try {
      const sid = $("#sid").value.trim(), pw = $("#pw").value.trim();
      const key = await loginKey(sid, pw);
      const doc = await store.get("logins/" + key);
      if (!doc) { $("#err").textContent = "รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง"; return; }
      setSession({ key }, $("#remember").checked);
      login = { key, ...doc };
      location.hash = "#/"; route();
    } catch (err) {
      console.error(err); $("#err").textContent = "เชื่อมต่อระบบไม่ได้: " + err.message;
    } finally { btn.disabled = false; btn.textContent = "เข้าสู่ระบบ"; }
  };
}

// ------------------------------------------------------------------ classroom
// ภาคเรียนที่นักศึกษาคนนี้มีข้อมูล (เฉพาะภาคเรียนที่ผู้ดูแลเปิดไว้ในระบบ)
function myTerms() {
  const terms = loginTerms(login);
  const open = settings?.semesters ? new Set(settings.semesters.map(semId)) : null;
  return Object.keys(terms).filter(id => !open || open.has(id)).sort(semCompare).map(id => ({ id, ...terms[id] }));
}
function pickTerm(list, wanted) {
  if (!list.length) return null;
  const want = wanted || SS.get("itw51:term") || semId(settings?.current || settings?.semester);
  return list.find(t => t.id === want) || list[list.length - 1];
}

async function renderClassroom(wanted) {
  stopVideo();
  try { settings = (await store.get("settings/app")) || settings; } catch {}
  const list = myTerms();
  const term = pickTerm(list, wanted);
  if (term) SS.set("itw51:term", term.id);
  app.innerHTML = `${topbar(login)}<main class="wrap">
    <div class="term-head"><div>
      <h1>ห้องเรียนของฉัน</h1>
      ${term ? `<div class="muted small">${esc(LEVELS[term.level] || "")} · กลุ่ม ${esc(term.grp)}${term.grpName ? " " + esc(term.grpName) : ""}</div>` : ""}
    </div></div>
    ${list.length ? `<nav class="term-tabs" aria-label="เลือกภาคเรียน">${list.map(t => `<a href="#/s/${t.id}" class="${t.id === term.id ? "on" : ""}">${esc(semShort(t.sem))}</a>`).join("")}</nav>` : ""}
    <div class="course-grid" id="grid"><div class="loading"><span class="spin"></span></div></div>
  </main>`;
  bindLogout();
  if (!term) { $("#grid").outerHTML = `<div class="notice warn">ยังไม่มีข้อมูลการลงทะเบียนของคุณในระบบ กรุณาติดต่อครู</div>`; return; }
  const ids = term.courses || [];
  const [courses, results] = await Promise.all([
    Promise.all(ids.map(id => store.get("courses/" + id).catch(() => null))),
    Promise.all(ids.map(id => store.get("results/" + resultId(login.key, id)).catch(() => null))),
  ]);
  $("#grid").innerHTML = ids.map((id, i) => {
    const s = term.subj?.[id] || {}, c = courses[i], r = results[i] || {};
    const ready = c && c.published;
    const vq = c?.video?.questions?.length || 0;
    const vDone = vq ? Object.keys(r.video || {}).filter(k => c.video.questions.some(q => q.id === k)).length : 0;
    let chips = "";
    if (!ready) chips = `<span class="chip">ครูยังไม่เปิดบทเรียน</span>`;
    else {
      if (c.video?.url) chips += `<span class="chip ${vq && vDone >= vq ? "ok" : ""}">วิดีโอ ${vq ? vDone + "/" + vq : ""}</span>`;
      if (c.article?.html) chips += `<span class="chip ${r.articleAt ? "ok" : ""}">ใบความรู้${r.articleAt ? " ✓" : ""}</span>`;
      if (c.quiz?.questions?.length) chips += `<span class="chip ${r.quizAt ? "ok" : ""}">แบบทดสอบ${r.quizAt ? " ✓" : ""}</span>`;
    }
    return `<a class="course-card ${ready ? "" : "empty"}" href="#/c/${encodeURIComponent(id)}">
      ${(() => { const sc = c ? myScore(c, r) : null; return sc && sc.complete ? `<span class="score-pill">${fmtNum(sc.total)}/10</span>` : ""; })()}
      <div class="code">${esc(s.code)}${s.credit ? " · " + esc(s.credit) + " หน่วยกิต" : ""}</div>
      <div class="name">${esc(s.name || s.code)}</div>
      <div class="meta">${chips}</div></a>`;
  }).join("") || `<div class="notice">ไม่พบรายวิชาที่ลงทะเบียนในภาคเรียนนี้</div>`;
}

// ------------------------------------------------------------------ course
async function renderCourse(cid, tab) {
  stopVideo();
  const term = myTerms().find(t => (t.courses || []).includes(cid));
  if (!term) { location.hash = "#/"; return; }
  const s = term.subj?.[cid] || {};
  app.innerHTML = `${topbar(login)}<main class="wrap narrow">
    <div class="crumb"><a href="#/s/${term.id}">← ห้องเรียนของฉัน · ${esc(semShort(term.sem))}</a></div>
    <div class="muted small">${esc(s.code)} · ${esc(semLabel(term.sem))}</div>
    <h1>${esc(s.name || s.code)}</h1>
    <div id="body"><div class="loading"><span class="spin"></span></div></div></main>`;
  bindLogout();
  const rid = resultId(login.key, cid);
  const [course, res0] = await Promise.all([store.get("courses/" + cid), store.get("results/" + rid)]);
  let res = res0 || {};
  if (!course || !course.published) {
    $("#body").innerHTML = `<div class="card"><p>ครูยังไม่ได้เปิดบทเรียนของรายวิชานี้ กรุณากลับมาใหม่ภายหลัง</p></div>`;
    return;
  }
  const base = { sid: login.sid, courseId: cid, sem: term.sem };
  const save = async patch => {
    await store.set("results/" + rid, { ...base, ...patch, updatedAt: store.serverTime() }, true);
    res = (await store.get("results/" + rid)) || res;
  };
  const vqs = course.video?.questions || [];
  const hasVideo = !!course.video?.url, hasArticle = !!course.article?.html, hasQuiz = (course.quiz?.questions || []).length > 0;
  const vAnswered = () => vqs.filter(q => res.video && res.video[q.id] !== undefined).length;
  const status = () => ({
    video: !hasVideo || (vqs.length ? vAnswered() >= vqs.length : !!res.videoDone),
    article: !hasArticle || !!res.articleAt,
    quiz: !hasQuiz || !!res.quizAt,
  });
  const quizLocked = () => hasArticle && !res.articleAt;
  // ตรวจคะแนนทันที: วิดีโอเมื่อตอบครบ, แบบทดสอบเมื่อส่งแล้ว
  const ensureCounts = async () => {
    try {
      if (hasVideo && vqs.length && vAnswered() >= vqs.length && res.vc === undefined)
        res.vc = await store.probeCount("results/" + rid, base, "vc", vqs.length);
      if (hasQuiz && res.quizAt && res.qc === undefined)
        res.qc = await store.probeCount("results/" + rid, base, "qc", course.quiz.questions.length);
    } catch (e) { console.error(e); }
  };
  await ensureCounts();
  const scoreCard = () => {
    const sc = myScore(course, res);
    const row = (label, val, full, detail) => `<div class="sc-row"><span>${label}</span><span class="muted small">${detail}</span><b>${val}</b><span class="muted">/ ${full}</span></div>`;
    return `<div class="card score-card">
      <div class="sc-head"><div><div class="small muted">ผลคะแนนออนไลน์ของคุณ</div><div class="sc-total">${fmtNum(sc.total)}<span> / 10</span></div></div>
        <div class="sc-itw"><div class="small muted">คะแนนที่ส่งเข้า ITW51</div><b>${sc.itw}</b></div></div>
      ${row("วิดีโอ", hasVideo && sc.nV ? (sc.videoReady === false ? "—" : fmtNum(sc.video)) : "—", CONFIG.videoFull,
        !hasVideo || !sc.nV ? "วิชานี้ไม่มีคำถามวิดีโอ" : sc.vc !== undefined ? `ตอบถูก ${sc.vc} จาก ${sc.nV} ข้อ` : `ตอบแล้ว ${vAnswered()}/${sc.nV} ข้อ — ดูวิดีโอให้ครบเพื่อรับคะแนน`)}
      ${row("แบบทดสอบ", sc.qc !== undefined ? fmtNum(sc.quiz) : "—", CONFIG.quizFull, sc.qc !== undefined ? `ตอบถูก ${sc.qc} จาก ${sc.nQ} ข้อ` : "")}
    </div>`;
  };
  tab = tab || (status().video ? (status().article ? "quiz" : "article") : "video");
  if (!hasVideo && tab === "video") tab = "article";

  const draw = () => {
    const st = status();
    const exists = { video: hasVideo, article: hasArticle, quiz: hasQuiz };
    const stepBtn = (k, n, t, sub, locked) => `<button class="step ${exists[k] && st[k] ? "done" : ""} ${tab === k ? "active" : ""} ${locked || !exists[k] ? "locked" : ""}" data-tab="${k}">
      <span class="n">${!exists[k] ? "–" : st[k] ? "✓" : n}</span><span><span class="t">${t}</span><br><span class="s">${sub}</span></span></button>`;
    $("#body").innerHTML = `

      <div class="steps">
        ${stepBtn("video", 1, "วิดีโอ", hasVideo ? `ตอบคำถาม ${vAnswered()}/${vqs.length}` : "ไม่มี")}
        ${stepBtn("article", 2, "ใบความรู้", hasArticle ? (res.articleAt ? "อ่านแล้ว" : "ยังไม่อ่าน") : "ไม่มี")}
        ${stepBtn("quiz", 3, "แบบทดสอบ", hasQuiz ? (res.quizAt ? "ส่งแล้ว" : quizLocked() ? "อ่านใบความรู้ก่อน" : "พร้อมทำ") : "ไม่มี", quizLocked())}
      </div>
      <div id="pane"></div>`;
    $$(".step").forEach(b => b.onclick = () => { const t = b.dataset.tab; if (t !== tab) { tab = t; history.replaceState(null, "", `#/c/${encodeURIComponent(cid)}/${t}`); stopVideo(); draw(); } });
    if (tab === "video") drawVideo(); else if (tab === "article") drawArticle(); else drawQuiz();
  };

  // ---------- video
  const drawVideo = async () => {
    const pane = $("#pane");
    if (!hasVideo) { pane.innerHTML = `<div class="card"><p class="muted">รายวิชานี้ไม่มีวิดีโอ</p></div>`; return; }
    pane.innerHTML = `<div class="card">
      <h2><span class="num-badge">1</span>${esc(course.video.title || "วิดีโอบทเรียน")}</h2>
      ${course.video.desc ? `<p class="muted">${esc(course.video.desc)}</p>` : ""}
      <p class="small muted">วิดีโอจะหยุดเพื่อให้ตอบคำถาม ${vqs.length} ข้อ ตอบแล้ววิดีโอจะเล่นต่อ (ตอบได้ครั้งเดียว) · ส่วนนี้คิดเป็น ${CONFIG.videoFull} คะแนน</p>
      <div class="video-box" id="vbox"><div id="vhost"></div></div>
      <div class="row between" style="margin-top:10px">
        <div class="vq-progress" id="vqp"></div>
        <button class="btn sm ghost" id="fsBtn">⛶ เต็มจอ</button>
      </div>
    </div>`;
    const drawDots = () => {
      $("#vqp").innerHTML = [...vqs].sort((a, b) => a.t - b.t).map((q, i) =>
        `<span class="vq-dot ${res.video?.[q.id] !== undefined ? "done" : ""}">ข้อ ${i + 1} · ${fmtTime(q.t)}</span>`).join("");
    };
    drawDots();
    const vbox = $("#vbox");
    // เต็มจอ: ขยายกล่องวิดีโอเต็มหน้าจอ (ใช้ได้ทุกเครื่อง รวม iPhone) + เต็มจอจริงและหมุนแนวนอน ถ้าเครื่องรองรับ
    const exitBtn = document.createElement("button");
    exitBtn.type = "button"; exitBtn.className = "fs-exit"; exitBtn.textContent = "✕ ออกจากเต็มจอ";
    vbox.appendChild(exitBtn);
    const isFs = () => vbox.classList.contains("pseudo-fs");
    const enterFs = async () => {
      vbox.classList.add("pseudo-fs"); document.body.classList.add("no-scroll");
      try { const req = vbox.requestFullscreen || vbox.webkitRequestFullscreen; if (req) await req.call(vbox); } catch {}
      try { await screen.orientation?.lock?.("landscape"); } catch {}
    };
    const exitFs = async () => {
      vbox.classList.remove("pseudo-fs"); document.body.classList.remove("no-scroll");
      try { screen.orientation?.unlock?.(); } catch {}
      try { if (document.fullscreenElement || document.webkitFullscreenElement) await (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch {}
    };
    $("#fsBtn").onclick = () => (isFs() ? exitFs() : enterFs());
    exitBtn.onclick = exitFs;
    const onFsChange = () => { if (!document.fullscreenElement && !document.webkitFullscreenElement && isFs() && fsWasReal) exitFs(); fsWasReal = !!(document.fullscreenElement || document.webkitFullscreenElement); };
    let fsWasReal = false;
    document.addEventListener("fullscreenchange", onFsChange); document.addEventListener("webkitfullscreenchange", onFsChange);
    try { activePlayer = await createPlayer($("#vhost"), course.video.url); }
    catch (e) { $("#vhost").innerHTML = `<div class="notice bad" style="margin:20px">${esc(e.message)}</div>`; return; }
    const ask = q => new Promise(resolve => {
      const ov = document.createElement("div");
      ov.className = "q-overlay";
      const idx = [...vqs].sort((a, b) => a.t - b.t).findIndex(x => x.id === q.id) + 1;
      ov.innerHTML = `<div class="q-panel">
        <div class="qtime">คำถามข้อ ${idx}/${vqs.length} · นาที ${fmtTime(q.t)}</div>
        <div class="qtext">${esc(q.text)}</div>
        <div class="choices">${q.choices.map((c, i) => `<label class="choice"><input type="radio" name="vq" value="${i}"><span>${esc(c)}</span></label>`).join("")}</div>
        <div class="row end" style="margin-top:12px"><button class="btn primary" id="vqok" disabled>ตอบและเล่นต่อ ▶</button></div></div>`;
      vbox.appendChild(ov);
      $$(".choice", ov).forEach(l => l.onclick = () => { $$(".choice", ov).forEach(x => x.classList.remove("sel")); l.classList.add("sel"); $("#vqok", ov).disabled = false; });
      $("#vqok", ov).onclick = async () => {
        const v = Number($("input[name=vq]:checked", ov).value);
        $("#vqok", ov).disabled = true;
        try {
          await save({ video: { [q.id]: v } });
          ov.remove(); drawDots(); updateSteps(); resolve();
          if (vAnswered() >= vqs.length) { await ensureCounts(); const sc = myScore(course, res); if (res.vc !== undefined) toast(`ตอบคำถามวิดีโอครบแล้ว ได้ ${fmtNum(sc.video)}/${CONFIG.videoFull} คะแนน (ถูก ${res.vc}/${vqs.length} ข้อ)`, "ok"); }
        } catch (e) { toast("บันทึกคำตอบไม่สำเร็จ ลองอีกครั้ง", "bad"); $("#vqok", ov).disabled = false; }
      };
    });
    const answered = vqs.filter(q => res.video?.[q.id] !== undefined).map(q => q.id);
    activeRun = runInteractive(activePlayer, vqs, answered, ask, {});
    activePlayer.onEnded(async () => {
      if (vAnswered() >= vqs.length && !res.videoDone) { await save({ videoDone: true }).catch(() => {}); updateSteps(); toast("ดูวิดีโอจบแล้ว ไปอ่านใบความรู้ต่อได้เลย", "ok"); }
    });
  };
  const updateSteps = () => {
    const st = status();
    const ex = { video: hasVideo, article: hasArticle, quiz: hasQuiz };
    $$(".step").forEach(b => { const k = b.dataset.tab; if (!ex[k]) return; b.classList.toggle("done", !!st[k]); b.querySelector(".n").textContent = st[k] ? "✓" : ({ video: 1, article: 2, quiz: 3 })[k]; });
    const vs = $('.step[data-tab="video"] .s'); if (vs && hasVideo) vs.textContent = `ตอบคำถาม ${vAnswered()}/${vqs.length}`;
  };

  // ---------- article
  const drawArticle = () => {
    const pane = $("#pane");
    if (!hasArticle) { pane.innerHTML = `<div class="card"><p class="muted">รายวิชานี้ไม่มีใบความรู้</p></div>`; return; }
    pane.innerHTML = `<div class="card">
      <h2><span class="num-badge">2</span>${esc(course.article.title || "ใบความรู้")}</h2>
      <div class="article">${course.article.html}</div>
      ${course.article.attach ? `<p><a class="btn" href="${esc(course.article.attach)}" target="_blank" rel="noopener">📄 เปิดเอกสารประกอบ</a></p>` : ""}
      <hr style="border:0;border-top:1px solid var(--line);margin:20px 0">
      <div class="row between"><span class="muted small">${res.articleAt ? "คุณอ่านใบความรู้นี้แล้ว" : "อ่านให้จบแล้วกดปุ่มเพื่อไปทำแบบทดสอบ"}</span>
      <button class="btn primary" id="readDone">${res.articleAt ? "ไปทำแบบทดสอบ →" : "อ่านจบแล้ว ไปทำแบบทดสอบ →"}</button></div>
    </div>`;
    $("#readDone").onclick = async () => {
      try { if (!res.articleAt) await save({ articleAt: store.serverTime() }); } catch { toast("บันทึกไม่สำเร็จ", "bad"); return; }
      tab = "quiz"; history.replaceState(null, "", `#/c/${encodeURIComponent(cid)}/quiz`); draw(); scrollTo(0, 0);
    };
  };

  // ---------- quiz
  const drawQuiz = () => {
    const pane = $("#pane");
    const qs = course.quiz?.questions || [];
    if (!hasQuiz) { pane.innerHTML = `<div class="card"><p class="muted">รายวิชานี้ไม่มีแบบทดสอบ</p></div>`; return; }
    if (quizLocked()) { pane.innerHTML = `<div class="card"><p>กรุณาอ่าน <b>ใบความรู้</b> ให้จบก่อน แล้วกดปุ่ม "อ่านจบแล้ว" เพื่อเปิดแบบทดสอบ</p><button class="btn primary" id="toArt">ไปที่ใบความรู้</button></div>`; $("#toArt").onclick = () => { tab = "article"; draw(); }; return; }
    if (res.quizAt) {
      pane.innerHTML = `<div class="notice ok-notice">✓ ส่งแบบทดสอบเรียบร้อยแล้ว เมื่อ ${new Date(res.quizAt).toLocaleString("th-TH")}</div>${scoreCard()}`;
      return;
    }
    const limitMin = Number(course.quiz?.timeLimit) || 0;
    // จับเวลา: ต้องกด "เริ่มทำแบบทดสอบ" ก่อน (บันทึกเวลาเริ่มไว้ในระบบ รีเฟรชแล้วเวลาไม่รีเซ็ต)
    if (limitMin && !res.quizStartAt) {
      pane.innerHTML = `<div class="card result-box">
        <h2 style="justify-content:center">${esc(course.quiz.title || "แบบทดสอบ")}</h2>
        <p>${qs.length} ข้อ · คิดเป็น ${CONFIG.quizFull} คะแนน · ส่งได้ครั้งเดียว</p>
        <div class="big" style="font-size:2.2rem">⏱ ${limitMin} นาที</div>
        <p class="muted small" style="margin-top:10px">เมื่อกดเริ่ม ระบบจะนับเวลาถอยหลัง และ<b>ส่งคำตอบอัตโนมัติเมื่อหมดเวลา</b><br>ถ้าทำเสร็จก่อน กดส่งเองได้ · ออกจากหน้านี้แล้วเวลายังเดินต่อ</p>
        <button class="btn primary" id="qstart" style="margin-top:8px">เริ่มทำแบบทดสอบ</button></div>`;
      $("#qstart").onclick = async () => {
        if (!(await confirmBox(`เริ่มทำแบบทดสอบ? มีเวลา ${limitMin} นาที`, "เริ่มเลย"))) return;
        $("#qstart").disabled = true;
        try { const t0 = Date.now(); await save({ quizStartAt: store.serverTime() }); SS.set("quizskew:" + rid, String(new Date(res.quizStartAt).getTime() - t0)); drawQuiz(); }
        catch (err) { console.error(err); toast("เริ่มไม่สำเร็จ ลองอีกครั้ง", "bad"); $("#qstart").disabled = false; }
      };
      return;
    }
    const draft = (() => { try { return JSON.parse(SS.get("quizdraft:" + rid) || "{}"); } catch { return {}; } })();
    pane.innerHTML = `<div class="card">
      ${limitMin ? `<div class="quiz-timer" id="qtimer" role="timer" aria-live="off"><span>⏱ เวลาที่เหลือ</span><b id="qtleft">--:--</b></div>` : ""}
      <h2><span class="num-badge">3</span>${esc(course.quiz.title || "แบบทดสอบ")}</h2>
      <p class="small muted">${qs.length} ข้อ · คิดเป็น ${CONFIG.quizFull} คะแนน · ส่งได้ครั้งเดียว${limitMin ? ` · เวลา ${limitMin} นาที ส่งอัตโนมัติเมื่อหมดเวลา` : ""}</p>
      <form id="qf">${qs.map((q, i) => `<div class="quiz-q"><div class="qn">${i + 1}. ${esc(q.text)}</div>
        <div class="choices">${q.choices.map((c, j) => `<label class="choice ${draft[q.id] === j ? "sel" : ""}"><input type="radio" name="${q.id}" value="${j}" ${draft[q.id] === j ? "checked" : ""}><span>${esc(c)}</span></label>`).join("")}</div></div>`).join("")}
      <div class="row between" style="margin-top:14px"><span class="muted small" id="qcount"></span><button class="btn primary" id="qsend">ส่งคำตอบ</button></div></form></div>`;
    const count = () => { const n = qs.filter(q => $(`input[name="${q.id}"]:checked`)).length; $("#qcount").textContent = `ตอบแล้ว ${n}/${qs.length} ข้อ`; return n; };
    count();
    const answers = () => { const d = {}; qs.forEach(q => { const c = $(`input[name="${q.id}"]:checked`); if (c) d[q.id] = Number(c.value); }); return d; };
    $$(".choice", pane).forEach(l => l.addEventListener("change", () => {
      $$(`.choice input[name="${l.querySelector("input").name}"]`).forEach(i => i.closest(".choice").classList.toggle("sel", i.checked));
      SS.set("quizdraft:" + rid, JSON.stringify(answers())); count();
    }));
    let sending = false;
    const submit = async (auto) => {
      if (sending || res.quizAt) return;
      sending = true; stopTimer();
      $("#qsend").disabled = true; $("#qsend").innerHTML = `<span class="spin"></span> กำลังตรวจคำตอบ`;
      $$("#qf input").forEach(i => i.disabled = true);
      try {
        await save({ quiz: answers(), quizAt: store.serverTime() }); SS.remove("quizdraft:" + rid);
        await ensureCounts(); toast(auto ? "หมดเวลา ระบบส่งคำตอบให้แล้ว" : "ส่งคำตอบเรียบร้อย", "ok"); draw(); scrollTo(0, 0);
      } catch (err) {
        console.error(err); sending = false;
        toast("ส่งไม่สำเร็จ: " + err.message + (auto ? " — ตรวจอินเทอร์เน็ตแล้วกดส่งอีกครั้ง" : ""), "bad");
        $("#qsend").disabled = false; $("#qsend").textContent = "ส่งคำตอบ"; $$("#qf input").forEach(i => i.disabled = false);
      }
    };
    $("#qf").onsubmit = async e => {
      e.preventDefault();
      const n = count();
      const ok = await confirmBox(n < qs.length ? `ยังตอบไม่ครบ (${n}/${qs.length} ข้อ) ต้องการส่งเลยหรือไม่? ส่งแล้วแก้ไขไม่ได้` : "ยืนยันการส่งคำตอบ? ส่งแล้วแก้ไขไม่ได้", "ส่งคำตอบ");
      if (ok) submit(false);
    };
    // นับเวลาถอยหลัง (อ้างอิงเวลาเริ่มที่บันทึกในระบบ)
    if (limitMin && res.quizStartAt) {
      const skew = Number(SS.get("quizskew:" + rid) || 0);
      const end = new Date(res.quizStartAt).getTime() + limitMin * 60000;
      const tick = () => {
        const left = Math.max(0, end - (Date.now() + skew));
        const m = Math.floor(left / 60000), sec = Math.floor((left % 60000) / 1000);
        const el = $("#qtleft"); if (!el) { stopTimer(); return; }
        el.textContent = `${m}:${String(sec).padStart(2, "0")}`;
        $("#qtimer").classList.toggle("warn", left <= 60000);
        if (left <= 0) { el.textContent = "หมดเวลา"; submit(true); }
      };
      tick(); activeTimer = setInterval(tick, 500);
    }
  };
  draw();
}

// คะแนนของนักศึกษา: วิดีโอ 5 + แบบทดสอบ 5 = 10 (ใช้คะแนนที่ครูประกาศ ถ้ามี)
function myScore(course, r) {
  r = r || {};
  const nV = course?.video?.url ? (course.video.questions || []).length : 0, nQ = (course?.quiz?.questions || []).length;
  if (r.score) return { ...r.score, nV, nQ, vc: r.vc, qc: r.score.quizCorrect ?? r.qc, complete: true };
  const video = nV && r.vc !== undefined ? (r.vc / nV) * CONFIG.videoFull : 0;
  const quiz = nQ && r.qc !== undefined ? (r.qc / nQ) * CONFIG.quizFull : 0;
  const total = video + quiz;
  return { video, quiz, total, itw: Math.round(total + 1e-9), nV, nQ, vc: r.vc, qc: r.qc,
    videoReady: !nV || r.vc !== undefined, quizReady: !nQ || r.qc !== undefined,
    complete: (!nV || r.vc !== undefined) && (!nQ || r.qc !== undefined) };
}

function stopVideo() {
  stopTimer();
  if (activeRun) { activeRun.stop(); activeRun = null; }
  if (activePlayer) { activePlayer.destroy(); activePlayer = null; }
}
function bindLogout() {
  const b = $("#logout");
  if (b) b.onclick = () => { setSession(null); login = null; location.hash = ""; renderLogin(); };
}

async function route() {
  if (!login) return renderLogin();
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const m = h.match(/^c\/([^/]+)(?:\/(video|article|quiz))?$/);
  if (m) return renderCourse(m[1], m[2]);
  const t = h.match(/^s\/(\d{2}-\d)$/);
  return renderClassroom(t ? t[1] : null);
}

(async function init() {
  try {
    store = await getStore();
    demoBanner(isDemo, { page: "student", onReset: async () => { await store.reset(); setSession(null); location.hash = ""; location.reload(); } });
    settings = await store.get("settings/app").catch(() => null);
  } catch (e) {
    app.innerHTML = `<div class="wrap"><div class="notice bad">เชื่อมต่อระบบไม่ได้: ${esc(e.message)}</div></div>`; return;
  }
  const s = getSession();
  if (s?.key) {
    const doc = await store.get("logins/" + s.key).catch(() => null);
    if (doc) login = { key: s.key, ...doc }; else setSession(null);
  }
  window.addEventListener("hashchange", route);
  route();
})();
