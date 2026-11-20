# Wer wird Opa-när? – Anleitung

Familien-Quiz-App zu Opas 77. Geburtstag. Läuft im Browser jedes Handys und lässt sich wie eine App auf den Startbildschirm legen („Zum Startbildschirm hinzufügen“).

## 1. Ausprobieren (Demo-Modus)

Ohne weitere Einrichtung läuft die App im **Demo-Modus**: Alle Daten liegen nur auf dem jeweiligen Gerät.
Mehrere Browser-Tabs auf demselben Rechner sind miteinander verbunden, so lassen sich Publikumsjoker und Duelle testen.

```
python -m http.server 5177 --directory opa-naer
```
Dann http://localhost:5177 öffnen. Familien-Code: **OPA77** · Admin-PIN: **7777** (bitte im Admin-Bereich ändern).

## 2. Für die ganze Familie (Cloud mit Firebase, kostenlos)

1. Auf https://console.firebase.google.com ein Projekt anlegen (z. B. `opa-naer`). Google Analytics wird nicht gebraucht.
2. **Authentication** → „Jetzt starten“ → Anbieter **Anonym** aktivieren.
3. **Firestore Database** → Datenbank erstellen (Standort `europe-west3` Frankfurt).
4. **Storage** → aktivieren (für Fotos und Opas Sprachaufnahmen; verlangt ggf. den Blaze-Tarif, die Nutzung bleibt bei einer Familie im kostenlosen Rahmen).
5. In Firestore eine Sammlung **`codes`** anlegen mit einem Dokument, dessen **Dokument-ID euer Familien-Code** ist (z. B. `MUELLER77`, nur Großbuchstaben). Felder sind egal (z. B. `aktiv: true`).
6. Projekteinstellungen → „Meine Apps“ → **Web-App** hinzufügen → die angezeigte `firebaseConfig` in `js/config.js` bei `FIREBASE_CONFIG` eintragen.
7. Firebase-Werkzeug installieren und veröffentlichen (im Ordner `opa-naer`):
   ```
   npm install -g firebase-tools
   firebase login
   firebase use --add        (Projekt auswählen)
   firebase deploy
   ```
   Damit werden App, Firestore-Regeln und Storage-Regeln hochgeladen. Die Adresse (z. B. `https://opa-naer.web.app`) mit Familien-Code in die WhatsApp-Gruppe schicken.

### Erste Schritte als Admin
- Admin-Bereich über das Menü ☰ → „Admin-Bereich“, Start-PIN **7777** → unter „System“ sofort ändern.
- **Opa**: Foto, Name, Handynummer (für den Opa-Joker), Sprüche und Sprachaufnahmen (Datei hochladen oder direkt aufnehmen).
- **Prüfliste**: Dort liegen schon Vorlagen für Familien- und Fotofragen („Wo hat Opa Oma kennengelernt?“ …). Echte Antworten eintragen, bei Fotofragen ein Bild hochladen, freigeben.
- **Wochenplan**: zeigt, ob in den kommenden Wochen alle 15 Stufen abgedeckt sind. Im Katalog sind 60 Allgemeinwissen-Fragen (4 pro Stufe) – für mehr als 4 Wochen ohne Wiederholungen bitte weitere Fragen anlegen oder importieren.

## Wie die Regeln umgesetzt sind
- **Wochenpool**: Jeden Montag 0:00 Uhr (deutsche Zeit) legt der erste Spieler der Woche automatisch den Pool fest – alle bekommen dieselben 15 Fragen. Bevorzugt werden eingeplante, dann noch unbenutzte Fragen; mindestens 3 Familien-/Fotofragen, sofern vorhanden. Wer eine Frage eingereicht hat, bekommt stattdessen eine Ersatzfrage derselben Stufe.
- **Wertung**: beste Runde pro Spieler und Woche nach Gewinn, bei Gleichstand zählt die kürzere Antwortzeit (Summe der Antwortzeiten). Duell-Runden zählen nicht für die Rangliste.
- **Aufhören** nimmt den Betrag der letzten richtig beantworteten Stufe mit. Falsche Antwort / Zeit abgelaufen → letzte Sicherheitsstufe.
- **Echter Preis**: der höchste Preis bis zur gewonnenen Stufe.
- **Publikumsjoker**: Alle, die gerade online sind und nicht selbst spielen, bekommen ein Abstimmungsfenster. Ist niemand da, stimmt ein simuliertes Publikum ab (je schwerer die Frage, desto unzuverlässiger).
- **Wochensieger-Urkunde**: wird beim ersten App-Start nach Wochenende erstellt und erscheint auf der Startseite und unter „Urkunden“.
- **Benachrichtigungen**: In der App erscheinen Hinweise sofort; ist die App im Hintergrund geöffnet, kommt eine System-Benachrichtigung (vorher im Profil erlauben). Push-Nachrichten bei ganz geschlossener App bräuchten zusätzlich einen Server (Firebase Cloud Messaging + Cloud Function) und sind nicht eingebaut.

## Sicherheit
Nur wer den Familien-Code kennt, kommt an die Daten. Die Admin-PIN schützt den Admin-Bereich in der App. Technisch versierte Familienmitglieder könnten die Daten aber direkt bearbeiten – für ein Familienspiel ist das ausreichend.
