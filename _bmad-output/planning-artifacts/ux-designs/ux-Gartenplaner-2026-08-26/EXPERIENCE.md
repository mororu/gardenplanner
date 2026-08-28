---
name: 'Gemeinschaftsgarten'
type: experience-spine
status: final
created: '2026-08-26'
updated: '2026-08-26'
design: './DESIGN.md'
sources:
  - '../../../specs/spec-gartengemeinschaft-koordination/SPEC.md'
  - '../../../specs/spec-gartengemeinschaft-koordination/scope-priorities.md'
  - '../../architecture/architecture-Gartenplaner-2026-08-26/ARCHITECTURE-SPINE.md'
---

# Experience Spine — Gemeinschaftsgarten

Diese Datei und `DESIGN.md` sind gleichrangige Verträge. Bei Widerspruch zu einem Mockup, einem Wireframe oder einem Import gewinnen die Spines. Farbwerte, Typografie und Komponentenoptik gehören in `DESIGN.md` und werden hier nur als `{token.pfad}` referenziert.

## Foundation

**Form-Faktor:** Handy zuerst, im Hochformat. Eine Web-Anwendung mit Web-App-Manifest, vom Home-Bildschirm startbar, ohne Offline-Betrieb (AD-12). Am Desktop bleibt derselbe einspaltige Aufbau in `max-width: 600px` zentriert — der Desktop wird geduldet, nicht gestaltet.

**Kein UI-System.** Keine Komponentenbibliothek, kein Tailwind, kein shadcn. Svelte-Komponenten mit `<style>`-Blöcken und den Tokens aus `DESIGN.md`, wie im Referenzprojekt.

**Bedienkontext, der alles andere bestimmt:** eine Person steht im Garten, im Freien, oft in der Sonne, häufig mit erdigen oder feuchten Händen, manchmal mit Handschuhen. Sie hat kein Interesse an der Anwendung, sondern an ihrem Beet. Jede Gestaltungsentscheidung wird gegen diese Szene geprüft, nicht gegen einen Schreibtisch.

## Information Architecture

Acht Oberflächen. Die Startseite ist die Antwort auf „was ist zu tun"; alles andere vertieft (AD-14).

| Oberfläche | Pfad | Trägt | Erreichbar über |
| --- | --- | --- | --- |
| Aufgaben | `/` | Diensthinweis, freie Einzelaufgaben, Aufgaben-Pool | Navigation, Startziel |
| Aufgabe erfassen | `/aufgabe` | eine einzelne neue Aufgabe | Knopf auf `/` |
| Dienstplan | `/dienstplan` | Wochenrotation mit Namen, drei Monate | Navigation |
| Wissen | `/wissen` | Referenz-Sheets, Liste und Einzelblatt | Navigation |
| Mehr | `/mehr` | Einstieg zu den seltenen Handlungen | Navigation |
| Monatsplan ablegen | `/monatsplan` | die Massen-Eingabe | `/mehr` |
| Einzelaufgabe ausschreiben | `/einzelaufgaben/neu` | eine verbindliche Einzelaufgabe erzeugen | `/mehr` |
| Verwaltung | `/verwaltung` | Mitglieder, Einladungen | `/mehr`, nur für Admins |

`/i/[token]` ist keine Oberfläche, sondern ein Durchgang: der Link löst die Einladung ein und leitet auf `/` weiter. Er zeigt nur bei Fehlschlag eine Seite.

Visuelle Referenz: [`mockups/startseite.html`](./mockups/startseite.html) — hell, dunkel und der leere Pool. Bei Widerspruch gewinnen die Spines, nicht das Mockup.

**Navigation:** eine feste Leiste am unteren Bildschirmrand mit genau vier Zielen — **Aufgaben · Dienstplan · Wissen · Mehr**. Unten, weil der Daumen dort ist, wenn man einhändig im Beet steht. Vier, weil es die vier Dinge sind, die mehr als einmal im Monat gebraucht werden.

