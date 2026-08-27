---
title: 'Story 1.4 — Offene Aufgaben sehen und abhaken'
type: 'feature'
created: '2026-08-27'
status: 'in-progress'
review_loop_iteration: 0
baseline_commit: '4f89296adc1362ec092fad128995a973b078ec7f'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Die Anwendung hat Zugang und Mitgliederverwaltung, aber keinen Gegenstand. `/` zeigt seit Story 1.1 den festen Satz `Nichts offen.`, es gibt keine Tabelle für Aufgaben und keinen Weg, etwas zu erledigen. Damit ist die tragende Produktannahme — dass zwanzig Freiwillige tatsächlich abhaken — nicht testbar, und das gesamte Adoptionsrisiko des Projekts liegt genau hier.

**Approach:** Die Tabelle `tasks` anlegen und darauf die Kernschleife bauen: `/` lädt die offenen Aufgaben und zeigt sie unter der Marke `OFFEN`; ein Antippen des Kästchens erledigt sie in **einer** Interaktion, ohne Rückfrage und ohne Formular; die Zeile bleibt an ihrem Platz durchgestrichen stehen, damit ein Fehlgriff sichtbar ist, und nochmaliges Antippen öffnet sie wieder. Zugleich wird die Dreierordnung der Startseite angelegt, von der diese Story nur den dritten Block füllt.

## Boundaries & Constraints

**Always:**

- **Abhaken kostet genau eine Interaktion.** Kein Formular, kein Statusfeld, kein Pflichtkommentar, keine Begründung, kein Bestätigungsdialog, kein zweiter Knopf.
- **Nur das Kästchen ist antippbar.** Sichtbar 22px, Trefferfeld mindestens 44 × 44 px über Innenabstand, ohne die Zeilenhöhe aufzublähen. Ein Antippen des Aufgabentexts tut nichts — ein Trefferfeld über die ganze Zeile würde im Beet versehentlich Aufgaben erledigen.
- **Das Kästchen ist ein echtes `<input type="checkbox">` in einem Formular**, kein `<div>` mit Klick-Handler, und seine Beschriftung kommt aus dem Aufgabentext, damit ein Screenreader Text **und** Erledigen-Aktion vorliest.
- **Das Abhaken lädt die Liste nicht neu.** Benannte Ausnahme von AD-7, vom User am 2026-08-27 entschieden: die Zeile muss an ihrem Platz stehen bleiben, damit ein Fehlgriff sichtbar ist, und ein `invalidateAll()` würde sie sofort entfernen. Sie verschwindet beim nächsten Laden — dann auch für alle anderen.
- **Nochmaliges Antippen öffnet die Aufgabe wieder** und setzt `completed_by` und `completed_at` zurück auf leer. Vom User am 2026-08-27 entschieden.
- **Nirgends ist zu sehen, wer abgehakt hat** (AD-5) — nicht im Text, nicht als Titel-Attribut, nicht in einem `data-`Attribut, nicht in den Seitendaten. `completed_by` und `completed_at` werden trotzdem gesetzt.
- **Aufgaben sind namenlos und haben keine Zuständigkeit im Voraus** (AD-2). `tasks` trägt **keine** Spalte für eine vorab zuständige Person. Jedes Mitglied darf jede Aufgabe abhaken.
- Jeder Datenbankzugriff läuft über neue benannte, **synchrone** Funktionen in `src/lib/server/db/queries/tasks.ts` (AD-1, Gate-Regel 9). Beide Mutationen tragen ihre Vorbedingung in der Abfrage, nicht in der Route.
- Beide Mutationen sind form actions in `+page.server.ts` mit `use:enhance` (AD-9). Kein `+server.ts`, kein JSON-Endpunkt.
- Zeitstempel sind SQLite-Integer in Unix-Sekunden (AD-6). Die Migration entsteht **ausschliesslich** über `npm run db:generate`; nichts unter `drizzle/` wird von Hand angefasst.
- Kein Hex-Wert, keine Farbfunktion, kein rohes `px`, `rem`, `ms` oder `s` in einem Komponenten-`<style>`; kein `var()` mit Fallback. Neue Tokens zuerst in `src/app.html` deklarieren.
- Der Übergang in den durchgestrichenen Zustand dauert 140ms und **entfällt bei `prefers-reduced-motion`**. Es ist die einzige Animation der Anwendung.
- Kein Zustand hängt allein an der Farbe: erledigt ist Durchstreichung **und** gefülltes Kästchen, nicht nur Dämpfung.
- Oberfläche deutsch in Schweizer Rechtschreibung ohne Eszett, Du-Form, bedienbar bei 375px, geprüft in Hell **und** Dunkel.
- `src/routes/+page.server.ts` importiert **relativ mit `.ts`-Endung** und bezieht Typen aus `@sveltejs/kit`, nie aus `./$types` und nie über `$lib` — `scripts/smoke-zugang.ts` lädt dieses Modul, und `tsconfig.scripts.json` kennt weder das virtuelle `./$types` noch die `$lib`-Zuordnung. Dieselbe Begründung steht in `src/routes/verwaltung/+page.server.ts:14-22`.

