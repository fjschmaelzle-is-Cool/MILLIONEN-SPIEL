// Das eigentliche Quiz: Fragen, Bestätigung, Spannung, Joker, Countdown

import { store } from "./store.js";
import {
  settings, ladder, me, myId, amountAt, safeLevelBelow, prizeFor, ensurePool, questionsFor,
  checkRoundBadges, announce, onlinePlayers, finishDuelIfDone, playerName, attemptsLeft,
} from "./logic.js";
import { CATEGORIES } from "./data.js";
import { esc, euro, fmtClock, fmtDuration, sleep, uid, weekId, vibrate, seededRandom, shuffle } from "./util.js";
import { play } from "./audio.js";
import { modal, confirmDialog, opaSay, zoomImage, toast } from "./ui.js";
import { levelOverlay, millionOverlay, showBadges, certificateDialog } from "./effects.js";

const L = ["A", "B", "C", "D"];
let G = null;
let ticker = null;
let unsub = null;

// ------------------------------------------------------------
//  HTML-Bausteine (auch fürs Tutorial nutzbar)
// ------------------------------------------------------------
export function ladderHTML(currentLevel, open = false) {
  const lad = ladder();
  const cur = lad[currentLevel - 1];
  return `
    <button class="ladder-toggle" data-tut="ladder" id="ladderToggle">
      <span>🪜</span><span class="cur">Frage ${currentLevel}: ${euro(cur?.amount)}</span>
      <span class="muted small">${open ? "▲ zuklappen" : "▼ Gewinnleiter"}</span>
    </button>
    <ol class="ladder ${open ? "" : "hidden"}" id="ladderList">
      ${lad.map((s, i) => `<li class="${s.safe ? "safe" : ""} ${i + 1 < currentLevel ? "done" : ""} ${i + 1 === currentLevel ? "current" : ""}">
        <span class="n">${i + 1}</span><span class="amt">${s.safe ? "🛡️ " : ""}${euro(s.amount)}</span><span class="prz">${s.prize ? "🎁 " + esc(s.prize) : ""}</span></li>`).join("")}
    </ol>`;
}

function timerHTML(sec, total) {
  const C = 2 * Math.PI * 42;
  return `<div class="timer ${sec <= 10 ? "danger" : ""}" id="timer" data-tut="timer">
    <svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="42" fill="none" stroke-width="9"/>
    <circle class="bar" id="timerBar" cx="50" cy="50" r="42" fill="none" stroke-width="9" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - sec / total)}"/></svg>
    <div class="num" id="timerNum">${fmtClock(sec)}</div></div>`;
}

export function gameHTML({ q, level, jokers = {}, hidden = [], remaining, total, duelLine = "" }) {
  const cat = CATEGORIES[q.category] || CATEGORIES.allgemein;
  return `
  <div class="game-layout">
    <div class="game">
      <div class="game-head">
        <div class="jokers" data-tut="jokers">
          <button class="joker ${jokers.fifty ? "used" : ""}" data-joker="fifty" title="50:50">50:50</button>
          <button class="joker ${jokers.audience ? "used" : ""}" data-joker="audience" title="Publikumsjoker">👥</button>
          <button class="joker ${jokers.opa ? "used" : ""}" data-joker="opa" title="Opa-Joker">👴📞</button>
        </div>
        ${timerHTML(remaining, total)}
      </div>
      ${duelLine ? `<div class="duel-live" id="duelLine">${duelLine}</div>` : ""}
      <div class="mobile-ladder">${ladderHTML(level)}</div>
      <div class="q-meta"><span>${cat.icon} ${cat.label}</span><span>Frage ${level} von 15 · <b class="gold">${euro(ladder()[level - 1].amount)}</b></span></div>
      ${q.image ? `<img class="q-image" id="qImage" src="${esc(q.image)}" alt="Bild zur Frage">` : ""}
      <div class="question-wrap"><div class="question" data-tut="question">${esc(q.text)}</div></div>
      ${q.submittedByName ? `<div class="small muted center">✍️ Eingereicht von ${esc(q.submittedByName)}</div>` : ""}
      <div class="answers" data-tut="answers">
        ${q.answers.map((a, i) => `<button class="answer ${hidden.includes(i) ? "gone" : ""}" data-a="${i}"><span class="l">${L[i]}:</span><span>${esc(a)}</span></button>`).join("")}
      </div>
      <div id="resultArea"></div>
      <button class="btn ghost sm" id="quitBtn" data-tut="quit">🏳️ Aufhören & Gewinn mitnehmen</button>
    </div>
  </div>`;
}

