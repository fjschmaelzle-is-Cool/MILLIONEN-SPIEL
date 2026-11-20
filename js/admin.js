// Admin-Bereich (PIN-geschützt)

import { store } from "./store.js";
import { DEFAULT_ADMIN_PIN, DEMO_FAMILY_CODE } from "./config.js";
import { settings, players, buildPool, ensurePool, checkLeaderBadges, playerName } from "./logic.js";
import { CATEGORIES, GENERATIONS, OPA_MOMENTS, BADGES } from "./data.js";
import { $, esc, euro, sha, weekId, shiftWeek, weekLabel, compressImage, pickFile, uid } from "./util.js";
import { toast, modal, confirmDialog, avatarHTML } from "./ui.js";
import { playVoice } from "./audio.js";

let root, nav;
let tab = "questions";
let filter = { level: "", cat: "", q: "" };

export async function renderAdmin(r, n) {
  root = r; nav = n;
  if (sessionStorage.getItem("opa-admin") !== "1") {
    const ok = await askPin();
    if (!ok) return nav("home");
    sessionStorage.setItem("opa-admin", "1");
  }
  render();
}

async function askPin() {
  const pin = await modal(`<h2 class="title-font center">🔐 Admin-Bereich</h2><label class="field"><span>PIN</span><input type="password" inputmode="numeric" id="pin" autocomplete="off"></label>`,
    [{ label: "Abbrechen", value: null }, { label: "Öffnen", cls: "gold", value: "go" }], {
      onMount: (el, close) => {
        const i = el.querySelector("#pin");
        setTimeout(() => i.focus(), 50);
        i.onkeydown = (e) => e.key === "Enter" && close("go");
        el._pin = i;
      },
    });
  if (!pin) return false;
  const val = document.getElementById("pin")?.value ?? lastPin;
  return check(val);
}
let lastPin = "";
document.addEventListener("input", (e) => { if (e.target.id === "pin") lastPin = e.target.value; });

async function check(val) {
  const s = settings();
  const ok = s.adminPinHash ? (await sha("opa:" + val)) === s.adminPinHash : val === DEFAULT_ADMIN_PIN;
  if (!ok) toast("Falsche PIN.");
  return ok;
}

const TABS = [
  ["questions", "📚 Fragen"], ["review", "📥 Prüfliste"], ["plan", "🗓️ Wochenplan"], ["ladder", "🪜 Gewinnleiter"],
  ["times", "⏱️ Zeiten & Regeln"], ["opa", "👴 Opa"], ["players", "👥 Spieler"], ["system", "⚙️ System"],
];