**Ask First:**

- Eine Spalte `due_at` oder irgendeine Frist- oder Überfälligkeitslogik — das ist Epic 2, die Überlappung ist im Epic-Kontext ausdrücklich akzeptiert.
- Eine Oberfläche zum Erfassen einer Aufgabe — das ist Story 1.5. Diese Story legt keinen Erfassen-Knopf an.
- Eine Zählung, ein Fortschrittsbalken, eine Serie, ein Abzeichen oder irgendeine Sichtbarkeit erledigter Aufgaben über die eigene Sitzung hinaus.
- Eine zeitliche Schranke für das Wieder-Öffnen.
- Ein Umbau von `scripts/smoke-zugang.ts` auf einen echten Server — steht als zurückgestellter Posten in `deferred-work.md`, samt dem vierstufigen Vorschlag.

**Never:**

- Keine Spalte, kein Feld und keine Ansicht, die eine Aufgabe im Voraus einer Person zuordnet.
- Kein Name an irgendetwas Erledigtem, in keiner Ansicht, auch nicht als Tooltip.
- Kein `<label for>` auf dem Aufgabentext — das machte den Text antippbar und bräche das Akzeptanzkriterium.
- Kein Polling, kein SSE, kein WebSocket, kein Service-Worker-Caching auf `/` (AD-7, AD-12).
- Keine Wischgeste, kein Bestätigungsdialog beim Abhaken, kein unendliches Nachladen, keine Illustration.
- Kein Verschwinden der Zeile im Moment des Abhakens.
- `/dienstplan`, `/wissen` und `/verwaltung` bleiben unangetastet.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Offene Aufgaben vorhanden | GET `/` | Alle offenen Aufgaben unter `OFFEN`, älteste zuerst, vollständig, ohne Nachladen | N/A |
| Keine offene Aufgabe | GET `/`, Tabelle leer oder alles erledigt | `Nichts offen.` — ohne Erfassen-Knopf, der kommt mit 1.5 | N/A |
| Erledigte Aufgaben vorhanden | GET `/` | Sie erscheinen **nicht**; die Seitendaten tragen weder `completed_by` noch `completed_at` | N/A |
| Kästchen antippen | POST `abhaken`, offene Aufgabe | `completed_by` = eigene Id, `completed_at` = jetzt; Zeile bleibt an ihrem Platz, durchgestrichen, Kästchen gefüllt | N/A |
| Neu laden nach dem Abhaken | GET `/` | Die Zeile ist fort, auch für alle anderen | N/A |
| Gefülltes Kästchen antippen | POST `wiederOeffnen`, erledigte Aufgabe | `completed_by` und `completed_at` sind wieder leer; die Zeile ist wieder offen dargestellt | N/A |
| Aufgabentext antippen | Tippen auf den Text | Nichts geschieht | N/A |
| Abhaken einer schon erledigten Aufgabe | POST `abhaken`, `completed_at` gesetzt | `fail(400)`, nichts geändert — der erste Abhakende bleibt gespeichert | Ein Satz, der nicht verrät, welcher der Fälle vorliegt |
| Wieder-Öffnen einer offenen Aufgabe | POST `wiederOeffnen`, `completed_at` leer | `fail(400)`, nichts geändert | Derselbe Satz |
| Unbekannte, fehlende oder nicht numerische `aufgabeId` | POST mit `999` / fehlt / `'abc'` | `fail(400)`, nichts geändert | Derselbe Satz für alle drei |
| Zwei Personen haken dieselbe Aufgabe fast gleichzeitig ab | POST `abhaken` zweimal | Der erste gewinnt und ist gespeichert; der zweite bekommt `fail(400)` und ändert nichts | Derselbe Satz |
| `prefers-reduced-motion: reduce` | Kästchen antippen | Derselbe Zustandswechsel, ohne Übergang | N/A |
| Ohne JavaScript | Kästchen antippen | Nichts geschieht — es wird nichts versehentlich erledigt | N/A, benannt akzeptiert |

