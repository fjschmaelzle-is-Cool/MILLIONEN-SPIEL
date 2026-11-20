// Overlays, Konfetti, Urkunden-Bilder, Teilen

import { esc, euro, vibrate, sleep, weekLabel } from "./util.js";
import { settings } from "./logic.js";
import { play, playVoice } from "./audio.js";
import { BADGES } from "./data.js";
import { modal, toast, opaSay } from "./ui.js";

// ---------- Konfetti & Funken ----------
function startConfetti(canvas, { gold = true, sparks = true, amount = 160 } = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
  resize();
  const colors = gold ? ["#ffd34d", "#f5c542", "#fff2b0", "#e0a400", "#ffffff"] : ["#ff5e5e", "#ffd34d", "#4be38f", "#6aa0ff", "#e07bff"];
  const parts = [];
  const add = (n) => {
    for (let i = 0; i < n; i++) parts.push({
      x: Math.random() * canvas.width, y: -20 * dpr - Math.random() * canvas.height * 0.5,
      vx: (Math.random() - 0.5) * 2 * dpr, vy: (2 + Math.random() * 3) * dpr,
      s: (5 + Math.random() * 7) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      c: colors[(Math.random() * colors.length) | 0], spark: false,
    });
  };
  add(amount);
  let run = true, frame = 0;
  const loop = () => {
    if (!run) return;
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (sparks && frame % 6 === 0) {
      const cx = Math.random() * canvas.width, cy = Math.random() * canvas.height * 0.6;
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, v = (1 + Math.random() * 4) * dpr;
        parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 2 * dpr, life: 40 + Math.random() * 20, c: "#fff2b0", spark: true });
      }
    }
    if (frame % 40 === 0 && parts.length < 400) add(20);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.spark) {
        p.vy += 0.05 * dpr; p.life--;
        ctx.globalAlpha = Math.max(0, p.life / 60);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill();
        if (p.life <= 0) parts.splice(i, 1);
      } else {
        p.r += p.vr; p.vx += Math.sin(frame / 20 + i) * 0.02;
        ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
        if (p.y > canvas.height + 20) parts.splice(i, 1);
      }
    }
    requestAnimationFrame(loop);
  };
  loop();
  addEventListener("resize", resize);
  return () => { run = false; removeEventListener("resize", resize); };
}