function render() {
  const pending = store.all("questions").filter((q) => q.status === "pending").length;
  root.className = "screen";
  root.innerHTML = `<h2 class="title-font">🔐 Admin-Bereich</h2>
    <div class="tabs">${TABS.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "active" : ""}">${l}${k === "review" && pending ? ` (${pending})` : ""}</button>`).join("")}</div>
    <div id="admBody"></div>`;
  root.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); }));
  ({ questions, review, plan, ladder: ladderTab, times, opa, players: playersTab, system })[tab]($("#admBody"));
}

// ------------------------------------------------------------
//  Fragen
// ------------------------------------------------------------
function upcomingWeeks(n = 10) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(shiftWeek(weekId(), i));
  return out;
}

function qCard(q) {
  const cat = CATEGORIES[q.category] || CATEGORIES.allgemein;
  return `<div class="adm-q" data-edit="${q.id}" style="cursor:pointer">
    <div class="row"><span class="lvl-chip">${q.level}</span><b class="grow">${esc(q.text)}</b>${q.image ? "🖼️" : ""}</div>
    <div class="meta">${cat.icon} ${cat.label} · richtig: ${esc(q.answers[q.correct])}${q.submittedByName ? ` · von ${esc(q.submittedByName)}` : ""}${q.plannedWeek ? ` · 📌 ${weekLabel(q.plannedWeek)}` : ""}${q.status === "rejected" ? " · ✕ abgelehnt" : ""}</div></div>`;
}

function questions(el) {
  const all = store.all("questions").filter((q) => q.status !== "pending");
  const list = all
    .filter((q) => (!filter.level || q.level === +filter.level) && (!filter.cat || q.category === filter.cat) && (!filter.q || q.text.toLowerCase().includes(filter.q.toLowerCase())))
    .sort((a, b) => a.level - b.level || (a.createdAt || 0) - (b.createdAt || 0));
  el.innerHTML = `<button class="btn gold block" id="newQ" style="margin-bottom:12px">➕ Neue Frage anlegen</button>
    <div class="row" style="margin-bottom:10px">
      <select id="fL"><option value="">Alle Stufen</option>${Array.from({ length: 15 }, (_, i) => `<option ${filter.level == i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select>
      <select id="fC"><option value="">Alle Arten</option>${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${filter.cat === k ? "selected" : ""}>${c.label}</option>`).join("")}</select>
    </div>
    <input type="text" id="fQ" placeholder="🔍 Suchen …" value="${esc(filter.q)}" style="margin-bottom:10px">
    <p class="small muted">${list.length} von ${all.length} Fragen</p>
    ${list.map(qCard).join("")}`;
  $("#newQ").onclick = () => editQuestion({ level: +filter.level || 1, category: filter.cat || "allgemein", answers: ["", "", "", ""], correct: 0, status: "approved" });
  $("#fL").onchange = (e) => { filter.level = e.target.value; questions(el); };
  $("#fC").onchange = (e) => { filter.cat = e.target.value; questions(el); };
  $("#fQ").oninput = (e) => { filter.q = e.target.value; clearTimeout(el._t); el._t = setTimeout(() => { questions(el); $("#fQ").focus(); $("#fQ").setSelectionRange(99, 99); }, 400); };
  el.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => editQuestion(store.get("questions", b.dataset.edit))));
}

function editQuestion(q, { review = false } = {}) {
  q = JSON.parse(JSON.stringify(q));
  let image = q.image || null;
  const el = $("#admBody");
  el.innerHTML = `<div class="card">
    <h3>${q.id ? (review ? "Eingereichte Frage prüfen" : "Frage bearbeiten") : "Neue Frage"}</h3>
    ${q.submittedByName ? `<p class="small muted">✍️ Eingereicht von <b>${esc(q.submittedByName)}</b>${q.submittedBy ? "" : " (Vorlage – bitte mit echten Antworten füllen)"}</p>` : ""}
    <div class="row">
      <label class="field grow"><span>Schwierigkeitsstufe</span><select id="eL">${Array.from({ length: 15 }, (_, i) => `<option value="${i + 1}" ${q.level === i + 1 ? "selected" : ""}>${i + 1} – ${euro(settings().ladder[i].amount)}</option>`).join("")}</select></label>
      <label class="field grow"><span>Art</span><select id="eC">${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${q.category === k ? "selected" : ""}>${c.icon} ${c.label}</option>`).join("")}</select></label>
    </div>
    <label class="field"><span>Frage</span><textarea id="eT">${esc(q.text || "")}</textarea></label>
    <span class="small muted">Antworten (Kreis = richtige Antwort)</span>
    <div class="ans-edit" style="margin:6px 0 12px">${[0, 1, 2, 3].map((i) => `<input type="radio" name="eCorr" value="${i}" ${q.correct === i ? "checked" : ""}><input type="text" class="eA" value="${esc(q.answers[i] || "")}" placeholder="Antwort ${"ABCD"[i]}">`).join("")}</div>
    <label class="field"><span>Erklärung nach der Auflösung (optional)</span><input type="text" id="eX" value="${esc(q.explanation || "")}"></label>
    <div class="field"><span class="small muted">Bild (optional, bei Fotofragen empfohlen)</span>
      <div id="eImg" style="margin:6px 0">${image ? `<img class="thumb" src="${esc(image)}">` : ""}</div>
      <div class="row"><button class="btn sm" id="eImgBtn">📷 Bild wählen</button>${image ? `<button class="btn sm" id="eImgDel">Bild entfernen</button>` : ""}</div></div>
    <label class="field"><span>Für eine bestimmte Woche einplanen (optional)</span><select id="eW"><option value="">– automatisch –</option>${upcomingWeeks().map((w) => `<option value="${w}" ${q.plannedWeek === w ? "selected" : ""}>${weekLabel(w)}</option>`).join("")}</select></label>
    <div class="row wrap">
      ${review ? `<button class="btn green grow" id="eApprove">✅ Freigeben</button><button class="btn red grow" id="eReject">✕ Ablehnen</button>` : `<button class="btn gold grow" id="eSave">💾 Speichern</button>`}
      ${q.id && !review ? `<button class="btn red" id="eDel">🗑️</button>` : ""}
      <button class="btn ghost grow" id="eBack">Zurück</button>
    </div></div>`;
  $("#eImgBtn").onclick = async () => {
    const f = await pickFile("image/*");
    if (!f) return;
    toast("Bild wird hochgeladen …");
    image = await store.upload(await compressImage(f, 1400, 0.85), "questions");
    $("#eImg").innerHTML = `<img class="thumb" src="${esc(image)}">`;
  };
  $("#eImgDel")?.addEventListener("click", () => { image = null; $("#eImg").innerHTML = ""; });
  const collect = () => {
    const data = {
      ...q,
      level: +$("#eL").value, category: $("#eC").value, text: $("#eT").value.trim(),
      answers: [...el.querySelectorAll(".eA")].map((i) => i.value.trim()),
      correct: +el.querySelector("[name=eCorr]:checked").value,
      explanation: $("#eX").value.trim(), image, plannedWeek: $("#eW").value || null,
    };
    if (!data.text || data.answers.some((a) => !a)) { toast("Bitte Frage und alle vier Antworten ausfüllen."); return null; }
    if (data.answers.some((a) => /bitte anpassen/i.test(a))) { toast("Bitte die Platzhalter-Antworten ersetzen."); return null; }
    return data;
  };
  const save = async (status) => {
    const d = collect();
    if (!d) return;
    const id = q.id || uid("q");
    await store.set("questions", id, { ...d, status, createdAt: q.createdAt || Date.now(), reviewedAt: Date.now() });
    if (status === "approved" && q.submittedBy) await checkLeaderBadges();
    toast(status === "approved" ? "Gespeichert ✅" : "Abgelehnt");
    render();
  };
  $("#eSave")?.addEventListener("click", () => save(q.status === "rejected" ? "approved" : q.status || "approved"));
  $("#eApprove")?.addEventListener("click", () => save("approved"));
  $("#eReject")?.addEventListener("click", async () => {
    await store.update("questions", q.id, { status: "rejected", reviewedAt: Date.now() });
    toast("Abgelehnt");
    render();
  });
  $("#eDel")?.addEventListener("click", async () => {
    if (!(await confirmDialog("Diese Frage endgültig löschen?", "Löschen", "Abbrechen"))) return;
    await store.remove("questions", q.id);
    render();
  });
  $("#eBack").onclick = render;
  window.scrollTo(0, 0);
}