</frozen-after-approval>

## Code Map

Am Stand `4f89296` sondiert und belegt — nicht neu herleiten:

- **`update()` aus `use:enhance` hat zwei Vorgaben, die diese Story still brechen.** Geprüft in `node_modules/@sveltejs/kit/types/index.d.ts:1878-1883`: `invalidateAll` ist standardmässig `true` — die Liste lädt neu und die abgehakte Zeile verschwindet sofort. `reset` ist standardmässig `true` — `form.reset()` setzt das Kästchen auf seinen serverseitig gerenderten Zustand zurück, also auf leer, und der Haken wäre wieder weg. Der Aufruf lautet deshalb `update({ reset: false, invalidateAll: false })`. **Zusätzlich** hängt die sichtbare Erledigt-Darstellung an Svelte-Zustand und nicht am `checked` des DOM-Kästchens, damit keine dieser Vorgaben sie überhaupt erreichen kann — zwei unabhängige Sicherungen, weil eine davon eine stille Zusage wäre.
- **`versand` aus Story 1.3 ist nicht übernehmbar** (`src/routes/verwaltung/+page.svelte:128-160`): es ruft `await update()` ohne Argumente, weil dort das Neuladen erwünscht ist. Übernehmbar sind dagegen unverändert: die Doppelsperre gegen Doppelversand (`imFlug` seitenweit plus `cancel()` **und** `disabled`), `fokusNach` über einen `art`-Diskriminator im Rückgabewert (`:110-126`), und die zwei Live-Regionen, die **immer leer im Markup stehen** und über `.live:empty` aus dem Fluss genommen werden statt über `display: none` (`:267-272`, `:480-485`).
- **`/` hat noch kein `+page.server.ts`**, und es gibt nirgends eine `+layout.server.ts`. `src/routes/+page.svelte:1-43` ist minimal: `<title>Aufgaben</title>`, ein `<h1 class="seitentitel">`, darunter `<p class="leer">Nichts offen.</p>`. **Der Kommentar in `:5-9` benennt die Dreierordnung schon** — Diensthinweis, freie Einzelaufgaben, offener Pool. Diese Story füllt nur den dritten und legt die anderen zwei als Platzhalter in der Reihenfolge an.
- **`locals.mitglied` ist in einer normalen Route nie `null`** (`src/hooks.server.ts:80-109`): der Wächter hat vorher mit 403 abgewiesen. `locals.mitglied.id` ist der Wert für `completed_by`; `/` braucht keine eigene Schranke.
- **Vorlage für `queries/tasks.ts`** ist `src/lib/server/db/queries/members.ts`. Die Mutationsform steht in `:165-173`: `update … set … where(and(eq(id), <Vorbedingung>)) … returning(<Projektion>) … get()`, Rückgabe `null` bei keinem Treffer. Die Begründung in `:151-163` gilt hier wörtlich weiter: die Vorbedingung steht **in der Abfrage**, und `null` bedeutet bewusst mehrdeutig, damit die Route **einen** Satz daraus macht. Für `abhaken` ist die Vorbedingung `completed_at IS NULL`, für `wiederOeffnen` `IS NOT NULL` — das erledigt zugleich das Wettrennen zweier gleichzeitiger Abhaker, ohne Transaktion und ohne Vorab-Select.
- **Die Projektion ist doppelseitig abgesichert** (`queries/members.ts:76-101`): `satisfies Record<keyof AngemeldetesMitglied, unknown>` fängt eine überzählige Spalte, die Rückgabeannotation von `ohneTokenHash` in `schema.ts:70-80` fängt eine fehlende. Dasselbe Paar ist für `tasks` anzulegen. Weil die Liste **nur offene** Aufgaben liefert, ist der stärkere Weg, `completed_by` und `completed_at` gar nicht in den Typ aufzunehmen: dann kann die Seite den Abhakenden nicht tragen, weil das Feld nicht existiert.
- **Schemakonventionen** (`src/lib/server/db/schema.ts:14-44`): snake_case als zweites Argument jedes Spaltenbauers, `integer(..., { mode: 'boolean' })` für Wahrheitswerte, Zeitstempel über `$defaultFn` im Schema statt in der Einfügefunktion, Zeilentypen über `$inferSelect`/`$inferInsert`, jede nicht-triviale Spalte mit einem Kommentar, der eine Entscheidung begründet. **`schema.ts:11-12` behauptet „genau eine Tabelle … tasks kommt mit Story 1.4" und wird mit dieser Story falsch.**
- **Migration:** `drizzle/` enthält heute genau `0000_flashy_eternity.sql` plus `meta/_journal.json` und `meta/0000_snapshot.json`. `npm run db:generate` erzeugt die neue `.sql`, aktualisiert das Journal und legt einen neuen Snapshot an. **`scripts/db-check.ts:219-322` lässt den echten Generator gegen eine Kopie der Kette laufen und verlangt „No schema changes"** — eine von Hand nachgezogene Migrationsdatei fällt dort sofort auf.
- **Tokens** (`src/app.html:66-160`): vorhanden sind neun Farbpaare, sieben Typografie-Rollen (`--task-size: 1rem` ist die Rolle des Aufgabentexts), `--radius-sm` 5px, `--space-1`…`--space-6`, `--touch: 2.75rem` (44px), `--border-hairline/-active/-marker` (1/2/3px). **Es fehlt ein Token für die sichtbaren 22px des Kästchens und es fehlt jedes Zeit-Token** — im ganzen Block steht kein einziger Zeitwert. `--border-active` (2px) und `--radius-sm` passen exakt auf die Vorgabe aus `DESIGN.md:243-253`.
- **Gate-Regel 1 fängt rohe `ms`-Werte nicht** (`scripts/gate.mjs:760-761`): der Massliteral-Regex prüft nur `(px|rem)\b`. Ein hartes `140ms` käme durch, das neue Zeit-Token wäre also von Anfang an umgehbar. **Regel 4 greift bei einem Mass-Token nicht** (`:580-602`, `istFarbwert` `:310-316`) — ein Nicht-Farbwert braucht kein Dunkel-Pendant. Regel 8 ist nur ein Hinweis.
- **Gate-Regel 11 liest `action="?/name"` textuell** aus der `.svelte` und vergleicht mit der Nachbardatei `+page.server.ts` (`scripts/gate.mjs:1054-1133`). Ein **dynamisches** `action={…}` würde sie nicht sehen. Darum zwei getrennte Formulare mit literalem `action`, bedingt gerendert, statt eines Formulars mit wechselndem Ziel — so bleibt die Regel für diese Story scharf.
- **`transition` und `prefers-reduced-motion` kommen im ganzen Baum nicht vor.** Diese Story führt beide ein, ohne Vorbild. Der Fokusring liegt global in `src/app.html:178-181`.
- **Listenvorlage** (`src/routes/verwaltung/+page.svelte:343-393`, Stile `:547-589`): `<h2>` plus `<ul class="liste" aria-labelledby>` und `{#each … (id)}`. Wiederverwendbar sind `.liste`, die Haarlinien-Trennung mit `:first-child`-Ausnahme und `min-height: var(--touch)`. **`.zeile` selbst nicht** — sie stapelt vertikal, die Aufgabenzeile braucht Kästchen links und Text rechts.
- **Das Mockup löst das Trefferfeld mit negativem Margin** (`_bmad-output/planning-artifacts/ux-designs/ux-Gartenplaner-2026-08-26/mockups/startseite.html:101-113`): ein 44px-Feld um das 22px-Kästchen, das die Zeilenhöhe nicht aufbläht. `OFFEN` ist dort ein Abschnittstitel über der Liste in der **`label`**-Rolle mit `text-transform` (`DESIGN.md:200`), nicht Teil jeder Zeile. Der leere Zustand heisst im Mockup „Nichts offen. Schön." — verbindlich ist `Nichts offen.`, weil bei Widerspruch die Spines gewinnen.
- **Zwei Verträge nennen zwei Zahlen für den Übergang:** `DESIGN.md:249` sagt 140ms, `EXPERIENCE.md:113` „unter 150 ms". Kein Konflikt; die konkrete Zahl gilt.
- **`EXPERIENCE.md` verweist auf ein Token `{colors.warn}`, das nicht existiert** — es heisst `overdue` beziehungsweise `--overdue`. Für diese Story ohne Folge, aber für Epic 2 notiert, damit dort niemand danach sucht.
- **Prüfkette:** `npm run lint` ist siebengliedrig (`package.json:24`). `ERWARTETE_BEHAUPTUNGEN = 185` in `scripts/smoke-zugang.ts:88` ist von Hand gepflegt. `Ereignis` kann seit 1.3 POST mit `FormData`: `constructor(pfad, keks?, formular?: Record<string, string>)` (`:284-349`). Das Aufrufmuster einer action steht in `:1309-1312`, `routenausgang()` in `:528-545` übersetzt `fail`/`redirect`/Rückgabewert. Das Muster „ein Wert steht **nicht** in den Seitendaten" steht in `:1761-1766` und ist für `completed_by` zu übernehmen. Gate hat zwölf Regeln und 23 Proben.

