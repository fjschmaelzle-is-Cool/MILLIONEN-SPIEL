// Spiellogik ohne Oberfläche: Einstellungen, Wochenpool, Ranglisten,
// Statistiken, Abzeichen, Wochenabschluss, Duelle.

import { store } from "./store.js";
import { defaultSettings, defaultQuestions, BADGES } from "./data.js";
import { weekId, shiftWeek, seededRandom, shuffle, uid } from "./util.js";

export const settings = () => store.get("settings", "main") || defaultSettings();
export const ladder = () => settings().ladder;

export async function bootstrapData() {
  if (!store.get("settings", "main")) await store.createIfMissing("settings", "main", defaultSettings());
  if (!store.all("questions").length && !localStorage.getItem("opa-seeded")) {
    localStorage.setItem("opa-seeded", "1");
    for (const q of defaultQuestions()) await store.set("questions", q.id, q);
  }
}

// ---------- Spieler ----------
export const myId = () => localStorage.getItem("opa-player");
export const me = () => store.get("players", myId());
export const players = () => store.all("players").sort((a, b) => a.name.localeCompare(b.name, "de"));
export const playerName = (id) => store.get("players", id)?.name || "Unbekannt";
export const isOnline = (p) => p && Date.now() - (p.lastSeen || 0) < 45000;
export const onlinePlayers = () => store.all("players").filter(isOnline);

// ---------- Gewinnleiter ----------
// level = Anzahl richtig beantworteter Fragen (0–15)
export const amountAt = (level) => (level > 0 ? ladder()[level - 1].amount : 0);
export function safeLevelBelow(level) {
  let safe = 0;
  ladder().forEach((s, i) => { if (s.safe && i + 1 <= level) safe = i + 1; });
  return safe;
}
// Echter Preis: höchster Preis bis zur erreichten Stufe
export function prizeFor(level) {
  let prize = "";
  ladder().forEach((s, i) => { if (s.prize && i + 1 <= level) prize = s.prize; });
  return prize;
}

// ---------- Fragen & Wochenpool ----------
export const approved = () => store.all("questions").filter((q) => q.status === "approved");

