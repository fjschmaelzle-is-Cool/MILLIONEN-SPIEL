// Hauptprogramm: Anmeldung, Startseite, Ranglisten, Profil, Duelle,
// Fragen einreichen, Urkunden – plus Echtzeit-Wächter (Publikum, Duelle, Mitteilungen)

import { store } from "./store.js";
import { APP_TITLE } from "./config.js";
import {
  bootstrapData, settings, me, myId, players, isOnline, weekRanking, eternalRanking, generationRanking,
  totalWon, stats, attemptsLeft, closePastWeeks, createDuel, playerName, prizeFor, checkLeaderBadges, ensurePool,
} from "./logic.js";
import { GENERATIONS, CATEGORIES, BADGES } from "./data.js";
import { $, esc, euro, fmtDuration, fmtDate, weekId, shiftWeek, weekLabel, compressImage, pickFile, uid } from "./util.js";
import { avatarHTML, toast, modal, confirmDialog, opaSay } from "./ui.js";
import { startGame, stopGame } from "./game.js";
import { runTutorial } from "./tutorial.js";
import { showBadges, certificateDialog } from "./effects.js";
import { sound, play } from "./audio.js";

const app = document.getElementById("app");
let main = null;
let route = "home";
let playing = false;

const EMOJIS = ["😀", "😎", "🤓", "🥳", "😇", "🤠", "👵", "👴", "👩", "👨", "👧", "👦", "🧒", "👶", "🐶", "🐱", "🦊", "🐻", "🐼", "🦁", "🐸", "🦄", "🐝", "🌻", "⚽", "🎸", "🚜", "⛵", "🍰", "🍦"];

// ------------------------------------------------------------
//  Rahmen
// ------------------------------------------------------------
function shell() {
  app.innerHTML = `
    <header class="topbar">
      <span class="brand">${esc(APP_TITLE)}</span>
      ${store.mode === "demo" ? `<span class="mode-pill" title="Daten nur auf diesem Gerät">DEMO</span>` : ""}
      <button class="icon-btn" id="muteBtn" title="Ton an/aus">${sound.muted ? "🔇" : "🔊"}</button>
      <button class="icon-btn" id="menuBtn" data-tut="menu" title="Menü">☰</button>
    </header>
    <main class="screen" id="main"></main>`;
  main = $("#main");
  $("#muteBtn").onclick = () => { $("#muteBtn").textContent = sound.toggle() ? "🔇" : "🔊"; };
  $("#menuBtn").onclick = openMenu;
}

async function openMenu() {
  if (playing) return toast("Während einer Runde ist das Menü gesperrt – du kannst über „Aufhören“ beenden.");
  const items = [
    ["home", "🏠", "Startseite"], ["play", "▶️", "Spielen"], ["ranking", "🏆", "Ranglisten"], ["duels", "⚔️", "Duelle"],
    ["submit", "✍️", "Frage einreichen"], ["profile", "👤", "Mein Profil"], ["certs", "📜", "Urkunden"],
    ["tutorial", "👴", "Spielregeln (Opa erklärt)"], ["admin", "🔐", "Admin-Bereich"], ["switch", "🔄", "Spieler wechseln"],
  ];
  const r = await modal(`<h2 class="title-font center">Menü</h2><div style="display:flex;flex-direction:column;gap:8px">
    ${items.map(([k, i, l]) => `<button class="btn block" data-m="${k}" style="justify-content:flex-start">${i} ${l}</button>`).join("")}</div>`,
  [{ label: "Schließen", value: null }], {
    onMount: (el, close) => el.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => close(b.dataset.m))),
  });
  if (r) nav(r);
}

export function nav(r, param) {
  if (r !== "play" && r !== "duelplay") { playing = false; stopGame(); heartbeat(); }
  route = r;
  main.className = "screen";
  window.scrollTo(0, 0);
  const screens = {
    home: renderHome, play: () => play_(), duelplay: () => play_(param), ranking: renderRanking, profile: () => renderProfile(param),
    duels: renderDuels, submit: renderSubmit, certs: renderCerts, tutorial: () => runTutorial({ root: main, renderHome }),
    admin: async () => (await import("./admin.js")).renderAdmin(main, nav), switch: switchPlayer,
  };
  (screens[r] || renderHome)();
}

async function play_(duelId) {
  playing = true;
  heartbeat();
  await startGame(main, nav, { duelId });
}

