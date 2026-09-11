---
title: 'Überblicksband auf der Startseite — das Dashboard über den drei Blöcken'
type: 'feature'
created: '2026-09-11'
status: 'done'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Die Startseite beantwortet „was ist zu tun" nur als Liste. Drei Zahlen, die den Zustand des Gartens
ausmachen, stehen heute nirgends auf `/`: **wie viele** der offenen Aufgaben überfällig sind (die Zeile sagt es je
Aufgabe, nie in Summe), wie viele Dienstwochen im Fenster **unbesetzt** sind (nur auf `/dienstplan` sichtbar), und
wie viele Einzelaufgaben frei sind, wenn der Block gerade lang ist. Wer die Lage überblicken will, muss zählen oder
die Seite wechseln.

**Approach:** Ein **Überblicksband** als Block 0 über den drei Blöcken von AD-14: drei Kacheln, jede eine Zahl mit
einem Wort, jede ein Verweis auf die Stelle, die vertieft. Kein neuer Aufgabentyp, keine neue Tabelle, keine neue
Query-Funktion — alle drei Zahlen entstehen in der bestehenden `load` aus schon geladenen oder schon vorhandenen
Repository-Funktionen.

**Gewählt am 2026-09-11 nach einem gezeichneten Entwurf: Fassung B**, die Kachel mit Kante. Sie liegt seit
Commit `be6e262` auf `--ink-secondary` und erfüllt damit NFR9 — der Entwurf ohne Kante war im hellen Schema
fast flächenlos, weil `--surface-raised` auf `--surface-base` bei 1.06:1 steht.

## Boundaries & Constraints

**Always:**
- Die drei Blöcke aus AD-14 bleiben **unverändert in Inhalt und Reihenfolge**. Das Band steht davor und ersetzt
  keinen davon.
- Das Band informiert **nie exklusiv**: jede Zahl ist auch ohne das Band erreichbar (Pool-Liste, `/einzelaufgaben`,
  `/dienstplan`). Es ist ein Überblick, keine neue Wahrheit.
- Der Pool bleibt namenlos (AD-2) und `completed_by`/`completed_at` erscheinen nirgends (AD-5) — Kennzahlen sind
  Summen ohne Person.
- Farben, Abstände und Schriftrampen **nur** über bestehende Tokens aus `src/app.html` (Gate 1 und 3). Kein neues
  Farbtoken — sonst bricht die Kontrastkette samt DESIGN.md-Tabelle.
- Jede Kachel ist ein Trefferfeld von mindestens `--touch` (44px) und das Band scrollt bei 375px nicht waagrecht.
- Jede neue Wache wird einmal absichtlich rot gemacht, und wie, steht in der Commit-Nachricht.

**Entschieden am 2026-09-11 — was vorher Ask First war:**
- **AD-14 wird ergänzt.** Die Regel lautete „genau drei Blöcke in dieser Reihenfolge" (`ARCHITECTURE-SPINE.md:136`);
  ein vorangestelltes Band ist ein vierter. Sie bekommt den Satz: *„Ein Überblicksband ohne eigene Aufgabenart darf
  vorangestellt werden; es informiert nie exklusiv."* — in `ARCHITECTURE-SPINE.md` **und** `epics.md`.
- **Die Kante ist entschieden.** Entscheid (a) ist gebaut; die Kachel nimmt `--ink-secondary` wie jedes andere
  Bedienelement. Kein Sonderweg, kein neues Token.
- **Die Zahl bleibt auf `--section-size` (20px).** `--display-size` ist für den Seitentitel reserviert, „einer pro
  Seite". Ein Dashboard mit grösseren Ziffern wäre eine neue Typo-Rolle und damit eine Änderung am
  Gestaltungsrahmen — ausdrücklich nicht Teil dieser Story.

**Ask First:**
- Ein **mehrspaltiges Layout jenseits des Bandes** — `.inhalt` hält `max-width: var(--measure)` (600px) und eine
  Spalte (`+layout.svelte:78`). Das Band bleibt darin. Wer die Breitenbegrenzung aufbricht, ändert jede Seite.