// ------------------------------------------------------------
//  Spielstart
// ------------------------------------------------------------
export async function startGame(root, nav, { duelId } = {}) {
  stopGame();
  const pid = myId();
  let qids;
  if (duelId) {
    const d = store.get("duels", duelId);
    if (!d) return toast("Duell nicht gefunden.");
    qids = d.qids;
  } else {
    if (attemptsLeft(pid) <= 0) {
      await modal(`<h2 class="title-font center">Keine Versuche mehr</h2><p class="center">Diese Woche hast du alle erlaubten Runden gespielt. Ab Montag gibt's neue Fragen!</p>`);
      return nav("home");
    }
    const pool = await ensurePool();
    qids = questionsFor(pool, pid);
    if (!qids) {
      await modal(`<h2 class="title-font center">Noch nicht genug Fragen</h2><p class="center">Im Admin-Bereich müssen zuerst Fragen angelegt werden.</p>`);
      return nav("home");
    }
  }
  const roundId = uid("r");
  G = {
    roundId, duelId, qids, idx: 0, correctCount: 0, answers: [], jokers: {}, usedJokers: [],
    hidden: [], phase: "answer", startedAt: Date.now(), root, nav, badgesBefore: Object.keys(me()?.badges || {}),
  };
  await store.set("rounds", roundId, {
    playerId: pid, week: weekId(), date: Date.now(), finished: false, level: 0, amount: 0, duration: 0,
    jokers: [], answers: [], duelId: duelId || null, qids,
  });
  if (duelId) {
    const d = store.get("duels", duelId);
    if (d.opponent === pid && d.status === "open") await store.update("duels", duelId, { status: "accepted" });
    await store.update("duels", duelId, { results: { [pid]: { current: 1, level: 0, done: false } } });
  }
  unsub = store.on((col, id) => { if (col === "duels" && id === G?.duelId) updateDuelLine(); });
  opaSay("start");
  showQuestion();
}

export function stopGame() {
  clearInterval(ticker);
  ticker = null;
  unsub?.();
  unsub = null;
  document.querySelector(".modal-bg")?.remove();
  G = null;
}

const curQ = () => store.get("questions", G.qids[G.idx]) || { text: "(Frage wurde gelöscht)", answers: ["–", "–", "–", "–"], correct: 0, category: "allgemein" };

function duelLineText() {
  if (!G.duelId) return "";
  const d = store.get("duels", G.duelId);
  const opp = d.challenger === myId() ? d.opponent : d.challenger;
  const r = d.results?.[opp];
  const name = esc(playerName(opp));
  if (!r) return `⚔️ Duell gegen ${name} – spielt später`;
  if (r.done) return `⚔️ ${name} ist fertig: Stufe ${r.level} in ${fmtDuration(r.duration)}`;
  return `⚔️ LIVE: ${name} ist gerade bei Frage ${r.current}`;
}
function updateDuelLine() {
  const el = document.getElementById("duelLine");
  if (el) el.innerHTML = duelLineText();
}

function showQuestion() {
  const level = G.idx + 1;
  const total = settings().times[level - 1] || 30;
  G.phase = "answer";
  G.hidden = [];
  G.qStart = Date.now();
  G.deadline = G.qStart + total * 1000;
  G.total = total;
  G.lastSec = null;
  G.root.className = "screen game-screen";
  G.root.innerHTML = gameHTML({ q: curQ(), level, jokers: G.jokers, hidden: [], remaining: total, total, duelLine: duelLineText() });
  bind();
  clearInterval(ticker);
  ticker = setInterval(tick, 200);
  if (G.duelId) store.update("duels", G.duelId, { results: { [myId()]: { current: level, level: G.correctCount } } });
}

