---
title: 'Story 3.2: Einzelaufgabe ausschreiben und übernehmen'
type: 'feature'
created: '2026-08-29'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done
review_loop_iteration: 2
baseline_commit: 'ca523cffae15fb9d79d36602107ca276f0ad1dce'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Unregelmässiges wie das Abholen von Setzlingen wird heute im Gruppenchat ausgehandelt: jemand fragt, mehrere antworten vielleicht, und am Ende weiss niemand verbindlich, ob und von wem es getan wird. Der Aufgaben-Pool aus Epic 1 kann das nicht leisten — er ist absichtlich namenlos, und eine Sache, die genau einen Namen tragen muss, verdunstet darin.

**Approach:** Eine Tabelle `signup_tasks` mit Titel, Termin und **einer nullbaren** Mitgliedsspalte. Eine Formularroute `/einzelaufgabe` zum Ausschreiben, erreichbar über `/mehr`; eine Seite `/einzelaufgaben` mit allen; und auf `/` als **Block 2** die freien mit dem Knopf `Übernehmen`. Das Übernehmen ist verbindlich und wird darum bestätigt — die einzige Bestätigung im Aufgabenbereich, und sie trägt auch ohne JavaScript.

## Boundaries & Constraints

**Always:**

- **Null oder eine Person je Einzelaufgabe.** `signup_tasks.member_id` ist **nullbar** — der Gegensatz zu `duty_weeks.member_id`, das es nicht ist. Genau dieser Unterschied ist AD-4: drei Aufgabenarten, drei Verbindlichkeiten, und das Schema soll sie zeigen.
- **`tasks` wird nicht angefasst.** Keine Zuständigkeitsspalte, keine Typspalte, keine Basistabelle über die Arten (AD-2, AD-3).
- **Auf `/` erscheinen nur freie Einzelaufgaben.** Eine übernommene verlässt Block 2 und steht auf `/einzelaufgaben` — dort stehen **alle**, freie wie übernommene. Die Unterseite vertieft, sie informiert nicht exklusiv.
- **Der Termin ist ein Tagesende in Europe/Zurich**, in Unix-Sekunden, gerechnet von `tagesendeInUnixSekunden`. Dasselbe Fenster von einem Jahr in jede Richtung wie `Fällig bis` (`istImFristfenster`, `fristfenster`), dieselbe Konstante, `min`/`max` am Feld **und** die Prüfung in der action.
- **Der Titel geht durch `aufgabentextFalten`** und gegen `AUFGABE_HOECHSTLAENGE` — die dritte Wurfstelle derselben Kette, angekündigt in der Triage vom 2026-08-28 (B5). Keine zweite Zeichenklasse, keine zweite Zahl.
- **Die Bestätigung trägt ohne JavaScript.** Der Server kennt beide Schritte; der `<dialog>` ist die Aufwertung, nicht die Bedingung. Siehe Design Notes.
- **Der Datenzugriff bleibt in der Repository-Schicht:** ein neues Modul `queries/signup-tasks.ts`, benannte **synchrone** Funktionen, kein Drizzle-Aufruf in einer Routendatei (Gate-Regel 9), kein `async`/`await` in der Datenschicht.
- **Mutationen sind form actions** mit `use:enhance` und **literalem** `action="?/name"` (AD-9). Jede Abweisung geht durch `abweisen`; jeder `use:enhance`-Rückruf fängt `result.type === 'error'` mit `VERSAND_FEHLGESCHLAGEN` ab.
- **Ausschreiben und Übernehmen dürfen alle** — keine Adminschranke, keine zweite Stufe. Der Wächter genügt.
- **Beide neuen Routen werden in `NavBar.svelte` eingetragen**, beide unter `Mehr`: das ist der Weg, der immer besteht. `smoke` macht eine nicht eingetragene Route rot.
- **Die Schemaerweiterung läuft über `npm run db:generate`.** Migrationsdateien werden nie von Hand geändert.
- **Block 2 fügt sich in die bestehende Reihenfolge ein** (AD-14): Diensthinweis, freie Einzelaufgaben, Pool. Story 3.1 hat sie angelegt; diese Story füllt die Lücke, sie ordnet sie nicht um.

**Ask First:**

- Ein **Abgeben** einer schon übernommenen Einzelaufgabe (Name zurück auf null).
- Ein **Erledigt**-Zustand oder ein Abhaken für Einzelaufgaben — es gibt heute keinen.
- Ein **Verfallen** freier Einzelaufgaben mit vergangenem Termin. Sie bleiben stehen, wie eine Poolaufgabe stehenbleibt; es gibt keine Löschen-Aktion. Das ist eine benannte Warze, keine Auslassung.
- Eine zweite Person je Einzelaufgabe, eine Warteliste, ein Tausch.

**Never:**

- Keine Verhandlung, keine Anfrage zwischen Mitgliedern, kein Annehmen/Ablehnen.
- Keine Erinnerung, kein Push, keine Benachrichtigung zum Termin.
- Kein Bestätigungsdialog **irgendwo sonst**: das Abhaken im Pool bleibt eine einzige Interaktion ohne Rückfrage, und diese Ausnahme darf nicht dorthin ausstrahlen.
- Kein Kommentar, kein Abzeichen, keine Zählung, keine Wischgeste, kein Nachladen.
- Kein JSON-Endpunkt, kein `+server.ts`, kein Polling.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Ausschreiben gelingt | Titel und Termin gültig, POST auf `/einzelaufgabe?/ausschreiben` | Zeile ohne Übernehmer angelegt, 303 auf `/` mit Bestätigung | — |
| Titel fehlt | Feld leer, fehlend oder nur Unsichtbares | 400, Satz am Feld, **nichts** angelegt | `abweisen(…, 'titel', getippt)` |
| Titel zu lang | über `AUFGABE_HOECHSTLAENGE` Codepoints | 400, Satz am Feld, Eingabe reist zurück | `abweisen(…, 'titel', getippt)` |
| Termin fehlt / unmöglich | Feld leer, keine Form `JJJJ-MM-TT`, `2026-02-31` | 400, **ein** Satz am Datumsfeld | `abweisen(…, 'termin')` |
| Termin ausserhalb | mehr als ein Jahr von heute, in jede Richtung | 400, `FRIST_AUSSERHALB` am Datumsfeld | `abweisen(…, 'termin')` |
| Freie sehen | `/` mit mindestens einer freien Einzelaufgabe | Block 2 über dem Pool: Titel, Termin, `noch niemand`, Knopf `Übernehmen`, Fusslink | — |
| Keine freien | keine freie Einzelaufgabe | Block 2 fehlt **ganz** — kein leerer Rahmen | — |
| Übernehmen, Schritt 1 | POST auf `?/uebernehmen` **ohne** `bestaetigt` | 200, **keine** Mutation, Bestätigungstext `Du übernimmst: <Titel>, <Termin>.` — im Dialog mit JavaScript, als Dokument ohne | — |
| Übernehmen, Schritt 2 | POST mit `bestaetigt` | Name gesetzt, Zeile verlässt Block 2, Rückmeldung in der Live-Region | — |
| Wettrennen | zwei übernehmen dieselbe im selben Moment | Die zweite trifft keine Zeile: 400, **ein** Satz | `member_id IS NULL` in der where-Klausel |
| Nicht ansprechbar | Id fehlt, nicht numerisch, unbekannt, schon übernommen | 400, **ein** Satz für alle vier | `abweisen(…)` ohne Feld |
| Übernehmer beendet | Zeile zeigt auf ein Mitglied mit `is_active = 0` | Die Aufgabe gilt wieder als **frei**: sie steht in Block 2 mit `noch niemand` und Knopf; die Zeile bleibt stehen | — |
| Abbrechen | Bestätigung verworfen | Nichts geändert, keine Meldung | — |