function countUp(el, to, ms = 2600) {
  return new Promise((res) => {
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * e).toLocaleString("de-DE") + " €";
      if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}

// ---------- Kleines Overlay: Sicherheitsstufe / Preisstufe ----------
export function levelOverlay(level) {
  const st = settings().ladder[level - 1];
  return new Promise((resolve) => {
    const o = document.createElement("div");
    o.className = "ovl";
    o.innerHTML = `<canvas class="fx"></canvas>
      <div class="inner">
        <div style="font-size:3rem">${st.safe ? "🛡️" : "🎁"}</div>
        <div class="gold-text big-amount" style="font-size:clamp(2.2rem,11vw,4rem)">${euro(st.amount)}</div>
        <h2 class="title-font" style="margin-top:10px">${st.safe ? "Sicherheitsstufe erreicht!" : "Preisstufe erreicht!"}</h2>
        ${st.prize ? `<p style="font-size:1.15rem">Echter Preis auf dieser Stufe:<br><b class="gold">${esc(st.prize)}</b></p>` : ""}
        ${st.safe ? `<p class="muted">Diesen Betrag kannst du nicht mehr verlieren.</p>` : `<p class="muted">Gehört dir, wenn du jetzt aufhörst oder eine spätere Sicherheitsstufe erreichst.</p>`}
        <button class="btn gold" style="margin-top:12px">Weiter</button>
      </div>`;
    document.body.append(o);
    const stop = startConfetti(o.querySelector("canvas"), { amount: 90, sparks: st.safe });
    play("level");
    vibrate([60, 40, 60]);
    o.querySelector("button").onclick = () => { stop(); o.remove(); resolve(); };
  });
}

// ---------- Das große Millionär-Finale ----------
export function millionOverlay(player, onShare) {
  const s = settings();
  const st = s.ladder[14];
  return new Promise((resolve) => {
    const o = document.createElement("div");
    o.className = "ovl";
    o.style.background = "radial-gradient(circle at 50% 40%, #1a1200, #000 75%)";
    o.innerHTML = `<div class="spot s1"></div><div class="spot s2"></div><div class="spot s3"></div><canvas class="fx"></canvas>
      <div class="inner">
        <div class="gold-text big-amount" id="mAmt">0 €</div>
        <div class="gold-text millionaer hidden" id="mTitle">MILLIONÄR!</div>
        <div id="mReveal" class="hidden">
          <p class="muted" style="margin-top:18px">Tippe auf die Schatztruhe!</p>
          <div class="chest" id="mChest"><div class="glow"></div><div class="base"></div><div class="lid"><div class="band" style="left:22%"></div><div class="band" style="right:22%"></div></div></div>
          <div class="prize-reveal" id="mPrize">Du hast gewonnen:<br><span class="gold-text" style="font-size:1.8rem">${esc(st.prize || "Ruhm und Ehre!")}</span></div>
        </div>
        <div id="mBtns" class="hidden" style="margin-top:18px;display:flex;flex-direction:column;gap:10px">
          <button class="btn gold" id="mShare">📜 Millionär-Urkunde teilen</button>
          <button class="btn" id="mClose">Weiter</button>
        </div>
      </div>`;
    document.body.append(o);
    const stop = startConfetti(o.querySelector("canvas"), { amount: 220 });
    play("fanfare");
    vibrate([200, 100, 200, 100, 400, 150, 600]);
    (async () => {
      await countUp(o.querySelector("#mAmt"), st.amount || 1000000);
      o.querySelector("#mTitle").classList.remove("hidden");
      opaSay("million", { ms: 6000 }); // Sprachaufnahme, sonst Sprechblase
      vibrate([300, 100, 300]);
      await sleep(1600);
      o.querySelector("#mReveal").classList.remove("hidden");
      const chest = o.querySelector("#mChest");
      const open = () => {
        chest.classList.add("open");
        play("level");
        vibrate(150);
        o.querySelector("#mPrize").classList.add("show");
        setTimeout(() => o.querySelector("#mBtns").classList.remove("hidden"), 900);
      };
      chest.onclick = open;
      setTimeout(() => !chest.classList.contains("open") && open(), 6000);
    })();
    o.querySelector("#mShare").onclick = () => onShare?.();
    o.querySelector("#mClose").onclick = () => { stop(); o.remove(); resolve(); };
  });
}

// ---------- Abzeichen-Animation ----------
export async function showBadges(keys) {
  for (const k of keys) {
    const b = BADGES[k];
    if (!b) continue;
    play("badge");
    vibrate(80);
    await modal(`<div class="center badge-pop"><span class="bi">${b.icon}</span><h2 class="title-font gold">Neues Abzeichen!</h2><h3>${esc(b.name)}</h3><p class="muted">${esc(b.desc)}</p></div>`, [{ label: "Super!", cls: "gold", value: true }]);
  }
}

// ---------- Urkunde als Bild ----------
async function loadImg(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(" ");
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh; }
    else line = test;
  }
  ctx.fillText(line, x, y);
  return y;
}