function bind() {
  const r = G.root;
  r.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => choose(+b.dataset.a)));
  r.querySelectorAll("[data-joker]").forEach((b) => (b.onclick = () => useJoker(b.dataset.joker)));
  r.querySelector("#quitBtn").onclick = quit;
  r.querySelector("#qImage")?.addEventListener("click", (e) => zoomImage(e.target.src));
  const tog = r.querySelector("#ladderToggle");
  tog.onclick = () => {
    const list = r.querySelector("#ladderList");
    list.classList.toggle("hidden");
    tog.querySelector(".muted").textContent = list.classList.contains("hidden") ? "▼ Gewinnleiter" : "▲ zuklappen";
  };
}

function tick() {
  if (!G || !["answer", "confirm"].includes(G.phase)) return;
  const rem = Math.max(0, (G.deadline - Date.now()) / 1000);
  const C = 2 * Math.PI * 42;
  const bar = document.getElementById("timerBar");
  const num = document.getElementById("timerNum");
  if (bar) bar.style.strokeDashoffset = C * (1 - rem / G.total);
  if (num) num.textContent = fmtClock(rem);
  const sec = Math.ceil(rem);
  document.getElementById("timer")?.classList.toggle("danger", sec <= 10);
  if (sec !== G.lastSec) {
    G.lastSec = sec;
    if (sec <= 10 && sec > 0) { play("tick"); if (sec <= 3) vibrate(40); }
  }
  if (rem <= 0) timeout();
}

// ------------------------------------------------------------
//  Antworten
// ------------------------------------------------------------
async function choose(i) {
  if (G.phase !== "answer" || G.hidden.includes(i)) return;
  play("click");
  const btns = G.root.querySelectorAll("[data-a]");
  btns.forEach((b) => b.classList.toggle("selected", +b.dataset.a === i));
  G.phase = "confirm";
  const g = G;
  const ok = await confirmDialog("Ist das deine endgültige Antwort?");
  if (G !== g || G.phase !== "confirm") return; // Zeit abgelaufen o. Ä.
  if (!ok) {
    btns.forEach((b) => b.classList.remove("selected"));
    G.phase = "answer";
    return;
  }
  lockIn(i);
}

async function lockIn(picked) {
  const g = G;
  G.phase = "locked";
  const ms = Date.now() - G.qStart;
  const q = curQ();
  const btns = [...G.root.querySelectorAll("[data-a]")];
  btns.forEach((b) => (b.disabled = true));
  if (picked != null) {
    btns[picked].classList.remove("selected");
    btns[picked].classList.add("locked");
    play("lock");
    await sleep(2300);
    if (G !== g) return;
  }
  const correct = picked === q.correct;
  G.answers.push({ qid: q.id, level: G.idx + 1, category: q.category, picked, correct, ms });
  btns[q.correct].classList.remove("locked");
  btns[q.correct].classList.add("correct");
  if (picked != null && !correct) btns[picked].classList.replace("locked", "wrong");
  if (correct) {
    G.correctCount++;
    play("correct");
    vibrate(60);
  } else {
    play("wrong");
    vibrate([200, 80, 200]);
  }
  await saveProgress();
  const level = G.idx + 1;
  const st = ladder()[level - 1];
  if (correct) {
    if (level === 15) {
      await sleep(1200);
      return finish("million");
    }
    opaSay(st.safe ? "safe" : "correct");
    await sleep(1300);
    if (G !== g) return;
    if (st.safe || st.prize) await levelOverlay(level);
    if (G !== g) return;
  } else {
    opaSay(picked == null ? "timeout" : "wrong");
  }
  showResultArea(q, correct, picked == null);
}

function showResultArea(q, correct, timedOut) {
  const area = G.root.querySelector("#resultArea");
  const msg = correct ? "✅ Richtig!" : timedOut ? "⏰ Die Zeit ist abgelaufen!" : `❌ Leider falsch. Richtig war ${L[q.correct]}: ${esc(q.answers[q.correct])}`;
  area.innerHTML = `<div class="explain ${correct ? "" : "bad"}"><b>${msg}</b>${q.explanation ? `<p style="margin:.4em 0 0">${esc(q.explanation)}</p>` : ""}</div>
    <button class="btn ${correct ? "gold" : ""} block" id="nextBtn" style="margin-top:10px">${correct ? "Nächste Frage ➜" : "Zur Auswertung"}</button>`;
  G.root.querySelector("#quitBtn").classList.add("hidden");
  area.querySelector("#nextBtn").onclick = () => {
    if (correct) { G.idx++; showQuestion(); }
    else finish(timedOut ? "timeout" : "wrong");
  };
  area.scrollIntoView({ behavior: "smooth", block: "center" });
}