</frozen-after-approval>

## Code Map

- `src/lib/server/db/schema.ts:96,182` — der Docblock sagt wörtlich „`signup_tasks` kommt mit Story 3.2"; er ist mitzuziehen. `dutyWeeks` (`:224`) ist die **Gegenvorlage**: dort `notNull()` mit ausführlicher Begründung, hier nullbar. `tasks` (`:110`) wird nicht angefasst; `SichtbareAufgabe` (`:205`) zeigt die Bauform einer Projektion, `ohneTokenHash` (`:76`) die einer Handprojektion.
- `src/lib/server/db/queries/duty-weeks.ts:56,116,150` — die direkte Vorlage: Zeilentyp der Seite, `leftJoin` auf `members` mit `is_active`-Auswertung **in der Abfrage**, Vorprüfung vor dem Schreiben. Der Absatz über den `leftJoin` gilt hier wörtlich.
- `src/lib/server/db/queries/tasks.ts:20,36,240` — die Spaltenauswahl als Konstante mit `satisfies Record<keyof …, unknown>`, und `aufgabeAbhaken:265` als Vorlage für das Wettrennen: die Vorbedingung steht in der **where-Klausel**, nicht in der Route, und `null` ist der einzige Fehlschlag.
- `src/routes/aufgabe/+page.server.ts:31,58,110` — die Vorlage für `/einzelaufgabe`: lokale Textkonstanten mit **einer** Wurfstelle, `textPruefen`, `abweisen(…, feld, getippt)`, `redirect(303, '/?abgelegt')`. Ihr Docblock erklärt zugleich, warum die Importe relativ mit `.ts` stehen und die Typen aus `@sveltejs/kit` kommen.
- `src/routes/monatsplan/+page.server.ts:104,161-181` — die Datumskette, wörtlich zu übernehmen: `fristfenster` in der `load`, `tagesendeInUnixSekunden` → `DATUM_FEHLT`, dann `istImFristfenster` gegen die Uhr **des Versands** → `FRIST_AUSSERHALB`.
- `src/routes/verwaltung/+page.svelte:203,297-343,657-704,849` — der `<dialog>` in allen Teilen: `close()` **vor** `update()`, ein Dialog für alle Zeilen, `Abbrechen` zuerst im DOM und fokussiert, Inhalt bedingt gerendert (sonst steht der Satz im Quelltext jedes Besuchers), `.bestaetigung` samt `::backdrop` aus Tokens.
- `src/routes/+page.server.ts:120,175` — die `load`; ihr Docblock trägt die **verengte** Zusage aus Story 3.1 (`cookies` unberührt, gleiche Aufgabenliste für alle). Block 2 ist **nicht** personenbezogen und darf sie nicht weiter aufweichen.
- `src/routes/+page.svelte:283,289,470` — der Kommentar über die drei Blöcke nennt Block 2 als „kommt mit Story 3.2 und rendert hier nichts"; er ist mitzuziehen. `<h2 class="marke" id="offen-marke">` ist die Vorlage für die Marke, `.dienst` (`:302`) die für einen Block mit Kante.
- `src/lib/components/NavBar.svelte:33-38` — `gehoertDazu`; der Docblock kündigt die Routen dieser Story ausdrücklich an. `trifft` vergleicht an der Segmentgrenze — `/einzelaufgabe` und `/einzelaufgaben` kollidieren dort **nicht**, siehe Design Notes.
- `src/routes/mehr/+page.svelte:38` — die Einträge; `resolve()` ist für interne Ziele Pflicht.
- `src/lib/texte.ts:141,171,187` — `WOCHE_NICHT_ANSPRECHBAR` nennt Story 3.2 als zweite Route, die einen Termin abweist; `DATUM_FEHLT` und `FRIST_AUSSERHALB` stehen bereit. Die Docblocks zählen ihre Wurfstellen und sind mitzuziehen.
- `src/lib/aufgabentext.ts:69,107` und `src/lib/unsichtbar.ts:87` — `AUFGABE_HOECHSTLAENGE` und `aufgabentextFalten`; die Zeichenklasse erbt die dritte Wurfstelle geschenkt (Triage B5).
- `src/lib/client/utils/date.ts:42` — `datumLang`, das ausgeschriebene Datum für Termin und Bestätigungssatz.
- `src/lib/styles/bedienelemente.css:210,233,248,274` — `.seite`, `.seitentitel`, `.fehler`, `.live:empty`, `.hinweis` liegen geteilt. Die neuen Seiten benutzen sie und legen **keine** Kopie an; `smoke:5838` (SEITENFORM) macht eine Kopie rot.
- `scripts/smoke-zugang.ts:5725,5730,5906,5945` — `seitenServer` und `seitenKomponenten` sind Listen, in die beide neuen Seiten gehören (sonst laufen `abweisen`- und Wurf-Behauptungen an ihnen vorbei); die Routen-Behauptung liest den Rumpf von `ziele` gegen den Baum. `ERWARTETE_BEHAUPTUNGEN` (`:186`) steht bei 536.
- `scripts/smoke-http.ts:87,498,802` — `ERWARTETE_BEHAUPTUNGEN` bei 121; `postenAnAction` (`:498`) ist der POST mit `origin`-Kopf; die Seitenschleife (`:802`) ist die **einzige** Stelle, die `<title>` misst — der Kommentar dort trägt die Lehre aus Story 3.1.
- `README.md:1304` (Mutationstabelle), `:1700` (Zeilenkennungen), `:1774` (ein Antippen erledigt) — je eine Stelle, an der diese Story eine Zeile ergänzt.

## Tasks & Acceptance

**Execution:**

