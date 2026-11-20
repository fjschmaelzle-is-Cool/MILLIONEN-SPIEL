// ============================================================
//  Wer wird Opa-när? – Konfiguration
// ============================================================
//  Solange FIREBASE_CONFIG leer ist (null), läuft die App im
//  DEMO-MODUS: Alle Daten liegen nur auf diesem Gerät (IndexedDB).
//  Mehrere Browser-Tabs auf demselben Gerät synchronisieren sich,
//  so lassen sich Publikumsjoker & Duelle testen.
//
//  Für den echten Familienbetrieb: Firebase-Projekt anlegen
//  (siehe ANLEITUNG.md) und hier die Web-Konfiguration eintragen.
// ============================================================

export const FIREBASE_CONFIG = null;
/* Beispiel:
export const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "opa-naer.firebaseapp.com",
  projectId: "opa-naer",
  storageBucket: "opa-naer.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
};
*/

// Familien-Code für den DEMO-MODUS.
// (Mit Firebase wird der Code als Dokument "codes/<CODE>" in Firestore angelegt.)
export const DEMO_FAMILY_CODE = "OPA77";

// Start-PIN für den Admin-Bereich (kann im Admin-Bereich geändert werden).
export const DEFAULT_ADMIN_PIN = "7777";

export const APP_TITLE = "Wer wird Opa-när?";
