// Opa erklärt das Spiel – mit hervorgehobenen Spielelementen

import { settings, ladder } from "./logic.js";
import { esc, euro, fmtClock } from "./util.js";
import { gameHTML } from "./game.js";
import { play } from "./audio.js";

function steps() {
  const s = settings();
  const t = s.times;
  const name = s.opa?.name || "Opa";
  const range = (a, b) => {
    const xs = t.slice(a, b);
    const f = (sec) => (sec >= 60 ? fmtClock(sec) + " Min" : sec + " Sek");
    return `${f(Math.min(...xs))}–${f(Math.max(...xs))}`;
  };
  const safes = ladder().map((x, i) => (x.safe ? `Stufe ${i + 1} (${euro(x.amount)})` : null)).filter(Boolean).join(" und ");
  return [
    { screen: "home", text: `Hallo und herzlich willkommen bei „Wer wird ${name}-när?“! Ich bin ${name} und erkläre dir kurz, wie das Spiel funktioniert. Keine Sorge – das ist ganz einfach!` },
    { screen: "demo", target: "question", text: "Pro Runde bekommst du 15 Fragen. Jede ist ein bisschen schwerer als die davor. Hier oben steht immer die Frage." },
    { screen: "demo", target: "answers", text: "Darunter stehen vier Antworten, A bis D. Tipp eine an – dann frage ich dich: „Ist das deine endgültige Antwort?“ Erst wenn du „Ja“ sagst, wird sie eingeloggt. Orange heißt: Spannung! Grün heißt richtig, Rot heißt falsch." },
    { screen: "demo", target: "timer", text: `Das ist die Uhr. Bei den Fragen 1–5 hast du ${range(0, 5)}, bei 6–10 ${range(5, 10)} und bei 11–15 sogar ${range(10, 15)}. Bei den letzten 10 Sekunden wird sie rot und tickt. Läuft die Zeit ab, zählt das wie eine falsche Antwort.` },
    { screen: "demo", target: "jokers", text: `Deine drei Joker, jeder einmal pro Runde: 50:50 streicht zwei falsche Antworten. Beim Publikumsjoker stimmt die Familie live ab, die gerade online ist. Und mit dem ${name}-Joker kannst du mich per WhatsApp oder Anruf fragen – aber die Zeit läuft weiter!` },
    { screen: "demo", target: "ladder", text: `Das ist die Gewinnleiter. Die goldenen Stufen sind Sicherheitsstufen: ${safes}. Wer falsch antwortet, fällt auf die letzte erreichte Sicherheitsstufe zurück. Und bei manchen Stufen gibt es echte Preise von mir – 🎁!` },
    { screen: "demo", target: "quit", text: "Wenn du dir unsicher bist, kannst du jederzeit aufhören und deinen bisherigen Gewinn samt echtem Preis mitnehmen." },
    { screen: "home", target: "ranking", text: "In der Rangliste siehst du, wer diese Woche vorne liegt, die ewige Bestenliste und das große Generationen-Duell: Enkel gegen Kinder gegen Großeltern! Es zählt jeweils deine beste Runde der Woche – bei Gleichstand gewinnt, wer schneller war." },
    { screen: "home", target: "submit", text: "Du kennst eine gute Frage – vielleicht sogar über mich oder mit einem Foto aus dem Familienalbum? Dann reich sie hier ein! Deine eigene Frage bekommst du natürlich nicht selbst gestellt." },
    { screen: "home", target: "duels", text: "Hier kannst du jemanden aus der Familie zum Duell herausfordern. Ihr bekommt dieselben Fragen – wer weiter kommt, gewinnt." },
    { screen: "home", target: "menu", text: "Jeden Montag gibt es neue Fragen für alle. Diese Erklärung findest du jederzeit wieder hier im Menü. Und jetzt: Viel Glück – ich drück dir die Daumen!" },
  ];
}

export function runTutorial({ root, renderHome }) {
  return new Promise((resolve) => {
    const list = steps();
    const s = settings();
    let i = 0;
    const hole = document.createElement("div");
    hole.className = "tut-hole";
    const box = document.createElement("div");
    box.className = "tut-box";
    document.body.append(hole, box);
    const prevClass = root.className;

    const demo = () => {
      root.className = "screen game-screen";
      root.innerHTML = gameHTML({
        q: { text: "Wie viele Kerzen braucht ein Kuchen zum 77. Geburtstag?", answers: ["7", "70", "77", "707"], category: "allgemein" },
        level: 3, jokers: {}, hidden: [], remaining: 25, total: 25,
      });
    };

    const end = () => {
      hole.remove();
      box.remove();
      root.className = prevClass;
      localStorage.setItem("opa-tutorial-done", "1");
      renderHome();
      resolve();
    };

    const show = () => {
      const st = list[i];
      if (st.screen === "demo") demo(); else renderHome();
      const el = st.target ? document.querySelector(`[data-tut="${st.target}"]`) : null;
      if (st.target === "ladder") document.querySelector("#ladderList")?.classList.remove("hidden");
      box.innerHTML = `<img src="${esc(s.opa?.photo || "icons/opa.svg")}" alt=""><div class="bubble"><span class="who">${esc(s.opa?.name || "Opa")} erklärt</span>${esc(st.text)}
        <div class="tut-nav"><span class="step">${i + 1} / ${list.length}</span>
        <button class="skip" data-t="skip">Überspringen</button>
        ${i > 0 ? `<button data-t="back">◀</button>` : ""}
        <button data-t="next">${i === list.length - 1 ? "Los geht's!" : "Weiter ▶"}</button></div></div>`;
      if (el) {
        let target = el;
        if (st.target === "ladder") {
          const ll = document.querySelector("#ladderList");
          if (ll) target = ll;
        }
        target.scrollIntoView({ block: "center" });
        requestAnimationFrame(() => {
          const r = target.getBoundingClientRect();
          Object.assign(hole.style, { display: "block", left: r.left - 6 + "px", top: r.top - 6 + "px", width: r.width + 12 + "px", height: r.height + 12 + "px" });
          const below = r.top + r.height / 2 < innerHeight / 2;
          box.style.top = below ? Math.min(innerHeight - 220, r.bottom + 18) + "px" : "auto";
          box.style.bottom = below ? "auto" : Math.max(12, innerHeight - r.top + 18) + "px";
        });
      } else {
        Object.assign(hole.style, { left: "50%", top: "40%", width: "0px", height: "0px" });
        box.style.top = "30%";
        box.style.bottom = "auto";
      }
      play("click");
    };

    box.addEventListener("click", (e) => {
      const t = e.target.closest("[data-t]")?.dataset.t;
      if (t === "skip") end();
      else if (t === "back") { i--; show(); }
      else if (t === "next") { if (++i >= list.length) end(); else show(); }
    });
    show();
  });
}
