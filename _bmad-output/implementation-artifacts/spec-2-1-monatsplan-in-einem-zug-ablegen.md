---
title: 'Story 2.1 — Monatsplan in einem Zug ablegen'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'b207331a1e2706ae4c4e76ee92458c4e791cc652'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/aufgabe` legt genau eine Zeile je Versand an. Die monatlich wechselnde planende Person hat aber 20 bis 40 Aufgaben auf einmal — auf Papier oder in einer Notiz — und müsste heute vierzig Mal ein Feld füllen, absenden und zurücknavigieren. Das verliert den Vergleich mit der Papierliste sofort, und dann tut es die rotierende Person nicht. Damit fehlt dem Pool sein Hauptzufluss.

**Approach:** Eine eigene Seite `/monatsplan`, erreichbar über `/mehr`, mit **zwei Schritten auf einer Route**. Schritt 1: ein Datumsfeld `Fällig bis` für den ganzen Stapel und **ein** mehrzeiliges Textfeld — eine Aufgabe pro Zeile, einfügbar aus Notiz oder Chat —, darunter eine mitlaufende Zählung. Schritt 2: die erkannten Zeilen als Prüfliste, jede mit einem `×` zum Entfernen, kein Bearbeiten. Ein Versand legt alle Zeilen mit **demselben** `due_at` an und leitet auf `/` mit `22 Aufgaben abgelegt.` Die Story ergänzt `tasks` um die Spalte `due_at`, auf der Story 2.2 die Überfälligkeit rechnet.

## Boundaries & Constraints

**Always:**

- **Ein Textfeld für den ganzen Plan, kein Feld pro Aufgabe.** Das ist die Abnahmebedingung (NFR3): der Aufwand darf nicht höher sein als die Papier- oder Chat-Variante, geprüft an einem realen Plan von 20 bis 40 Aufgaben.
- **Ein `due_at` für den ganzen Stapel**, nicht eines pro Zeile. `Fällig bis` ist **Pflicht** und mit dem Ende des laufenden Monats vorbelegt: eine Planaufgabe ohne Frist wäre von einer vor Ort erfassten nicht mehr zu unterscheiden, und die Monatsplan-Ausnahme aus Story 2.2 fiele still aus.
- **Die Regel, was eine Zeile ist, steht genau einmal** und wird von Zähler (Browser) und action (Server) **derselben** Funktion entnommen. Zwei Fassungen derselben Regel liefen auseinander, und der Zähler versprach dann eine Zahl, die der Server nicht einlöst.
- **Dieselbe Textregel wie `/aufgabe`:** Nullbreiten-Zeichen entfernen, `\s+` zu einem Leerzeichen falten, trimmen, leere Zeilen fallen weg, höchstens 200 Codepoints je Zeile. Die 200 ist ab jetzt **eine** Konstante für beide Wurfstellen.
- **Der Prüfschritt ist Zustand, keine Mutation** (AD-9 bindet nur Änderungen an Domänendaten): Schritt 1 → 2 → 1 läuft in Runes-`$state` ohne Server-Rundgang. Nur das Ablegen ist eine form action mit **literalem** `action="?/ablegen"` und `use:enhance` (Gate-Regel 11).
- **Genau eine action auf dieser Route**, und der Stapel entsteht in **einem** Repository-Aufruf und **einem** INSERT — ein mehrzeiliges `values([...])` ist in SQLite atomar, es braucht keine Transaktion.
- **Jeder Datenbankzugriff über eine neue benannte, synchrone Funktion in `queries/tasks.ts`** (AD-1, Gate-Regel 9), mit `returning(sichtbareSpalten)` wie jede andere Funktion der Datei.
- **`due_at` ist ein Integer in Unix-Sekunden** (AD-6), nullbar, über die Migrationskette ergänzt (`npm run db:generate`); Migrationsdateien werden nie von Hand geschrieben. `created_at` bleibt aus dem Schema.
- **Die Zeitzone ist Europe/Zurich und steht genau einmal.** `Fällig bis` bezeichnet das **Ende** des gewählten Tages in dieser Zone, nicht Mitternacht UTC.
- **Die Meldung reist als Query-Parameter mit Zahl:** `redirect(303, '/?abgelegt=22')`. Die `load` von `/` macht daraus eine Zahl, die Oberfläche den Satz. Das bare `?abgelegt` von `/aufgabe` bleibt gültig und bedeutet weiterhin `Abgelegt.`
- **Der Eintrag auf `/mehr` heisst `Monatsplan ablegen` und gilt allen** — die planende Person wechselt monatlich und ist nicht die Adminperson. `/monatsplan` kommt **nicht** in die Navigationsleiste (AD-14: vier Ziele, und das hier tut man einmal im Monat).
- **`/monatsplan/+page.server.ts` importiert relativ mit `.ts`-Endung** und bezieht Typen aus `@sveltejs/kit`, nie aus `./$types` und nie über `$lib` — `scripts/smoke-zugang.ts` lädt dieses Modul mit nacktem Node.
- **Genau ein `button-primary` je Seite** (UX-DR10): in Schritt 1 `Weiter`, in Schritt 2 `N Aufgaben ablegen`; `Zurück zum Text` ist `button-quiet`.
- **Das `×` ist ein echtes `<button type="button">`** mit einem Trefferfeld von `--touch` und einem zugänglichen Namen, kein `<span>` mit Klick-Handler.
- Kein Hex-Wert, keine Farbfunktion, kein rohes `px`, `rem`, `em`, `ms` oder `s` in einem Komponenten-`<style>`; kein `var()` mit Fallback. Genau **ein** neues Token: die Mindesthöhe des Textfelds.
- Oberfläche deutsch in Schweizer Rechtschreibung ohne Eszett, Du-Form, bedienbar bei 375px, geprüft in Hell **und** Dunkel.

**Ask First:**

- Eine zweite Route (`/monatsplan/pruefen`) oder eine zweite action für den Prüfschritt.
- Ein Bearbeiten einzelner Zeilen in Schritt 2 — ausdrücklich ausgeschlossen, wer ändern will, geht zurück ins Textfeld.
- Ein Datum **pro Zeile**, eine Kategorie, ein Beet, ein Zuständiger, eine Priorität.
- Ein Verändern der Anzeige auf `/` über die Meldung hinaus — die Kennzeichnung überfälliger Zeilen ist Story 2.2 und gehört nicht hierher, auch wenn `due_at` ab jetzt in den Seitendaten steht.
- Ein Zusammenziehen der wortgleichen `.fehler`- und `.live:empty`-Regeln nach `bedienelemente.css`. Diese Story fügt die **vierte** Kopie hinzu; die Zusammenlegung ist offener Retro-Posten B5 und betrifft auch `/verwaltung`.

**Never:**

- Kein Formular mit einem Feld pro Aufgabe, kein „Zeile hinzufügen"-Knopf, kein Editor pro Zeile.
- Keine `is_overdue`-Spalte, kein Cron, kein Hintergrundjob — Überfälligkeit wird in Story 2.2 gerechnet, nicht gespeichert.
- Keine Spalte und kein Feld, das eine Aufgabe im Voraus einer Person zuordnet (AD-2, AD-5). Ein Monatsplan ist namenlos wie der Rest des Pools.
- Kein `+server.ts`, kein JSON-Endpunkt, kein dynamisches `action={…}`.
- Kein modaler Dialog, kein Wischen zum Entfernen, kein Fortschrittsbalken, keine Animation, kein Rot.
- Kein Platzhalter statt einer Beschriftung, kein Verbleiben im Formular nach dem Ablegen, kein Zurück-Pfeil in der Seitenchrome.
- `/dienstplan`, `/wissen`, `/verwaltung` und `/aufgabe` bleiben in ihrer Wirkung unangetastet; `/aufgabe` bekommt kein Datumsfeld.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Seite öffnen | GET `/monatsplan` mit Cookie | Schritt 1: `Fällig bis` vorbelegt mit dem Monatsende, Textfeld ab `16em`, Zähler `Keine Aufgabe erkannt`, `Weiter` gesperrt | N/A |
| Ohne Cookie | GET `/monatsplan` | 403 über den Wächter, keine eigene Schranke in der Route | Die Fehlerseite aus Story 1.2 |
| 27 Zeilen, davon 3 leer | Tippen oder Einfügen | Zähler zeigt `24 Aufgaben erkannt`, `Weiter` frei | N/A |
| Eine Zeile aus reinem Leerraum oder Nullbreiten-Zeichen | Tippen | Zählt nicht mit | N/A |
| `Weiter` | 24 erkannte Zeilen | Schritt 2: 24 Zeilen als Liste, je ein `×`, kein Eingabefeld je Zeile, Knopf `24 Aufgaben ablegen`, Fokus auf der Überschrift `Prüfen` | N/A |
| Zwei `×` und ablegen | POST `?/ablegen`, `zeilen` = 22 Zeilen, `faelligBis` = `2026-08-31` | Genau 22 Zeilen, alle mit **demselben** `due_at` (Tagesende Europe/Zurich), Texte gefaltet, Erledigt-Spalten leer; `redirect(303, '/?abgelegt=22')` | N/A |
| Nach dem Ablegen | GET `/?abgelegt=22` | Die 22 Aufgaben stehen im Pool, die Live-Region sagt `22 Aufgaben abgelegt.` und nimmt einmalig den Fokus | N/A |
| Genau eine Zeile | POST `?/ablegen` | Eine Zeile, `redirect(303, '/?abgelegt=1')`, auf `/` steht `Abgelegt.` | N/A |
| `/aufgabe` unverändert | POST `?/ablegen` dort | `redirect(303, '/?abgelegt')`, auf `/` steht weiterhin `Abgelegt.` | N/A |
| `Zurück zum Text` | Schritt 2 | Zurück zu Schritt 1, Textfeld unverändert, entfernte Zeilen sind wieder da | N/A |
| Keine Zeile übrig | Alle `×` in Schritt 2 | Der primäre Knopf ist gesperrt; ein POST mit leerem `zeilen` legt nichts an und wird abgewiesen | Ein Satz, der sagt, dass ohne Zeilen kein Plan entsteht |
| `zeilen` fehlt oder ist kein String | POST ohne Feld, Datei-Upload | Wie leer | Derselbe Satz |
| `faelligBis` fehlt, leer, kein `JJJJ-MM-TT` oder `2026-02-31` | POST `?/ablegen` | Nichts entsteht, `fail(400)` mit `feld: 'datum'` | Ein Satz, der sagt, dass ein Datum zu wählen ist |
| Eine Zeile mit 201 Codepoints | POST `?/ablegen` | **Der ganze Stapel** wird abgewiesen, nichts entsteht | Ein Satz mit der Zahl der zu langen Zeilen und der Grenze |
| Genau 200 Codepoints | POST `?/ablegen` | Geht durch — die Grenze ist einschliessend | N/A |
| Mehr als 100 Zeilen | Einfügen eines ganzen Chatverlaufs | Nichts entsteht, `fail(400)` | Ein Satz mit der Höchstzahl |
| Doppelte Zeilen | Zwei Mal `Tunnel lüften` | Zwei Aufgaben — zwei Tunnel sind möglich, es wird nicht entdoppelt | N/A |
| Doppeltipp auf `N Aufgaben ablegen` | Zwei Versande in Folge | Genau ein Stapel entsteht | Die Sperre aus 1.3/1.4/1.5 (`imFlug` plus `cancel()` plus `disabled`) |
| Ohne JavaScript | `/monatsplan` öffnen | Zähler und `Weiter` tun **nichts**, es entsteht nichts — die richtige Ausfallrichtung | N/A, benannt akzeptiert |

</frozen-after-approval>

## Code Map

Am Stand `b207331` sondiert und belegt — nicht neu herleiten:

- **Das Schema muss angefasst werden, und der Kommentar dort weiss es schon.** `src/lib/server/db/schema.ts:95-96` sagt wörtlich „Ebenfalls nicht hier: due_at … Das ist Epic 2, das diese Tabelle ausdrücklich noch einmal anfasst"; `:11-13` beschreibt den Zwei-Tabellen-Stand. Beide Kommentare sind mitzuziehen. Neue Spalte `dueAt: integer('due_at')` (nullbar, kein `$defaultFn` — sie entsteht nicht beim Anlegen, sondern kommt vom Stapel).
- **Die Spalte fällt zwangsläufig in `SichtbareAufgabe`** (`schema.ts:166`, `Omit<Task, 'completedBy' | 'completedAt'>`). Damit bricht `satisfies Record<keyof SichtbareAufgabe, unknown>` auf `sichtbareSpalten` in `src/lib/server/db/queries/tasks.ts:36-40`, bis dort `dueAt: tasks.dueAt` steht — ein `npm run check`-Fehler, kein Laufzeitfehler. Das ist gewollt: `due_at` **soll** in die Seitendaten, Story 2.2 rechnet darauf. Betroffene Annotationen: `NurSichtbar:61`, `aufgabeAnlegen:94`, `offeneAufgabenAuflisten:118`, `aufgabeAbhaken:147`, `aufgabeWiederOeffnen:174`.
- **Insert-Vorlage** ist `aufgabeAnlegen` (`queries/tasks.ts:88-95`). Die neue Funktion gehört direkt daneben, mit `.values(zeilen.map(…) satisfies NewTask[])` in **einem** Aufruf und `returning(sichtbareSpalten).all()`. Der Dateikopf `:22-26` benennt „ein `returning()` über alles" als den teuren Fehler, bei dem AD-5 still fällt; `NurSichtbar` (`:61`) macht daraus einen Typfehler.
- **Die Textregel liegt heute in `src/routes/aufgabe/+page.server.ts`:** `NULLBREITE:79`, `TEXT_HOECHSTLAENGE:58`, `textPruefen:97-104`. Der Kommentar an `:58` begründet die lokale Konstante mit „genau eine Wurfstelle" — mit dieser Story sind es zwei, also zieht sie in ein geteiltes Modul um. **`scripts/smoke-zugang.ts:2609-2613` hält das `maxlength` textuell gegen `/const TEXT_HOECHSTLAENGE = (\d+);/` in der Routendatei** und bricht bei diesem Umzug; die Regex zeigt danach auf das neue Modul.
- **Die Zeitzone liegt in `src/lib/client/utils/date.ts:13`** (`ZEITZONE = 'Europe/Zurich'`), zusammen mit `datumLang()` — der einzigen Stelle, die einen Zeitstempel in Text verwandelt (AD-6). Der Server braucht dieselbe Zone für die Umrechnung von `JJJJ-MM-TT` in Unix-Sekunden. Die Konstante wandert in ein neutrales Modul, `date.ts` liest sie von dort.
- **Kein Wächter in der Route.** `src/hooks.server.ts:80-101` schützt jeden Pfad ausser `/i/…`; `/monatsplan` ist damit automatisch angemeldet-only. `locals` wird in dieser action **nicht** gelesen — es gibt keine Spalte, die einen Erfassenden hielte.
- **Der Meldungsträger auf `/`:** `src/routes/+page.server.ts:83-87` gibt `abgelegt: url.searchParams.has('abgelegt')`; der Docblock `:73-78` sieht die Zahl ausdrücklich vor („eine spätere Massen-Eingabe kann den Parameter mit einer Zahl belegen"). Die Oberfläche baut den Satz in `rueckmeldung` (`src/routes/+page.svelte:44-51`), der Fokusgriff steht im `$effect` (`:81-84`). **Drei smoke-Behauptungen hängen textuell daran:** `:2696-2703` (exakte Regex auf `rueckmeldung`), `:2704-2708` (Reihenfolge der Zweige), `:2725` (`/!data\.abgelegt/` im Effekt). Dazu die ausgeführten `:2310`, `:2325-2340`.
- **`/mehr` zeigt heute genau einen Eintrag und nur Admins.** `src/routes/mehr/+page.svelte:13-15` (Kommentar), `:20-30` (`{#if data.istAdmin}` mit `{:else} Nichts zu verwalten.`). Mit dem Monatsplan-Eintrag hat die Seite **immer** mindestens einen Eintrag: der `{:else}`-Zweig wird tot und fällt weg, der Kommentar wird falsch. `load` (`mehr/+page.server.ts:20-32`) bleibt unverändert — `istAdmin` wird weiter gebraucht.
- **Formularmuster und Doppelsperre** stehen fertig in `src/routes/aufgabe/+page.svelte`: `imFlug`-Zustand `:18`, `versand` mit `cancel()` und `try/finally` `:39-60`, Feldblock mit `aria-invalid`/`aria-describedby` `:88-104`, immer vorhandene Fehler-Live-Region `:117`. Der `try/finally` ist Pflicht (Retro B1): bricht `update()` ab, bliebe der Knopf sonst dauerhaft gesperrt.
- **Alle Bedienelement-Stile existieren global** in `src/lib/styles/bedienelemente.css` (eingebunden über `src/routes/+layout.svelte:5`): `.button-primary:52`, `.button-quiet:59`, `.feld:121-135` (volle Breite, `min-height: var(--touch)`, task-Rolle wegen der 16px, unter denen iOS beim Fokus hineinzoomt — deckt das `<textarea>` bis auf `min-height` und `resize` vollständig), `.feld[aria-invalid='true']:147-150`, `.feld__beschriftung:159-167`. `.seite`, `.seitentitel`, `.fehler` und `.live:empty` sind pro Seite dupliziert (Vorbild `aufgabe/+page.svelte:130-180`).
- **Tokens:** `--overdue` (`src/app.html:73`/`:196`) bleibt in dieser Story **unbenutzt** — es gehört Story 2.2, und Gate-Regel 8 macht daraus einen Hinweis, keinen Fehler (heute 2 Hinweise, danach weiterhin 2). Neu ist genau eines: die Mindesthöhe des Textfelds (`16em`, aus DESIGN.md `components.textarea-bulk.minHeight`). Ein rohes `16em` liefe an Gate-Regel 1 vorbei, die nur `px`/`rem` liest — deshalb als Token. Nicht-Farb-Tokens brauchen keinen Dunkel-Wert (Vorbild `--task-box:159`).
- **Mockup** `planning-artifacts/ux-designs/ux-Gartenplaner-2026-08-26/mockups/monatsplan.html` — Struktur und Wortlaut verbindlich, seine Rohmasse **nicht**: `padding: 10px 12px`, `margin: 8px 0 20px 2px`, ein `height: 8px`-Abstandshalter und `19px` für das `×` widersprechen der 4px-Skala und der Typo-Rampe. Es zeigt das Datumsfeld zudem als toten `<div>` mit `30. September 2026`; ein natives `<input type="date">` schreibt `30.09.2026`. Bei Widerspruch gewinnen die Spines.
- **smoke-Anschlussstellen** (`scripts/smoke-zugang.ts`, 2781 Zeilen): Modul-Lade-Helfer nach dem Muster `aufgabeLaden():562-566` samt Typ/Cache `:559-560`; Aufruf im Hauptteil wie `:2232`; die Zugangszeile pro Pfad wie `:2234-2241`; POST-Kurzform `ablegenMit:2250-2254`; Textprüfungen über `kommentarfrei:2482-2486`; Saat `aufgabeSaen:648-655` (braucht ein optionales `dueAt`); `ERWARTETE_BEHAUPTUNGEN:89` mit der einen Verwendung `:2768-2773`. Es gibt **keine** zentrale Liste geschützter Pfade — jede Route bringt ihre eigene Zeile mit.
- **`gate.mjs` und `db-check.ts` sind nicht anzufassen.** Regel 9 (`:660-697`), Regel 11 (`:1117-1197`) und Regel 3 (`:656-667`) greifen automatisch; ohne `npm run db:generate` schlägt allein die Drift-Prüfung an (`db-check.ts:291-302`) und macht `lint` rot. Zu liefern sind `drizzle/0002_*.sql`, `drizzle/meta/0002_snapshot.json` und der fortgeschriebene `_journal.json`. Die Fixture-Verzeichnisse bleiben unberührt, solange keine Regel geändert wird.

## Tasks & Acceptance

**Execution:**

- [x] `src/lib/zeit.ts` -- neu: `ZEITZONE` (aus `date.ts` hierher gezogen), `monatsendeAlsFeldwert(jetztSekunden): string` (letzter Tag des laufenden Monats in der Zone als `JJJJ-MM-TT`) und `tagesendeInUnixSekunden(feldwert): number | null` (23:59:59 des Tages in der Zone; `null` bei Formfehler oder unmöglichem Datum wie `2026-02-31`, geprüft über einen Rückvergleich der Bestandteile). Der Zonenversatz kommt aus `Intl.DateTimeFormat` mit `timeZone` und `hourCycle: 'h23'`; **eine** Runde genügt und die Begründung gehört als Kommentar dazu: die Schweizer Zeitumstellung liegt um 02:00/03:00, nie um 23:59
- [x] `src/lib/client/utils/date.ts` -- `ZEITZONE` von dort importieren statt selbst deklarieren; der Kommentar zur festen Zone bleibt und nennt jetzt beide Nutzer
- [x] `src/lib/aufgabentext.ts` -- neu: `NULLBREITE`, `AUFGABE_HOECHSTLAENGE = 200`, `aufgabentextFalten(eingabe): string` (die Kette aus `textPruefen`) und `zeilenErkennen(text): string[]` (je Zeile falten, leere weglassen). **Die eine Stelle**, an der steht, was eine Aufgabenzeile ist — gelesen von zwei actions und vom Zähler im Browser
- [x] `src/routes/aufgabe/+page.server.ts` -- `NULLBREITE`, die 200 und die Faltung aus `src/lib/aufgabentext.ts` beziehen statt lokal zu halten; die zwei Sätze und der Rest der action bleiben unverändert. Der Kommentar an der Grenze wird von „genau eine Wurfstelle" auf „zwei Wurfstellen, darum geteilt" umgeschrieben
- [x] `src/lib/server/db/schema.ts` -- `dueAt: integer('due_at')` an `tasks` ergänzen, nullbar, ohne `$defaultFn`, mit Kommentar: gesetzt vom Monatsplan für den ganzen Stapel, leer bei einer vor Ort erfassten Aufgabe, Grundlage der Überfälligkeit in Story 2.2. Die Kommentare `:11-13` und `:95-96` wahrheitsgemäss nachziehen
- [x] `drizzle/` -- `npm run db:generate` laufen lassen und die drei erzeugten Dateien mitliefern. Nichts von Hand ändern
- [x] `src/lib/server/db/queries/tasks.ts` -- `dueAt: tasks.dueAt` in `sichtbareSpalten`; neue Funktion `aufgabenStapelAnlegen(texte: string[], faelligAm: number): NurSichtbar[]` mit **einem** `insert().values([…])` und `returning(sichtbareSpalten).all()`. Im Docblock festhalten, warum es keine Transaktion braucht (ein mehrzeiliges INSERT ist atomar) und dass die Texte fertig geprüft hereinkommen
- [x] `src/routes/monatsplan/+page.server.ts` -- neu: `load` gibt nur `faelligBisVorgabe`; **eine** action `ablegen`, die `faelligBis` und `zeilen` liest, in dieser Reihenfolge prüft (Datum → Zeilen vorhanden → Höchstzahl → Zeilenlänge), bei Erfolg `aufgabenStapelAnlegen` ruft und mit `303` auf `/?abgelegt=<anzahl>` leitet. Vier lokale Sätze und `PLAN_HOECHSTZAHL = 100` samt Begründung: ein Monatsplan hat 20 bis 40 Aufgaben, und es gibt keine Löschen-Aktion, die einen versehentlich eingefügten Chatverlauf wieder aufräumte. `fail(400, { art: 'fehler', meldung, feld })` mit `feld: 'datum' | 'zeilen'`. Keine eigene Zugangsschranke, `locals` wird nicht gelesen. Importe relativ mit `.ts`, Typen aus `@sveltejs/kit`
- [x] `src/routes/monatsplan/+page.svelte` -- neu: beide Schritte in einer Komponente über `$state`. Schritt 1 ohne `<form>`: Datumsfeld (`type="date"`, `.feld`, sichtbare Beschriftung `Fällig bis`), Textfeld (`.feld`, `bind:value`, Mindesthöhe über das neue Token, `resize: vertical`, Beschriftung `Eine Aufgabe pro Zeile`), Zähler in der meta-Rolle aus `zeilenErkennen`, `Weiter` als `button-primary` und `type="button"`, gesperrt bei null Zeilen. Schritt 2 **ist** das Formular mit literalem `action="?/ablegen"` und `use:enhance`: Zwischentext `N Aufgaben, fällig bis <datumLang>`, `<ol>` mit je einem `×`-`<button type="button">` (Trefferfeld `--touch`, Name über `aria-labelledby` auf Zeilentext plus verborgenes `, entfernen` — dasselbe Muster wie das Kästchen auf `/`), zwei versteckte Felder `faelligBis` und `zeilen`, `N Aufgaben ablegen` als einziger `button-primary` und `Zurück zum Text` als `button-quiet`. Beim Wechsel nach Schritt 2 den Fokus auf die Überschrift holen (`tabindex="-1"`), damit der Schrittwechsel angesagt wird; der Zähler ist **keine** Live-Region — er spräche bei jedem Tastendruck. Fehler-Live-Region immer im Markup, `imFlug`-Doppelsperre mit `try/finally`
- [x] `src/app.html` -- ein Token für die Mindesthöhe des Textfelds im `:root`-Block, neben `--task-box`, mit Kommentar auf DESIGN.md
- [x] `src/routes/mehr/+page.svelte` -- `Monatsplan ablegen` als erster Eintrag, für **alle**; `Verwaltung` bleibt darunter und bleibt an `istAdmin`. Der `{:else}`-Zweig mit `Nichts zu verwalten.` fällt weg — die Liste ist nie mehr leer —, der Kommentar `:13-15` wird nachgezogen. `resolve()` ist für beide Ziele Pflicht
- [x] `src/routes/+page.server.ts` -- `abgelegt` wird `number | null`: kein Parameter → `null`, barer Parameter oder unlesbarer Wert → `1`, positive ganze Zahl → diese Zahl. Den Docblock von „Wahrheitswert" auf „Zahl" umschreiben; die Begründung „der Satz gehört zur Oberfläche" bleibt
- [x] `src/routes/+page.svelte` -- `rueckmeldung` baut aus der Zahl den Satz: `1` → `Abgelegt.`, sonst `N Aufgaben abgelegt.`; der Vorrang des jüngeren `form`-Ausgangs bleibt. Die Fokusbedingung im `$effect` von `!data.abgelegt` auf `data.abgelegt === null` umstellen
- [x] `scripts/smoke-zugang.ts` -- `monatsplanLaden()` neben `aufgabeLaden()`; `aufgabeSaen` um ein optionales `dueAt`; ein 2.1-Block mit jeder Zeile der Matrix **ausgeführt**: 403 ohne Cookie auf `/monatsplan`; ein Stapel von drei Zeilen erzeugt genau drei Zeilen mit **identischem** `due_at`, gefalteten Texten, leeren Erledigt-Spalten und `303` auf `/?abgelegt=3`; alle Abweisungen (leer, nur Leerraum, nur Nullbreiten, fehlendes Feld, Nicht-String, fehlendes/unlesbares/unmögliches Datum, 201 Codepoints, 101 Zeilen) ergeben `400` mit dem richtigen `feld` **und** unveränderter Zeilenzahl; 200 Codepoints und 100 Zeilen gehen durch; `due_at` liegt auf dem Tagesende in Europe/Zurich, nicht auf Mitternacht UTC; `load` gibt die Vorgabe als `JJJJ-MM-TT`. Dazu die `?abgelegt`-Behauptungen auf die Zahl umstellen (`:2310`, `:2325-2340`, `:2696-2708`, `:2725`), die `TEXT_HOECHSTLAENGE`-Regex auf das neue Modul richten (`:2609-2613`), und Textprüfungen für `/monatsplan`: kein `placeholder`, genau ein `button-primary` je Schritt, das `×` ist ein `<button>`, `use:enhance` am Formular, die zwei versteckten Feldnamen, die vollständige Doppelsperre. `ERWARTETE_BEHAUPTUNGEN` exakt nachziehen
- [x] `README.md` -- Abschnitt „Den Monatsplan ablegen" nach „Eine Aufgabe erfassen": die zwei Schritte, warum der Prüfschritt kein Server-Rundgang ist, das gemeinsame `due_at` samt Tagesende-Regel, die Grenzen 200 und 100. Nachziehen: der `/mehr`-Absatz (`:1264-1270`, jetzt zwei Einträge), die zwei falsch gewordenen Punkte unter „Was noch nicht hier ist" (`:1435-1438`), ein smoke-Absatz für Story 2.1 und die Mutationstabelle. Bei den benannt akzeptierten Risiken ergänzen: `/monatsplan` braucht JavaScript, und ein Stapel lässt sich nicht rückgängig machen

**Acceptance Criteria:**

- Given `npm run lint` und `npm run check`, when sie laufen, then enden beide mit 0 — `gate`, `gate:selftest`, `db:check`, `db:check:selftest` und `smoke` eingeschlossen
- Given `npm run db:check`, when es nach dieser Story läuft, then meldet der Drift-Lauf „No schema changes" — die Migration für `due_at` ist mitgeliefert
- Given `dueAt: tasks.dueAt` wird aus `sichtbareSpalten` entfernt, when `npm run check` läuft, then endet es mit 1
- Given das literale `action="?/ablegen"` wird verschrieben, when `npm run gate` läuft, then endet es mit 1 (Regel 11)
- Given ein realer Monatsplan von 20 bis 40 Aufgaben aus einer Notiz, when eine Person ihn einmal einfügt und ablegt, then ist der Aufwand nicht höher als die Papier- oder Chat-Variante (manuelle Prüfung, NFR3)
- Given 24 abgelegte Zeilen, when die Datenbank geprüft wird, then tragen alle 24 **denselben** `due_at`, und keine trägt einen Zuständigen
- Given `/monatsplan` bei 375px in Hell und Dunkel, when die Seite geprüft wird, then sind Datumsfeld, Textfeld, `Weiter` und jedes `×` mindestens 44px hoch, die Beschriftungen sind sichtbar statt Platzhalter, der Fokusring ist überall erkennbar, und je Schritt gibt es genau einen primären Knopf
- Given ein Screenreader, when `Weiter` gedrückt wird, then wird der Schrittwechsel über die fokussierte Überschrift `Prüfen` angesagt, und jedes `×` heisst `<Zeilentext>, entfernen`
- Given der ausgelieferte Quelltext von `/monatsplan`, when darin gesucht wird, then kommt kein Mitgliedsname und kein Hinweis auf Zuständigkeit vor
- Given `/mehr` als Nicht-Admin, when die Seite geöffnet wird, then steht dort `Monatsplan ablegen` und **kein** Hinweis darauf, dass es mehr gäbe

## Spec Change Log

**2026-08-27 — Kein Loopback. Zwei Funde des Reviews haben ihre Wurzel trotzdem in dieser Spezifikation; sie stehen hier, damit eine spätere Neuableitung sie nicht wieder erzeugt.**

Die drei Review-Ebenen fanden keinen `intent_gap` und keinen Fund, der einen Rückbau des ganzen Standes gerechtfertigt hätte. Zwei Funde waren aber **von der Spezifikation verursacht** und nicht vom Umsetzenden, und beide wären bei einer wortgetreuen Neuableitung wieder entstanden. Sie sind als Patch behoben; der Eintrag hält den Spec-Fehler fest, nicht die Behebung.

**1. Die Grenze `PLAN_HOECHSTZAHL` stand am falschen Ort.** Die Spezifikation legte sie in der Aufgabenliste ausdrücklich in `monatsplan/+page.server.ts` ab („Vier lokale Sätze und `PLAN_HOECHSTZAHL = 100`") und stellte im selben Atemzug die Invariante auf, der Zähler dürfe keine Zahl versprechen, die der Server nicht einlöst. Beides zusammen geht nicht: eine Grenze, die nur die action kennt, ist genau eine solche gebrochene Zusage — 500 eingefügte Zeilen ergaben `500 Aufgaben erkannt`, einen freien `Weiter`-Knopf, 500 gerenderte Zeilen und eine Abweisung erst nach dem Versand. **Richtig ist:** jede Regel, die der Zähler mitträgt, gehört in `src/lib/aufgabentext.ts` — dort, wo `AUFGABE_HOECHSTLAENGE` schon steht. Der Ortsentscheid „lokale Konstante, weil eine Wurfstelle" gilt nur für Sätze, nicht für Grenzen, die beide Seiten kennen müssen.

**2. „`Fällig bis` ist Pflicht" war nur als Serverregel geschrieben.** Die Spezifikation nannte die Pflicht in den Boundaries und in der Matrix ausschliesslich als Abweisung der action. Das `required` am Feld ist aber wirkungslos, weil Schritt 1 bewusst kein `<form>` ist — was dieselbe Spezifikation an anderer Stelle vorschreibt. Ergebnis: ein geleertes Feld kam bis in den Prüfschritt, wo `24 Aufgaben, fällig bis ` mitten in der Präposition endete, über einem freigeschalteten Ablegen-Knopf. **Richtig ist:** wo eine Regel eine Bedingung für den Schrittwechsel ist, muss die Spezifikation sie am Schrittwechsel festmachen und nicht nur an der action. Die Matrix hatte für diesen Weg keine Zeile — das ist der Grund, warum das Matrix-Audit ihn nicht fand.

**KEEP — was gut war und eine Neuableitung überleben muss.** Die geteilte Zerlegung (`zeilenErkennen` als eine Wahrheit für Zähler und action) war richtig und hat sich im Review gehalten; ebenso der zweistufige Zonenversatz in `src/lib/zeit.ts` (ausgeführt gegen Sommer, Winter, beide Umstelltage und ein Schaltjahr nachgemessen — die Rechnung war von Anfang an korrekt, es fehlte allein der Beleg), die Schrittfolge ohne Server-Rundgang, die Fokusführung über die Überschrift und die Entscheidung, einen zu langen Text den **ganzen** Stapel abweisen zu lassen statt still zu kürzen.

## Design Notes

**Warum der Prüfschritt kein Server-Rundgang ist.** AD-9 bindet jede Änderung an **Domänendaten** an eine form action. Schritt 1 → 2 ändert nichts: es zerlegt einen Text, den die Person gerade selbst getippt hat. Ein Rundgang dafür kostete eine Roundtrip-Latenz pro `×`, brauchte eine zweite action oder eine zweite Route, und der Server müsste den Zwischenstand irgendwo halten. Der Zähler unter dem Textfeld muss ohnehin bei jedem Tastendruck stimmen — damit ist die Zerlegung im Browser gesetzt, und der Prüfschritt bekommt sie geschenkt. Der Server bleibt trotzdem die Instanz: er zerlegt die übergebenen Zeilen mit **derselben** Funktion noch einmal und prüft sie, bevor etwas entsteht.

**Warum `/monatsplan` JavaScript braucht und `/aufgabe` nicht.** Der mitlaufende Zähler ist eine Zusage der Akzeptanzkriterien, und eine mitlaufende Zahl gibt es ohne JavaScript nicht. Die Ausfallrichtung ist die richtige: ohne JavaScript ist `Weiter` ein `type="button"` ohne Wirkung, es entsteht **nichts**, und die Person merkt es sofort — anders als bei einer stillen Teil-Anlage. Der Weg über `/aufgabe`, der vollständig ohne JavaScript funktioniert, bleibt daneben offen.

**Warum ein zu langer Text den ganzen Stapel abweist.** Die Alternativen sind schlechter: eine Zeile still zu kürzen erzeugt eine Aufgabe, die niemand so geschrieben hat, und eine Zeile still zu überspringen bricht die Zusage, die der Knopf trägt — `24 Aufgaben ablegen` muss 24 Aufgaben ablegen. Der Satz nennt darum die Zahl der zu langen Zeilen, und die Person geht mit `Zurück zum Text` an die eine Stelle, an der sich das beheben lässt. Dass die Prüfung erst beim Ablegen greift und nicht schon im Zähler, ist der Preis dafür, dass der Zähler nur eine Zahl ist und keine Fehlerliste.

**Warum `Fällig bis` Pflicht ist, obwohl die Spalte nullbar ist.** Nullbar ist sie wegen `/aufgabe`: eine vor Ort erfasste Aufgabe hat keine Frist, und `COALESCE(due_at, created_at)` in Story 2.2 fängt genau das ab. Ein Monatsplan **ohne** Frist wäre dagegen ein Widerspruch in sich — und würde in Story 2.2 dazu führen, dass Planaufgaben schon drei Wochen nach dem Anlegen als überfällig gelten, also genau der Fall, den ein Akzeptanzkriterium dort ausdrücklich ausschliesst.

**Warum das Tagesende und nicht Mitternacht.** `Fällig bis 31. August` heisst umgangssprachlich „bis der 31. vorbei ist". Mitternacht UTC läge in der Schweizer Sommerzeit zwei Stunden **vor** dem Beginn des gemeinten Tages, und eine am 31. erledigte Aufgabe wäre zwischendurch überfällig gewesen. Die Umrechnung braucht darum den Zonenversatz, und der Kommentar hält fest, warum eine einzige Runde genügt.

## Verification

**Commands:**

- `npm run check` -- expected: Exit 0 mit `--fail-on-warnings`; belegt zugleich, dass `monatsplan/+page.server.ts` im Skript-Programm auflösbar ist
- `npm run db:generate` -- expected: erzeugt `drizzle/0002_*.sql` plus Snapshot und Journal-Eintrag
- `npm run db:check` -- expected: Exit 0, Drift-Lauf meldet „No schema changes"
- `npm run smoke` -- expected: Exit 0, jede Zeile der Matrix ausgeführt belegt, `ERWARTETE_BEHAUPTUNGEN` stimmt
- `npm run lint` -- expected: Exit 0 über die ganze siebengliedrige Kette
- `env -u DATABASE_PATH -u SESSION_SECRET -u ORIGIN npm run build` -- expected: Exit 0

**Manual checks (if no CLI):**

- `/monatsplan` bei 375px in Hell **und** Dunkel: `Fällig bis` vorbelegt mit dem Monatsende, Textfeld mindestens 16em, Zähler darunter, genau ein primärer Knopf, Fokusring auf allem
- 27 Zeilen einfügen, davon drei leere: der Zähler sagt `24 Aufgaben erkannt`
- `Weiter`, zwei `×`, ablegen: die Seite landet auf `/`, dort steht `22 Aufgaben abgelegt.`, und die 22 Aufgaben stehen im Pool
- `Zurück zum Text`: das Textfeld ist unverändert, die entfernten Zeilen sind wieder da
- Alle Zeilen entfernen: der primäre Knopf ist gesperrt
- In der Datenbank: alle 22 Zeilen tragen denselben `due_at`, und er liegt auf dem Abend des gewählten Tages
- Mit VoiceOver: nach `Weiter` wird `Prüfen` angesagt, jedes `×` heisst `<Zeilentext>, entfernen`
- Mit abgeschaltetem JavaScript: `Weiter` tut nichts, es entsteht nichts
- `/mehr` als Nicht-Admin: `Monatsplan ablegen` steht da, `Verwaltung` nicht, und `Nichts zu verwalten.` erscheint nicht mehr

## Suggested Review Order

**Die Massen-Eingabe selbst — prüfen, anlegen, weiterleiten**

- Einstieg: die eine action in ganzer Länge — Datum, Zeilen, Höchstzahl, Länge, dann ablegen.
  [`monatsplan/+page.server.ts:131`](../../src/routes/monatsplan/+page.server.ts#L131)

- Die Reihenfolge der vier Prüfungen und der eine Ausgang je Feld.
  [`monatsplan/+page.server.ts:137`](../../src/routes/monatsplan/+page.server.ts#L137)

- Ein Fehlschlag mit 400: zwei Felder, ein Satz je Fall, nichts entsteht.
  [`monatsplan/+page.server.ts:84`](../../src/routes/monatsplan/+page.server.ts#L84)

- Der Stapel in **einem** INSERT, ohne Transaktion — die Begründung steht daneben.
  [`tasks.ts:157`](../../src/lib/server/db/queries/tasks.ts#L157)

**Die eine Wahrheit über eine Aufgabenzeile**

- Zerlegen und Falten: gelesen vom Zähler im Browser **und** von beiden actions.
  [`aufgabentext.ts:140`](../../src/lib/aufgabentext.ts#L140)

- Die 200 gilt jetzt zwei Wurfstellen, darum steht sie hier statt in der Route.
  [`aufgabentext.ts:80`](../../src/lib/aufgabentext.ts#L80)

- Die 100 gehört hierher, damit der Zähler nicht verspricht, was der Server abweist.
  [`aufgabentext.ts:100`](../../src/lib/aufgabentext.ts#L100)

**Zeit — die subtilste Rechnung der Story**

- Feldwert zu Tagesende in der Zone; warum eine Versatzrunde genügt.
  [`zeit.ts:132`](../../src/lib/zeit.ts#L132)

- Die Vorbelegung bestimmt den Monat in der Zone, nicht in UTC.
  [`zeit.ts:102`](../../src/lib/zeit.ts#L102)

- Die Zone steht einmal; `date.ts` liest sie von hier.
  [`zeit.ts:30`](../../src/lib/zeit.ts#L30)

**Die zwei Schritte im Browser**

- Der Schrittzustand: eine Route, kein Server-Rundgang dazwischen.
  [`monatsplan/+page.svelte:25`](../../src/routes/monatsplan/+page.svelte#L25)

- `Weiter` sperrt aus drei Gründen, und jeder trägt daneben seinen Satz.
  [`monatsplan/+page.svelte:123`](../../src/routes/monatsplan/+page.svelte#L123)

- Der Zwischentext endet nie mitten in einer Präposition — drei Zweige.
  [`monatsplan/+page.svelte:131`](../../src/routes/monatsplan/+page.svelte#L131)

- Schrittwechsel holt den Fokus auf die Überschrift, sonst bliebe er stumm.
  [`monatsplan/+page.svelte:223`](../../src/routes/monatsplan/+page.svelte#L223)

- Das `×` zerstört sich selbst; hier wird der Fokus aufgefangen.
  [`monatsplan/+page.svelte:266`](../../src/routes/monatsplan/+page.svelte#L266)

- Schritt 2 **ist** das Formular, mit literalem action und Doppelsperre.
  [`monatsplan/+page.svelte:449`](../../src/routes/monatsplan/+page.svelte#L449)

- Die Seite sagt selbst, dass sie JavaScript braucht, und nennt den Weg daneben.
  [`monatsplan/+page.svelte:527`](../../src/routes/monatsplan/+page.svelte#L527)

**Die Spalte und die Meldung — Eingriffe in Bestehendes**

- `due_at`: nullbar, ohne Vorgabe, ohne Index — alle drei begründet.
  [`schema.ts:154`](../../src/lib/server/db/schema.ts#L154)

- Die Projektion zwingt `due_at` in die Seitendaten; Story 2.2 rechnet darauf.
  [`tasks.ts:39`](../../src/lib/server/db/queries/tasks.ts#L39)

- `?abgelegt` trägt jetzt eine Zahl; drei Fälle, keiner ein Fehlschlag.
  [`+page.server.ts:67`](../../src/routes/+page.server.ts#L67)

**Peripherie**

- Das eine neue Token, neben `--task-box`.
  [`app.html:169`](../../src/app.html#L169)