function review(el) {
  const list = store.all("questions").filter((q) => q.status === "pending").sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  el.innerHTML = list.length
    ? `<p class="small muted">Tippe eine Frage an, um sie zu prüfen, zu bearbeiten, einer Stufe zuzuordnen und freizugeben.</p>${list.map(qCard).join("")}`
    : `<div class="card center muted">Keine Fragen in der Prüfliste. 🎉</div>`;
  el.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => editQuestion(store.get("questions", b.dataset.edit), { review: true })));
}

// ------------------------------------------------------------
//  Wochenplan
// ------------------------------------------------------------
function plan(el) {
  const approved = store.all("questions").filter((q) => q.status === "approved");
  const used = new Set(store.all("pools").flatMap((p) => (p.levels || []).map((l) => l.primary)));
  const weeks = upcomingWeeks(6);
  const cur = store.get("pools", weekId());
  const rows = weeks.map((w, wi) => {
    const pool = store.get("pools", w) || buildPool(w);
    const chips = pool.levels.map((l) => {
      const q = store.get("questions", l.primary);
      const avail = approved.filter((x) => x.level === l.level && (!x.plannedWeek || x.plannedWeek === w));
      const fresh = avail.filter((x) => !used.has(x.id)).length;
      const cls = !q ? "bad" : q.plannedWeek === w || fresh >= wi + 1 || store.get("pools", w) ? "ok" : "warn";
      return `<span class="lvl-chip ${cls}" title="Stufe ${l.level}: ${q ? esc(q.text) : "keine Frage!"}">${l.level}</span>`;
    }).join("");
    const fam = pool.levels.filter((l) => ["familie", "foto"].includes(store.get("questions", l.primary)?.category)).length;
    return `<div style="margin-bottom:12px"><div class="row small"><b class="grow">${weekLabel(w)}${wi === 0 ? " (aktuell)" : ""}</b><span class="muted">👨‍👩‍👧 ${fam} Familien-/Fotofragen</span></div><div class="cover-grid" style="margin-top:4px">${chips}</div></div>`;
  }).join("");
  const perLevel = Array.from({ length: 15 }, (_, i) => {
    const a = approved.filter((q) => q.level === i + 1);
    const fresh = a.filter((q) => !used.has(q.id)).length;
    return `<tr><td><span class="lvl-chip">${i + 1}</span></td><td>${a.length}</td><td class="${fresh ? "" : "gold"}">${fresh}${fresh ? "" : " ⚠️"}</td><td>${a.filter((q) => q.category !== "allgemein").length}</td></tr>`;
  }).join("");
  el.innerHTML = `<div class="card"><h3>Abdeckung der nächsten Wochen</h3>
      <p class="small muted">Grün = Frage vorhanden (bzw. noch unbenutzt), Orange = Frage wird wiederholt, Rot = keine Frage für diese Stufe. Jeden Montag 0 Uhr wird der Pool automatisch festgelegt; zukünftige Wochen sind eine Vorschau.</p>
      ${rows}</div>
    <div class="card"><h3>Fragen pro Stufe</h3><table class="simple"><tr><th>Stufe</th><th>Freigegeben</th><th>Noch unbenutzt</th><th>Familie/Foto</th></tr>${perLevel}</table></div>
    <div class="card"><h3>Pool dieser Woche</h3>
      ${cur ? cur.levels.map((l) => { const q = store.get("questions", l.primary); return `<div class="small list-item"><span class="lvl-chip">${l.level}</span><span class="grow">${q ? esc(q.text) : "—"}</span></div>`; }).join("") : "<p class='muted'>Noch nicht erstellt.</p>"}
      <button class="btn sm" id="rebuild" style="margin-top:10px">🔄 Pool dieser Woche neu erstellen</button>
      <p class="small muted">Achtung: Nur sinnvoll, wenn noch niemand gespielt hat – sonst bekommen nicht mehr alle dieselben Fragen.</p></div>`;
  $("#rebuild").onclick = async () => {
    const played = store.all("rounds").some((r) => r.week === weekId() && !r.duelId);
    if (!(await confirmDialog(played ? "Es wurde diese Woche schon gespielt! Trotzdem neu erstellen?" : "Pool dieser Woche neu erstellen?", "Neu erstellen", "Abbrechen"))) return;
    await store.remove("pools", weekId());
    await ensurePool();
    toast("Neuer Pool erstellt.");
    plan(el);
  };
}