## Tasks & Acceptance

**Execution:**

- [x] `src/app.html` -- zwei Tokens ergänzen: die sichtbare Kästchengrösse (22px als `rem`) und die Übergangsdauer 140ms. Beide sind **keine** Farbwerte, brauchen also kein Dunkel-Pendant; Regel 3 verlangt aber die Deklaration, bevor sie irgendwo benutzt werden
- [x] `scripts/gate.mjs` + `scripts/gate-fixtures/` -- **Regel 1 auf rohe Zeitwerte ausdehnen** (`ms` und `s` in `transition`, `animation`, `transition-duration`, `animation-duration`). Ohne das ist das neue Zeit-Token von Anfang an umgehbar: der heutige Massliteral-Regex prüft nur `px` und `rem`, ein hartes `140ms` käme durch. Mit Fehlerprobe **und** Gegenprobe, die belegt, dass eine Null ohne Einheit und ein `var()`-Aufruf nicht fallen; `erwartet` je Probe begründet, Doku-Kopf und Regelzahl nachziehen
- [x] `src/lib/server/db/schema.ts` -- Tabelle `tasks`: `id`, `text` (der Aufgabentext, `notNull`), `completed_by` (`integer`, nullable, Fremdschlüssel auf `members.id`), `completed_at` (`integer`, nullable, Unix-Sekunden), `created_at` (`notNull`, über `$defaultFn`). **Keine Spalte für eine vorab zuständige Person** — das ist der Kern von AD-2 und gehört als Kommentar an die Tabelle, damit eine spätere Story sie nicht „nachträgt". Der Fremdschlüssel ist tragfähig, weil Zugang beenden deaktiviert statt löscht. Zeilentypen `Task`/`NewTask` und der Projektionstyp für offene Aufgaben (**ohne** `completed_by` und `completed_at`) mit Rückgabeannotation als Gegenrichtung der Absicherung. Kopfkommentar `:11-12` richtigstellen — er behauptet „genau eine Tabelle"
- [x] `drizzle/0001_*.sql` und `drizzle/meta/` -- über `npm run db:generate` erzeugen, mitliefern, **von Hand nie ändern**. `db:check` lässt den echten Generator gegen eine Kopie laufen und verlangt „No schema changes"
- [x] `src/lib/server/db/queries/tasks.ts` -- synchron: `offeneAufgabenAuflisten()` (nur `completed_at IS NULL`, älteste zuerst nach `created_at`, projiziert **ohne** die zwei Erledigt-Spalten, mit `satisfies Record<keyof …, unknown>`), `aufgabeAbhaken(id, mitgliedId)` und `aufgabeWiederOeffnen(id)`. Beide Mutationen tragen ihre Vorbedingung in der `where`-Klausel (`completed_at IS NULL` beziehungsweise `IS NOT NULL`) und geben `null` zurück, wenn keine Zeile getroffen wurde. Damit ist das Wettrennen zweier gleichzeitiger Abhaker ohne Transaktion entschieden, und der zweite erfährt nicht, ob die Aufgabe fehlte oder schon erledigt war
- [x] `src/lib/texte.ts` -- **eine** Konstante für den Satz, den beide actions bei jedem der vier nicht ansprechbaren Zustände zurückgeben (unbekannt, fehlend, nicht numerisch, falscher Erledigt-Zustand). Zwei Wurfstellen, ein Satz — jede Unterscheidung wäre ein Kanal
- [x] `src/routes/+page.server.ts` -- neu: `load` gibt die offenen Aufgaben; zwei actions `abhaken` und `wiederOeffnen`, beide lesen `locals.mitglied.id`, prüfen `aufgabeId` und geben einen `art`-Diskriminator zurück wie die actions aus 1.3. Importe relativ mit `.ts`, Typen aus `@sveltejs/kit`, weil das Prüfskript dieses Modul lädt
- [x] `src/routes/+page.svelte` -- die Dreierordnung anlegen: Block 1 Diensthinweis und Block 2 freie Einzelaufgaben als kommentierte Platzhalter, die nichts rendern, Block 3 der Pool. Darin `OFFEN` als Abschnittsmarke in der `label`-Rolle mit `text-transform`, die zugleich über `aria-labelledby` der zugängliche Name der Liste ist; `<ul class="liste">` mit Key; bei leerer Liste `Nichts offen.` **ohne** Erfassen-Knopf. Der bestehende `<h1>` und der `<title>` bleiben
- [x] `src/routes/+page.svelte` -- die Aufgabenzeile: Kästchen links, Text rechts. Das Kästchen ist ein `<input type="checkbox">`, das bei `change` sein Formular abschickt. **Kein `<label for>`** — das machte den Text antippbar; die Beschriftung entsteht über `aria-labelledby` auf dem Kästchen, das auf den sichtbaren Aufgabentext **und** ein visuell verborgenes Verb zeigt, sodass ein Screenreader „<Aufgabentext>, erledigen" mit der Rolle Kontrollkästchen vorliest und der Text trotzdem toter Text bleibt. Zwei getrennte Formulare mit **literalem** `action="?/abhaken"` beziehungsweise `action="?/wiederOeffnen"`, bedingt gerendert — ein dynamisches `action` würde Gate-Regel 11 blind machen
- [x] `src/routes/+page.svelte` -- der eigene `use:enhance`-Rückruf mit `update({ reset: false, invalidateAll: false })`, dazu die Erledigt-Darstellung aus Svelte-Zustand statt aus dem `checked` des DOM-Kästchens. Doppelsperre gegen Doppelversand und die zwei Live-Regionen aus 1.3 übernehmen; nach dem Abhaken **keinen** Fokuswechsel, weil der Daumen auf dem Kästchen bleibt und ein Sprung die nächste Zeile verfehlen liesse — die Live-Region sagt es an, ohne den Fokus zu holen
- [x] `src/routes/+page.svelte` -- Gestaltung: 22px sichtbar, 44px Trefferfeld über Innenabstand mit negativem Margin, damit die Zeilenhöhe nicht wächst; 2px Umriss in `--accent`, `--radius-sm`; gefüllt `--accent` mit Haken in `--accent-ink`; erledigt heisst Durchstreichung **und** gefülltes Kästchen **und** `--ink-secondary`, nie Dämpfung allein; Übergang über das neue Zeit-Token, gekapselt in `@media (prefers-reduced-motion: no-preference)`, damit die Abwesenheit der Bewegung der Standardfall ist und nicht eine Ausnahme, die jemand vergisst
- [x] `scripts/smoke-zugang.ts` -- die Zusagen dieser Story **ausgeführt** belegen, jede per Mutation als rot-werdend nachgewiesen: die `load` liefert nur offene Aufgaben, älteste zuerst, und ihre Seitendaten enthalten **keinen** `completed_by`-Wert und keinen Zeitstempel eines Erledigten; `abhaken` setzt beide Spalten und trägt die eigene Id; ein zweites `abhaken` auf dieselbe Zeile ergibt `fail(400)` und lässt den ersten Abhakenden unverändert; `wiederOeffnen` leert beide Spalten; `wiederOeffnen` auf eine offene Aufgabe ergibt `fail(400)`; unbekannte, fehlende und nicht numerische `aufgabeId` ergeben denselben Satz wie der falsche Erledigt-Zustand; nach dem Abhaken erscheint die Zeile in einer frischen `load` nicht mehr. `ERWARTETE_BEHAUPTUNGEN` exakt nachziehen
- [x] `README.md` -- die Kernschleife beschreiben: was `/` zeigt, dass ein Antippen genügt, dass die Zeile bis zum nächsten Laden stehen bleibt und nochmaliges Antippen sie wieder öffnet, dass niemand sieht wer abgehakt hat, und dass Aufgaben in dieser Story noch nicht erfasst werden können — das bringt Story 1.5. Die benannt akzeptierten Risiken erweitern: ohne JavaScript hakt nichts ab, und jedes Mitglied kann jede erledigte Aufgabe wieder öffnen, auch eine fremde und eine alte