- [x] `src/lib/server/db/schema.ts` — `signup_tasks` anlegen: Titel, Termin (Unix-Sekunden), **nullbare** `member_id`, `created_at` über `$defaultFn`; Docblock von „kommt mit Story 3.2" auf die gebaute Wirklichkeit umschreiben und die Nullbarkeit gegen `duty_weeks` begründen — das Schema soll die drei Verbindlichkeiten zeigen.
- [x] `drizzle/` — Migration über `npm run db:generate` erzeugen, nicht von Hand schreiben.
- [x] `src/lib/server/db/queries/signup-tasks.ts` — `einzelaufgabeAusschreiben`, `freieEinzelaufgabenLesen`, `einzelaufgabenLesen` (alle, mit Namen und Aktiv-Zustand) und `einzelaufgabeUebernehmen`; synchron, projiziert, `is_active` in der Abfrage, das Wettrennen in der where-Klausel.
- [x] `src/routes/einzelaufgabe/+page.server.ts` + `+page.svelte` — Ausschreiben: Titel- und Terminfeld, Prüfkette in der festgelegten Reihenfolge, `redirect(303, …)` mit Bestätigung; `min`/`max` am Datumsfeld aus der `load`.
- [x] `src/routes/einzelaufgaben/+page.server.ts` + `+page.svelte` — alle Einzelaufgaben, nach Termin geordnet, mit Name oder `noch niemand`. **Lesend, ohne action** — beim Bauen verengt, Begründung in den Design Notes.
- [x] `src/routes/+page.server.ts` — die freien Einzelaufgaben in die `load` aufnehmen und die zwei Schritte des Übernehmens als **eine** action; die verengte Zusage über `cookies` und die gleiche Aufgabenliste für alle bleibt unberührt.
- [x] `src/routes/+page.svelte` — Block 2 zwischen Diensthinweis und Pool, mit Marke, Fusslink auf `/einzelaufgaben` und dem `<dialog>`; ohne freie Einzelaufgabe fehlt er ganz. Den Drei-Block-Kommentar mitziehen.
- [x] `src/routes/mehr/+page.svelte` — zwei Einträge ergänzen: `Einzelaufgabe ausschreiben` und `Alle Einzelaufgaben`. *(Beschriftung nachgezogen am 2026-08-30: die Zeile trug weiter den Planungsnamen `Übernommene Einzelaufgaben`, während der Review desselben Vormittags auf `Alle Einzelaufgaben` umbenannt hatte — siehe die Entscheidung weiter unten. Retro Epic 3, Befund E2.)*
- [x] `src/lib/components/NavBar.svelte` — beide neuen Routen in `gehoertDazu` von `/mehr` eintragen; den Docblock von der Ankündigung auf die Tatsache umschreiben.
- [x] `src/lib/texte.ts` — `EINZELAUFGABE_NICHT_ANSPRECHBAR` aufnehmen (zwei Wurfstellen: `/` und `/einzelaufgaben`); die Wurfstellenzählungen der berührten Docblocks nachziehen.
- [x] `scripts/smoke-zugang.ts` — beide Seiten in `seitenServer` und `seitenKomponenten` aufnehmen und die neuen Wege belegen: Nullbarkeit, Ordnung nach Termin, Wettrennen, beendeter Übernehmer macht wieder frei, Termin-Fenster, kein Bestätigungsdialog auf dem Abhak-Weg.
- [x] `scripts/smoke-http.ts` — beide Seiten in die Seitenschleife (samt `<title>`); den **zweischrittigen POST ohne JavaScript** ausgeführt messen: erst der Bestätigungssatz im Dokument und keine Mutation, dann die Mutation.
- [x] `README.md` — Mutationstabelle, Zeilenkennungen und der Absatz über die eine Bestätigung; keine Zusage ohne Behauptung in der Kette.

**Acceptance Criteria:**

- Given eine freie Einzelaufgabe und ein Browser **ohne JavaScript**, when ich `Übernehmen` abschicke, then steht der Satz `Du übernimmst: <Titel>, <Termin>.` im ausgelieferten Dokument und in der Datenbank hat sich **nichts** geändert; erst der zweite Versand setzt den Namen.
- Given `npm run smoke` und `npm run smoke:http`, when die Story fertig ist, then ist jede Zeile der I/O-Matrix durch eine Behauptung gedeckt, und beide Zähler sind auf die neue Zahl gehoben.
- Given das Schema, when ich es prüfe, then hat `signup_tasks` genau eine nullbare Mitgliedsspalte und `tasks` weiterhin keine Zuständigkeitsspalte.
- Given `/` ohne freie Einzelaufgabe, when ich sie öffne, then ist zwischen Diensthinweis und `Offen` **kein** Element — auch keines mit leerem Inhalt.
- Given `npm run gate`, when die Story fertig ist, then bleibt es bei null Hinweisen: kein Hex-Wert in einem Komponenten-`<style>`, kein neues undeklariertes Token.

### Review Findings

**Durchgang 1 — 2026-08-29, abgearbeitet.** Drei Schichten (Blind Hunter, Edge Case Hunter, Verification Gap), keine ausgefallen. **Kein `intent_gap` und kein `bad_spec`** — kein Akzeptanzkriterium ist verletzt und keine Zeile der I/O-Matrix verhält sich anders als zugesagt. Zwei Befunde betreffen echtes Verhalten, der Rest die Kette und die Prosa. Nach den Patches: `check` und `lint` Exit 0 (`smoke` 592, `smoke:http` 140 Behauptungen — je die Konstante `ERWARTETE_BEHAUPTUNGEN`, ohne die Schlusszählung; die Skripte melden am Ende 593 und 141 —, `gate` 0 Hinweise), und **zwölf** Mutationen einzeln rot gesehen statt der sieben aus der Planung.

Verhalten:

- [x] [Review][Patch] Zwei `Übernehmen`-Knöpfe in derselben Zeile: der Knopf blieb neben der offenen Frage stehen, schickte dieselbe action ein zweites Mal ab und stellte damit nur dieselbe Frage noch einmal; nach dem Hydrieren eines Frage-Dokuments öffnete er den Dialog **über** der sichtbaren Frage. Die Zeile trägt jetzt entweder ihren Knopf oder ihre Frage [src/routes/+page.svelte:{#if !frageHier}]
- [x] [Review][Patch] Die Frage konnte ihre Zeile verlieren und fiel dann lautlos aus — zwischen der Antwort der action und dem Rendern läuft die `load` erneut, und wer in diesem Fenster überholt wird, sah einen Knopf, der nichts getan zu haben schien. Jetzt sagt die Fehlerregion denselben Satz wie beim verlorenen Wettrennen [src/routes/+page.svelte:frageZeile]
- [x] [Review][Patch] Ohne JavaScript war die Frage stumm und ausserhalb des Blickfelds: die Antwort auf einen POST ist ein frisches Dokument, der Blick beginnt oben, die Frage stand unten. Die Meldung oben trägt jetzt `Bitte bestätigen: <Titel>` [src/routes/+page.svelte:rueckmeldung]
- [x] [Review][Patch] `versandFragen` brach den Versand auch dann ab, wenn der Dialog gar nicht aufgeht — der schlechteste Ausgang: nichts geschieht, der Knopf sieht tot aus. Fehlt das Element, läuft jetzt der gewöhnliche POST durch [src/routes/+page.svelte:versandFragen]

Kette und Aussagekraft:

- [x] [Review][Patch] `frei` stand zweimal — als Join-Ausdruck in den Leseabfragen und als Unterabfrage im UPDATE —, während der Docblock „dieselbe Bedingung" behauptete. Jetzt **ein** Ausdruck, `frei()`, mit drei Aufrufern [src/lib/server/db/queries/signup-tasks.ts]
- [x] [Review][Patch] Die Wurf-Behauptung zählte **Dateien**, während ihre Beschriftung von Rückrufen sprach; seit `/` zwei trägt, deckte der eine den anderen. Sie schneidet jetzt die einzelnen Rückrufrümpfe [scripts/smoke-zugang.ts:wurfTeile]
- [x] [Review][Patch] `?ausgeschrieben` und der Satz `Ausgeschrieben.` waren nirgends beobachtet — gemessen wurde nur der `location`-Kopf, und der bleibt bei einem Tippfehler im Parameternamen grün [scripts/smoke-zugang.ts; scripts/smoke-http.ts]
- [x] [Review][Patch] `meldung: 'Übernommen.'` war unbelegt; die ausgeführte Zeile las nur `art` und `titel`, und der Fokusgriff hätte in eine leere Region gezeigt [scripts/smoke-zugang.ts]
- [x] [Review][Patch] Der Rückweg des Titels aus einer **Termin**-Abweisung war unbelegt — `abweisen` hat `eingabe = ''` als Vorgabe, das Weglassen wäre kein Typfehler gewesen [scripts/smoke-zugang.ts]
- [x] [Review][Patch] Die neue Navigations-Behauptung zählte Nennungen im Literal und führte die Segmentregel nicht aus — genau die Verwechslung, die ihr Kommentar ihr zuschrieb, konnte sie nicht sehen [scripts/smoke-zugang.ts]
- [x] [Review][Patch] Vier neue CSS-Kopien: `.leer` stand nach dieser Story dreimal, die Karte dreimal, `.marke` zweimal. Alle gezogen und in die Wache aufgenommen — der Retro-Posten D1 wächst genau so nach [src/lib/styles/bedienelemente.css]
- [x] [Review][Patch] `maxlength` stand als Literal `200` neben einem Server, der aus der Konstante prüft. Kommt jetzt über die `load` [src/routes/einzelaufgabe/]
- [x] [Review][Patch] Der Kommentar „ein Datumsfeld hält seinen Wert … und es reist mit" widersprach der Komponente und dem Eintrag in `deferred-work.md` [src/routes/einzelaufgabe/+page.server.ts]
- [x] [Review][Patch] `EINZELAUFGABE_NICHT_ANSPRECHBAR` nannte zwei Wurfstellen bei vier und liess einen Zustand aus; `VERSAND_FEHLGESCHLAGEN` zählte Seiten statt Rückrufe [src/lib/texte.ts]
- [x] [Review][Patch] „Das Wettrennen, ausgeführt" behauptete mehr als gemessen wurde — der Ablauf ist sequenziell, gemessen wird die Eigenschaft, auf der der Ausgang beruht [scripts/smoke-zugang.ts]
- [x] [Review][Patch] Drei brüchige Muster: der Klammerschnitt an `meldungAngekommen`, die `required`-Zählung über Kommentare, die Formularprüfung über das ganze Dokument samt geteilter Hülle [beide Prüfskripte]
- [x] [Review][Patch] `smoke:http` schickte den Termin **am Fensterrand**; fiel Mitternacht zwischen GET und POST, wäre der Lauf einmal je Nacht zufällig rot [scripts/smoke-http.ts]
- [x] [Review][Patch] Der abgewiesene zweite Schritt wurde nie als Dokument geprüft — dieselbe Lücke wie beim Besetzen vor dem Review zu Story 3.1 [scripts/smoke-http.ts]
- [x] [Review][Patch] `signup_tasks` trug keine Begründung zur Index-Entscheidung, obwohl `tasks` eine hat [src/lib/server/db/schema.ts]
- [x] [Review][Patch] `/einzelaufgaben`: die Liste hatte keinen zugänglichen Namen, und der Hinweis nannte die Startseite, ohne dorthin zu führen — eine freie Zeile war dort eine Sackgasse [src/routes/einzelaufgaben/+page.svelte]

Zurückgestellt, mit Begründung in `deferred-work.md`:

- [x] [Review][Defer] Eine freie Einzelaufgabe mit vergangenem Termin steht **oben** in Block 2, ohne Zeichen, dass ihr Termin vorbei ist — gehört zum Ask-First-Entscheid über das Verfallen
- [x] [Review][Defer] `/einzelaufgaben` wächst unbegrenzt und beginnt mit dem Ältesten — dieselbe Auslösebedingung
- [x] [Review][Defer] Kein Korrigieren, kein Zurückgeben, kein Löschen; die Asymmetrie dazu ist benannt — das **umkehrbare** Abhaken fragt nichts, die **unumkehrbare** Übernahme bekommt den Dialog
- [x] [Review][Defer] Ein doppelter POST ohne JavaScript legt zwei gleiche Zeilen an — pre-existing, `/aufgabe` trägt dieselbe Lücke seit Story 1.5
- [x] [Review][Defer] `maxlength` zählt UTF-16-Einheiten, die Prüfung Codepoints — pre-existing an drei Stellen
- [x] [Review][Defer] `.erfassen` liegt zweimal — bewusst getragen: Layout ohne Rolle, und eine Utility-Klasse im geteilten Blatt wäre der Anfang einer Sammlung, die es hier nicht gibt

Verworfen:

- [x] [Review][Reject] „`member_id` gesetzt, aber keine Mitgliedszeile" — `foreign_keys = ON` (src/lib/server/db/index.ts:71) schliesst das aus; erreichbar nur über einen Eingriff von Hand, und dieselbe Klasse gilt für `duty_weeks` seit Story 3.1
- [x] [Review][Reject] „`fokusGeholt` verbraucht sich zwischen `?abgelegt` und `?ausgeschrieben`" — die zwei Parameter sind Ziele **verschiedener** Seiten, und der Weg dorthin verlässt `/` und baut die Komponente neu auf
- [x] [Review][Reject] „`sprint-status.yaml` steht auf in-progress" — der Stand wandert am Ende des Workflows, nicht in der Umsetzung

**Durchgang 2 — 2026-08-30, der separate Review in frischer Sitzung.** Den die Retrospektive Epic 3 als Bedingung für die Abnahme benannt hat (`epic-3-retro-2026-08-29.md:252`). Vier Schichten (Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor), keine ausgefallen. Diff `ca523cf..a25bda5`, Prüfgegenstand `src/`, `drizzle/`, `scripts/`; jeder Befund gegen **HEAD** verifiziert, nicht gegen den Diff — seit `a25bda5` sind `2ee5b03` und `4af054f` gelaufen.

**Kein `intent_gap` und kein `bad_spec`.** Der Acceptance Auditor hat die I/O-Matrix Zeile für Zeile gegen ausgeführte Behauptungen gehalten: keine Zeile verhält sich anders als zugesagt, kein Akzeptanzkriterium ist verletzt. Ausgangsmessung bei HEAD vor dem Review: `gate` 0 Hinweise, `db:check`, `smoke` 593, `smoke:selftest` 15, `smoke:http` 141 Behauptungen, alle Exit 0.

**Zwei Mutationen ausgeführt und beide grün geblieben** — das ist der Kern dieses Durchgangs. Was Durchgang 1 gefunden hat, war Verhalten; was hier steht, ist zum grossen Teil die Frage, ob dieses Verhalten gemessen wird.

Verhalten:

- [x] [Review][Patch] Der Durchgang-1-Patch an `versandFragen` hat einen Weg geöffnet, den zwei Docblocks seither falsch beschreiben. `if (dialog === null) return;` steht **vor** `cancel()`; der Rückruf gibt dann gar keine Fortsetzung zurück, SvelteKit fährt sein Vorgabeverhalten `update()`, und ein `result.type === 'error'` erreicht `applyAction` statt `VERSAND_FEHLGESCHLAGEN` — die Always-Regel „jeder `use:enhance`-Rückruf fängt `result.type === 'error'` ab" gilt auf diesem Zweig nicht. `src/lib/texte.ts:119` behauptet das Gegenteil („sein Rückruf bricht den Versand ab und gibt gar keine Fortsetzung zurück"), und `src/routes/+page.svelte:598` behauptet „Mit JavaScript entsteht sie nie" über den Inline-Frageblock, der auf genau diesem Zweig **zusätzlich** zum Dialog erscheint [src/routes/+page.svelte:387; src/lib/texte.ts:119]
- [x] [Review][Patch] Derselbe Patch deckt `dialog === null`, nicht `abbrechenKnopf === null`. Fehlt der Abbrechen-Knopf, ist `cancel()` schon gelaufen, und `uebernahmeFragen` steigt danach still aus — genau der „schlechteste Ausgang", den der Kommentar darüber für behoben erklärt: kein POST, kein Dialog, toter Knopf [src/routes/+page.svelte:352]

Messung — die zwei ausgeführten Mutationen:

- [x] [Review][Patch] **Der Weg mit JavaScript zur Bestätigung ist von keiner Behauptung berührt.** Mutation ausgeführt: `cancel()` in `src/routes/+page.svelte:388` gestrichen → `smoke` Exit 0, 593 Behauptungen, kein Befund. Die Rückruf-Schleife schneidet nur `return async (…) => {`, und `versandFragen` gibt einen synchronen Pfeil zurück; `smoke:http` kennt kein JavaScript. Ungedeckt sind damit `cancel()`, die Reihenfolge gegen den `dialog === null`-Ausstieg, `await tick()`, der `abbrechenKnopf`-Ausstieg, `showModal()` und `abbrechenKnopf.focus()` — und in `versandBestaetigen` zusätzlich `dialog?.close()` **vor** `update()` sowie `meldungKasten?.focus()`. Das Werkzeug dafür gibt es: `glatterRumpf`, benutzt für die Geschwisterseiten [scripts/smoke-zugang.ts]
- [x] [Review][Patch] **`/einzelaufgaben` wird nie mit einer freien Zeile ausgeliefert.** Mutation ausgeführt: den `{#if aufgabe.uebernehmer === null}`-Zweig kollabiert → `smoke` **und** `smoke:http` beide Exit 0. Die Seite wird im `seiten`-Durchlauf mit **leerer** Tabelle geholt und als `unterseiteHtml` erst **nach** der Zusage; es gibt im ganzen Lauf keinen Moment mit einer freien Zeile, und `Nichts ausgeschrieben.` kommt in keinem Skript vor. Die einzige Aussage, die diese Seite gegenüber `/` hinzufügt, kann still ausfallen [scripts/smoke-http.ts]
- [x] [Review][Patch] AD-2 ist für Einzelaufgaben Prosa statt Messung: die Gleichheits-Behauptung vergleicht `JSON.stringify(alsNico.aufgaben)` gegen `alsVera.aufgaben` und lässt `einzelaufgaben` aus — obwohl die `load` die Zusage „die freien Einzelaufgaben sind für alle dieselben" ausdrücklich trägt [scripts/smoke-zugang.ts:2644]
- [x] [Review][Patch] `/einzelaufgabe` wird über HTTP nie als Nicht-Admin geprüft — der `seiten`-Durchlauf und der Ausschreiben-POST fahren beide mit `adminKeks`. Die zentrale Zusage der Route („keine eigene Zugangsschranke, ausschreiben darf jedes aktive Mitglied") ist nur auf Unit-Ebene über `nicoLocals` gedeckt. Ein GET und ein POST mit `mitgliedKeks` schliessen das [scripts/smoke-http.ts]

Kette und Prosa:

- [x] [Review][Patch] `.hinweis--ziffern` ist die einzige neue geteilte Regel **ohne** Eintrag in `SEITENFORM`; der bestehende `.hinweis`-Eintrag greift nicht, weil auf `.hinweis` ein `-` folgt und kein `\s*\{`. Daneben schreiben `.dienst__datum` (`src/routes/+page.svelte:890`) und `.woche__datum` (`src/routes/dienstplan/+page.svelte:388`) dieselbe Regel byte-gleich weiter, `.woche__jahr` (`:373`) fast. Der Retro-Posten D1 wächst an genau der Stelle nach, die ihn beheben sollte [scripts/smoke-zugang.ts:SEITENFORM]
- [x] [Review][Patch] Der Docblock zu `EINZELAUFGABE_NICHT_ANSPRECHBAR` sagt „**Vier** Wurfstellen, **alle** in der action `uebernehmen`" — `src/routes/+page.svelte:144` liest die Konstante als fünfte Stelle. Kein Wurf, sondern eine Anzeige, und darum kein Widerspruch im Wort „Wurfstelle" — aber „alle in der action" liest sich als erschöpfende Aussage über die Konstante. Durchgang 1 hat diesen Docblock schon einmal nachgezogen [src/lib/texte.ts:223]
- [x] [Review][Patch] Zahlen-Buchhaltung: das Verifikationsprotokoll nennt „`smoke` 592, `smoke:http` 141" und mischt damit zwei Zählweisen — 592 ist die Konstante, 141 die Gesamtzahl einschliesslich der Schlusszählung; die Konstante steht auf 140. Dazu behauptet `scripts/smoke-http.ts:89` „dieselbe Zahl steht in README.md" — im README steht sie nicht [spec:119,213; scripts/smoke-http.ts:89]
- [x] [Review][Patch] Zwei Abweichungen ohne Eintrag im Spec Change Log, beide im Code sauber begründet: der lokale `TERMIN_FEHLT` statt des von der Code Map „wörtlich zu übernehmen"-den `DATUM_FEHLT`, und `/einzelaufgaben` **nicht** in `seitenServer`/`seitenKomponenten`, obwohl die abgehakte Aufgabenzeile „beide Seiten" verlangt. Genau die Lücke, die Retro-Posten 43 („Den Spec Change Log zur Regel erheben") adressiert [spec:162]

Entscheidungen für Manuel:

- [x] [Review][Decision] **Die zwei Bestätigungswege sagen nicht dasselbe.** Der Dialog trägt `<h2>Einzelaufgabe übernehmen?</h2>` und den Folgesatz „Dein Name steht danach für alle daneben."; das Dokument ohne JavaScript trägt nur `Du übernimmst: <Titel>, <Termin>.` Die Begründung der Verbindlichkeit — der Grund, warum diese eine Handlung überhaupt eine Bestätigung bekommt — erreicht damit nur, wer JavaScript hat. Die Spec sagt „Die Bestätigung trägt ohne JavaScript … der `<dialog>` ist die Aufwertung, nicht die Bedingung". Ist der Folgesatz Substanz (dann gehört er in beide Wege) oder Aufwertung (dann gehört das in die Design Notes)? Die bestehende Behauptung nagelt nur `Du übernimmst:` fest und sähe die Abweichung nie [src/routes/+page.svelte:830,617]
- [x] [Review][Decision] **Der Eintrag auf `/mehr` heisst `Übernommene Einzelaufgaben`, die Seite zeigt alle** und nennt sich selbst `Alle Einzelaufgaben` — so auch der Fusslink aus Block 2. Ein Widerspruch **innerhalb** der Spec: der Aufgabentext gab die Beschriftung vor, die Always-Regel sagt „dort stehen **alle**, freie wie übernommene". Umbenennen auf `Alle Einzelaufgaben` oder die Beschriftung halten? [src/routes/mehr/+page.svelte:44]

Zurückgestellt, mit Begründung in `deferred-work.md`:

- [x] [Review][Defer] `versandFragen` setzt `versandFehler` nicht zurück — ein alter `VERSAND_FEHLGESCHLAGEN` bleibt in der `role="alert"`-Region stehen, während der Dialog darüber aufgeht
- [x] [Review][Defer] Ein einziges `imFlug` koppelt Block 2 an Block 3: ein Häkchen im Pool sperrt jeden `Übernehmen`-Knopf und umgekehrt — nirgends benannt, obwohl die zwei Blöcke sonst als unabhängig argumentiert werden
- [x] [Review][Defer] `noch niemand` steht als Literal in zwei Komponenten — nach der eigenen Regel von `texte.ts` („Sätze, die an mehr als einer Stelle stehen müssen") gehörte es dorthin; die `Du übernimmst:`-Wache hat kein Gegenstück dafür
- [x] [Review][Defer] `rueckrufe.length >= 7` ist eine Untergrenze, während der Docblock **genau** sieben nennt; und `return async \([^)]*\) => \{` bricht an einer Klammer im Parameterkopf — ein still nicht gezählter Rückruf macht nichts rot
- [x] [Review][Defer] `class="karte woche"` trägt einen toten Klassen-Token: eine Regel `.woche {` gibt es nicht mehr, nur `.woche--laufend` und die `.woche__*`
- [x] [Review][Defer] `<title>Einzelaufgabe</title>` und `<title>Einzelaufgaben</title>` sind in Tab und Verlauf ein Zeichen auseinander, für zwei Seiten mit ganz verschiedenen Aufgaben
- [x] [Review][Defer] Kein Index auf `signup_tasks.member_id` und `members.is_active`, obwohl `frei()` bei **jedem** Lesen von `/` und `/einzelaufgaben` auf `is_active` unterabfragt — die Begründung im Schema deckt allein `termin_at` und liest sich, als deckte sie den Entscheid
- [x] [Review][Defer] Der verlorene Wettlauf in **Schritt 1** antwortet mit 200 (die erfolgreiche `fragen`-Antwort, deren Zeile beim Rendern fehlt), während die Matrixzeile „Wettrennen" 400 zusagt — der eigentliche Schreib-Wettlauf liefert korrekt 400

Verworfen:

- [x] [Review][Reject] „`frei()` und `alsEinzelaufgabe` widersprechen sich bei verwaister `member_id`" — dieselbe Klasse, die Durchgang 1 schon mit `foreign_keys = ON` verworfen hat
- [x] [Review][Reject] „`einzelaufgabeAusschreiben` spreizt `.get()` ohne Null-Prüfung" — ein `INSERT … RETURNING` liefert entweder eine Zeile oder wirft; `undefined` ist dort nicht erreichbar, anders als bei SELECT und UPDATE
- [x] [Review][Reject] „Vier byte-gleiche Body-Text-Regeln neu erzeugt" — durch `2ee5b03` und `4af054f` nach der Retrospektive bereits ins geteilte Blatt gezogen
- [x] [Review][Reject] „Kein Zurückgeben, kein Löschen, kein Verfallen; vergangener Termin ohne Zeichen; Block 2 unbegrenzt; doppelter POST legt zwei Zeilen an" — alle vier stehen schon unter „Ask First" der Spec und in den Defers aus Durchgang 1

**Abgearbeitet am 2026-08-30.** Beide Entscheidungen von Manuel getroffen, alle zehn Patches gebaut. `check` und `lint` beide Exit 0: `gate` 0 Hinweise über 44 Dateien, `gate:selftest` alle 29 Fehlerproben, `db:check` und `db:check:selftest`, `smoke` **598**, `smoke:selftest` 15, `smoke:http` **142** Behauptungen. Die zwei Prüfskripte sind um 5 und 1 Behauptung gewachsen (`ERWARTETE_BEHAUPTUNGEN` 592 → 597 und 140 → 141).

**Entschieden:**

- *Die Folge ist Substanz.* „Dein Name steht danach für alle daneben." steht jetzt als `UEBERNAHME_FOLGE` in `texte.ts` und auf **beiden** Bestätigungswegen. Die Überschrift bleibt dem Dialog — sie benennt ein Fenster, nicht den Vorgang.
- *Ein Ziel, ein Name.* Der Eintrag auf `/mehr` heisst `Alle Einzelaufgaben`, wie die Seite und wie der Fusslink aus Block 2.

**Vier Mutationen einzeln rot gesehen** — dieselben, die vor diesem Durchgang grün durchgingen:

| Mutation | vorher | jetzt |
| --- | --- | --- |
| `cancel()` in `versandFragen` gestrichen | grün | **rot** |
| `{#if uebernehmer === null}` auf `/einzelaufgaben` kollabiert | grün (beide Skripte) | **rot** (`smoke:http`) |
| `{UEBERNAHME_FOLGE}` aus dem No-JS-Weg genommen | — | **rot** |
| `.hinweis--ziffern` zurück in eine Komponente kopiert | grün | **rot** |

Ein Nebenbefund aus dem Bauen, gemessen und nicht vermutet: die erste Fassung der drei Rumpf-Behauptungen schnitt an `indexOf(name)` und traf damit die **Typannotation** statt des Funktionskörpers — drei Zeilen rot, aus dem falschen Grund. `koerperRumpf` sucht jetzt die erste `{` auf Klammertiefe null. Dieselbe Falle, die der Kommentar an der Rückruf-Schleife seit Durchgang 1 benennt.

Und eine Folge, die über die Story hinausgeht: der Ausfallweg von `versandFragen` gibt jetzt eine Fortsetzung zurück und wird damit vom `wurfTeile`-Schnitt **mitgezählt** — sieben Rückrufe sind acht geworden, in `texte.ts` und in der Wache nachgezogen.

## Spec Change Log

**Beim Bauen verengt — `/einzelaufgaben` bekommt keine action.** Die
Aufgabenzeile sagte „die freien tragen denselben `Übernehmen`-Weg wie auf `/`".
Ausgeführt hiesse das: dieselbe zweischrittige action, derselbe Dialog, dieselbe
Live-Region ein zweites Mal — zwei Wege in dieselbe Mutation, von denen einer
beim nächsten Anfassen zurückbleibt. Genau die Drift, gegen die dieses Projekt
seine geteilten Module hat.

Der eingefrorene Block verlangt sie nicht: er sagt „auf `/` erscheinen nur freie,
übernommene stehen auf `/einzelaufgaben`, dort stehen alle" — eine Aussage über
das Anzeigen, keine über das Handeln. Die Akzeptanzkriterien des Epics
beschreiben das Übernehmen ausschliesslich von `/` aus. Die Seite vertieft
darum: sie zeigt zusätzlich die übernommenen, was `/` bewusst nicht tut, und sie
handelt nicht. Dass sie keine action hat, ist gemessen und nicht bloss
unterlassen — `smoke` hält fest, dass das Modul kein `actions` exportiert, und
`smoke:http`, dass ihr Dokument weder `<form>` noch `<button>` trägt.

**Beim Bauen abgewichen — `TERMIN_FEHLT` statt `DATUM_FEHLT`.** Die Code Map gab
die Datumskette von `/monatsplan` „wörtlich zu übernehmen" vor, samt
`DATUM_FEHLT`. Übernommen ist die **Regel** — `tagesendeInUnixSekunden`,
`istImFristfenster`, `fristfenster`, `FRIST_AUSSERHALB`, dieselbe Konstante,
dieselben `min`/`max` —, nicht die Auslegung des leeren Felds. `DATUM_FEHLT`
lautet „Wähle ein Datum, bis zu dem die **Aufgaben** erledigt sein sollen" und
beschreibt einen Stapel mit gemeinsamer Frist; hier geht es um **einen** Termin
für **eine** Sache. Ein geteilter Satz, der auf einer der zwei Seiten die falsche
Zahl von Dingen nennt, ist kein geteilter Satz, sondern ein Kompromiss. `smoke`
nagelt die Abweichung ausdrücklich fest („und der Satz ist **nicht**
DATUM_FEHLT"), damit sie nicht als Versehen zurückgebaut wird. Nachgetragen im
Review vom 2026-08-30 — begründet war sie seit dem Bau, verbucht nicht.

**Beim Bauen verengt — `/einzelaufgaben` steht nicht in `seitenServer` und
`seitenKomponenten`.** Die Aufgabenzeile verlangte „**beide** Seiten". Die zwei
Listen führen die Seiten mit einem Formular; sie tragen die `abweisen`- und die
Wurf-Behauptung, und beide setzen eine action voraus, die `/einzelaufgaben` nach
dem Eintrag darüber gerade nicht hat. Ein Eintrag hätte dort eine Behauptung
über eine Eigenschaft erzwungen, die es nicht gibt. Die Ersatzdeckung ist
ausgeführt und nicht behauptet: `smoke` hält fest, dass das Modul kein `actions`
exportiert, `smoke:http`, dass der Seitenbereich weder `<form>` noch `<button>`
trägt, und seit dem Review vom 2026-08-30 zusätzlich, dass die Seite beide
Zustände nebeneinander ausliefert. Nachgetragen im selben Review.

## Design Notes

**Die Bestätigung ist eine Eigenschaft des Servers, nicht des Browsers.** Der `Übernehmen`-Knopf ist ein echter `submit` in einem Formular mit literalem `action="?/uebernehmen"`. Die action verzweigt an **einem** Feld:

```
POST ?/uebernehmen  ohne `bestaetigt`  → keine Mutation, Rückgabe { art: 'fragen', … }
POST ?/uebernehmen  mit  `bestaetigt`  → einzelaufgabeUebernehmen(id, mitgliedId)
```

Ohne JavaScript ist die Antwort auf den ersten POST ein vollständiges Dokument, und die Seite rendert die Bestätigung inline an der Zeile — dieselbe Bauform, mit der `/verwaltung` seit Story 1.3 den Einladungslink zurückgibt. Mit JavaScript bricht der `use:enhance`-Rückruf den ersten Versand mit `cancel()` ab und öffnet statt dessen den `<dialog>`; die Daten für den Satz stehen ohnehin schon in `data`. Der zweite Versand ist in beiden Fällen derselbe POST.

Der Gegenentwurf wäre der Widerruf-Knopf auf `/verwaltung`: `type="button"`, und ohne JavaScript passiert nichts. Für eine **zerstörende** Handlung einer Adminperson ist das die richtige Ausfallrichtung. Für das Übernehmen ist es die falsche: es ist die Kernhandlung dieser Story (FR10), sie gehört allen, und „ohne JavaScript geht es gar nicht" wäre eine stille Einschränkung der Verbindlichkeit, die das Epic gerade herstellen will.

**Ein beendetes Mitglied gibt die Einzelaufgabe frei.** Dieselbe Regel wie bei `duty_weeks`, mit demselben `leftJoin` und derselben Begründung: die Zeile bleibt stehen, die **Darstellung** fällt auf frei zurück. Der Unterschied zum Dienstplan ist die Folge, und sie ist die richtige: eine Dienstwoche fällt auf `— unbesetzt —` und wartet auf die Verwaltung, eine Einzelaufgabe fällt zurück in Block 2 und wartet auf die Nächste, die sie nimmt. Ein `innerJoin` liesse sie verschwinden — ein stiller Datensatz, den niemand je wieder anfasst.

**`/einzelaufgabe` und `/einzelaufgaben` unterscheiden sich um einen Buchstaben, und das ist geprüft statt gehofft.** `trifft` in `NavBar.svelte` vergleicht `pfad === href` oder `pfad.startsWith(href + '/')`; keiner der beiden Vergleiche trifft den Nachbarn. Die Benennung folgt dem Haus: die Route trägt das Substantiv, das Verb steht in der Beschriftung — `/aufgabe` neben `+ Aufgabe`, `/monatsplan` neben `Monatsplan ablegen`. Der Preis ist die Verwechselbarkeit im Quelltext; sie wird von zwei Behauptungen getragen — verschiedene `<title>` in der Seitenschleife von `smoke:http`, und je Route genau **ein** Navigationseintrag statt bloss mindestens einem.

**Beide Routen hängen an `Mehr`, obwohl Block 2 auf `/` auch zu `/einzelaufgaben` führt.** `gehoertDazu` ordnet nach dem Weg dorthin, und der Weg, der **immer** besteht, ist `/mehr`: Block 2 fehlt ganz, sobald keine freie Einzelaufgabe da ist, und eine Seite, die dann unerreichbar wäre, ist keine Vertiefung, sondern eine Sackgasse.

**Die Ordnung ist der Termin, nicht die Anlage.** Der Pool ordnet nach `created_at`, weil eine Poolaufgabe keine Frist trägt und die Liste zwischen zwei Aufrufen nicht springen soll. Eine Einzelaufgabe trägt einen Termin, und wer sie übernimmt, entscheidet danach. Zweites Ordnungskriterium ist die Id — zwei Einzelaufgaben mit demselben Termin hätten sonst keine festgelegte Reihenfolge.

## Verification

**Commands:**

- `npm run check` — Exit 0 in beiden Typprüf-Programmen.
- `npm run build && npm run lint` — Exit 0 über die ganze Kette. **In dieser Reihenfolge:** `smoke:http` misst den gebauten Baum und baut ihn nicht selbst.
- `npm run gate` — weiterhin null Hinweise.

**Jede dieser Mutationen muss rot werden:**

- `member_id` in `signup_tasks` auf `notNull()` gesetzt; `member_id IS NULL` aus der where-Klausel des Übernehmens entfernt; `is_active` aus der Anzeigeabfrage genommen; die Prüfung auf `bestaetigt` in der action entfernt (das Übernehmen liefe dann einschrittig durch); der Block auf `/` auch ohne freie Einzelaufgabe gerendert; eine übernommene Einzelaufgabe weiterhin in Block 2 gezeigt; die Terminschranke `istImFristfenster` entfernt.

**Ausgeführt am 2026-08-29, nach dem Review:** `check` und `lint` beide Exit 0 (`smoke` 592, `smoke:http` 140 Behauptungen — je die Konstante `ERWARTETE_BEHAUPTUNGEN`, ohne die Schlusszählung; die Skripte melden am Ende 593 und 141 —, `gate` 0 Hinweise), und **zwölf** Mutationen einzeln rot gesehen — die sieben aus dieser Liste plus fünf, die der Review nachgetragen hat.

**Manual checks — offen, nicht durchgeführt.** Diese Sitzung hat keinen Browser; die drei Punkte gehören vor die Abnahme:

- Bei 375px in Hell **und** Dunkel: Block 2 sprengt die Zeile nicht, der Termin steht in der Nebentext-Rolle, Trefferfelder messen 44px, der Dialog ist in beiden Modi lesbar und sein `::backdrop` kommt aus Tokens.
- Der Dialog öffnet mit dem Fokus auf `Abbrechen`, Esc schliesst ihn, und nach dem Bestätigen liegt der Fokus in der Rückmeldung.
- Mit abgeschaltetem JavaScript: `Übernehmen` führt auf ein Dokument mit dem Bestätigungssatz, `Bestätigen` setzt den Namen, der Zurück-Weg des Browsers wiederholt nichts. **Der Server-Teil davon ist gemessen** (`smoke:http` geht die drei POSTs ohne `x-sveltekit-action`); was die Handprüfung noch hinzufügt, ist das Verhalten des Browsers davor und danach.

## Suggested Review Order

**Die Verbindlichkeit im Schema — hier beginnt alles**

- Der Einstieg: eine nullbare Spalte ist die ganze Aussage von AD-4.
  [`schema.ts:320`](../../src/lib/server/db/schema.ts#L320)

- Der Gegenentwurf daneben, nicht nullbar — die zwei zusammen lesen.
  [`schema.ts:263`](../../src/lib/server/db/schema.ts#L263)

- Die Migration: erzeugt, nicht von Hand geschrieben.
  [`0004_past_rockslide.sql:1`](../../drizzle/0004_past_rockslide.sql#L1)

**Wann eine Zeile frei ist — eine Regel, drei Leser**

- Als Unterabfrage statt über den Join: passt damit auch ins UPDATE.
  [`signup-tasks.ts:88`](../../src/lib/server/db/queries/signup-tasks.ts#L88)

- Die Vorbedingung steht im selben Statement wie das Schreiben.
  [`signup-tasks.ts:249`](../../src/lib/server/db/queries/signup-tasks.ts#L249)

- Der Termin ordnet, nicht die Anlage — anders als der Pool.
  [`signup-tasks.ts:109`](../../src/lib/server/db/queries/signup-tasks.ts#L109)

**Die Bestätigung als Eigenschaft des Servers**

- Zwei Schritte an einer action, verzweigt an einem Feld.
  [`+page.server.ts:330`](../../src/routes/+page.server.ts#L330)

- Nur freie Zeilen verlassen die load Richtung Startseite.
  [`+page.server.ts:202`](../../src/routes/+page.server.ts#L202)

- Der Dialog ist die Aufwertung; ohne Dialog läuft der POST durch.
  [`+page.svelte:371`](../../src/routes/+page.svelte#L371)

- Der zweite Schritt: schliessen, aktualisieren, Fokus in die Meldung.
  [`+page.svelte:405`](../../src/routes/+page.svelte#L405)

- Entweder der Knopf oder die Frage, nie beides.
  [`+page.svelte:577`](../../src/routes/+page.svelte#L577)

- Verliert die Frage ihre Zeile, sagt es die Fehlerregion.
  [`+page.svelte:73`](../../src/routes/+page.svelte#L73)

**Block 2 und die zwei neuen Seiten**

- Ohne freie Einzelaufgabe fehlt der Block ganz.
  [`+page.svelte:526`](../../src/routes/+page.svelte#L526)

- Die Prüfkette folgt den Feldern, von oben nach unten.
  [`einzelaufgabe/+page.server.ts:167`](../../src/routes/einzelaufgabe/+page.server.ts#L167)

- Die Längengrenze wird abgeleitet, nicht abgeschrieben.
  [`einzelaufgabe/+page.server.ts:110`](../../src/routes/einzelaufgabe/+page.server.ts#L110)

- Die Unterseite liest und handelt nicht — gemessen, nicht unterlassen.
  [`einzelaufgaben/+page.server.ts:1`](../../src/routes/einzelaufgaben/+page.server.ts#L1)

- Beide Routen hängen an `Mehr`: der Weg, der immer besteht.
  [`NavBar.svelte:54`](../../src/lib/components/NavBar.svelte#L54)

**Geteiltes statt Kopien — der Retro-Posten D1**

- Der Dialog ist gezogen worden, nicht kopiert.
  [`bedienelemente.css:340`](../../src/lib/styles/bedienelemente.css#L340)

- Die Karte: eine Zeile, die einen Namen trägt, sieht überall gleich aus.
  [`bedienelemente.css:411`](../../src/lib/styles/bedienelemente.css#L411)

- Der leere Zustand stand nach dieser Story dreimal.
  [`bedienelemente.css:385`](../../src/lib/styles/bedienelemente.css#L385)

**Was das belegt**

- Der zweischrittige POST ohne JavaScript, am gebauten Server.
  [`smoke-http.ts:1780`](../../scripts/smoke-http.ts#L1780)

- Die Wurf-Behauptung zählt seit dem Review Rückrufe, nicht Dateien.
  [`smoke-zugang.ts:6108`](../../scripts/smoke-zugang.ts#L6108)

- Die Segmentregel der Leiste wird ausgeführt, nicht gezählt.
  [`smoke-zugang.ts:6035`](../../scripts/smoke-zugang.ts#L6035)