Alles, was eine Person höchstens einmal im Monat tut — Monatsplan ablegen, Einzelaufgabe ausschreiben, Mitglieder verwalten — liegt hinter **Mehr**. Das ist die IA-Entscheidung, die verhindert, dass 18 von 20 Leuten Knöpfe sehen, die sie nie brauchen.

**Kein Zurück-Pfeil bauen.** Formularseiten schliessen mit ihrer Aktion und leiten auf die Liste zurück; die Systemgeste des Browsers genügt.

## Voice and Tone

**Schweizer Rechtschreibung, kein Eszett.** Durchgehend Du-Form. Keine Höflichkeitsfloskeln, kein „bitte" an Knöpfen.

| Regel | Ja | Nein |
| --- | --- | --- |
| Knöpfe sagen, was passiert | `Ablegen` · `Übernehmen` · `Erledigt` | `Absenden` · `OK` · `Speichern` |
| Rückmeldung im gleichen Wort | Knopf `Ablegen` → Meldung `Abgelegt` | `Ablegen` → `Erfolgreich gespeichert` |
| Leere Zustände sagen, was gilt | `Nichts offen.` | `Keine Einträge vorhanden` |
| Fehler sagen, was zu tun ist | `Der Link gilt nicht mehr. Melde dich in der Gartengruppe.` | `Ein Fehler ist aufgetreten` |
| Keine Entschuldigungen | `Nicht gespeichert — probier es nochmals.` | `Leider ist etwas schiefgelaufen, sorry!` |
| Keine Systemsprache | `Wer ist diese Woche dran` | `Zuständigkeitszuweisung` |

Zeitangaben in Alltagssprache: `heute`, `gestern`, `seit 4 Wochen überfällig`, `Sa 14 Uhr`. Kein `26.08.2026 14:00` in Listen; das ausgeschriebene Datum nur dort, wo es zählt (Dienstplan, Einzelaufgabe).

**Nie in einem Text auftauchen:** wer eine Aufgabe abgehakt hat (AD-5). Kein `von R. erledigt`, nirgends, auch nicht als Tooltip.

## Component Patterns

Verhalten. Die Optik dieser Komponenten steht in `DESIGN.md.Components`.

### Aufgabenzeile

Der wichtigste Baustein der ganzen Anwendung. Eine Zeile trägt ein Kästchen links und den Text rechts.

- **Nur das Kästchen ist antippbar**, mindestens 44 × 44 px. Der Text ist nicht antippbar — es gibt keine Detailansicht, und ein grosses Trefferfeld über die ganze Zeile würde im Beet versehentlich Aufgaben erledigen.
- Ein Antippen erledigt. Kein Bestätigungsdialog, keine Rückfrage, keine Eingabe (Spec-Constraint).
- Nach dem Antippen bleibt die Zeile **an ihrem Platz** stehen, durchgestrichen und gedämpft. Sie verschwindet erst beim nächsten Laden. So sieht die Person, dass ihr Tippen angekommen ist, und merkt einen Fehlgriff sofort.
- Eine überfällige Zeile trägt zusätzlich eine Textzeile `seit N Wochen überfällig` in `{colors.overdue}`. **Die Farbe allein signalisiert nie** — der Text steht immer dabei.

### Diensthinweis

Erscheint auf `/` nur dann, wenn die betrachtende Person in dieser Woche Dienst hat. Eine Zeile, `{colors.accent}` als linke Kante, nicht wegklickbar, nicht abhakbar — ein Dienst ist keine Aufgabe. Verlinkt auf `/dienstplan`.

### Einzelaufgabe

Zwei Zustände. **Frei:** Titel, Termin, `noch niemand`, Knopf `Übernehmen`. **Übernommen:** Titel, Termin, der Name der Person, kein Knopf. Auf `/` erscheinen nur freie (AD-14); übernommene stehen auf `/einzelaufgaben`.