**Acceptance Criteria:**

- Given `npm run lint` und `npm run check`, when sie laufen, then enden beide mit 0 — `smoke`, `gate:selftest`, `db:check` und `db:check:selftest` eingeschlossen
- Given `invalidateAll: false` wird aus dem Rückruf entfernt, when `npm run lint` läuft, then endet es mit 1 — die Zusage „die Zeile bleibt stehen" darf nicht am Augenschein hängen
- Given die Vorbedingung `completed_at IS NULL` wird aus `aufgabeAbhaken` entfernt, when `npm run lint` läuft, then endet es mit 1 — sonst überschreibt ein zweiter Abhaker den ersten
- Given `completed_by` wird in die Projektion der offenen Aufgaben aufgenommen, when `npm run lint` läuft, then endet es mit 1
- Given ein rohes `140ms` in einem Komponenten-`<style>`, when `npm run gate` läuft, then endet es mit 1
- Given eine Spalte wird in `schema.ts` ergänzt, ohne `db:generate` zu laufen, when `npm run lint` läuft, then endet es mit 1
- Given `npm run gate:selftest`, when es läuft, then weist es für die erweiterte Regel 1 eine Fehlerprobe **und** eine Gegenprobe nach
- Given die Aufgabenliste bei 375px in Hell und Dunkel, when sie geprüft wird, then ist das Kästchen 22px sichtbar bei mindestens 44px Trefferfeld, ein Antippen des Texts tut nichts, und die Zeilenhöhe wächst durch das Trefferfeld nicht
- Given ein Screenreader, when er eine Aufgabenzeile vorliest, then nennt er den Aufgabentext und die Erledigen-Aktion und meldet die Rolle Kontrollkästchen
- Given `prefers-reduced-motion: reduce`, when eine Aufgabe abgehakt wird, then wechselt der Zustand ohne Übergang
- Given der ausgelieferte Quelltext von `/`, when darin nach den Namen aller Mitglieder und nach `completed` gesucht wird, then steht dort kein Hinweis darauf, wer etwas abgehakt hat