function timeout() {
  if (G.phase === "confirm") document.querySelector(".modal-bg")?.close?.(false);
  document.querySelector(".modal-bg")?.remove();
  G.phase = "locked";
  clearInterval(ticker);
  const n = document.getElementById("timerNum");
  if (n) n.textContent = "0";
  G.root.querySelectorAll("[data-a]").forEach((b) => b.classList.remove("selected"));
  lockIn(null);
}

async function quit() {
  if (G.phase !== "answer") return;
  const amt = amountAt(G.correctCount);
  const ok = await confirmDialog(`Wirklich aufhören und ${euro(amt)} mitnehmen?`, "Ja, aufhören", "Weiterspielen");
  if (!ok || !G || G.phase !== "answer") return;
  // Die aktuelle Frage wird nicht gewertet
  finish("quit");
}

function duration() {
  return G.answers.reduce((s, a) => s + a.ms, 0);
}

async function saveProgress() {
  await store.update("rounds", G.roundId, {
    level: G.correctCount, answers: G.answers, jokers: G.usedJokers, duration: duration(),
  });
}

// ------------------------------------------------------------
//  Rundenende
// ------------------------------------------------------------
async function finish(outcome) {
  clearInterval(ticker);
  G.phase = "done";
  const g = G;
  const level = G.correctCount;
  const wonLevel = outcome === "quit" || outcome === "million" ? level : safeLevelBelow(level);
  const amount = amountAt(wonLevel);
  const prize = prizeFor(wonLevel);
  const round = {
    finished: true, outcome, level, wonLevel, amount, prize, duration: duration(),
    answers: G.answers, jokers: G.usedJokers, finishedAt: Date.now(),
  };
  await store.update("rounds", G.roundId, round);
  const full = store.get("rounds", G.roundId);
  if (G.duelId) {
    await store.update("duels", G.duelId, { results: { [myId()]: { current: level, level, amount, duration: round.duration, done: true } } });
    await finishDuelIfDone(G.duelId);
  }
  if (!G.duelId) await checkRoundBadges(full);
  if (outcome === "quit") opaSay("quit");
  const p = me();
  if (outcome === "million") {
    announce(`🎉 ${p.name} ist Millionär geworden!`, "million");
    await millionOverlay(p, () => certificateDialog({ kind: "million", name: p.name, avatar: p.avatar, amount, prize }));
  }
  if (G !== g) return;
  renderSummary(full, outcome);
  const newBadges = Object.keys(me()?.badges || {}).filter((k) => !g.badgesBefore.includes(k));
  if (newBadges.length) {
    await sleep(900);
    await showBadges(newBadges);
    await store.update("players", myId(), { seenBadges: Object.keys(me().badges || {}) });
  }
}