Das Übernehmen ist verbindlich und wird deshalb bestätigt — die einzige Bestätigung im Aufgabenbereich. Text: `Du übernimmst: Setzlinge abholen, Sa 14 Uhr.`

### Sheet

Ein Blatt ist Titel plus Freitext. Liste zeigt nur Titel. Kein Editor mit Werkzeugleiste — ein Textfeld, Absätze und Zeilenumbrüche, sonst nichts. Wer ein Blatt ändert, ändert es für alle; es gibt keine Versionen und keinen Autor.

## State Patterns

| Zustand | Verhalten |
| --- | --- |
| Pool leer | `Nichts offen.` — und darunter der Knopf zum Erfassen. Ein leerer Garten-Pool ist ein gutes Zeichen, der Text feiert es leise mit. |
| Alles erledigt in dieser Sitzung | Die durchgestrichenen Zeilen bleiben sichtbar, bis neu geladen wird. Kein Konfetti, keine Belohnung. |
| Überfällig | `{colors.overdue}` plus Text `seit N Wochen überfällig`. Ab drei Wochen (AD-8). Nichts verschwindet, nichts eskaliert. |
| Dienstwoche unbesetzt | Die Woche steht mit `— unbesetzt —` in `{colors.warn}`. Entsteht, wenn ein Mitglied deaktiviert wurde (AD-11). |
| Kein Netz | `Keine Verbindung. Die Liste braucht Netz.` Keine Warteschlange, kein späteres Senden (AD-12). |
| Link ungültig | Eigene Seite: `Dieser Link gilt nicht mehr. Melde dich in der Gartengruppe.` Kein Hinweis darauf, ob das Token je existiert hat. |
| Kein Admin auf `/verwaltung` | Kein Fehler, sondern der Eintrag erscheint gar nicht in `/mehr`. Direktaufruf führt auf `/`. |
| Formular abgeschickt | Weiterleitung auf die Liste mit einer kurzen Meldung im Perfekt desselben Verbs. Kein Verbleiben im leeren Formular. |

## Interaction Primitives

- **Ein Antippen erledigt.** Das ist das einzige Interaktionsmuster, das jede Person kennen muss.
- **Keine modalen Dialoge**, ausser der einen Bestätigung beim Übernehmen einer Einzelaufgabe und beim Widerrufen einer Einladung. Alles andere ist eine Seite oder steht inline.
- **Kein Wischen.** Keine Wisch-zum-Erledigen-Geste, keine Wisch-zum-Löschen-Geste. Mit Handschuhen und in der Sonne unzuverlässig, und für einen Teil der Gruppe unbekannt.
- **Keine Animation ausser einer:** der Übergang der Zeile in den durchgestrichenen Zustand, unter 150 ms. `prefers-reduced-motion` schaltet auch die ab.
- **Kein unendliches Nachladen.** Alle Listen sind vollständig; bei 40 Beeten und ~40 Aufgaben gibt es nichts zu blättern.

## Accessibility Floor

- Trefferfelder mindestens 44 × 44 px, auch das Kästchen der Aufgabenzeile.
- Kontrast: 4.5:1 für Text, 3:1 für grosse Schrift und Umrisse — gilt in Hell **und** Dunkel. Prüfung gehört zur Definition of Done jeder Story mit Oberfläche.
- **Kein Zustand nur über Farbe.** Überfällig trägt Text, erledigt trägt Durchstreichung, unbesetzt trägt das Wort.
- Das Kästchen ist ein echtes Bedienelement in einem Formular, mit Beschriftung aus dem Aufgabentext, damit ein Screenreader `Beet 25 Nüsslisalat jäten, erledigen` vorliest.
- Sichtbarer Tastaturfokus auf allem Bedienbaren; die Reihenfolge folgt der Leserichtung.
- Schriftgrösse nie unter 14 px, Fliesstext 15–16 px. Systemweite Vergrösserung muss das Layout nicht brechen: relative Einheiten, keine festen Höhen an Textcontainern.
- `<html lang="de">`.