// ------------------------------------------------------------
//  Anmeldung
// ------------------------------------------------------------
function renderJoin() {
  app.innerHTML = `<main class="screen" style="display:grid;place-items:center">
    <div class="card center" style="max-width:420px;width:100%">
      <img src="${esc(settings().opa?.photo || "icons/opa.svg")}" style="width:110px;height:110px;border-radius:50%;border:3px solid var(--gold);object-fit:cover">
      <h1 class="title-font gold" style="margin-top:12px">${esc(APP_TITLE)}</h1>
      <p class="muted">Das Familien-Quiz zum 77. Geburtstag</p>
      <label class="field"><span>Familien-Code</span><input type="text" id="code" autocomplete="off" autocapitalize="characters" placeholder="z. B. OPA77"></label>
      <button class="btn gold block" id="joinBtn">Mitspielen</button>
      ${store.mode === "demo" ? `<p class="small muted" style="margin-top:12px">Demo-Modus: Der Code ist <b>OPA77</b>. Daten bleiben auf diesem Gerät.</p>` : ""}
    </div></main>`;
  const go = async () => {
    const ok = await store.join($("#code").value);
    if (!ok) return toast("Dieser Familien-Code stimmt leider nicht.");
    await bootstrapData();
    ensureWatchers();
    renderWho();
  };
  $("#joinBtn").onclick = go;
  $("#code").onkeydown = (e) => e.key === "Enter" && go();
}

function renderWho() {
  const ps = players();
  app.innerHTML = `<main class="screen"><div class="card">
    <h2 class="title-font center">Wer bist du?</h2>
    ${ps.length ? `<div>${ps.map((p) => `<div class="list-item" data-p="${p.id}" style="cursor:pointer">${avatarHTML(p.avatar)}<b class="grow">${esc(p.name)}</b><span class="muted small">${GENERATIONS.find((g) => g.id === p.generation)?.label || ""}</span></div>`).join("")}</div><hr style="border-color:var(--line);margin:16px 0">` : ""}
    <button class="btn gold block" id="newP">➕ Ich bin neu hier</button>
  </div></main>`;
  app.querySelectorAll("[data-p]").forEach((el) => (el.onclick = () => { localStorage.setItem("opa-player", el.dataset.p); start(); }));
  $("#newP").onclick = () => renderProfileEditor(null);
}

function renderProfileEditor(player) {
  const p = player || { name: "", avatar: { type: "emoji", value: "😀" }, generation: "enkel" };
  let avatar = { ...p.avatar };
  let gen = p.generation;
  const target = player ? main : app;
  target.innerHTML = `${player ? "" : `<main class="screen">`}<div class="card">
    <h2 class="title-font center">${player ? "Profil bearbeiten" : "Neu anmelden"}</h2>
    <div class="center" id="avPrev">${avatarHTML(avatar, "lg")}</div>
    <label class="field"><span>Dein Name</span><input type="text" id="pName" maxlength="24" value="${esc(p.name)}" placeholder="z. B. Lena"></label>
    <span class="small muted">Avatar wählen</span>
    <div class="emoji-grid" id="emo">${EMOJIS.map((e) => `<button data-e="${e}" class="${avatar.type === "emoji" && avatar.value === e ? "active" : ""}">${e}</button>`).join("")}</div>
    <button class="btn block sm" id="photoBtn" style="margin-top:8px">📷 Stattdessen ein Foto nehmen</button>
    <p class="small muted" style="margin:14px 0 6px">Zu welcher Generation gehörst du?</p>
    <div class="seg" id="gen">${GENERATIONS.map((g) => `<button data-g="${g.id}" class="${gen === g.id ? "active" : ""}">${g.icon}<br>${g.label}</button>`).join("")}</div>
    <button class="btn gold block" id="saveP" style="margin-top:16px">${player ? "Speichern" : "Los geht's!"}</button>
    ${!player ? `<button class="btn ghost block" id="backP" style="margin-top:8px">Zurück</button>` : ""}
  </div>${player ? "" : `</main>`}`;
  const prev = () => ($("#avPrev").innerHTML = avatarHTML(avatar, "lg"));
  target.querySelectorAll("[data-e]").forEach((b) => (b.onclick = () => {
    avatar = { type: "emoji", value: b.dataset.e };
    target.querySelectorAll("[data-e]").forEach((x) => x.classList.toggle("active", x === b));
    prev();
  }));
  target.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => {
    gen = b.dataset.g;
    target.querySelectorAll("[data-g]").forEach((x) => x.classList.toggle("active", x === b));
  }));
  $("#photoBtn").onclick = async () => {
    const f = await pickFile("image/*");
    if (!f) return;
    try {
      const blob = await compressImage(f, 400, 0.85);
      toast("Foto wird hochgeladen …");
      avatar = { type: "photo", value: await store.upload(blob, "avatars") };
      prev();
    } catch (e) { toast(e.message); }
  };
  $("#backP") && ($("#backP").onclick = renderWho);
  $("#saveP").onclick = async () => {
    const name = $("#pName").value.trim();
    if (!name) return toast("Bitte gib deinen Namen ein.");
    if (player) {
      await store.update("players", player.id, { name, avatar, generation: gen });
      toast("Gespeichert!");
      return nav("profile");
    }
    if (players().some((x) => x.name.toLowerCase() === name.toLowerCase())) return toast("Diesen Namen gibt es schon – wähle ihn in der Liste oder nimm einen anderen.");
    const id = uid("p");
    await store.set("players", id, { name, avatar, generation: gen, createdAt: Date.now(), lastSeen: Date.now(), badges: {}, seenBadges: [] });
    localStorage.setItem("opa-player", id);
    start();
  };
}