// ------------------------------------------------------------
//  Gewinnleiter
// ------------------------------------------------------------
function ladderTab(el) {
  const lad = settings().ladder;
  el.innerHTML = `<div class="card"><p class="small muted">Beträge, echte Preise und Sicherheitsstufen (🛡️) frei einstellen.</p>
    ${lad.map((s, i) => `<div class="row" style="margin-bottom:8px;align-items:flex-start">
      <span class="lvl-chip" style="margin-top:12px">${i + 1}</span>
      <div class="grow"><div class="row"><input type="number" class="lA" value="${s.amount}" min="0" style="max-width:130px"><label class="row small" style="gap:4px"><input type="checkbox" class="lS" ${s.safe ? "checked" : ""}>🛡️ Sicherheit</label></div>
      <input type="text" class="lP" value="${esc(s.prize)}" placeholder="Echter Preis (leer = keiner)" style="margin-top:4px"></div></div>`).join("")}
    <button class="btn gold block" id="saveL">💾 Gewinnleiter speichern</button></div>`;
  $("#saveL").onclick = async () => {
    const A = [...el.querySelectorAll(".lA")], S = [...el.querySelectorAll(".lS")], P = [...el.querySelectorAll(".lP")];
    const ladder = A.map((a, i) => ({ amount: Math.max(0, +a.value || 0), safe: S[i].checked, prize: P[i].value.trim() }));
    await store.update("settings", "main", { ladder });
    toast("Gewinnleiter gespeichert ✅");
  };
}