## Massen-Eingabe des Monatsplans

Die anspruchsvollste Interaktion im MVP und der Grund, warum dieser Abschnitt existiert. Die Messlatte steht in der Spec: **20–40 Aufgaben in einer Sitzung, ohne mehr Aufwand als Papier.** Ein Formular mit einem Feld pro Aufgabe verliert diesen Vergleich sofort — vierzig Mal antippen, tippen, hinzufügen.

Der Weg ist deshalb **ein einziges mehrzeiliges Textfeld: eine Aufgabe pro Zeile.** Genau die Handlung, die auf Papier stattfindet — eine Liste schreiben. Einfügen aus einer Notiz oder aus dem Chat funktioniert damit ebenfalls.

Visuelle Referenz: [`mockups/monatsplan.html`](./mockups/monatsplan.html) — beide Schritte, hell und dunkel.

Zwei Schritte:

1. **Schreiben.** Ein grosses Textfeld, darüber ein Datumsfeld `Fällig bis` für den ganzen Stapel, vorbelegt mit dem Monatsende. Unter dem Textfeld eine mitlaufende Zählung: `24 Aufgaben erkannt`. Leere Zeilen zählen nicht. Ein Knopf: `Weiter`.
2. **Prüfen und ablegen.** Die erkannten Zeilen als Liste, jede mit einem `×` zum Entfernen. Darunter `24 Aufgaben ablegen`. Der Schritt existiert, weil beim Einfügen aus einem Chat Zeilen mitkommen, die keine Aufgaben sind.

Nach dem Ablegen: Weiterleitung auf `/` mit `24 Aufgaben abgelegt.`

**Kein Bearbeiten von Zeilen im zweiten Schritt** — nur Entfernen. Wer eine Zeile ändern will, geht zurück ins Textfeld. Ein Editor pro Zeile würde die Ersparnis wieder auffressen.

`Fällig bis` gilt für den ganzen Stapel und setzt `due_at` (AD-8), damit eine Ende-September-Aufgabe nicht am 22. September als überfällig gilt.

## Key Flows

Die Personen sind reale Mitglieder der Gemeinschaft, aus der Brainstorming-Session — hier auf Initialen abgekürzt.

### R., Donnerstag 7 Uhr, allein im Garten

1. Sie kommt an, Handschuhe schon an, und öffnet Gemeinschaftsgarten vom Home-Bildschirm.
2. Sie liest die offenen Aufgaben. Drei davon hat sie letzte Woche selbst gemacht.
3. **Der Höhepunkt:** sie zieht einen Handschuh aus und tippt drei Kästchen an. Drei Zeilen streichen sich durch. Sie hat nichts erklärt, nichts kommentiert, niemandem widersprochen — und die Liste stimmt jetzt.
4. Sie sieht `Tunnel 2 Blattläuse nachbehandeln · seit 4 Wochen überfällig`, macht es, hakt es ab.
5. Handschuh wieder an. Die ganze Interaktion hat unter einer Minute gedauert.

### Die planende Person, Sonntagabend am Küchentisch

1. Sie geht auf `Mehr` → `Monatsplan ablegen`.
2. Sie sieht das leere Textfeld und schreibt ihre Liste, eine Aufgabe pro Zeile — dieselbe Handlung wie bisher auf Papier.
3. Unter dem Feld läuft die Zählung mit: `27 Aufgaben erkannt`. `Fällig bis` steht schon auf dem Monatsende.
4. **Der Höhepunkt:** `Weiter` — die 27 Zeilen stehen als Liste da. Sie entfernt zwei, die nur Notizen an sich selbst waren, und tippt `25 Aufgaben ablegen`.
5. Sie landet auf der Startseite und sieht ihren Plan als offene Aufgaben. Der Aufwand war das Schreiben, nichts sonst.