**Never:**
- **Die Dienstkachel wird nicht eingefärbt.** `--warn` begründet seine Nähe zu `--overdue` (1.07:1 im Hellen)
  ausdrücklich damit, dass Überfälligkeit und Unbesetztheit **nie auf derselben Seite** stehen (`src/app.html`).
  Das Band bräche genau diese Annahme. Das Wort trägt die Aussage, wie überall sonst.
- Keine neue Tabelle, keine Migration, keine neue Query-Funktion.
- Kein Diagramm, keine Zeitreihe, kein Verlauf — es gibt kein Archiv erledigter Aufgaben (`tasks.ts:190-196`), und
  jede Trendzahl wäre erfunden.
- Keine Auswertung nach Person („X hat Y erledigt"), auch nicht als Aggregat über `completed_by`.
- Kein zweiter `.button-primary` auf der Seite (`bedienelemente.css:83`) — die Kacheln sind Verweise, keine Knöpfe.
- Keine Kachel ohne Zahl: ein leeres Band wird nicht gerendert.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normalfall | 7 offen, davon 2 überfällig; 3 frei; 2 Wochen unbesetzt | Drei Kacheln: `7 offen · 2 überfällig`, `3 zum Übernehmen`, `2 Wochen unbesetzt` | N/A |
| Nichts überfällig | 7 offen, 0 überfällig | Kachel zeigt `7 offen`, der Zusatz `· N überfällig` fehlt ganz — kein `0 überfällig` | N/A |
| Alles leer | 0 offen, 0 frei, 0 unbesetzt | Band wird **nicht** gerendert; die Seite beginnt wie heute | N/A |
| Einzelne Null | 0 frei, Rest > 0 | Die Kachel `zum Übernehmen` fehlt, die anderen bleiben | N/A |
| Singular | 1 offen, 1 Woche unbesetzt | `1 offen`, `1 Woche unbesetzt` — nicht `1 Wochen` | N/A |
| Kein Mitglied im Kontext | `locals.mitglied === null` | Band erscheint unverändert: keine der drei Zahlen ist personenbezogen | Wächter hat vorher mit 403 abgewiesen |

</frozen-after-approval>

## Code Map

- `src/routes/+page.server.ts` -- die `load` (Zeile ~200) liefert heute `aufgaben`, `einzelaufgaben`, `dienst`,
  `abgelegt`, `ausgeschrieben`. Hier entstehen die drei Zahlen. `jetztSekunden` existiert bereits als **eine** Uhr
  für die ganze Seite — dieselbe Uhr benutzen, kein zweites `Date.now()`.
- `src/routes/+page.svelte:491-492` -- `.seite` / `.seitentitel`; das Band gehört **zwischen** `h1` und die
  Live-Regionen (`:513-516`) bzw. direkt davor — vor Block 1 (`:546`).
- `src/routes/+page.svelte:1113-1120` -- `.zeile__frist` mit `var(--overdue)`: die Farbe der Überfälligkeit ist
  gesetzt und **darf nur als Text** getragen werden, nie als Fläche oder Abzeichen.
- `src/lib/server/db/queries/tasks.ts:242-253` -- `offeneAufgabenAuflisten(jetztSekunden)` gibt `wochenOffen`
  mit; überfällig ist `wochenOffen !== null`. Filter in TypeScript, nicht in SQL (`:232-234`).
- `src/lib/server/db/queries/signup-tasks.ts:192-201` -- `freieEinzelaufgabenLesen()`, schon in der `load`.
- `src/lib/server/db/queries/duty-weeks.ts:68-102` -- `dienstwochenLesen(fenster)`; unbesetzt ist `name === null`.
  Fenster aus `src/lib/zeit.ts:474-487` (`wochenfenster`). **Neuer Aufrufort, keine neue Funktion.**
- `src/app.html:49-215` -- alle Tokens. `--space-*`, `--touch`, `--measure`, `--meta-*`, `--label-*`,
  `--surface-raised`, `--ink-secondary`, `--overdue`, `--radius-md`.
- `src/lib/styles/bedienelemente.css:490-505` -- `.karte` ist ausdrücklich „benannter Eintrag einer Liste".
  **Nicht wiederverwenden** — eine Kachel ist ein Behälter. Eigene Klassen, seitenlokal wie `.zeile` und `.dienst`.
- `scripts/gate.mjs:18,32,72` -- Regel 1 (keine Literale), 3 (Token im `:root`), 14 (keine verwaiste oder doppelte
  Gestaltungsklasse). Regel 14 bricht sofort, wenn eine Kachelklasse ohne Leser bleibt.
- `scripts/smoke-zugang.ts:222` -- `ERWARTETE_BEHAUPTUNGEN = 633`; `smoke-http.ts:118` = 159;
  `smoke-sicht.ts:69` = 70. Jede neue Behauptung zieht die Zahl mit.
- `scripts/smoke-sicht.ts:216-517` -- der Sichtlauf bleibt auf `/` und misst 375px ohne waagrechtes Scrollen sowie
  genau zwei `.zeile`. Das Band kommt in denselben Lauf.

## Tasks & Acceptance

**Execution:**
- [ ] `src/routes/+page.server.ts` -- `load` um `ueberblick: { offen, ueberfaellig, frei, unbesetzt }` erweitern;
  `offen`/`ueberfaellig` aus der schon geholten Aufgabenliste ableiten, `frei` aus `einzelaufgaben.length`,
  `unbesetzt` über `dienstwochenLesen(wochenfenster(jetztSekunden))` -- eine Uhr, keine zweite Abfrage des Pools.
- [ ] `src/routes/+page.svelte` -- Band als `<nav class="ueberblick">` mit bis zu drei `<a class="ueberblick__kachel">`
  vor Block 1 einsetzen; Ziele: Pool-Anker `#offen-marke`, `./einzelaufgaben`, `./dienstplan` -- jede Kachel ein
  Verweis, damit „vertiefen statt exklusiv informieren" gilt.
- [ ] `src/routes/+page.svelte` (`<style>`) -- `.ueberblick` als Raster mit `grid-auto-flow: column` und
  `grid-auto-columns: 1fr` (trägt eine, zwei oder drei Kacheln ohne Fallunterscheidung), `gap: var(--space-2)`,
  Kachel mit `border: var(--border-hairline) solid var(--ink-secondary)` und `min-height: var(--touch)`, Zahl auf
  `--section-*`, Wort auf `--meta-*`; der Zusatz „überfällig" in `var(--overdue)` als **Text**, keine Fläche.
- [ ] `src/lib/texte.ts` -- die Wortformen (`offen`, `überfällig`, `zum Übernehmen`, `Woche`/`Wochen` unbesetzt)
  an einer Stelle, damit Singular und Plural nicht in der Komponente auseinanderlaufen.
- [ ] `scripts/smoke-zugang.ts` -- Behauptungen über das Markup: Band steht vor Block 1; jede Kachel ist ein `<a>`;
  keine Kachel bei Zahl 0; `ERWARTETE_BEHAUPTUNGEN` mitziehen.
- [ ] `scripts/smoke-http.ts` -- gegen den echten Server: die drei Zahlen im ausgelieferten HTML stimmen mit dem
  Datenbestand überein, und bei vollständig leerem Bestand fehlt das Band; Zähler mitziehen.
- [ ] `scripts/smoke-sicht.ts` -- Geometrie: jede Kachel mindestens 44x44px, Band bei 375px ohne waagrechtes
  Scrollen, Zahl grösser als Wort; Zähler mitziehen.
- [ ] `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md` und `epics.md` -- AD-14 um den
  Satz zum Überblicksband ergänzen (**nur nach der Ask-First-Entscheidung**).

**Acceptance Criteria:**
- Given ein Mitglied ohne eigenen Dienst und mit leerem Pool, when `/` geladen wird, then erscheint kein Band und
  die Seite sieht aus wie heute.
- Given zwei überfällige von sieben offenen Aufgaben, when `/` geladen wird, then nennt die erste Kachel beide
  Zahlen, und die Summe stimmt mit der Zahl der Zeilen mit `.zeile__frist` überein.
- Given zwei verschiedene angemeldete Mitglieder, when beide `/` laden, then sind alle drei Kennzahlen wortgleich —
  das Band ist nicht personenbezogen, und die Zusage aus `+page.server.ts` bleibt heil.
- Given `npm run build && npm run lint`, when die Kette läuft, then ist sie grün, und jede neue Behauptung wurde
  zuvor einmal vorgeführt rot.

## Design Notes

**Warum Block 0 und nicht Kacheln statt der Liste.** Die Kernschleife ist „sehen und mit einem Griff abhaken".
Ein Kachelraster, das die Liste ersetzt, kostet genau diesen Griff — die Zeile mit dem 44px-Trefferfeld ist das
Herz der Anwendung und ist gemessen (`smoke-sicht.ts:216-517`). Das Band legt den Überblick **davor**, ohne die
Handlung zu verstellen.

**Warum keine Kachel bei Null.** Eine Kachel `0 überfällig` behauptet Aufmerksamkeit für eine Nicht-Lage. Der
Pool zeigt für denselben Fall `Nichts offen.` — ein Satz, keine Zahl. Das Band folgt derselben Haltung.

**Ein Raster ohne Spaltenzahl.** `repeat(auto-fit, minmax(…))` bräuchte ein Längenliteral und bräche Gate-Regel 1.
`grid-auto-flow: column` mit `grid-auto-columns: 1fr` kommt ohne aus und trägt zugleich den Fall mit weniger als
drei Kacheln, ohne dass jemand die Spaltenzahl nachführt. Bei 375px bleiben rund 110px je Kachel.

## Verification

**Commands:**
- `npm run build && npm run lint` -- erwartet: grün. `build` muss vor `lint`, sonst brechen `smoke:http` und
  `smoke:sicht` am veralteten Baum.
- `npm run gate` -- erwartet: Regel 1, 3 und 14 grün trotz neuer Klassen und neuer Style-Regeln.
- `npm run smoke:sicht` -- erwartet: die neuen Geometriebehauptungen grün (braucht Chrome; `CHROME_PFAD` setzt ihn).

**Manual checks (if no CLI):**
- Jede neue Behauptung einmal absichtlich brechen (Zahl verfälschen, Kachel bei 0 rendern, Kachel unter 44px
  drücken) und den roten Lauf in der Commit-Nachricht festhalten.

## Nachtrag — das Band ist aufgelöst (2026-09-11)

**Diese Story ist abgeschlossen und ihr Ergebnis anschliessend ersetzt worden.** Das Überblicksband hat getan,
wofür es gebaut wurde: es hat gezeigt, dass die drei Zahlen auf der Startseite gehören. Im Gebrauch zeigte sich
dann, dass es dieselben Abschnitte ein zweites Mal überschreibt — das Band sagte `4 Aufgaben offen`, die Marke
darunter `Offen` über derselben Liste.

Die Zahlen stehen seither **in den Griffen der Abschnitte**. Gemessen: der Kopfbereich fiel von 251px auf 180px,
die drei Kopfzeilen messen 45/53/53px statt der 115px des Bands allein. Der eigentliche Gewinn ist aber, dass
ein zugeklappter Abschnitt jetzt seinen Inhalt verbirgt und nicht mehr seine Lage — AD-14 hält damit
unabhängig davon, ob jemand die Abschnitte offen lässt.

Was bleibt: die vier Zahlen in der `load` (`Ueberblick`), die Code Map, und die Erkenntnis, dass `--warn` und
`--overdue` nicht auf dieselbe Seite gehören. Was fällt: das Band selbst, seine Klassen und die AD-14-Ergänzung
über ein „Überblicksband" — sie ist neu gefasst.