## Spec Change Log

## Design Notes

**Warum das Abhaken die Liste nicht neu lädt.** AD-7 verlangt `invalidateAll()` nach jeder Mutation; das Akzeptanzkriterium verlangt, dass die Zeile an ihrem Platz bleibt. Beides ist nicht gleichzeitig zu haben, und der Entwurfsgrund gibt den Ausschlag: die Zeile bleibt stehen, **damit ein Fehlgriff sichtbar ist**. Ein sofortiges Verschwinden würde ausgerechnet den Fall verbergen, für den die Regel geschrieben wurde. Die Ausnahme gilt genau für diese eine Aktion und ist der Grund, warum die Liste nach dem Antippen nicht mehr frisch ist — bei zwanzig Personen und einer Handvoll Aufgaben pro Woche ist das kein Preis, der auffällt.

**Warum `aria-labelledby` und nicht `<label>`.** Zwei Vorgaben stehen scheinbar gegeneinander: der Aufgabentext soll die Beschriftung des Kästchens sein, und ein Antippen des Aufgabentexts soll nichts tun. Ein `<label for>` erfüllt die erste und bricht die zweite, weil ein Label sein Bedienelement schaltet. `aria-labelledby` auf dem Kästchen, das auf den sichtbaren Text und ein verborgenes Verb zeigt, erfüllt beide: der Screenreader liest `Beet 25 Nüsslisalat jäten, erledigen`, und der Text bleibt ein toter `<span>`.

