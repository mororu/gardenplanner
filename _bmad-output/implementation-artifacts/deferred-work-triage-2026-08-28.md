# Triage `deferred-work.md` vor Epic 3

**Stand:** 2026-08-28, Baum bei `d6a0af5`. 41 Einträge, jeder einzeln gegen den Baum nachgeprüft — ein Eintrag, der noch stimmt, ist etwas anderes als einer, der sich erledigt hat.
**Auslöser:** Aktionspunkt aus der Retrospektive Epic 2 (`epic-2-retro-item-28-…`), ursprünglich Epic-1-Punkt 11 („die 30 Einträge triagieren, bevor Epic 2 beginnt") — dort nicht ausgeführt, die Datei ist seither auf 41 gewachsen.

Die Einordnung „vor Epic 3 fällig" ist nicht geschätzt. Sie kommt aus den Akzeptanzkriterien von Epic 3 selbst (`epics.md:428-500`): Story 3.1 legt `/dienstplan` als **echtes Navigationsziel** an und färbt `— unbesetzt —` in Lehmbraun; Story 3.2 legt `/einzelaufgaben` plus eine Ausschreib-Formularroute an, bringt **Freitext** (Titel) und **die zweite Bestätigung mit Sicherheitszusage**. Mehrere Einträge nennen genau diese Ereignisse als ihre eigene Auslösebedingung.

## Ergebnis

| Bucket | Einträge | Bedeutung |
| --- | --- | --- |
| **A — Geschlossen** | 9 | Arbeit gelandet, Entscheid gefallen oder reiner Abnahmebeleg. Keine Restarbeit. |
| **B — Vor Epic 3 fällig** | 12 | Auslösebedingung tritt in Epic 3 ein, oder das Warten kostet messbar mehr. |
| **C — Entscheid durch Manuel** | 5 | Kann niemand durch Lesen von Code auflösen. |
| **D — Bewusst getragen** | 15 | Benannt, begründet, kein Auslöser in Sicht. Bleiben stehen. |

Netto sinkt die Liste der offenen Arbeit von 41 auf **32**, davon **12 mit Termin**.

> **Nachtrag vom selben Tag:** Die fünf Entscheide aus Bucket C sind **gefallen**. Sie stehen mit voller Begründung in `deferred-work.md` unter „Entschieden am 2026-08-28"; für zwei davon sind die Plandokumente nachgezogen. Bucket C trägt darum keine Fragen mehr, sondern Umsetzungsarbeit — siehe die geänderte Reihenfolge am Ende.

---

## A — Geschlossen (9)

Diese neun tragen keine Arbeit mehr und sollen die Liste nicht länger als „offen" belasten.

| # | Zeile | Eintrag | Warum geschlossen |
| --- | --- | --- | --- |
| 1 | 10 | Datenbankschicht aus Story 1.1 herausgelöst | In Story 1.2 gebaut. `schema.ts`, `db/index.ts`, `drizzle/` und die `db:*`-Skripte stehen im Baum. |
| 3 | 16 | Aufteilung von Story 1.1 verworfen | Entscheid gefallen und begründet, kein Rest. |
| 2 | 13 | Zweite Review-Runde Story 1.1 nachgeholt | Abnahmebeleg. |
| 7 | 28 | Visuelle Prüfung Story 1.2 | Abnahmebeleg. |
| 16 | 56 | Visuelle Prüfung Story 1.3 | Abnahmebeleg (hat drei Fehler gefunden, alle behoben und committet). |
| 18 | 62 | Visuelle Prüfung Story 1.4 | Abnahmebeleg. |
| 30 | 104 | Visuelle Prüfung Story 1.5 | Abnahmebeleg. |
| 34 | 116 | Visuelle Prüfung Story 2.1 | Abnahmebeleg. |
| 41 | 144 | Visuelle Prüfung Story 2.2 | Abnahmebeleg. |

**Wichtig:** Die sieben Abnahmebelege enthalten je einen Absatz darüber, welche Prüflistenpunkte **nicht** einzeln bestätigt wurden — überwiegend Barrierefreiheit. Diese Substanz ist nicht weg, sie ist in der Retrospektive Epic 2 als Befund P3 und Aktionspunkt 15 verbucht. Hier werden nur die Belege geschlossen, nicht die Lücke.

---

## B — Vor Epic 3 fällig (12 Einträge in 6 Posten)

### B1 · Reihenfolgefalle in `smoke-zugang.ts` — **bricht garantiert** *(Eintrag 40, Zeile 140)*

Der Story-2.2-Block sät Zeilen mit `created_at` bis 60 Tage in der Vergangenheit und steht darum am Dateiende (`smoke-zugang.ts:3775`, Datei hat 4342 Zeilen). Weil `offeneAufgabenAuflisten` nach `created_at` aufsteigend sortiert, stellen sich diese Zeilen vor alles Frühere und machen vier Behauptungen mit exakten Id-Ketten aus 1.4/1.5 rot.
**Warum jetzt:** Epic 3 hängt Behauptungen an. Wer das tut, tappt hinein, und die Fehlermeldung zeigt auf eine fremde Story.
**Fassung:** die älteren Reihenfolgeprüfungen auf eigene Ids umstellen, wie es der 2.2-Block über `gesäteIds` schon tut. Mechanisch, klein.

**Erledigt am 2026-08-28.** `offeneReihenfolge` nimmt jetzt einen optionalen Id-Filter; die sechs Ketten der Stories 1.4 und 1.5 fragen über `dreiGesaete`/`fuenfGesaete` nur noch nach ihren eigenen Zeilen. Belegt statt behauptet: eine Probezeile mit 60 Tage altem `created_at`, mitten in den 1.4-Block gesät, machte vor der Umstellung fünf Behauptungen rot und nach ihr keine mehr (Probezeile wieder entfernt). Die Endposition des 2.2-Blocks trägt damit nichts mehr, und sein Kopfkommentar sagt das statt der alten Bedingung. Anzahl der Behauptungen unverändert bei 373. Einzelheiten in `deferred-work.md`.

### B2 · Abdeckung der Svelte-Schicht — **die Auslösebedingung tritt in Epic 3 ein** *(Einträge 9, 15, 17, 36, 37 — Zeilen 34, 53, 59, 125, 131)*

Fünf Einträge, ein Gegenstand: die Svelte-Schicht von `/verwaltung`, `/mehr`, `/` und `/monatsplan` ist von keinem ausgeführten Werkzeug gedeckt. Der vierstufige Vorschlag steht ausformuliert in Eintrag 15.

Zwei Termine daraus sind schon verstrichen oder treffen jetzt:

- **Stufe A** („ein zweites Prüfskript gegen einen echten Server auf einem freien Port") war **„empfohlen als eigene Story vor Epic 2"**. Epic 2 ist durch. Stufe A schliesst laut dem Eintrag drei Posten auf einmal: Klasse A, die Attrappen-Bauform (Eintrag 5) und die ungeprüfte `Referrer-Policy`.
- **Stufe C** (kopfloser Browser) hat als ausdrücklich benannte Auslösebedingung: *„die zweite Bestätigung mit Sicherheitszusage, also Story 3.2 (Einzelaufgabe übernehmen)"* — und `epics.md:479-482` schreibt für 3.2 genau das vor: „Dann erscheint eine Bestätigung mit `Du übernimmst: <Titel>, <Termin>.` — die einzige Bestätigung im Aufgabenbereich". **Die Bedingung tritt in Epic 3 ein.** Der Eintrag sagt dazu: „Ab zwei solchen Dialogen ist Playwright billiger als die Handprüfung, vorher nicht — und es widerspricht einer ausdrücklichen Stack-Entscheidung, die dem User gehört."

Seit der Formulierung sind zwei Gegenstände dazugekommen (Einträge 36, 37): die Zeilenhöhe auf `/` hängt seit Story 2.2 an `.zeile__spalte`, und der Spaltencontainer ändert die Geometrie **jeder** Zeile, nicht nur der überfälligen. Beides deckt nur Stufe C.
**Was zu tun ist:** Entscheid (siehe C) und, wenn Stufe A kommt, eine eigene Story davor.

### B3 · Geteilte Stile nach `bedienelemente.css` — **zwei neue Seiten in Epic 3** *(Einträge 27, 38 — Zeilen 95, 134)*

Gemessen heute: `.seitentitel` 6 Kopien, `.seite` 5, `.fehler` 4, `.live:empty` 4 (Retro-Befund D1). `/dienstplan` und `/einzelaufgaben` machen daraus 8/7/6/6. Der Gap-Drift in `verwaltung/+page.svelte:455` (`--space-5` gegen `--space-4` überall sonst) besteht seit Epic 1.
**Mitzunehmen, wenn die Datei ohnehin offen ist:** Eintrag 38 — im ganzen Baum steht **keine** Umbruchregel (nachgeprüft: null Treffer für `overflow-wrap`, `word-break`, `hyphens` in `src/`), und `AUFGABE_HOECHSTLAENGE = 200` erlaubt 200 Codepoints ohne ein Leerzeichen. Der Eintrag nennt als Ort selbst „eine geteilte Regel, vermutlich in `src/lib/styles/bedienelemente.css`". Zwei Posten, ein Handgriff.

### B4 · Navigationsleiste ohne aktives Ziel auf Formularrouten *(Eintrag 28, Zeile 98)*

`istAktiv` in `NavBar.svelte:19-22` trifft bei `pfad === href` oder `${href}/`-Präfix. `/aufgabe` und seit Epic 2 auch `/monatsplan` gehören zu einem Navigationsziel, ohne unter dessen Pfad zu liegen — kein Eintrag ist markiert.
**Warum jetzt:** Der Eintrag sagt es selbst voraus („Betrifft künftig jede weitere Formularroute (Monatsplan, Ausschreiben)"). Epic 3 bringt `/dienstplan` als **echtes** Navigationsziel und die Ausschreib-Route als dritte Formularroute. Danach ist es eine Gestaltungsentscheidung über vier Routen statt über zwei.

### B5 · Faltungskette und unsichtbare Zeichen — **dritte Freitext-Wurfstelle in Story 3.2** *(Einträge 23, 24 — Zeilen 83, 86)*

Zwei Lücken derselben Kette: `NULLBREITE` entfernt U+200D bedingungslos und zerlegt Emoji-ZWJ-Folgen (`👨‍🌾` wird zu zwei Glyphen), und ausser den fünf Nullbreiten-Zeichen kommt kein weiteres unsichtbares Zeichen durch — U+00AD, U+2800 (Braille-Leerzeichen, das `trim()` nicht als Leerraum sieht), U+3164, U+202A–U+202E. Nachgeprüft: null Treffer für diese Codepoints in `src/`. Ein Text aus lauter U+2800 legt eine sichtbar leere Zeile an, und es gibt keine Löschen-Aktion.
Die Regel liegt heute an zwei Stellen: `src/lib/aufgabentext.ts:55` (seit Story 2.1 geteilt) und `verwaltung/+page.server.ts:68` (bewusst verdoppelt, weil es um Namen und nicht um Aufgabentexte geht).
**Warum jetzt:** Story 3.2 bringt den Titel einer Einzelaufgabe als **dritte** Wurfstelle. Beide Einträge sagen „gehört an alle Stellen zugleich" — der Moment davor ist der billigste.

### B6 · `{colors.warn}` in `EXPERIENCE.md` — **Story 3.1 braucht die Antwort** *(Eintrag 35, Zeile 122)*

`EXPERIENCE.md:79` und `:101` verweisen auf ein Token `{colors.warn}`, das es nicht gibt; das Token heisst `overdue` (`src/app.html:73,206`). Bisher als Kosmetik geführt. Ist es nicht: dieselbe Datei benutzt `{colors.warn}` auf `:102` für **„Dienstwoche unbesetzt"**, und `epics.md:466` schreibt für Story 3.1 vor, dass unbesetzte Wochen als `— unbesetzt —` **in Lehmbraun** stehen. Lehmbraun ist `--overdue`.
**Die Frage, die vor Story 3.1 beantwortet sein muss:** trägt „unbesetzt" dasselbe Token wie „überfällig", oder bekommt Epic 3 ein eigenes `--warn`? Gate-Regel 3 weist ein `var(--warn)` ohne Deklaration sofort ab, die Story bliebe also stehen.

**Vollständig geschlossen am 2026-08-28.** `:79` und `:101` tragen jetzt `{colors.overdue}` — dort war es nie eine Frage. Und `:102` ist entschieden: **Fassung B**, ein eigenes Token `--warn` in Ringelblume (`#A05300` hell / `#FFA857` dunkel), deklariert, gemessen und in `DESIGN.md`, `epics.md` und `src/app.html` nachgezogen. „Unbesetzt" und „überfällig" sind zwei Aussagen und tragen zwei Farben. Begründung samt Messwerten in `deferred-work.md`.

---

## C — Entscheid durch Manuel (5) — **entschieden am 2026-08-28**

Keiner liess sich durch Lesen von Code auflösen; alle fünf sind jetzt beantwortet. Die Begründungen stehen in `deferred-work.md`, Abschnitt „Entschieden am 2026-08-28". Was bleibt, ist Umsetzung.

| # | Zeile | Frage | Bemerkung |
| --- | --- | --- | --- |
| 31 | 107 | ✔ **Entschieden: Fenster ±1 Jahr, hart abgewiesen.** Ursprünglich: — Vergangenheit abweisen, warnen oder Obergrenze? | Der Eintrag setzte sich selbst die Frist „bevor Story 2.2 rechnet". Verstrichen. Bis dahin legt ein vertipptes Jahr bis zu 100 Aufgaben an, die keine Löschen-Aktion aufräumt. = Retro-Punkt 7. |
| 39 | 137 | ✔ **Entschieden: `seit N Wochen überfällig`.** Plandokumente nachgezogen, Code offen. | Untertreibt bei Planaufgaben systematisch (3 statt 8). Wortlaut ist durch `epics.md:412` und `DESIGN.md:199,248` gebunden. = Retro-Punkt 8. |
| 15 | 53 | ✔ **Entschieden: Stufe A ja (eigene Story vor Epic 3), Stufe C nein.** Bedingung für C neu gefasst — Geometrie- oder Fokuszusage bricht, oder Barrierefreiheit soll abgenommen werden. | Stack-Entscheidung, gehört ausdrücklich dem User. Siehe B2. |
| 11 | 40 | ✔ **Entschieden: 80 und Aussieben abgenommen, kein Reaktivieren/Undo abgenommen — Umbenennen ab Story 3.1 nötig.** In `epics.md` bei Epic 3 als Vorbedingung festgehalten. | Der Eintrag trägt seit Story 1.3 selbst `status: dem User vorzulegen` und ist nie vorgelegt worden. Kein Umbenennen, kein Reaktivieren, kein Undo — Folgen stehen in `README.md`. |
| 32 | 110 | ✔ **Entschieden: abfangen, einheitlich auf allen vier Seiten, generischer Satz in der bestehenden Live-Region.** Läuft mit Retro-Punkt 3. | Heute ersetzt ein Wurf die Seite durch die Fehlergrenze — auf `/monatsplan` kostet das vierzig gerade getippte Zeilen. Betrifft `/aufgabe`, `/`, `/verwaltung` und `/monatsplan` zugleich. Nur über einen Datenbankfehler erreichbar. |

Dazu, ausserhalb der Buckets, aber offen seit Story 1.1: **Eintrag 4** (Zeile 19) — die Installation zum Home-Bildschirm ist auf keinem echten Gerät geprüft. Story 1.6 (Betrieb) ist durch, der Punkt blieb; er trägt weiterhin „spätestens mit Betrieb nachzuholen". Braucht ein Telefon, sonst nichts.

---

## D — Bewusst getragen (15)

Benannt, begründet, ohne Auslöser. Sie bleiben stehen — mit einem Zähler dort, wo das Warten sichtbar teurer wird.

| # | Zeile | Eintrag | Auslösebedingung |
| --- | --- | --- | --- |
| 5 | 22 | `smoke-zugang.ts` stellt SvelteKit mit Attrappen nach | Fällt mit Stufe A (B2). |
| 6 | 25 | Drei von Hand gepflegte Zahlen (`ERWARTETE_BEHAUPTUNGEN` heute **373**, 29 Gate-Proben, Probenliste in `db-check.ts`) | Reibung ist Absicht — sie fängt stilles Schrumpfen. Ableitbar machen, falls es lästig wird. |
| 8 | 31 | Textuelles Scanning in `gate.mjs`: blinde Flecken und Fehlalarme | Beim nächsten `bad_spec`-Fund dieser Klasse hier ansetzen. |
| 10 | 37 | Einmal-Link überlebt einen Fehlschlag nur mit JavaScript | Ohne JavaScript nicht behebbar, ohne den eingefrorenen Block zu brechen. Endgültig. |
| 12 | 44 | Das Gate rechnet keinen Kontrast nach | Bräuchte eine maschinenlesbare Liste der Vordergrund-/Hintergrund-Paare. |
| 13 | 47 | `sitzungLoeschen` ohne Aufrufer | Nachgeprüft: weiterhin nur `smoke` und ein Kommentar. Erster echter Aufrufer wäre ein Abmelden-Knopf — den gibt es bewusst nicht. |
| 14 | 50 | Gate-Regel 11 deutet `action="/pfad?/name"` nicht | Form kommt im Baum nicht vor; geratene Zuordnung wäre schlechter. |
| 19 | 68 | Zeitregex case-sensitiv (`140MS`) | Kein Treffer im Baum. |
| 20 | 71 | Zeitregex könnte bei `--transition-duration` anschlagen | Keine solche Custom Property im Baum. |
| 21 | 74 | `request.formData()` ohne try/catch (Story 1.4) | **Zähler: 6 → 7 Stellen** seit Epic 2 (`monatsplan/+page.server.ts:132`). |
| 25 | 89 | dasselbe, dritte Fundstelle (Story 1.5) | Nur über einen direkten POST erreichbar; wenn angefasst, dann alle sieben zugleich. |
| 22 | 77 | Randfälle von `idLesen` ungetestet | Nachgeprüft: `idLesen` kommt in `smoke` nur in einem Kommentar vor — weiterhin ungedeckt. Logik ist korrekt. |
| 26 | 92 | Harte Redirect-Pfade statt `resolve()` | **Zähler: 4 → 6 Stellen.** Wirkungslos, solange `paths.base` nicht konfiguriert ist. |
| 29 | 101 | Fokusgriff der Live-Region gegen SvelteKits `reset_focus` | Deckt nur Stufe C (B2). |
| 33 | 113 | Zwei brüchige Textprüfungen in `smoke` (`schrittGrenze` am ersten `{:else}` bei `:3294`; Identitätsregex `:2713`, `:3732` trifft auch Prosa) | Falsch-Rot-Risiken, keine übersehenen Fehler. Epic 3 fasst `/monatsplan` nicht an. |

---

## Empfohlene Reihenfolge

Fassung vom 2026-08-28, nachdem die fünf Entscheide gefallen sind. Die drei Entscheidungsschritte
der ersten Fassung sind erledigt; was bleibt, ist Bauen — in dieser Ordnung.

1. ~~**B6 Rest**~~ — erledigt am 2026-08-28: eigenes Token `--warn` in Ringelblume. Story 3.1 hat
   damit freie Bahn; keine offene Frage hält Epic 3 mehr auf.
2. ~~**B1**~~ — erledigt am 2026-08-28: die Ketten der Stories 1.4 und 1.5 fragen nur noch nach
   ihren eigenen Ids. Kein Block der Epic 3 kann sie mehr mit alten Zeitstempeln rot machen.
3. **Stufe A als eigene Story** (Entscheid zu Eintrag 15). Sie schliesst vier Posten auf einmal, und
   jede Story ab 3.1 bekommt sie geschenkt — der Nutzen ist am grössten, wenn sie **vor** Epic 3 steht.
   **Aufgesetzt am 2026-08-28 als Story 3.0** („Das ausgelieferte HTML gegen einen echten Server
   prüfen", `epics.md`), im Sprint-Status als `backlog` geführt und im Epic-3-Kontext als Vorarbeit
   vor 3.1 vermerkt. Geschrieben, nicht gebaut — die Umsetzung steht noch aus.
4. **Ein Durchgang durch die geteilten Stellen: B3 + B4 + B5 + Retro-Punkte 1, 2, 3 + Entscheid 32.**
   Sie hängen alle an denselben vier Seiten und teilweise an denselben Zeilen — der Fehlerfall
   `result.type === 'error'` und die vier `abweisen`-Signaturen sind derselbe Handgriff, `/verwaltung`
   wird für Retro-Punkt 1 ohnehin geöffnet (und nimmt Stufe B mit), und `bedienelemente.css` ist
   offen, sobald die Stile zusammengehen (dann auch die Umbruchregel aus Eintrag 38).
5. **Wortlaut im Code nachziehen** (Entscheid zu Eintrag 39). Die Plandokumente sagen es schon; bis
   der Code folgt, ist es eine benannte, verfolgte Plan-Ist-Abweichung.
6. **Fenster an `Fällig bis`** (Entscheid zu Eintrag 31) — klein und unabhängig, passt in jeden Zug.
7. **`umbenennen`-action auf `/verwaltung`** (Entscheid zu Eintrag 11), vor oder mit Story 3.1; nimmt
   Epic-1-Punkt 3 (`create-admin.ts`) mit.

## Was mit `deferred-work.md` geschehen soll

Die Datei bleibt, wie sie ist — sie ist das Protokoll dessen, was jede Story zurückgestellt hat, und ein Protokoll wird nicht umgeschrieben. Diese Triage ist die Momentaufnahme daneben. Was fehlt, ist der Lesepunkt: dieser Bericht gehört beim Start jeder Epic-3-Story neben den Epic-Kontext, damit ein Eintrag mit eigener Fälligkeit nicht ein zweites Mal verstreicht (Eintrag 31 ist der Beleg, dass genau das passiert).
