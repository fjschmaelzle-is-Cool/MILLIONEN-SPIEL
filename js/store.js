// Datenschicht: DEMO (IndexedDB, nur dieses Gerät) oder CLOUD (Firebase).
// Beide Varianten halten alle Daten zusätzlich im Speicher (cache), damit
// die Oberfläche synchron lesen kann. Änderungen anderer Geräte/Tabs kommen
// in Echtzeit über Listener herein.

import { FIREBASE_CONFIG, DEMO_FAMILY_CODE } from "./config.js";
import { blobToDataURL, uid } from "./util.js";

export const COLLECTIONS = ["settings", "players", "rounds", "questions", "pools", "duels", "polls", "announcements", "weeks"];

const cache = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()]));
const listeners = new Set();

function emit(col, id) {
  for (const l of listeners) {
    try { l(col, id); } catch (e) { console.error(e); }
  }
}

function isObj(v) {
  return v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Blob);
}
function deepMerge(target, patch) {
  const out = { ...(target || {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}
function clean(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================================
//  DEMO-Backend (IndexedDB + BroadcastChannel zwischen Tabs)
// ============================================================
class LocalBackend {
  mode = "demo";
  async init() {
    this.db = await new Promise((res, rej) => {
      const r = indexedDB.open("opa-naer", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("docs");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await this.loadAll();
    this.bc = "BroadcastChannel" in window ? new BroadcastChannel("opa-naer") : null;
    if (this.bc) {
      this.bc.onmessage = (e) => {
        const { col, id, data } = e.data;
        if (data === null) cache[col].delete(id);
        else cache[col].set(id, data);
        emit(col, id);
      };
    }
  }
  loadAll() {
    return new Promise((res) => {
      const tx = this.db.transaction("docs", "readonly");
      const req = tx.objectStore("docs").openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return res();
        const [col, ...rest] = cur.key.split("/");
        if (cache[col]) cache[col].set(rest.join("/"), cur.value);
        cur.continue();
      };
    });
  }
  needsJoin() {
    return localStorage.getItem("opa-joined") !== "1";
  }
  async join(code) {
    const s = cache.settings.get("main");
    const valid = (s?.familyCode || DEMO_FAMILY_CODE).trim().toUpperCase();
    if (code.trim().toUpperCase() !== valid) return false;
    localStorage.setItem("opa-joined", "1");
    return true;
  }
  write(col, id, data) {
    const tx = this.db.transaction("docs", "readwrite");
    if (data === null) tx.objectStore("docs").delete(`${col}/${id}`);
    else tx.objectStore("docs").put(data, `${col}/${id}`);
    this.bc?.postMessage({ col, id, data });
  }
  async set(col, id, data) {
    data = clean(data);
    cache[col].set(id, data);
    this.write(col, id, data);
    emit(col, id);
  }
  async update(col, id, patch) {
    const data = clean(deepMerge(cache[col].get(id), patch));
    cache[col].set(id, data);
    this.write(col, id, data);
    emit(col, id);
  }
  async remove(col, id) {
    cache[col].delete(id);
    this.write(col, id, null);
    emit(col, id);
  }
  async upload(blob) {
    return blobToDataURL(blob);
  }
  async createIfMissing(col, id, data) {
    if (!cache[col].has(id)) await this.set(col, id, data);
    return cache[col].get(id);
  }
}

// ============================================================
//  CLOUD-Backend (Firebase Firestore + Storage + anonyme Anmeldung)
// ============================================================
const FB = "https://www.gstatic.com/firebasejs/10.12.2/";

class FirebaseBackend {
  mode = "cloud";
  async init() {
    const [{ initializeApp }, auth, fs, st] = await Promise.all([
      import(FB + "firebase-app.js"),
      import(FB + "firebase-auth.js"),
      import(FB + "firebase-firestore.js"),
      import(FB + "firebase-storage.js"),
    ]);
    this.fs = fs;
    this.st = st;
    const app = initializeApp(FIREBASE_CONFIG);
    this.auth = auth.getAuth(app);
    this.db = fs.initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: fs.persistentLocalCache() });
    this.storage = st.getStorage(app);
    await new Promise((res) => {
      const off = auth.onAuthStateChanged(this.auth, (u) => { off(); res(u); });
    });
    if (!this.auth.currentUser) await auth.signInAnonymously(this.auth);
    this.uid = this.auth.currentUser.uid;
    const me = await fs.getDoc(fs.doc(this.db, "members", this.uid)).catch(() => null);
    this.member = !!(me && me.exists());
    if (this.member) await this.subscribeAll();
  }
  needsJoin() {
    return !this.member;
  }
  async join(code) {
    const { fs } = this;
    try {
      await fs.setDoc(fs.doc(this.db, "members", this.uid), { code: code.trim().toUpperCase(), ts: Date.now() });
      this.member = true;
      await this.subscribeAll();
      return true;
    } catch (e) {
      console.warn("Beitritt fehlgeschlagen", e);
      return false;
    }
  }
  subscribeAll() {
    const { fs } = this;
    const firstLoads = COLLECTIONS.map((col) => new Promise((resolve) => {
      let q = fs.collection(this.db, col);
      if (col === "polls") q = fs.query(q, fs.where("expiresAt", ">", Date.now() - 10 * 60 * 1000));
      if (col === "announcements") q = fs.query(q, fs.orderBy("ts", "desc"), fs.limit(30));
      let first = true;
      fs.onSnapshot(q, (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type === "removed") cache[col].delete(ch.doc.id);
          else cache[col].set(ch.doc.id, ch.doc.data());
          if (!first) emit(col, ch.doc.id);
        }
        if (first) { first = false; resolve(); }
      }, (err) => { console.error(col, err); resolve(); });
    }));
    return Promise.all(firstLoads);
  }
  async set(col, id, data) {
    data = clean(data);
    cache[col].set(id, data);
    emit(col, id);
    await this.fs.setDoc(this.fs.doc(this.db, col, id), data);
  }
  async update(col, id, patch) {
    patch = clean(patch);
    cache[col].set(id, deepMerge(cache[col].get(id), patch));
    emit(col, id);
    await this.fs.setDoc(this.fs.doc(this.db, col, id), patch, { merge: true });
  }
  async remove(col, id) {
    cache[col].delete(id);
    emit(col, id);
    await this.fs.deleteDoc(this.fs.doc(this.db, col, id));
  }
  async upload(blob, folder = "uploads") {
    const ext = (blob.type.split("/")[1] || "bin").replace("jpeg", "jpg").split(";")[0];
    const r = this.st.ref(this.storage, `${folder}/${uid()}.${ext}`);
    await this.st.uploadBytes(r, blob, { contentType: blob.type });
    return this.st.getDownloadURL(r);
  }
  async createIfMissing(col, id, data) {
    const { fs } = this;
    const ref = fs.doc(this.db, col, id);
    await fs.runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) tx.set(ref, clean(data));
      else cache[col].set(id, snap.data());
    });
    if (!cache[col].has(id)) cache[col].set(id, clean(data));
    return cache[col].get(id);
  }
}

// ============================================================
const backend = FIREBASE_CONFIG ? new FirebaseBackend() : new LocalBackend();

export const store = {
  get mode() { return backend.mode; },
  init: () => backend.init(),
  needsJoin: () => backend.needsJoin(),
  join: (code) => backend.join(code),
  all: (col) => [...cache[col].values()],
  get: (col, id) => cache[col].get(id),
  set: (col, id, data) => backend.set(col, id, { ...data, id }),
  update: (col, id, patch) => backend.update(col, id, patch),
  remove: (col, id) => backend.remove(col, id),
  upload: (blob, folder) => backend.upload(blob, folder),
  createIfMissing: (col, id, data) => backend.createIfMissing(col, id, { ...data, id }),
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