**Warum die Vorbedingung in der Abfrage steht.** `UPDATE tasks SET … WHERE id = ? AND completed_at IS NULL` ist zugleich die Wettrennen-Auflösung: haken zwei Personen dieselbe Aufgabe im selben Moment ab, trifft der zweite `UPDATE` keine Zeile und bekommt `null`. Kein Vorab-Select, keine Transaktion, keine Sperre — und der erste Abhakende bleibt gespeichert, was AD-5 verlangt. Ein Vorab-Select in der Route hätte genau hier ein Zeitfenster.

**Warum die Erledigt-Spalten nicht im Typ vorkommen.** AD-5 verbietet nicht nur die Anzeige, sondern jede Zuordnung. Die Liste zeigt ohnehin nur offene Aufgaben, dort sind beide Spalten leer. Sie aus der Projektion herauszulassen macht aus einer Zusage der Oberfläche eine Eigenschaft des Typs: die Seite kann den Abhakenden nicht ausliefern, weil das Feld nicht existiert. Dasselbe Muster wie `invite_token_hash` in Story 1.2 und 1.3.

**Warum `prefers-reduced-motion: no-preference` und nicht `reduce`.** Den Übergang in eine `no-preference`-Abfrage zu kapseln heisst: keine Bewegung ist der Standardfall, und Bewegung ist die Ausnahme, die ausdrücklich eingeschaltet wird. Die umgekehrte Schreibweise — Übergang immer, in `reduce` wieder abschalten — hat dasselbe Ergebnis, aber jede künftige Animation muss daran denken. Diese ist die einzige Animation der Anwendung, und sie soll die Vorlage sein.