// ------------------------------------------------------------
//  Zeiten & Regeln
// ------------------------------------------------------------
function times(el) {
  const s = settings();
  el.innerHTML = `<div class="card"><h3>Zeitlimit pro Frage (Sekunden)</h3>
      <p class="small muted">Vorgabe: Fragen 1–5: 20–30 s · 6–10: 1–3 min · 11–15: 5–10 min</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${s.times.map((t, i) => `<label class="small"><span class="lvl-chip">${i + 1}</span> <input type="number" class="tT" min="5" value="${t}"></label>`).join("")}</div></div>
    <div class="card"><h3>Regeln</h3>
      <label class="field"><span>Erlaubte Runden pro Woche und Spieler (0 = unbegrenzt)</span><input type="number" id="att" min="0" value="${s.attemptsPerWeek || 0}"></label>
      <label class="field"><span>Abstimmungszeit Publikumsjoker (Sekunden)</span><input type="number" id="poll" min="15" value="${s.pollSeconds || 60}"></label>
    </div>
    <button class="btn gold block" id="saveT">💾 Speichern</button>`;
  $("#saveT").onclick = async () => {
    await store.update("settings", "main", {
      times: [...el.querySelectorAll(".tT")].map((i) => Math.max(5, +i.value || 30)),
      attemptsPerWeek: Math.max(0, +$("#att").value || 0),
      pollSeconds: Math.max(15, +$("#poll").value || 60),
    });
    toast("Gespeichert ✅");
  };
}

