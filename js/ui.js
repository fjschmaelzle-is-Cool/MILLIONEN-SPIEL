// Gemeinsame Oberflächen-Bausteine: Avatare, Toasts, Dialoge, Opa-Sprechblase

import { esc } from "./util.js";
import { settings } from "./logic.js";
import { playVoice } from "./audio.js";

export function avatarHTML(avatar, cls = "") {
  if (avatar?.type === "photo" && avatar.value) return `<span class="avatar ${cls}"><img src="${esc(avatar.value)}" alt=""></span>`;
  return `<span class="avatar ${cls}">${esc(avatar?.value || "🙂")}</span>`;
}

export function toast(text, ms = 3500) {
  let box = document.querySelector(".toasts");
  if (!box) {
    box = document.createElement("div");
    box.className = "toasts";
    document.body.append(box);
  }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  box.append(t);
  setTimeout(() => t.remove(), ms);
}

// Dialog: html + Buttons [{label, cls, value}] -> Promise(value)
export function modal(html, buttons = [{ label: "OK", cls: "gold", value: true }], { dismissable = true, onMount } = {}) {
  return new Promise((resolve) => {
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal">${html}<div class="row wrap" style="margin-top:16px;justify-content:center">${buttons
      .map((b, i) => `<button class="btn ${b.cls || ""}" data-i="${i}" style="flex:1;min-width:120px">${b.label}</button>`)
      .join("")}</div></div>`;
    const close = (v) => { bg.remove(); resolve(v); };
    bg.addEventListener("click", (e) => {
      const b = e.target.closest("[data-i]");
      if (b && b.parentElement.parentElement === bg.firstChild) close(buttons[+b.dataset.i].value);
      else if (e.target === bg && dismissable) close(null);
    });
    document.body.append(bg);
    bg.close = close;
    onMount?.(bg.firstChild, close);
  });
}

export const confirmDialog = (text, yes = "Ja", no = "Nein") =>
  modal(`<h2 class="center title-font">${text}</h2>`, [
    { label: no, cls: "", value: false },
    { label: yes, cls: "gold", value: true },
  ], { dismissable: false });

export function zoomImage(src) {
  const d = document.createElement("div");
  d.className = "img-zoom";
  d.innerHTML = `<img src="${esc(src)}" alt="">`;
  d.onclick = () => d.remove();
  document.body.append(d);
}

// Opa spricht: Sprachaufnahme (falls vorhanden) + Sprechblase
let sayTimer = null;
export function opaSay(moment, { ms = 4200, text } = {}) {
  const s = settings();
  const opa = s.opa || {};
  const list = opa.sayings?.[moment] || [];
  const line = text || list[Math.floor(Math.random() * list.length)] || "";
  const hasVoice = moment && playVoice(opa.audio?.[moment]);
  if (!line && !hasVoice) return;
  document.querySelector(".opa-say")?.remove();
  clearTimeout(sayTimer);
  const el = document.createElement("div");
  el.className = "opa-say";
  el.innerHTML = `<img src="${esc(opa.photo || "icons/opa.svg")}" alt=""><div class="bubble"><span class="who">${esc(opa.name || "Opa")}${hasVoice ? " 🔊" : ""}</span>${esc(line || "…")}</div>`;
  el.onclick = () => el.remove();
  document.body.append(el);
  sayTimer = setTimeout(() => el.remove(), ms);
}