### Die Neue, drittes Mal im Garten, Samstagsgruppe

1. Sie öffnet die Liste, weil sie nicht fragen will, was zu tun ist.
2. Oben steht kein Diensthinweis — sie hat keinen Dienst, also fehlt der Block ganz.
3. Sie sieht eine freie Einzelaufgabe: `Setzlinge abholen · Sa 14 Uhr · noch niemand`.
4. **Der Höhepunkt:** sie tippt `Übernehmen`, bestätigt, und ihr Name steht daneben. Sie hat zum ersten Mal etwas übernommen, ohne jemanden ansprechen zu müssen.
5. Danach nimmt sie sich aus dem Pool eine Aufgabe, bei der sie sich sicher ist. Bei `Beet 25 Nüsslisalat jäten` fragt sie lieber — die Liste hilft ihr da nicht, und das ist bewusst so.

### C., Dienstag, Blattläuse in Tunnel 2

1. Sie entdeckt den Befall, behandelt ihn.
2. Sie öffnet die Liste und tippt `+ Aufgabe`.
3. Sie schreibt `Tunnel 2 Blattläuse nachbehandeln` und legt sie ab.
4. **Der Höhepunkt:** die Aufgabe steht im gemeinsamen Pool — nicht als Nachricht an zwanzig Leute, sondern als offene Sache, die die nächste Person sieht, die kommt. Sie musste niemanden bitten.

## Inspiration & Anti-patterns

**Übernommen von beehiveJournal** (`imports/beehivejournal-*.png`): der einspaltige Aufbau in 600 px, die sehr grossen fetten Überschriften, die gefüllte Hauptaktion als breiter Knopf, `(optional)` in gedämpftem Grau neben dem Label, viel Weissraum ohne Dekoration.

**Nicht übernommen:** die waagrechte Navigationsleiste oben. Sie läuft auf dem Handy über den Rand hinaus — auf dem Screenshot ist genau das zu sehen. Hier steht die Navigation unten und hat vier feste Ziele.

**Ausdrücklich vermieden:**

- Fortschrittsbalken, Punkte, Serien, Abzeichen. Jede Form von Zählung macht das Abhaken zu einer Leistung und damit sozial teuer — das Gegenteil des Zwecks.
- Ranglisten oder „wer hat wie viel gemacht". Direkter Verstoss gegen AD-5.
- Push-Benachrichtigungen und Erinnerungen. Nicht in der Architektur (AD-7), und eine Gruppe von zwanzig Freiwilligen erinnert man nicht per Handy.
- Bestätigungsdialoge beim Abhaken. Würde den einen Handgriff verdoppeln, auf dem alles beruht.
- Bilder, Illustrationen, Maskottchen. „Anmächelig" soll aus Farbe, Typografie und Ruhe kommen, nicht aus Dekoration.

## Responsive & Platform

Ein Layout, eine Spalte, `max-width: 600px`. Ab 600 px Fensterbreite wandert die Navigationsleiste von unten nach oben — am Desktop ist unten kein Daumen.

Getestet wird bei 375 px Breite (das enge Ende der Gruppe) und bei 430 px. Kein Tablet-Layout, keine Landscape-Sonderbehandlung.

**iOS-Besonderheit, die ins Layout muss:** die Navigationsleiste braucht `padding-bottom: env(safe-area-inset-bottom)`, sonst liegt sie unter dem Home-Indikator.

## Open Questions

- Erscheint der eigene Name irgendwo, damit man merkt, als wer man angemeldet ist? Vorschlag: unter `Mehr`, unauffällig. `[ASSUMPTION]`
- Sollen Sheets im Textfeld einfache Auszeichnung erlauben (Listenpunkte, Fettschrift)? Aktuell reiner Text. `[ASSUMPTION]`