// ------------------------------------------------------------
//  Opa: Foto, Name, Sprüche, Sprachaufnahmen
// ------------------------------------------------------------
let recorder = null;
function opa(el) {
  const o = settings().opa;
  el.innerHTML = `<div class="card">
      <div class="center"><img src="${esc(o.photo)}" style="width:110px;height:110px;border-radius:50%;border:3px solid var(--gold);object-fit:cover"><br>
      <button class="btn sm" id="oPhoto" style="margin-top:8px">📷 Foto ändern</button></div>
      <label class="field"><span>Name (z. B. Opa, Opa Heinz)</span><input type="text" id="oName" value="${esc(o.name)}"></label>
      <label class="field"><span>Handynummer für den Opa-Joker (mit Ländervorwahl, z. B. +49 171 1234567)</span><input type="tel" id="oPhone" value="${esc(o.phone)}"></label>
      <label class="field"><span>„Unterschrift“ auf Urkunden</span><input type="text" id="oSig" value="${esc(o.signature)}"></label>
      <label class="field"><span>Spruch auf den Urkunden</span><input type="text" id="oCert" value="${esc(o.certSaying)}"></label>
    </div>
    <div class="card"><h3>Sprüche & Sprachaufnahmen</h3>
      <p class="small muted">Pro Moment ein Spruch je Zeile (zufällige Auswahl). Ist eine Aufnahme hinterlegt, wird sie abgespielt.</p>
      ${Object.entries(OPA_MOMENTS).map(([k, label]) => `<div style="margin-bottom:14px">
        <b>${label}</b>
        <textarea class="oSay" data-k="${k}" style="min-height:60px;margin-top:4px">${esc((o.sayings?.[k] || []).join("\n"))}</textarea>
        <div class="row wrap" style="margin-top:4px">
          ${o.audio?.[k] ? `<button class="btn sm" data-play="${k}">▶️ Anhören</button><button class="btn sm" data-del="${k}">🗑️</button>` : `<span class="small muted">Keine Aufnahme</span>`}
          <button class="btn sm" data-up="${k}">📁 Datei</button>
          <button class="btn sm" data-rec="${k}">🎙️ Aufnehmen</button>
        </div></div>`).join("")}
    </div>
    <button class="btn gold block" id="saveO">💾 Speichern</button>`;
  let photo = o.photo;
  $("#oPhoto").onclick = async () => {
    const f = await pickFile("image/*");
    if (!f) return;
    toast("Foto wird hochgeladen …");
    photo = await store.upload(await compressImage(f, 600, 0.88), "opa");
    await store.update("settings", "main", { opa: { photo } });
    opa(el);
  };
  const setAudio = async (k, url) => {
    await store.update("settings", "main", { opa: { audio: { [k]: url } } });
    opa(el);
  };
  el.querySelectorAll("[data-play]").forEach((b) => (b.onclick = () => playVoice(o.audio[b.dataset.play])));
  el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => setAudio(b.dataset.del, null)));
  el.querySelectorAll("[data-up]").forEach((b) => (b.onclick = async () => {
    const f = await pickFile("audio/*");
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast("Die Datei ist zu groß (max. 8 MB).");
    toast("Aufnahme wird hochgeladen …");
    setAudio(b.dataset.up, await store.upload(f, "audio"));
  }));
  el.querySelectorAll("[data-rec]").forEach((b) => (b.onclick = async () => {
    if (recorder) { recorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recorder = null;
        const blob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" });
        toast("Aufnahme wird gespeichert …");
        setAudio(b.dataset.rec, await store.upload(blob, "audio"));
      };
      recorder.start();
      b.textContent = "⏹️ Stopp";
      b.classList.add("red");
    } catch { toast("Kein Zugriff aufs Mikrofon."); }
  }));
  $("#saveO").onclick = async () => {
    const sayings = {};
    el.querySelectorAll(".oSay").forEach((t) => (sayings[t.dataset.k] = t.value.split("\n").map((x) => x.trim()).filter(Boolean)));
    await store.update("settings", "main", {
      opa: { name: $("#oName").value.trim() || "Opa", phone: $("#oPhone").value.trim(), signature: $("#oSig").value.trim(), certSaying: $("#oCert").value.trim(), sayings },
    });
    toast("Gespeichert ✅");
  };
}

// ------------------------------------------------------------
//  Spieler
// ------------------------------------------------------------
function playersTab(el) {
  const ps = players();
  el.innerHTML = ps.length ? ps.map((p) => `<div class="card">
      <div class="row">${avatarHTML(p.avatar)}<input type="text" class="pN" data-id="${p.id}" value="${esc(p.name)}"></div>
      <div class="seg" style="margin-top:8px">${GENERATIONS.map((g) => `<button data-pg="${p.id}|${g.id}" class="${p.generation === g.id ? "active" : ""}">${g.icon} ${g.label}</button>`).join("")}</div>
      <div class="small muted" style="margin-top:6px">Abzeichen: ${Object.keys(p.badges || {}).map((k) => BADGES[k]?.icon).join(" ") || "–"} · Runden: ${store.all("rounds").filter((r) => r.playerId === p.id).length}</div>
      <div class="row wrap" style="margin-top:8px"><button class="btn sm" data-save="${p.id}">💾 Name speichern</button><button class="btn sm" data-rb="${p.id}">Abzeichen zurücksetzen</button><button class="btn sm red" data-pdel="${p.id}">Löschen</button></div>
    </div>`).join("") : `<div class="card muted center">Noch keine Spieler.</div>`;
  el.querySelectorAll("[data-pg]").forEach((b) => (b.onclick = async () => {
    const [id, g] = b.dataset.pg.split("|");
    await store.update("players", id, { generation: g });
    playersTab(el);
  }));
  el.querySelectorAll("[data-save]").forEach((b) => (b.onclick = async () => {
    const v = el.querySelector(`.pN[data-id="${b.dataset.save}"]`).value.trim();
    if (v) { await store.update("players", b.dataset.save, { name: v }); toast("Gespeichert ✅"); }
  }));
  el.querySelectorAll("[data-rb]").forEach((b) => (b.onclick = async () => {
    if (!(await confirmDialog("Alle Abzeichen dieses Spielers zurücksetzen?"))) return;
    const p = store.get("players", b.dataset.rb);
    await store.set("players", p.id, { ...p, badges: {}, seenBadges: [] });
    playersTab(el);
  }));
  el.querySelectorAll("[data-pdel]").forEach((b) => (b.onclick = async () => {
    const id = b.dataset.pdel;
    if (!(await confirmDialog(`${esc(playerName(id))} wirklich löschen? Die Runden bleiben gespeichert, erscheinen aber nicht mehr in den Ranglisten.`, "Löschen", "Abbrechen"))) return;
    await store.remove("players", id);
    playersTab(el);
  }));
}