export function buildPool(week) {
  const rnd = seededRandom("pool-" + week);
  const all = approved();
  const usage = new Map();
  for (const p of store.all("pools")) {
    if (p.id === week) continue;
    for (const l of p.levels || []) usage.set(l.primary, (usage.get(l.primary) || 0) + 1);
  }
  const order = new Map(shuffle(all.map((q) => q.id), rnd).map((id, i) => [id, i]));
  const rank = (q) => [q.plannedWeek === week ? 0 : 1, usage.get(q.id) || 0, order.get(q.id)];
  const cmp = (a, b) => { const x = rank(a), y = rank(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };

  const levels = [];
  for (let L = 1; L <= 15; L++) {
    let cands = all.filter((q) => q.level === L && (!q.plannedWeek || q.plannedWeek === week)).sort(cmp);
    levels.push({ level: L, ids: cands.map((q) => q.id) });
  }
  // Mindestens 3 Familien-/Fotofragen pro Woche (falls vorhanden)
  const isFam = (id) => ["familie", "foto"].includes(store.get("questions", id)?.category);
  let famCount = levels.filter((l) => l.ids[0] && isFam(l.ids[0])).length;
  for (const l of shuffle(levels, rnd)) {
    if (famCount >= 3) break;
    const first = store.get("questions", l.ids[0]);
    if (first && (isFam(first.id) || first.plannedWeek === week)) continue;
    const famIdx = l.ids.findIndex((id) => isFam(id) && !(usage.get(id) > 0));
    if (famIdx > 0) {
      const [f] = l.ids.splice(famIdx, 1);
      l.ids.unshift(f);
      famCount++;
    }
  }
  return {
    week, createdAt: Date.now(),
    levels: levels.map((l) => ({ level: l.level, primary: l.ids[0] || null, alts: l.ids.slice(1, 4) })),
  };
}

export async function ensurePool(week = weekId()) {
  const existing = store.get("pools", week);
  if (existing) return existing;
  return store.createIfMissing("pools", week, buildPool(week));
}

// Fragen für einen Spieler: eigene eingereichte Fragen werden ersetzt
export function questionsFor(pool, playerId) {
  const used = new Set();
  const ok = (q) => q && q.status === "approved" && q.submittedBy !== playerId && !used.has(q.id);
  const out = [];
  for (let L = 1; L <= 15; L++) {
    const l = pool.levels.find((x) => x.level === L) || { primary: null, alts: [] };
    let q = [l.primary, ...(l.alts || [])].map((id) => store.get("questions", id)).find(ok);
    if (!q) {
      // Ersatz aus benachbarten Stufen
      const all = approved();
      for (let d = 0; d <= 14 && !q; d++) {
        q = shuffle(all.filter((x) => (x.level === L - d || x.level === L + d) && ok(x)), seededRandom(pool.week + L))[0];
      }
    }
    if (!q) return null;
    used.add(q.id);
    out.push(q.id);
  }
  return out;
}

// ---------- Runden & Ranglisten ----------
export const allRounds = () => store.all("rounds").filter((r) => r.finished);
export const rankedRounds = () => allRounds().filter((r) => !r.duelId);
const better = (a, b) => (a.amount !== b.amount ? a.amount > b.amount : a.duration < b.duration);

export function bestPerPlayer(rounds) {
  const best = new Map();
  for (const r of rounds) {
    const cur = best.get(r.playerId);
    if (!cur || better(r, cur)) best.set(r.playerId, r);
  }
  return [...best.values()]
    .filter((r) => store.get("players", r.playerId))
    .sort((a, b) => b.amount - a.amount || a.duration - b.duration);
}

export const weekRanking = (week = weekId()) => bestPerPlayer(rankedRounds().filter((r) => r.week === week));
export const eternalRanking = () => bestPerPlayer(rankedRounds());
export const totalWon = (pid) => rankedRounds().filter((r) => r.playerId === pid).reduce((s, r) => s + r.amount, 0);

export function generationRanking(week = weekId()) {
  const best = weekRanking(week);
  const gens = {};
  for (const r of best) {
    const g = store.get("players", r.playerId)?.generation || "enkel";
    (gens[g] ||= []).push(r);
  }
  return Object.entries(gens)
    .map(([gen, rs]) => ({ gen, players: rs.length, avg: Math.round(rs.reduce((s, r) => s + r.amount, 0) / rs.length), best: rs[0] }))
    .sort((a, b) => b.avg - a.avg);
}

export function attemptsLeft(pid, week = weekId()) {
  const max = Number(settings().attemptsPerWeek) || 0;
  if (!max) return Infinity;
  const used = store.all("rounds").filter((r) => r.playerId === pid && r.week === week && !r.duelId).length;
  return Math.max(0, max - used);
}

// ---------- Statistiken ----------
export function stats(pid) {
  const rs = allRounds().filter((r) => r.playerId === pid);
  const answers = rs.flatMap((r) => r.answers || []);
  const answered = answers.filter((a) => a.picked != null);
  const correct = answers.filter((a) => a.correct);
  const catCount = {};
  for (const a of correct) catCount[a.category] = (catCount[a.category] || 0) + 1;
  const fav = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const duels = store.all("duels").filter((d) => d.status === "done" && (d.challenger === pid || d.opponent === pid));
  const wins = duels.filter((d) => d.winner === pid).length;
  return {
    rounds: rs.length,
    bestLevel: rs.reduce((m, r) => Math.max(m, r.level), 0),
    total: totalWon(pid),
    hitRate: answers.length ? Math.round((correct.length / answers.length) * 100) : 0,
    fav,
    avgTime: answered.length ? answered.reduce((s, a) => s + a.ms, 0) / answered.length : null,
    duelWins: wins,
    duelLosses: duels.filter((d) => d.winner && d.winner !== pid).length,
    duelDraws: duels.filter((d) => !d.winner).length,
    familyCorrect: correct.filter((a) => a.category === "familie").length,
    photoCorrect: correct.filter((a) => a.category === "foto").length,
  };
}

// ---------- Abzeichen ----------
export async function award(pid, key) {
  const p = store.get("players", pid);
  if (!p || p.badges?.[key] || !BADGES[key]) return;
  await store.update("players", pid, { badges: { [key]: Date.now() } });
}

async function awardLeader(key, scoreFn) {
  let best = null, bestScore = 0;
  for (const p of store.all("players")) {
    const s = scoreFn(p.id);
    if (s > bestScore) { best = p.id; bestScore = s; }
  }
  if (best) await award(best, key);
}

export async function checkLeaderBadges() {
  await awardLeader("opaexperte", (id) => stats(id).familyCorrect);
  await awardLeader("fotoprofi", (id) => stats(id).photoCorrect);
  await awardLeader("fragenmeister", (id) => store.all("questions").filter((q) => q.submittedBy === id && q.status === "approved").length);
}

export async function checkRoundBadges(round) {
  if (round.level === 15) await award(round.playerId, "millionaer");
  if (round.level >= 10 && !(round.jokers || []).length) await award(round.playerId, "ohnejoker");
  await checkLeaderBadges();
}

// ---------- Wochenabschluss (Urkunde & Wochen-Abzeichen) ----------
export async function closePastWeeks() {
  const now = weekId();
  for (let i = 1; i <= 4; i++) {
    const wk = shiftWeek(now, -i);
    if (store.get("weeks", wk)) continue;
    const ranking = weekRanking(wk);
    if (!ranking.length) continue;
    const w = ranking[0];
    const fastest = ranking.filter((r) => r.level >= 5).sort((a, b) => a.duration - b.duration)[0];
    const p = store.get("players", w.playerId);
    await store.createIfMissing("weeks", wk, {
      winner: { playerId: w.playerId, name: p.name, avatar: p.avatar, amount: w.amount, level: w.level, duration: w.duration, prize: prizeFor(w.level) },
      fastest: fastest?.playerId || null,
      closedAt: Date.now(),
    });
    await award(w.playerId, "wochensieger");
    if (fastest) await award(fastest.playerId, "schnell");
  }
}

// ---------- Mitteilungen ----------
export function announce(text, type = "info") {
  const id = uid("a");
  return store.set("announcements", id, { ts: Date.now(), text, type, by: myId() });
}

// ---------- Duelle ----------
export async function createDuel(opponentId) {
  const challenger = myId();
  const rnd = seededRandom(uid());
  const all = approved().filter((q) => q.submittedBy !== challenger && q.submittedBy !== opponentId);
  const qids = [];
  for (let L = 1; L <= 15; L++) {
    let q = null;
    for (let d = 0; d <= 14 && !q; d++) {
      q = shuffle(all.filter((x) => (x.level === L - d || x.level === L + d) && !qids.includes(x.id)), rnd)[0];
    }
    if (!q) throw new Error("Nicht genug Fragen für ein Duell.");
    qids.push(q.id);
  }
  const id = uid("d");
  await store.set("duels", id, {
    challenger, opponent: opponentId, qids, createdAt: Date.now(), status: "open", results: {},
  });
  return id;
}

export async function finishDuelIfDone(duelId) {
  const d = store.get("duels", duelId);
  if (!d || d.status === "done") return;
  const a = d.results?.[d.challenger], b = d.results?.[d.opponent];
  if (!a?.done || !b?.done) return;
  let winner = null;
  if (a.level !== b.level) winner = a.level > b.level ? d.challenger : d.opponent;
  else if (a.duration !== b.duration) winner = a.duration < b.duration ? d.challenger : d.opponent;
  await store.update("duels", duelId, { status: "done", winner, finishedAt: Date.now() });
  if (winner) await award(winner, "duellant");
}
