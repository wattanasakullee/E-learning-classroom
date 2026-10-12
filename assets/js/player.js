// ตัวเล่นวิดีโอ รองรับ YouTube และไฟล์วิดีโอ (ลิงก์ .mp4/.webm)
export function youtubeId(url) {
  const s = String(url || "").trim();
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/);
  if (m) return m[1];
  return /^[\w-]{11}$/.test(s) ? s : null;
}

let ytReady;
function loadYT() {
  if (ytReady) return ytReady;
  ytReady = new Promise((res, rej) => {
    if (window.YT && window.YT.Player) return res(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); res(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => rej(new Error("โหลด YouTube ไม่สำเร็จ"));
    document.head.appendChild(s);
    setTimeout(() => rej(new Error("โหลด YouTube ไม่สำเร็จ (หมดเวลา)")), 20000);
  });
  return ytReady;
}

export async function createPlayer(container, url) {
  container.innerHTML = "";
  const id = youtubeId(url);
  const endedCbs = [];
  if (id) {
    const YT = await loadYT();
    const host = document.createElement("div");
    container.appendChild(host);
    const p = await new Promise((res, rej) => {
      const pl = new YT.Player(host, {
        videoId: id, width: "100%", height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1, fs: 0 },
        events: {
          onReady: () => res(pl),
          onError: e => rej(new Error("เล่นวิดีโอ YouTube ไม่ได้ (รหัส " + e.data + ")")),
          onStateChange: e => { if (e.data === 0) endedCbs.forEach(f => f()); },
        },
      });
    });
    return {
      kind: "youtube",
      time: () => p.getCurrentTime() || 0,
      duration: () => p.getDuration() || 0,
      seek: t => p.seekTo(t, true),
      play: () => p.playVideo(),
      pause: () => p.pauseVideo(),
      playing: () => p.getPlayerState() === 1,
      onEnded: f => endedCbs.push(f),
      destroy: () => { try { p.destroy(); } catch {} },
    };
  }
  const v = document.createElement("video");
  v.src = url; v.controls = true; v.playsInline = true; v.preload = "metadata";
  v.setAttribute("controlsList", "nodownload noplaybackrate nofullscreen");
  container.appendChild(v);
  v.addEventListener("ended", () => endedCbs.forEach(f => f()));
  return {
    kind: "file",
    time: () => v.currentTime || 0,
    duration: () => v.duration || 0,
    seek: t => { v.currentTime = t; },
    play: () => v.play().catch(() => {}),
    pause: () => v.pause(),
    playing: () => !v.paused && !v.ended,
    onEnded: f => endedCbs.push(f),
    destroy: () => { v.pause(); v.removeAttribute("src"); v.load(); },
  };
}

// ควบคุมการหยุดถามคำถามตามเวลาที่ครูตั้ง และกันการข้ามวิดีโอ
export function runInteractive(player, questions, answered, ask, { onAllDone } = {}) {
  const qs = [...questions].sort((a, b) => a.t - b.t);
  const done = new Set(answered);
  let maxSeen = Math.max(0, ...qs.filter(q => done.has(q.id)).map(q => q.t));
  let busy = false, stopped = false;
  const tick = async () => {
    if (stopped || busy) return;
    const t = player.time();
    const next = qs.find(q => !done.has(q.id));
    // กันการกรอข้ามไปข้างหน้าเกินจุดที่ดูมาแล้ว (เผื่อ 3 วินาที)
    if (next && t > maxSeen + 3) { player.seek(maxSeen); return; }
    if (t > maxSeen) maxSeen = t;
    if (next && t >= next.t - 0.05) {
      busy = true; player.pause();
      if (t > next.t + 1) player.seek(next.t);
      try { await ask(next); done.add(next.id); maxSeen = Math.max(maxSeen, next.t); }
      finally { busy = false; }
      if (!stopped) player.play();
      if (qs.every(q => done.has(q.id)) && onAllDone) onAllDone();
    }
  };
  const h = setInterval(tick, 250);
  return { stop() { stopped = true; clearInterval(h); }, answeredCount: () => done.size };
}