async function switchPlayer() {
  if (await confirmDialog("Spieler wechseln?")) {
    localStorage.removeItem("opa-player");
    renderWho();
  } else nav("home");
}

// ------------------------------------------------------------
//  Startseite
// ------------------------------------------------------------
function renderHome() {
  route = "home";
  main.className = "screen";
  const p = me();
  const wk = weekId();
  const ranking = weekRanking(wk);
  const myBest = ranking.find((r) => r.playerId === p.id);
  const myPos = ranking.findIndex((r) => r.playerId === p.id) + 1;
  const left = attemptsLeft(p.id);
  const lastWeek = store.get("weeks", shiftWeek(wk, -1));
  const online = players().filter((x) => isOnline(x) && x.id !== p.id);
  const openDuels = store.all("duels").filter((d) => d.opponent === p.id && d.status === "open").length;
  const pending = store.all("questions").filter((q) => q.submittedBy === p.id && q.status === "pending").length;
  main.innerHTML = `
    <div class="card row">
      ${avatarHTML(p.avatar, "lg")}
      <div class="grow"><div class="muted small">Hallo,</div><h2 class="title-font" style="margin:0">${esc(p.name)}</h2>
        <div class="small muted">${weekLabel(wk)}</div></div>
    </div>
    <button class="btn gold block" id="playBtn" style="min-height:64px;font-size:1.3rem;margin-bottom:8px" ${left <= 0 ? "disabled" : ""}>▶️ Jetzt spielen</button>
    <p class="center small muted" style="margin:0 0 14px">${myBest ? `Deine beste Runde diese Woche: <b class="gold">${euro(myBest.amount)}</b> · Platz ${myPos}` : "Diese Woche noch nicht gespielt."}
      ${left !== Infinity ? `<br>Noch ${left} Versuch${left === 1 ? "" : "e"} diese Woche.` : ""}</p>
    ${lastWeek ? `<div class="card row" id="lastWinner" style="cursor:pointer;border-color:var(--gold)">
      ${avatarHTML(lastWeek.winner.avatar)}<div class="grow"><div class="small muted">🏆 Wochensieger ${weekLabel(shiftWeek(wk, -1))}</div><b>${esc(lastWeek.winner.name)}</b> mit <b class="gold">${euro(lastWeek.winner.amount)}</b></div><span>📜</span></div>` : ""}
    <div class="menu-grid">
      <div class="tile" data-go="ranking" data-tut="ranking"><span class="ico">🏆</span>Rangliste<span class="sub">${ranking.length} Spieler diese Woche</span></div>
      <div class="tile" data-go="duels" data-tut="duels"><span class="ico">⚔️</span>Duelle<span class="sub">${openDuels ? `<b class="gold">${openDuels} Herausforderung${openDuels > 1 ? "en" : ""}!</b>` : "Familie herausfordern"}</span></div>
      <div class="tile" data-go="submit" data-tut="submit"><span class="ico">✍️</span>Frage einreichen<span class="sub">${pending ? `${pending} in Prüfung` : "mit Foto möglich"}</span></div>
      <div class="tile" data-go="profile"><span class="ico">👤</span>Mein Profil<span class="sub">${Object.keys(p.badges || {}).length} Abzeichen</span></div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="small muted" style="margin-bottom:6px">Gerade online</div>
      ${online.length ? `<div class="row wrap">${online.map((x) => `<span class="row" style="gap:4px">${avatarHTML(x.avatar, "sm")}<span class="small">${esc(x.name)}</span><span class="dot-online"></span></span>`).join("")}</div>` : `<span class="small muted">Niemand außer dir – der Publikumsjoker wird simuliert.</span>`}
    </div>`;
  $("#playBtn").onclick = () => nav("play");
  main.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => nav(b.dataset.go)));
  $("#lastWinner")?.addEventListener("click", () => certificateDialog({ kind: "week", ...lastWeek.winner, week: shiftWeek(wk, -1), date: fmtDate(lastWeek.closedAt) }));
}