function renderSummary(r, outcome) {
  const titles = { quit: "Klug aufgehört!", wrong: "Leider falsch!", timeout: "Zeit abgelaufen!", million: "MILLIONÄR!" };
  const duel = r.duelId ? store.get("duels", r.duelId) : null;
  G.root.className = "screen";
  G.root.innerHTML = `
    <div class="card center">
      <h2 class="title-font">${titles[outcome]}</h2>
      <p class="muted">Du hast ${r.level} von 15 Fragen richtig beantwortet${outcome === "wrong" || outcome === "timeout" ? r.wonLevel ? ` und fällst auf die Sicherheitsstufe ${r.wonLevel} zurück` : "" : ""}.</p>
      <div class="gold-text big-amount" style="font-size:clamp(2.2rem,12vw,4rem)">${euro(r.amount)}</div>
      <div style="margin:16px 0;font-size:1.1rem">${r.prize ? `🎁 Dein echter Preis:<br><b class="gold" style="font-size:1.3rem">${esc(r.prize)}</b>` : `<span class="muted">Diesmal noch kein echter Preis – der erste wartet auf Stufe ${ladder().findIndex((s) => s.prize) + 1}!</span>`}</div>
      <p class="small muted">⏱️ Antwortzeit gesamt: ${fmtDuration(r.duration)} · 🃏 Joker: ${r.jokers.length ? r.jokers.length : "keine"}</p>
      ${duel ? `<p class="duel-live">${duelLineText()}</p>` : ""}
    </div>
    <div class="row wrap">
      ${r.duelId ? `<button class="btn gold grow" data-go="duels">⚔️ Zu den Duellen</button>` : `<button class="btn gold grow" id="again">🔁 Nochmal spielen</button>`}
      <button class="btn grow" data-go="ranking">🏆 Rangliste</button>
      <button class="btn grow" data-go="home">🏠 Start</button>
    </div>`;
  G.root.querySelector("#again")?.addEventListener("click", () => G.nav("play"));
  G.root.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => G.nav(b.dataset.go)));
}

// ------------------------------------------------------------
//  Joker
// ------------------------------------------------------------
async function useJoker(kind) {
  if (G.phase !== "answer" || G.jokers[kind]) return;
  play("joker");
  G.jokers[kind] = true;
  G.usedJokers.push(kind);
  G.root.querySelector(`[data-joker="${kind}"]`).classList.add("used");
  saveProgress();
  const q = curQ();
  if (kind === "fifty") {
    const wrong = shuffle([0, 1, 2, 3].filter((i) => i !== q.correct));
    G.hidden = wrong.slice(0, 2);
    G.hidden.forEach((i) => G.root.querySelector(`[data-a="${i}"]`).classList.add("gone"));
  } else if (kind === "audience") {
    await audienceJoker(q);
  } else if (kind === "opa") {
    await opaJoker(q);
  }
}

function visibleAnswers(q) {
  return q.answers.map((a, i) => (G.hidden.includes(i) ? null : a));
}

function barsHTML(perc, answers) {
  return `<div class="bars">${[0, 1, 2, 3].map((i) => `<div class="col">
    <span class="pct">${answers[i] == null ? "" : (perc[i] || 0) + " %"}</span>
    <div class="bar" style="height:${answers[i] == null ? 0 : Math.max(1, perc[i] || 0)}%"></div>
    <span class="lbl">${L[i]}</span></div>`).join("")}</div>`;
}

function simulatedVotes(q, level, answers) {
  const vis = answers.map((a, i) => (a == null ? -1 : i)).filter((i) => i >= 0);
  const reliability = Math.max(0.25, 0.92 - (level - 1) * 0.045);
  const w = {};
  for (const i of vis) w[i] = Math.random() * (1 - reliability);
  // Bei schweren Fragen manchmal eine falsche Antwort als Favorit
  const fav = Math.random() < reliability ? q.correct : vis[Math.floor(Math.random() * vis.length)];
  w[fav] += reliability;
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  const perc = {};
  let acc = 0;
  vis.forEach((i, k) => {
    perc[i] = k === vis.length - 1 ? 100 - acc : Math.round((w[i] / sum) * 100);
    acc += perc[i];
  });
  return perc;
}