// ------------------------------------------------------------
//  System
// ------------------------------------------------------------
function system(el) {
  const s = settings();
  el.innerHTML = `
    ${store.mode === "demo" ? `<div class="card"><h3>Familien-Code (Demo-Modus)</h3>
      <label class="field"><input type="text" id="fam" value="${esc(s.familyCode || DEMO_FAMILY_CODE)}"></label>
      <button class="btn sm" id="saveFam">Speichern</button></div>` :
      `<div class="card"><h3>Familien-Code</h3><p class="small">Im Cloud-Betrieb wird der Code in der Firebase-Konsole als Dokument <code>codes/&lt;CODE&gt;</code> angelegt (siehe ANLEITUNG.md).</p></div>`}
    <div class="card"><h3>Admin-PIN ändern</h3>
      <label class="field"><span>Neue PIN (mind. 4 Zeichen)</span><input type="password" id="newPin" inputmode="numeric"></label>
      <button class="btn sm" id="savePin">PIN speichern</button></div>
    <div class="card"><h3>Datensicherung</h3>
      <div class="row wrap"><button class="btn sm" id="exp">⬇️ Alles exportieren (JSON)</button><button class="btn sm" id="imp">⬆️ Fragen importieren</button></div>
      <p class="small muted">Beim Import werden Fragen aus einer exportierten Datei (oder einer Liste von Fragen) hinzugefügt bzw. aktualisiert.</p></div>
    <div class="card"><h3>Dieses Gerät</h3>
      <button class="btn sm" id="tut">Tutorial beim nächsten Start wieder zeigen</button>
      <button class="btn sm" id="lock" style="margin-left:6px">Admin abmelden</button></div>`;
  $("#saveFam")?.addEventListener("click", async () => {
    await store.update("settings", "main", { familyCode: $("#fam").value.trim().toUpperCase() });
    toast("Familien-Code gespeichert ✅");
  });
  $("#savePin").onclick = async () => {
    const v = $("#newPin").value.trim();
    if (v.length < 4) return toast("Die PIN muss mindestens 4 Zeichen haben.");
    await store.update("settings", "main", { adminPinHash: await sha("opa:" + v) });
    toast("PIN geändert ✅");
    $("#newPin").value = "";
  };
  $("#exp").onclick = () => {
    const data = {};
    for (const c of ["settings", "players", "rounds", "questions", "pools", "duels", "weeks"]) data[c] = store.all(c);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `opa-naer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  $("#imp").onclick = async () => {
    const f = await pickFile("application/json,.json");
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const qs = Array.isArray(data) ? data : data.questions || [];
      let n = 0;
      for (const q of qs) {
        if (!q.text || !Array.isArray(q.answers) || q.answers.length !== 4) continue;
        await store.set("questions", q.id || uid("q"), { status: "approved", category: "allgemein", correct: 0, level: 1, createdAt: Date.now(), ...q });
        n++;
      }
      toast(`${n} Fragen importiert ✅`);
    } catch (e) { toast("Import fehlgeschlagen: " + e.message); }
  };
  $("#tut").onclick = () => { localStorage.removeItem("opa-tutorial-done"); toast("Erledigt."); };
  $("#lock").onclick = () => { sessionStorage.removeItem("opa-admin"); nav("home"); };
}