// ------------------------------------------------------------
//  Ranglisten
// ------------------------------------------------------------
let rankTab = "week";
let rankWeek = null;
function renderRanking() {
  rankWeek ||= weekId();
  const tabs = [["week", "Woche"], ["eternal", "Ewige Bestenliste"], ["gen", "Generationen"]];
  let body = "";
  const row = (r, i, extra = "") => {
    const p = store.get("players", r.playerId);
    return `<div class="list-item rank-${i + 1}" data-prof="${p.id}" style="cursor:pointer"><span class="rank-no">${i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>${avatarHTML(p.avatar, "sm")}
      <div class="grow"><b>${esc(p.name)}</b>${isOnline(p) ? ' <span class="dot-online"></span>' : ""}<div class="small muted">Stufe ${r.level} · ${fmtDuration(r.duration)}${extra}</div></div>
      <b class="gold">${euro(r.amount)}</b></div>`;
  };
  if (rankTab === "week") {
    const list = weekRanking(rankWeek);
    body = `<div class="row" style="justify-content:space-between;margin-bottom:8px">
        <button class="btn sm" id="wPrev">◀</button><b class="small">${weekLabel(rankWeek)}</b>
        <button class="btn sm" id="wNext" ${rankWeek === weekId() ? "disabled" : ""}>▶</button></div>
      ${list.length ? list.map((r, i) => row(r, i)).join("") : `<p class="muted center">Noch keine Runden in dieser Woche.</p>`}
      <p class="small muted">Es zählt die beste Runde pro Spieler. Bei Gleichstand gewinnt, wer schneller war.</p>`;
  } else if (rankTab === "eternal") {
    const list = eternalRanking();
    body = list.length ? list.map((r, i) => row(r, i, ` · gesamt ${euro(totalWon(r.playerId))}`)).join("") : `<p class="muted center">Noch keine Runden gespielt.</p>`;
    body += `<p class="small muted">Beste Runde aller Zeiten pro Spieler.</p>`;
  } else {
    const list = generationRanking(rankWeek);
    body = `<p class="small muted center">${weekLabel(rankWeek)} · Durchschnitt der besten Runden pro Generation</p>` +
      (list.length ? list.map((g, i) => {
        const G = GENERATIONS.find((x) => x.id === g.gen);
        return `<div class="list-item rank-${i + 1}"><span class="rank-no">${["🥇", "🥈", "🥉"][i] || i + 1}</span><span style="font-size:2rem">${G?.icon}</span>
          <div class="grow"><b>${G?.label}</b><div class="small muted">${g.players} Spieler · Bester: ${esc(playerName(g.best.playerId))}</div></div><b class="gold">Ø ${euro(g.avg)}</b></div>`;
      }).join("") : `<p class="muted center">Noch keine Runden in dieser Woche.</p>`);
  }
  main.innerHTML = `<h2 class="title-font">🏆 Ranglisten</h2>
    <div class="tabs">${tabs.map(([k, l]) => `<button data-t="${k}" class="${rankTab === k ? "active" : ""}">${l}</button>`).join("")}</div>
    <div class="card">${body}</div>`;
  main.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { rankTab = b.dataset.t; renderRanking(); }));
  main.querySelectorAll("[data-prof]").forEach((b) => (b.onclick = () => nav("profile", b.dataset.prof)));
  $("#wPrev")?.addEventListener("click", () => { rankWeek = shiftWeek(rankWeek, -1); renderRanking(); });
  $("#wNext")?.addEventListener("click", () => { rankWeek = shiftWeek(rankWeek, 1); renderRanking(); });
}