async function audienceJoker(q) {
  const answers = visibleAnswers(q);
  const others = onlinePlayers().filter((p) => p.id !== myId() && !p.playing);
  const level = G.idx + 1;
  if (!others.length) {
    const perc = simulatedVotes(q, level, answers);
    await modal(`<h2 class="title-font center">👥 Publikumsjoker</h2>
      <p class="center small muted">Gerade ist niemand aus der Familie online – das Studiopublikum stimmt ab:</p>
      <div id="pollBars">${barsHTML({}, answers)}</div>`, [{ label: "Danke!", cls: "gold", value: true }], {
      onMount: (el) => setTimeout(() => { el.querySelector("#pollBars").innerHTML = barsHTML(perc, answers); }, 400),
    });
    return;
  }
  const secs = Number(settings().pollSeconds) || 60;
  const pollId = uid("p");
  await store.set("polls", pollId, {
    askerId: myId(), askerName: me().name, text: q.text, answers, level,
    createdAt: Date.now(), expiresAt: Date.now() + secs * 1000, votes: {}, closed: false,
  });
  let off;
  const result = () => {
    const p = store.get("polls", pollId);
    const votes = Object.values(p?.votes || {});
    const perc = {};
    for (let i = 0; i < 4; i++) perc[i] = votes.length ? Math.round((votes.filter((v) => v === i).length / votes.length) * 100) : 0;
    return { perc, n: votes.length };
  };
  await modal(`<h2 class="title-font center">👥 Publikumsjoker – live!</h2>
    <p class="center small">${others.length} Familienmitglied${others.length > 1 ? "er sind" : " ist"} online und stimmen ab …</p>
    <div id="pollBars">${barsHTML({}, answers)}</div>
    <p class="center small muted" id="pollInfo"></p>`, [{ label: "Fertig", cls: "gold", value: true }], {
    dismissable: false,
    onMount: (el, close) => {
      const upd = () => {
        const { perc, n } = result();
        const left = Math.max(0, Math.ceil((store.get("polls", pollId).expiresAt - Date.now()) / 1000));
        el.querySelector("#pollBars").innerHTML = barsHTML(perc, answers);
        el.querySelector("#pollInfo").textContent = `${n} Stimme${n === 1 ? "" : "n"} · noch ${left} s`;
        if (left <= 0 || n >= others.length) {
          clearInterval(iv);
          el.querySelector("#pollInfo").textContent = `Abstimmung beendet · ${n} Stimme${n === 1 ? "" : "n"}`;
          store.update("polls", pollId, { closed: true });
          if (!n) el.querySelector("#pollInfo").textContent = "Niemand hat abgestimmt – schade!";
        }
      };
      const iv = setInterval(upd, 1000);
      off = store.on((col, id) => col === "polls" && id === pollId && upd());
      upd();
      el.addEventListener("click", (e) => { if (e.target.closest("[data-i]")) clearInterval(iv); });
    },
  });
  off?.();
  store.update("polls", pollId, { closed: true });
}

async function opaJoker(q) {
  const s = settings();
  const phone = (s.opa?.phone || "").replace(/[^\d+]/g, "");
  const answers = visibleAnswers(q);
  const text = `Hallo ${s.opa?.name || "Opa"}, hier ist ${me().name} – ich brauche deinen Opa-Joker bei „Wer wird Opa-när?“! 🙏\n\n` +
    `Frage ${G.idx + 1} (${euro(ladder()[G.idx].amount)}): ${q.text}\n\n` +
    answers.map((a, i) => (a == null ? null : `${L[i]}: ${a}`)).filter(Boolean).join("\n") +
    `\n\nWas meinst du? Die Zeit läuft! ⏰`;
  const waNum = phone.replace(/^\+/, "").replace(/^00/, "").replace(/^0/, "49");
  const wa = `https://wa.me/${waNum}?text=${encodeURIComponent(text)}`;
  await modal(`<div class="center"><img src="${esc(s.opa?.photo || "icons/opa.svg")}" style="width:90px;height:90px;border-radius:50%;border:3px solid var(--gold);object-fit:cover"></div>
    <h2 class="title-font center">📞 ${esc(s.opa?.name || "Opa")}-Joker</h2>
    <p class="center small">Frag ${esc(s.opa?.name || "Opa")} um Rat! <b>Achtung: Die Zeit läuft weiter.</b></p>
    <div style="display:flex;flex-direction:column;gap:10px">
      <a class="btn green" href="${phone ? wa : "https://wa.me/?text=" + encodeURIComponent(text)}" target="_blank" rel="noopener">💬 WhatsApp mit Frage öffnen</a>
      ${phone ? `<a class="btn" href="tel:${esc(phone)}">📞 ${esc(s.opa?.name || "Opa")} anrufen</a>` : `<p class="small muted center">Opas Telefonnummer kann im Admin-Bereich eingetragen werden.</p>`}
    </div>`, [{ label: "Zurück zur Frage", cls: "gold", value: true }]);
}