// kind: "week" | "million"
export async function makeCertificate({ kind, name, avatar, amount, prize, week, date }) {
  const s = settings();
  try { await Promise.all([document.fonts.load("700 60px Cinzel"), document.fonts.load("60px 'Great Vibes'"), document.fonts.load("700 30px Nunito")]); } catch {}
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  // Hintergrund
  const g = x.createRadialGradient(W / 2, H * 0.35, 50, W / 2, H / 2, H * 0.8);
  g.addColorStop(0, "#fffaf0"); g.addColorStop(1, "#f1dfb2");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // Rahmen
  const gold = x.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, "#9a6a00"); gold.addColorStop(0.3, "#ffd34d"); gold.addColorStop(0.5, "#fff2b0"); gold.addColorStop(0.7, "#e0a400"); gold.addColorStop(1, "#8a5b00");
  x.strokeStyle = gold; x.lineWidth = 26; x.strokeRect(36, 36, W - 72, H - 72);
  x.lineWidth = 4; x.strokeRect(70, 70, W - 140, H - 140);
  // Ecken-Sterne
  x.fillStyle = gold; x.font = "60px serif"; x.textAlign = "center";
  [[110, 130], [W - 110, 130], [110, H - 90], [W - 110, H - 90]].forEach(([a, b]) => x.fillText("✦", a, b));

  x.fillStyle = "#1b2270";
  x.font = "700 46px Cinzel, Georgia, serif";
  x.fillText("Wer wird Opa-när?", W / 2, 190);
  x.fillStyle = gold;
  x.font = "900 112px Cinzel, Georgia, serif";
  x.fillText("URKUNDE", W / 2, 320);
  x.fillStyle = "#5a4310";
  x.font = "700 40px Nunito, sans-serif";
  x.fillText(kind === "million" ? "Millionär der Familie" : `Wochensieger ${week ? weekLabel(week) : ""}`, W / 2, 390);

  // Avatar
  const cx = W / 2, cy = 560, r = 120;
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.closePath();
  x.fillStyle = "#1b2270"; x.fill(); x.clip();
  if (avatar?.type === "photo") {
    const img = await loadImg(avatar.value);
    if (img) {
      const sc = Math.max((2 * r) / img.width, (2 * r) / img.height);
      x.drawImage(img, cx - (img.width * sc) / 2, cy - (img.height * sc) / 2, img.width * sc, img.height * sc);
    }
  } else {
    x.font = "150px serif"; x.textBaseline = "middle"; x.fillText(avatar?.value || "🙂", cx, cy + 8); x.textBaseline = "alphabetic";
  }
  x.restore();
  x.strokeStyle = gold; x.lineWidth = 12; x.beginPath(); x.arc(cx, cy, r + 6, 0, 7); x.stroke();

  x.fillStyle = "#1b2270";
  x.font = "900 84px Cinzel, Georgia, serif";
  x.fillText(name, W / 2, 790);
  x.fillStyle = "#5a4310";
  x.font = "700 38px Nunito, sans-serif";
  x.fillText(kind === "million" ? "hat die Millionen-Frage geknackt und gewinnt" : "hat die Woche gewonnen mit", W / 2, 860);
  x.fillStyle = gold;
  x.font = "900 96px Cinzel, Georgia, serif";
  x.fillText(euro(amount), W / 2, 970);
  if (prize) {
    x.fillStyle = "#1b2270";
    x.font = "700 36px Nunito, sans-serif";
    wrapText(x, "Echter Preis: " + prize, W / 2, 1030, W - 220, 44);
  }
  x.fillStyle = "#5a4310";
  x.font = "italic 34px Georgia, serif";
  wrapText(x, "„" + (s.opa?.certSaying || "Ich bin stolz auf dich!") + "“", W / 2, 1120, W - 240, 42);
  // Unterschrift
  x.fillStyle = "#1b2270";
  x.font = "76px 'Great Vibes', cursive";
  x.fillText(s.opa?.signature || s.opa?.name || "Opa", W / 2 + 180, 1235);
  x.strokeStyle = "#5a4310"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(W / 2 + 20, 1252); x.lineTo(W - 130, 1252); x.stroke();
  x.font = "26px Nunito, sans-serif"; x.fillStyle = "#5a4310";
  x.fillText(date || new Date().toLocaleDateString("de-DE"), W / 2 - 230, 1245);
  x.beginPath(); x.moveTo(130, 1252); x.lineTo(W / 2 - 60, 1252); x.stroke();
  return new Promise((res) => c.toBlob(res, "image/png"));
}

export async function shareImage(blob, filename, text) {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: "Wer wird Opa-när?" });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Urkunde gespeichert – jetzt in der Familiengruppe teilen!");
  setTimeout(() => window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank"), 600);
}

export async function certificateDialog(data) {
  const blob = await makeCertificate(data);
  const url = URL.createObjectURL(blob);
  const fname = (data.kind === "million" ? "Millionaer-" : "Wochensieger-") + data.name.replace(/\W+/g, "") + ".png";
  const text = data.kind === "million"
    ? `🎉 ${data.name} ist Millionär bei „Wer wird Opa-när?“ geworden!`
    : `🏆 ${data.name} ist Wochensieger bei „Wer wird Opa-när?“ mit ${euro(data.amount)}!`;
  const r = await modal(`<img class="cert-preview" src="${url}" alt="Urkunde">`, [
    { label: "Schließen", value: false },
    { label: "📤 Teilen", cls: "gold", value: true },
  ]);
  if (r) await shareImage(blob, fname, text);
  URL.revokeObjectURL(url);
}