// ------------------------------------------------------------
//  Profil & Statistiken
// ------------------------------------------------------------
function renderProfile(pid) {
  const p = store.get("players", pid || myId());
  if (!p) return nav("home");
  const own = p.id === myId();
  const s = stats(p.id);
  const G = GENERATIONS.find((g) => g.id === p.generation);
  const box = (v, l) => `<div class="card center" style="margin:0;padding:12px"><div style="font-size:1.3rem;font-weight:800" class="gold">${v}</div><div class="small muted">${l}</div></div>`;
  const recent = store.all("rounds").filter((r) => r.playerId === p.id && r.finished).sort((a, b) => b.date - a.date).slice(0, 8);
  main.innerHTML = `
    <div class="card center">${avatarHTML(p.avatar, "lg")}<h2 class="title-font" style="margin:8px 0 2px">${esc(p.name)}</h2>
      <div class="muted small">${G?.icon || ""} ${G?.label || ""} ${isOnline(p) ? '· <span class="dot-online"></span> online' : ""}</div>
      ${own ? `<div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm" id="editP">✏️ Bearbeiten</button><button class="btn sm" id="notif">🔔 Benachrichtigungen</button></div>` : `<button class="btn sm gold" id="challenge" style="margin-top:10px">⚔️ Zum Duell fordern</button>`}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      ${box(s.rounds, "Runden")}${box(s.bestLevel + "/15", "Beste Stufe")}${box(euro(s.total), "Gesamtgewinn")}
      ${box(s.hitRate + " %", "Trefferquote")}${box(s.fav ? CATEGORIES[s.fav]?.icon || "–" : "–", s.fav ? CATEGORIES[s.fav].label : "Lieblingskategorie")}${box(fmtDuration(s.avgTime), "Ø Antwortzeit")}
    </div>
    <div class="card"><b>⚔️ Duell-Bilanz:</b> ${s.duelWins} Siege · ${s.duelLosses} Niederlagen${s.duelDraws ? ` · ${s.duelDraws} Unentschieden` : ""}</div>
    <div class="card"><h3>Abzeichen</h3><div class="badges">
      ${Object.entries(BADGES).map(([k, b]) => `<div class="badge ${p.badges?.[k] ? "" : "locked"}" title="${esc(b.desc)}"><span class="bi">${b.icon}</span>${esc(b.name)}</div>`).join("")}
    </div></div>
    <div class="card"><h3>Letzte Runden</h3>${recent.length ? recent.map((r) => `<div class="list-item"><span class="small muted" style="width:80px">${fmtDate(r.date)}</span><span class="grow small">${r.duelId ? "⚔️ Duell · " : ""}Stufe ${r.level} · ${fmtDuration(r.duration)}</span><b class="gold">${euro(r.amount)}</b></div>`).join("") : `<p class="muted">Noch keine Runden.</p>`}</div>`;
  $("#editP")?.addEventListener("click", () => renderProfileEditor(p));
  $("#challenge")?.addEventListener("click", () => challenge(p.id));
  $("#notif")?.addEventListener("click", async () => {
    if (!("Notification" in window)) return toast("Dein Browser unterstützt keine Benachrichtigungen.");
    const r = await Notification.requestPermission();
    toast(r === "granted" ? "Benachrichtigungen sind an!" : "Benachrichtigungen wurden nicht erlaubt.");
  });
}

// ------------------------------------------------------------
//  Duelle
// ------------------------------------------------------------
async function challenge(oppId) {
  if (!(await confirmDialog(`${esc(playerName(oppId))} zum Duell herausfordern?`, "Herausfordern", "Abbrechen"))) return;
  try {
    const id = await createDuel(oppId);
    toast("Herausforderung verschickt – du spielst jetzt zuerst!");
    nav("duelplay", id);
  } catch (e) { toast(e.message); }
}

function renderDuels() {
  const pid = myId();
  const ds = store.all("duels").filter((d) => d.challenger === pid || d.opponent === pid).sort((a, b) => b.createdAt - a.createdAt);
  const res = (d, id) => d.results?.[id];
  const line = (d) => {
    const opp = d.challenger === pid ? d.opponent : d.challenger;
    const o = store.get("players", opp);
    const mine = res(d, pid), theirs = res(d, opp);
    let status = "", action = "";
    if (d.status === "declined") status = "abgelehnt";
    else if (d.status === "done") {
      status = !d.winner ? "🤝 Unentschieden" : d.winner === pid ? "🏆 Gewonnen!" : "Verloren";
      status += ` · ${mine.level} : ${theirs.level}`;
    } else if (!mine?.done) {
      status = d.opponent === pid && !mine ? `<b class="gold">fordert dich heraus!</b>` : "Du bist dran";
      action = `<button class="btn sm gold" data-play="${d.id}">Spielen</button>` + (d.opponent === pid && !mine ? `<button class="btn sm" data-decline="${d.id}">✕</button>` : "");
    } else status = theirs && !theirs.done ? `${esc(o?.name)} spielt gerade (Frage ${theirs.current})` : `Warte auf ${esc(o?.name)} …`;
    return `<div class="list-item">${avatarHTML(o?.avatar, "sm")}<div class="grow"><b>${esc(o?.name || "?")}</b>${isOnline(o) ? ' <span class="dot-online"></span>' : ""}<div class="small muted">${status} · ${fmtDate(d.createdAt)}</div></div>${action}</div>`;
  };
  const others = players().filter((p) => p.id !== pid);
  main.innerHTML = `<h2 class="title-font">⚔️ Duelle</h2>
    <div class="card"><h3>Herausfordern</h3>
      ${others.length ? others.map((p) => `<div class="list-item">${avatarHTML(p.avatar, "sm")}<b class="grow">${esc(p.name)} ${isOnline(p) ? '<span class="dot-online"></span>' : ""}</b><button class="btn sm" data-ch="${p.id}">⚔️ Fordern</button></div>`).join("") : `<p class="muted">Noch keine anderen Spieler angemeldet.</p>`}
      <p class="small muted">Beide bekommen dieselben 15 Fragen. Wer weiter kommt, gewinnt – bei Gleichstand der Schnellere. Ist dein Gegner online, seht ihr den Fortschritt live.</p>
    </div>
    <div class="card"><h3>Meine Duelle</h3>${ds.length ? ds.map(line).join("") : `<p class="muted">Noch keine Duelle.</p>`}</div>`;
  main.querySelectorAll("[data-ch]").forEach((b) => (b.onclick = () => challenge(b.dataset.ch)));
  main.querySelectorAll("[data-play]").forEach((b) => (b.onclick = () => nav("duelplay", b.dataset.play)));
  main.querySelectorAll("[data-decline]").forEach((b) => (b.onclick = async () => {
    await store.update("duels", b.dataset.decline, { status: "declined" });
    renderDuels();
  }));
}

// ------------------------------------------------------------
//  Frage einreichen
// ------------------------------------------------------------
function renderSubmit() {
  const p = me();
  let image = null;
  const mine = store.all("questions").filter((q) => q.submittedBy === p.id).sort((a, b) => b.createdAt - a.createdAt);
  const stLabel = { pending: "⏳ in Prüfung", approved: "✅ freigegeben", rejected: "✕ abgelehnt" };
  main.innerHTML = `<h2 class="title-font">✍️ Frage einreichen</h2>
    <div class="card">
      <label class="field"><span>Art der Frage</span><div class="seg" id="cat">${Object.entries(CATEGORIES).map(([k, c], i) => `<button data-c="${k}" class="${i === 0 ? "active" : ""}">${c.icon}<br>${c.label}</button>`).join("")}</div></label>
      <div id="imgBox" class="hidden" style="margin-bottom:12px"><button class="btn block sm" id="imgBtn">📷 Foto auswählen</button><div id="imgPrev" class="center" style="margin-top:8px"></div></div>
      <label class="field"><span>Frage</span><textarea id="qText" placeholder="z. B. Wo hat Opa Oma kennengelernt?"></textarea></label>
      <span class="small muted">Antworten – tippe den Kreis bei der richtigen an</span>
      <div class="ans-edit" style="margin:6px 0 12px">${["A", "B", "C", "D"].map((l, i) => `<input type="radio" name="corr" value="${i}" ${i === 0 ? "checked" : ""}><input type="text" class="qa" placeholder="Antwort ${l}">`).join("")}</div>
      <label class="field"><span>Wie schwer ist die Frage?</span><div class="seg" id="diff"><button data-d="3" class="active">Leicht</button><button data-d="8">Mittel</button><button data-d="13">Schwer</button></div></label>
      <label class="field"><span>Erklärung nach der Auflösung (optional)</span><input type="text" id="qExpl" placeholder="z. B. Beim Tanzen im Sommer 1968!"></label>
      <button class="btn gold block" id="sendQ">Frage einreichen</button>
      <p class="small muted">Die Frage wird erst geprüft und kommt dann in einen der nächsten Wochenpools. Dir selbst wird sie nicht gestellt.</p>
    </div>
    <div class="card"><h3>Meine eingereichten Fragen</h3>${mine.length ? mine.map((q) => `<div class="list-item"><span class="grow small">${esc(q.text)}</span><span class="small">${stLabel[q.status] || ""}</span></div>`).join("") : `<p class="muted">Noch keine.</p>`}</div>`;
  let cat = "allgemein", diff = 3;
  main.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => {
    cat = b.dataset.c;
    main.querySelectorAll("[data-c]").forEach((x) => x.classList.toggle("active", x === b));
    $("#imgBox").classList.toggle("hidden", cat !== "foto");
  }));
  main.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => {
    diff = +b.dataset.d;
    main.querySelectorAll("[data-d]").forEach((x) => x.classList.toggle("active", x === b));
  }));
  $("#imgBtn").onclick = async () => {
    const f = await pickFile("image/*");
    if (!f) return;
    image = await compressImage(f, 1400, 0.85);
    $("#imgPrev").innerHTML = `<img class="thumb" src="${URL.createObjectURL(image)}">`;
  };
  $("#sendQ").onclick = async () => {
    const text = $("#qText").value.trim();
    const answers = [...main.querySelectorAll(".qa")].map((i) => i.value.trim());
    if (!text || answers.some((a) => !a)) return toast("Bitte Frage und alle vier Antworten ausfüllen.");
    if (cat === "foto" && !image) return toast("Bei einer Fotofrage bitte ein Foto auswählen.");
    $("#sendQ").disabled = true;
    try {
      const url = image ? await store.upload(image, "questions") : null;
      const id = uid("q");
      await store.set("questions", id, {
        text, answers, correct: +main.querySelector("[name=corr]:checked").value, category: cat, level: diff,
        explanation: $("#qExpl").value.trim(), image: url, status: "pending",
        submittedBy: p.id, submittedByName: p.name, createdAt: Date.now(),
      });
      opaSay(null, { text: "Danke für deine Frage! Ich bin gespannt, wer die richtig hat." });
      renderSubmit();
    } catch (e) {
      toast("Fehler: " + e.message);
      $("#sendQ").disabled = false;
    }
  };
}

// ------------------------------------------------------------
//  Urkunden
// ------------------------------------------------------------
function renderCerts() {
  const weeks = store.all("weeks").sort((a, b) => b.id.localeCompare(a.id));
  const millions = store.all("rounds").filter((r) => r.finished && r.level === 15 && !r.duelId).sort((a, b) => b.date - a.date);
  main.innerHTML = `<h2 class="title-font">📜 Urkunden</h2>
    <div class="card"><h3>Wochensieger</h3>${weeks.length ? weeks.map((w) => `<div class="list-item" data-w="${w.id}" style="cursor:pointer">${avatarHTML(w.winner.avatar, "sm")}<div class="grow"><b>${esc(w.winner.name)}</b><div class="small muted">${weekLabel(w.id)}</div></div><b class="gold">${euro(w.winner.amount)}</b><span>📜</span></div>`).join("") : `<p class="muted">Die erste Urkunde gibt's, sobald eine Woche vorbei ist (Montag 0 Uhr).</p>`}</div>
    <div class="card"><h3>Millionäre 💰</h3>${millions.length ? millions.map((r) => { const p = store.get("players", r.playerId); return `<div class="list-item" data-m="${r.id}" style="cursor:pointer">${avatarHTML(p?.avatar, "sm")}<div class="grow"><b>${esc(p?.name)}</b><div class="small muted">${fmtDate(r.date)}</div></div><span>📜</span></div>`; }).join("") : `<p class="muted">Noch niemand – wer wird der erste?</p>`}</div>`;
  main.querySelectorAll("[data-w]").forEach((el) => (el.onclick = () => {
    const w = store.get("weeks", el.dataset.w);
    certificateDialog({ kind: "week", ...w.winner, week: w.id, date: fmtDate(w.closedAt) });
  }));
  main.querySelectorAll("[data-m]").forEach((el) => (el.onclick = () => {
    const r = store.get("rounds", el.dataset.m);
    const p = store.get("players", r.playerId);
    certificateDialog({ kind: "million", name: p.name, avatar: p.avatar, amount: r.amount, prize: r.prize, date: fmtDate(r.date) });
  }));
}

// ------------------------------------------------------------
//  Echtzeit: Anwesenheit, Publikumsjoker, Duell-Einladungen, Mitteilungen
// ------------------------------------------------------------
function heartbeat() {
  const id = myId();
  if (id && store.get("players", id)) store.update("players", id, { lastSeen: Date.now(), playing });
}

function notify(text) {
  if (!document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
  navigator.serviceWorker?.getRegistration().then((reg) => {
    if (reg) reg.showNotification(APP_TITLE, { body: text, icon: "icons/icon-192.png" });
    else new Notification(APP_TITLE, { body: text });
  }).catch(() => {});
}

const shownPolls = new Set();
const shownDuels = new Set();
function watchers() {
  const startTs = Date.now();
  store.on((col, id) => {
    const pid = myId();
    if (!pid) return;
    if (col === "polls") {
      const p = store.get("polls", id);
      if (!p || p.askerId === pid || p.closed || p.expiresAt < Date.now() || p.votes?.[pid] != null || shownPolls.has(id) || playing) return;
      shownPolls.add(id);
      votePoll(p);
    }
    if (col === "duels") {
      const d = store.get("duels", id);
      if (d && d.opponent === pid && d.status === "open" && !shownDuels.has(id) && d.createdAt > startTs && !playing) {
        shownDuels.add(id);
        notify(`${playerName(d.challenger)} fordert dich zum Duell heraus!`);
        confirmDialog(`⚔️ ${esc(playerName(d.challenger))} fordert dich zum Duell heraus! Jetzt live mitspielen?`, "Los geht's!", "Später").then((ok) => ok && nav("duelplay", id));
      }
    }
    if (col === "announcements") {
      const a = store.get("announcements", id);
      const seen = +localStorage.getItem("opa-ann") || startTs;
      if (a && a.ts > seen && a.by !== pid) {
        localStorage.setItem("opa-ann", a.ts);
        toast(a.text, 6000);
        notify(a.text);
        if (a.type === "million") play("fanfare");
      }
    }
    if ((col === "players" || col === "rounds" || col === "duels" || col === "weeks") && !playing && !document.querySelector(".modal-bg, .ovl, .tut-box")) {
      // Live-Aktualisierung der Listen
      if (["home", "ranking", "duels"].includes(route)) rerenderSoon();
    }
  });
}

let rr = null;
function rerenderSoon() {
  clearTimeout(rr);
  rr = setTimeout(() => {
    if (playing || document.querySelector(".modal-bg, .ovl, .tut-box") || document.activeElement?.matches("input,textarea")) return;
    if (route === "home") renderHome();
    else if (route === "ranking") renderRanking();
    else if (route === "duels") renderDuels();
  }, 600);
}

async function votePoll(p) {
  notify(`${p.askerName} braucht deine Hilfe beim Publikumsjoker!`);
  play("joker");
  const L = ["A", "B", "C", "D"];
  const v = await modal(`<h2 class="title-font center">👥 Publikumsjoker!</h2>
    <p class="center"><b>${esc(p.askerName)}</b> braucht deine Hilfe bei Frage ${p.level}:</p>
    <div class="question" style="font-size:1rem;margin-bottom:12px">${esc(p.text)}</div>
    <div class="vote-btns">${p.answers.map((a, i) => (a == null ? "" : `<button class="answer" data-v="${i}"><span class="l">${L[i]}:</span>${esc(a)}</button>`)).join("")}</div>
    <p class="center small muted" id="vLeft"></p>`, [{ label: "Weiß ich nicht", value: null }], {
    onMount: (el, close) => {
      el.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => close(+b.dataset.v)));
      const iv = setInterval(() => {
        const left = Math.ceil((p.expiresAt - Date.now()) / 1000);
        const cur = store.get("polls", p.id);
        if (left <= 0 || cur?.closed) { clearInterval(iv); close(undefined); }
        else el.querySelector("#vLeft").textContent = `noch ${left} Sekunden`;
      }, 500);
    },
  });
  if (v != null) {
    await store.update("polls", p.id, { votes: { [myId()]: v } });
    toast("Danke für deine Stimme!");
  }
}

// ------------------------------------------------------------
//  Start
// ------------------------------------------------------------
async function start() {
  if (!me()) return renderWho();
  shell();
  heartbeat();
  setInterval(heartbeat, 20000);
  await closePastWeeks().catch(console.error);
  await ensurePool().catch(console.error);
  await checkLeaderBadges().catch(console.error);
  renderHome();
  if (!localStorage.getItem("opa-tutorial-done")) {
    await runTutorial({ root: main, renderHome });
  } else {
    opaSay("greeting");
  }
  const p = me();
  const unseen = Object.keys(p.badges || {}).filter((k) => !(p.seenBadges || []).includes(k));
  if (unseen.length) {
    await showBadges(unseen);
    await store.update("players", p.id, { seenBadges: Object.keys(p.badges || {}) });
  }
}

let watching = false;
async function boot() {
  try {
    await store.init();
  } catch (e) {
    app.innerHTML = `<main class="screen"><div class="card"><h2>Verbindung fehlgeschlagen</h2><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Nochmal versuchen</button></div></main>`;
    return;
  }
  if (store.needsJoin()) return renderJoin();
  await bootstrapData();
  ensureWatchers();
  start();
}

function ensureWatchers() {
  if (!watching) { watching = true; watchers(); }
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
document.addEventListener("visibilitychange", () => !document.hidden && heartbeat());
boot();