## Verification

**Commands:**

- `npm run db:generate` -- expected: genau eine neue `drizzle/0001_*.sql` plus Journal- und Snapshot-Aktualisierung, danach `npm run db:check` mit Exit 0
- `npm run check` -- expected: Exit 0 mit `--fail-on-warnings`; belegt zugleich, dass `+page.server.ts` im Skript-Programm auflösbar ist
- `npm run lint` -- expected: Exit 0 über die ganze siebengliedrige Kette
- `npm run gate:selftest` -- expected: Exit 0, je Regel eine Fehlerprobe, für die erweiterte Regel 1 zusätzlich eine Gegenprobe
- `npm run smoke` -- expected: Exit 0, jede Zeile der Matrix ausgeführt belegt, `ERWARTETE_BEHAUPTUNGEN` stimmt
- `env -u DATABASE_PATH -u SESSION_SECRET -u ORIGIN npm run build` -- expected: Exit 0
- `curl -s localhost:5173/ -b <Cookie> | grep -c completed` -- expected: `0`

**Manual checks (if no CLI):**

- `/` bei 375px in Hell **und** Dunkel mit mehreren offenen Aufgaben: Kästchen 22px, Trefferfeld ab 44px, Zeilenhöhe unverändert, Fokusring sichtbar, `OFFEN` als Marke über der Liste
- Ein Antippen des Kästchens: die Zeile bleibt **an ihrem Platz**, durchgestrichen und gedämpft, Kästchen gefüllt mit Haken. Danach den Aufgabentext antippen: nichts geschieht
- Nochmaliges Antippen des gefüllten Kästchens: die Zeile ist wieder offen
- Seite neu laden: die abgehakte Zeile ist fort. In einem zweiten Browser mit einem anderen Mitglied ebenfalls
- Bei leerer Liste steht `Nichts offen.` und **kein** Erfassen-Knopf
- Mit eingeschaltetem „Bewegung reduzieren" im Betriebssystem: derselbe Zustandswechsel ohne Übergang
