---
title: 'Story 1.5 — Aufgabe vor Ort erfassen'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 0
baseline_commit: '4c0aeb3689c5468de4543a035f286766644b09f5'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `tasks` und die Kernschleife gibt es seit Story 1.4, aber keinen Weg, aus der Oberfläche eine Aufgabe anzulegen — Aufgaben entstehen heute nur von Hand in der Datenbank, und der leere Zustand trägt darum noch keinen Knopf. Wer im Garten Blattläuse entdeckt, muss zwanzig Leute anschreiben oder es vergessen. Damit fehlt der Hälfte des Werkzeugs der Zufluss: eine Liste, die nur die planende Person füllt, ist ein Aushang, kein gemeinsamer Pool.

**Approach:** Eine eigene Seite `/aufgabe` mit **einem** Textfeld und **einem** primären Knopf `Ablegen`. Sie legt eine Zeile in `tasks` an — ohne Zuständigen, ohne Frist — und leitet auf `/` zurück, wo die neue Aufgabe in derselben Liste steht wie die geplanten. Auf `/` kommt der Knopf `+ Aufgabe` unter den Pool, in beiden Zuständen. Weil ein `redirect()` den Rückgabewert der action verwirft, legt diese Story zugleich das Muster fest, wie eine Meldung eine Weiterleitung überlebt.

## Boundaries & Constraints

**Always:**

- **Ein Feld, ein Knopf, keine Wahl.** Kein Fälligkeitsdatum, keine Kategorie, kein Beet, keine Priorität, kein Zuständiger, kein zweites Feld. Wer im Beet steht, tippt einen Satz und ist fertig.
- **Der Knopf trägt das Verb, die Meldung dasselbe Verb im Perfekt:** `Ablegen` → `Abgelegt.` (mit Punkt — bei Widerspruch zwischen `EXPERIENCE.md:58` und dem Akzeptanzkriterium gewinnt das Akzeptanzkriterium, und die zwei anderen Belegstellen schreiben ebenfalls einen Punkt).
- **Die Meldung reist als Query-Parameter.** `redirect(303, '/?abgelegt')`; die `load` von `/` liest `url.searchParams` und gibt einen Wahrheitswert; `/` setzt den Satz. Vom User am 2026-08-27 gegen ein Flash-Cookie und gegen ein Verbleiben im Formular entschieden: kein neuer Zustandsträger, funktioniert ohne JavaScript, in einem Blick lesbar. **Benannt akzeptiert:** die URL trägt `?abgelegt` sichtbar, ein Neuladen wiederholt die Meldung, und wer die Adresse von Hand eintippt, sieht sie auch.
- **Der Aufgabentext wird serverseitig geprüft, in genau der Kette aus `namePruefen`:** Nullbreiten-Zeichen entfernen, `\s+` zu einem Leerzeichen falten, `trim()`, leer abweisen, Codepoints zählen. **Obergrenze 200** — vom User am 2026-08-27 entschieden (`Tunnel 2 Blattläuse nachbehandeln` braucht 34; 200 lässt Raum für Ort und Zusatz und hält die Zeile lesbar). Gespeichert wird die gefaltete Fassung.
- **Ein abgewiesener Versand legt nichts an** und gibt `fail(400)` mit `art: 'fehler'`, `feld: 'text'` und der Eingabe zurück, damit sie im Feld stehen bleibt. Die Kante des Feldes wird über `aria-invalid` breiter, der Satz hängt über `aria-describedby` daran.
- **Jeder Datenbankzugriff läuft über eine neue benannte, synchrone Funktion in `queries/tasks.ts`** (AD-1, Gate-Regel 9). Sie projiziert über `sichtbareSpalten` — ein `returning()` über alles brächte `completed_by` und `completed_at` in die Route zurück und bräche AD-5 still.
- **Die Mutation ist eine form action in `+page.server.ts` mit `use:enhance`** und literalem `action="?/ablegen"` (AD-9, Gate-Regel 11). Kein `+server.ts`, kein dynamisches `action`.
- **`created_at` kommt aus dem Schema** (`$defaultFn`, Unix-Sekunden, AD-6), nie aus der Einfügefunktion und nie aus der Route.
- **`/aufgabe/+page.server.ts` importiert relativ mit `.ts`-Endung** und bezieht Typen aus `@sveltejs/kit`, nie aus `./$types` und nie über `$lib` — `scripts/smoke-zugang.ts` lädt dieses Modul. Dieselbe Begründung steht in `src/routes/+page.server.ts:1-9`.
- **Genau ein `button-primary` je Seite** (UX-DR10): auf `/` der Erfassen-Knopf, auf `/aufgabe` der Ablegen-Knopf. Kein Gate prüft das; es ist von Hand zu halten.
- Kein Hex-Wert, keine Farbfunktion, kein rohes `px`, `rem`, `ms` oder `s` in einem Komponenten-`<style>`; kein `var()` mit Fallback; keine neuen Tokens — die vorhandenen decken diese Story vollständig.
- Oberfläche deutsch in Schweizer Rechtschreibung ohne Eszett, Du-Form, bedienbar bei 375px, geprüft in Hell **und** Dunkel.

**Ask First:**

- Ein zweites Feld irgendeiner Art auf `/aufgabe` — Frist, Beet, Kategorie, Zuständiger.
- Eine Änderung an `tasks` (die Spalte `due_at` gibt es nicht und kommt mit Epic 2; diese Story ändert das Schema **nicht** und erzeugt **keine** Migration).
- Ein Bearbeiten oder Löschen einer erfassten Aufgabe — in keiner Story von Epic 1 vorgesehen.
- Eine Massen-Eingabe oder ein mehrzeiliges Feld — das ist Story 2.1 (`textarea-bulk`, 16em).
- Ein Zurück-Knopf oder Zurück-Pfeil auf `/aufgabe` (`EXPERIENCE.md:49`: Formularseiten schliessen mit ihrer Aktion, die Systemgeste des Browsers genügt).

**Never:**

- Keine Spalte, kein Feld und keine Ansicht, die eine Aufgabe im Voraus einer Person zuordnet — auch nicht „von mir erfasst".
- Kein modaler Dialog und kein Sheet für die Erfassung; es ist eine eigene Seite.
- Kein Platzhalter statt einer Beschriftung.
- Kein Verbleiben im leeren Formular nach dem Ablegen.
- Kein Bestätigungsdialog, keine Zählung, kein Fortschritt, keine Illustration.
- `/dienstplan`, `/wissen`, `/verwaltung` und `/mehr` bleiben unangetastet.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Seite öffnen | GET `/aufgabe` mit Cookie | Ein Feld mit sichtbarer Beschriftung, ein `button-primary` `Ablegen`, sonst nichts | N/A |
| Ohne Cookie | GET `/aufgabe` | 403 über den Wächter in `hooks.server.ts`, keine eigene Schranke in der Route | Die Fehlerseite aus Story 1.2 |
| Text ablegen | POST `?/ablegen`, `text` = `Tunnel 2 Blattläuse nachbehandeln` | Neue Zeile: `text` gefaltet, `created_at` Unix-Sekunden, `completed_by` und `completed_at` leer; `redirect(303, '/?abgelegt')` | N/A |
| Nach dem Ablegen | GET `/?abgelegt` | Die neue Aufgabe steht in der Liste (jüngste zuletzt), die Live-Region sagt `Abgelegt.` und nimmt einmalig den Fokus | N/A |
| Leeres Feld | POST `?/ablegen`, `text` = `''` | Keine Zeile, `fail(400)`, Feld behält den Fokusweg über `aria-describedby` | Ein Satz am Feld, der sagt, dass ein Text nötig ist |
| Nur Leerraum oder Nullbreiten-Zeichen | `'   '`, `'​'`, `'\n\t'` | Wie leer | Derselbe Satz |
| Feld fehlt oder ist kein String | POST ohne `text` | Wie leer | Derselbe Satz |
| Genau 200 Codepoints | POST `?/ablegen` | Wird angelegt — die Grenze ist einschliessend | N/A |
| 201 Codepoints | POST `?/ablegen` | Keine Zeile, `fail(400)` | Ein Satz, der die Grenze nennt |
| Leerraum innen und aussen | `'  Beet   25   jäten  '` | Gespeichert wird `Beet 25 jäten` | N/A |
| `/` ohne Parameter | GET `/` | Keine Meldung, Live-Region leer und aus dem Fluss | N/A |
| `?abgelegt` von Hand eingetippt | GET `/?abgelegt` | Die Meldung erscheint | N/A, benannt akzeptiert |
| Abhaken nach dem Ablegen | GET `/?abgelegt`, dann POST `?/abhaken` | Die Rückmeldung des Abhakens ersetzt `Abgelegt.` | N/A |
| Ohne JavaScript | Formular absenden | Funktioniert vollständig — die Meldung erscheint sichtbar, wird aber nicht angesagt | N/A, benannt akzeptiert |
| Doppeltipp auf `Ablegen` | Zwei Versande in Folge | Genau eine Zeile entsteht | Die Sperre aus 1.3/1.4 (`imFlug` plus `cancel()` plus `disabled`) |

</frozen-after-approval>

## Code Map

Am Stand `4c0aeb3` sondiert und belegt — nicht neu herleiten:

- **Das Schema deckt diese Story vollständig ab; es gibt nichts zu migrieren.** `src/lib/server/db/schema.ts:98-137`: `text` ist `notNull` ohne Länge und ohne CHECK (Leertext käme durch — die Prüfung muss in der Route stehen), `completedBy`/`completedAt` sind nullbar, `createdAt` trägt `$defaultFn(() => Math.floor(Date.now() / 1000))` und gehört **ausdrücklich nicht** in die Einfügefunktion (`:131-133`). `due_at` gibt es bewusst nicht (`:95-96`), einen Zuständigen bewusst nicht (`:87-93`). Kein `npm run db:generate` — eine überflüssige Migration liesse `db:check` rot werden.
- **Insert-Vorlage** ist `src/lib/server/db/queries/members.ts:47-61` (`mitgliedAnlegen`): `.insert(…).values({…} satisfies NewTask).returning(…).get()`. Die neue Funktion gehört in `queries/tasks.ts` **nach** `sichtbareSpalten` (`:35-39`) und vor `offeneAufgabenAuflisten` (`:57`), analog zur Ordnung in `members.ts`. **`returning(sichtbareSpalten)`, nicht `returning()`** — der Dateikommentar `tasks.ts:22-26` benennt „ein `returning()` über alles" als den teuren Fehler, bei dem AD-5 still fällt. `NewTask` ist in `tasks.ts:3` zu ergänzen.
- **Validierungskern zum Abschauen:** `src/routes/verwaltung/+page.server.ts:38-84` — `NULLBREITE`-Regex `:68`, `namePruefen()` `:77-84` in fester Reihenfolge (Nullbreiten weg → `\s+` falten → `trim()` → leer? → `[...text].length` zählen, weil `.length` UTF-16-Einheiten zählt und Emoji doppelt wiegt). `abweisen()` `:128-130` erzeugt `fail(400, { art, meldung, feld, …Eingabe })`. Die Grenze steht dort als lokale Konstante und **nicht** in `texte.ts`, weil es nur eine Wurfstelle gibt — dasselbe gilt hier.
- **`use:enhance` behandelt den Redirect selbst.** Geprüft in `node_modules/@sveltejs/kit/src/runtime/app/forms.js`: das an den Rückruf gereichte `update()` **ist** `fallback_callback`, und der ruft bei `result.type === 'redirect'` `applyAction(result)`. `applyAction` wiederum ruft `_goto(result.location, { invalidateAll: true })` (`runtime/client/client.js`). **Damit ist AD-7 ohne Zutun erfüllt** — die `load` von `/` läuft frisch, die neue Aufgabe ist da. Ein eigener Rückruf braucht also kein eigenes `applyAction`; ein blosses `await update()` genügt. Er darf danach aber **nicht** `fokusNach` aufrufen: die Komponente ist dann bereits verlassen.
- **`imFlug`-Doppelsperre** unverändert übernehmbar aus `src/routes/verwaltung/+page.svelte:83-133`: seitenweiter Zustand, `cancel()` im Rückruf für das Fenster vor dem wirksamen `disabled`. Das Formularmarkup ist die engste Vorlage: `:313-340` (`<label class="feld__beschriftung" for=…>`, `<input class="feld" … aria-invalid aria-describedby>`, bedingter `<p class="fehler" id=…>`, `<button class="button-primary" type="submit" disabled={imFlug}>`).
- **Alle Bedienelement-Stile existieren global** in `src/lib/styles/bedienelemente.css`, eingebunden über `src/routes/+layout.svelte:5`; der Dateikopf `:8-12` nennt Story 1.5 namentlich als Grund für „global statt Komponente". `.button-primary` `:52-56`, `.feld` `:121-135` (volle Breite, `min-height: var(--touch)`, task-Rolle wegen der 16px, unter denen iOS beim Fokus hineinzoomt), `.feld[aria-invalid='true']` `:147-150` (breitere Kante in `--ink-primary`, **nicht** rot — die Begründung steht dort), `.feld__beschriftung` `:159-167`. **Kein neues Stilblatt, kein neues Token** — der Fokusring liegt global in `src/app.html:222-224`.
- **`.seite` und `.seitentitel` sind pro Seite im `<style>` dupliziert**, nicht global (`src/routes/+page.svelte:245-261` gegen `mehr/+page.svelte:35-50`). `/aufgabe` bringt dieselben ~20 Zeilen mit. Seitenmuster überall gleich: `<svelte:head><title>Wort</title></svelte:head>`, dann `<div class="seite"><h1 class="seitentitel">Wort</h1>`, Titel und `h1` wortgleich.
- **Kein Wächter in der Route.** `src/hooks.server.ts:80-101` schützt jeden Pfad ausser `/i/…` zentral; `/aufgabe` ist damit automatisch angemeldet-only.
- **Der Anker auf `/`** ist `src/routes/+page.svelte:171-174`: dort steht wörtlich `<!-- Leerer Zustand ohne Erfassen-Knopf; der kommt mit Story 1.5 -->`. Der Knopf gehört **hinter** das `{#if}/{:else}` (nach Zeile 241), damit er in beiden Zuständen unter dem Pool steht — so zeigt es auch das Mockup (`mockups/startseite.html:114`, `:159`), und `EXPERIENCE.md:99` verlangt ihn ausdrücklich auch unter `Nichts offen.`. Als **`<a class="button-primary" href={resolve('/aufgabe')}>`**, nicht als `<button>`: er navigiert nur. `resolve()` aus `$app/paths` ist Pflicht (`svelte/no-navigation-without-resolve`), Vorbild `mehr/+page.svelte:23-24`. `.button-primary` trägt `text-decoration: none` und `appearance: none` und wirkt darum auch auf einem `<a>`.
- **Die Live-Region auf `/`** ist `src/routes/+page.svelte:145-154`, gespeist aus `rueckmeldung` (`:44-51`, `$derived` über `form`). Sie steht **immer** im Markup, auch leer, und `.live:empty` nimmt sie aus dem Fluss. **Der Kommentar `:150-151` sagt heute, sie trage bewusst kein `tabindex`** — diese Story ändert das für den einen Fall des Ankommens mit `?abgelegt` und muss den Kommentar mitziehen.
- **Es gibt kein Flash-Muster im Projekt.** `redirect(303, …)` kommt genau dreimal vor (`src/lib/server/adminschranke.ts:38`, `mehr/+page.server.ts:25`, `i/[token]/+server.ts:47`) und leitet jedes Mal stumm um. Kein Cookie, kein Store, kein `+layout.server.ts`. Diese Story legt das Muster für Story 2.1 (`22 Aufgaben abgelegt.`) mit fest.
- **Gate:** einschlägig sind Regel 1 (keine Farb-, Mass- oder Zeitliterale in `.svelte`/`.css` unter `src/`), Regel 2 (kein `var()` mit Fallback), Regel 3 (jedes `var(--x)` in `app.html` deklariert), Regel 9 (kein Drizzle-Import unter `src/routes/` — reines `import type` ist ausgenommen, `scripts/gate.mjs:668-673`) und Regel 11 (literales `action="?/ablegen"` braucht den gleichnamigen Eintrag in der Nachbardatei, `:1100-1180`). **Keine Regel wird erweitert, kein neues Fixture ist nötig.** Es gibt **keine** Gate-Regel zu Knöpfen — „höchstens ein primärer pro Seite" steht nur als Kommentar in `bedienelemente.css:51`.
- **Prüfskript:** `scripts/smoke-zugang.ts`. `ERWARTETE_BEHAUPTUNGEN` steht auf **`215`** (`:89`), von Hand zu pflegen. `Ereignis` `:285-355` mit `constructor(pfad, keks?, formular?)` — mit `formular` entsteht ein echter POST. `alsMitglied(pfad, mitglied, formular?)` `:562-571`, `routenausgang()` `:542-559` (`wert` | `weiter` | `fehlschlag`), `wegGeleitet()` `:573-580` behauptet 303 und den Ort, `abgewiesen()` `:582-591` behauptet 400 und den Satz. Aufrufmuster einer action: `:1375-1377` und `:1880-1884`. Modul laden: `startseiteLaden()` `:525-529` — ein `aufgabeLaden()` gehört daneben. **`aufgabeSaen()` `:600-618` trägt im Doc den Satz, es gebe noch keine Repository-Funktion, „weil das Erfassen erst mit Story 1.5 kommt"** — dieser Kommentar wird mit dieser Story falsch. Die Hilfe selbst bleibt: sie setzt `createdAt` ausdrücklich, was `aufgabeAnlegen` nicht kann. Der 1.4-Block endet bei `:2110`; die Textprüfungen an `+page.svelte` (`:2085-2109`) sind das Vorbild dafür, wie Svelte-Markup ersatzweise auf der kommentarbefreiten Datei geprüft wird.
- **`npm run lint`** ist siebengliedrig (`package.json:23`): prettier → eslint → gate → gate:selftest → db:check → db:check:selftest → smoke.

## Tasks & Acceptance

**Execution:**

- [x] `src/lib/server/db/queries/tasks.ts` -- `aufgabeAnlegen(text: string): SichtbareAufgabe` ergänzen, synchron, mit ausgeschriebener Rückgabeannotation und `returning(sichtbareSpalten)`. `createdAt` **nicht** setzen — es kommt aus dem Schema. `NewTask` in den Typimport aufnehmen und `satisfies NewTask` auf `.values({ text })` setzen, damit eine später ergänzte Pflichtspalte hier auffällt
- [x] `src/routes/aufgabe/+page.server.ts` -- neu: `actions.ablegen`. Die Prüfkette aus `namePruefen` mit der Grenze **200** als lokale Konstante samt Begründung im Kommentar; bei Erfolg `aufgabeAnlegen(gefaltet)` und dann `redirect(303, '/?abgelegt')`, bei Abweisung `fail(400, { art: 'fehler', meldung, feld: 'text', eingabe })`. Zwei Sätze, weil sie verschiedene Dinge zu tun geben: einer für „ohne Text entsteht nichts", einer für „zu lang" mit der Zahl. Keine `load`, keine eigene Zugangsschranke. Importe relativ mit `.ts`, Typen aus `@sveltejs/kit`
- [x] `src/routes/aufgabe/+page.svelte` -- neu: `<title>Aufgabe</title>`, `<h1 class="seitentitel">Aufgabe</h1>`, ein Formular mit **literalem** `action="?/ablegen"` und `use:enhance`, darin `<label class="feld__beschriftung">`, ein `<input class="feld" type="text" name="text">` mit `maxlength` als Vorwarnung und `autocomplete="off"`, der bedingte Fehlersatz über `aria-describedby`, und genau ein `<button class="button-primary">Ablegen</button>`. Die `imFlug`-Doppelsperre aus 1.3 übernehmen; der Rückruf ruft nur `await update()` — der Redirect erledigt sich darin selbst, ein `fokusNach` liefe ins Leere. Ein einzeiliges `<input>` und kein `<textarea>`: eine Aufgabe ist ein Satz, und die Eingabetaste legt sie ab. Kein Zurück-Knopf. `.seite`/`.seitentitel` wie auf den anderen Seiten mitbringen
- [x] `src/routes/+page.server.ts` -- `load` nimmt `{ url }` und gibt zusätzlich `abgelegt: url.searchParams.has('abgelegt')`. Ein Wahrheitswert, kein Satz — der Satz gehört zur Oberfläche, und Story 2.1 kann den Parameter später mit einer Zahl belegen, ohne die Form zu ändern
- [x] `src/routes/+page.svelte` -- den Erfassen-Knopf als `<a class="button-primary" href={resolve('/aufgabe')}>+ Aufgabe</a>` **hinter** das `{#if}/{:else}` des Pools setzen, damit er in beiden Zuständen steht; den Kommentar in `:172` ersetzen. `rueckmeldung` um den Fall erweitern: ist `form` leer und `data.abgelegt` gesetzt, lautet sie `Abgelegt.` — eine Rückmeldung des Abhakens gewinnt, weil sie die jüngere ist. Der Live-Region ein `tabindex="-1"` geben und den Fokus **genau einmal beim Ankommen mit dem Parameter** dorthin holen, nie nach dem Abhaken; den Kommentar `:150-151`, der heute „kein tabindex" behauptet, wahrheitsgemäss auf beide Fälle umschreiben
- [x] `scripts/smoke-zugang.ts` -- `aufgabeLaden()` neben `startseiteLaden()`; einen 1.5-Block hinter `:2110` mit jeder Zeile der Matrix **ausgeführt**: Ablegen erzeugt genau eine Zeile mit gefaltetem Text, Unix-Sekunden-`created_at` und leeren Erledigt-Spalten und leitet mit 303 auf `/?abgelegt`; leer, nur Leerraum, Nullbreiten-Zeichen, fehlendes Feld und Nicht-String ergeben alle `fail(400)` mit `feld: 'text'` **und** unveränderter Zeilenzahl; 200 Codepoints gehen durch, 201 nicht; die neue Aufgabe erscheint in der `load` von `/`; `load` gibt `abgelegt: true` nur mit dem Parameter. Dazu die Textprüfung, dass `/` genau einen `button-primary` mit Ziel `/aufgabe` trägt. Den falsch gewordenen Kommentar an `aufgabeSaen` (`:600-610`) richtigstellen und `ERWARTETE_BEHAUPTUNGEN` exakt nachziehen
- [x] `README.md` -- einen Abschnitt „Eine Aufgabe erfassen" nach „Aufgaben sehen und abhaken": ein Feld, ein Knopf, was geprüft wird und warum 200, und das Flash-Muster über den Query-Parameter samt seinen benannten Kosten. Den letzten Aufzählungspunkt in „Aufgaben sehen und abhaken" (`:575`, „Erfassen kann man hier noch nichts") und den ersten Punkt unter „Was noch nicht hier ist" (`:706-710`) ersetzen. Bei den benannt akzeptierten Risiken ergänzen: die Meldung erscheint bei jedem Neuladen von `/?abgelegt` erneut und lässt sich von Hand herbeiführen, und ohne JavaScript wird sie nicht angesagt

**Acceptance Criteria:**

- Given `npm run lint` und `npm run check`, when sie laufen, then enden beide mit 0 — `gate`, `gate:selftest`, `db:check` und `smoke` eingeschlossen
- Given `npm run db:check`, when es nach dieser Story läuft, then meldet es keine Schemaänderung — diese Story erzeugt **keine** Migration
- Given die Längenprüfung wird aus `ablegen` entfernt, when `npm run lint` läuft, then endet es mit 1
- Given `returning(sichtbareSpalten)` wird in `aufgabeAnlegen` durch `returning()` ersetzt, when `npm run check` läuft, then endet es mit 1 — die Projektion darf nicht am Augenschein hängen
- Given das literale `action="?/ablegen"` wird verschrieben, when `npm run gate` läuft, then endet es mit 1 (Regel 11)
- Given `/aufgabe` bei 375px in Hell und Dunkel, when die Seite geprüft wird, then sind Feld und Knopf mindestens 44px hoch, die Beschriftung ist sichtbar statt Platzhalter, der Fokusring ist auf beiden erkennbar, und es gibt genau einen primären Knopf
- Given ein leerer Versand, when er abgewiesen wird, then trägt das Feld eine breitere Kante **und** einen Satz darunter — der Zustand hängt nicht allein an der Farbe, und die Kante ist nicht rot
- Given ein Screenreader, when nach dem Ablegen `/` geladen ist, then wird `Abgelegt.` angesagt, weil die Live-Region den Fokus einmalig nimmt
- Given `/` ohne Parameter nach einem Abhaken, when die Seite betrachtet wird, then steht dort keine Ablege-Meldung und die Live-Region nimmt keinen Fokus
- Given der ausgelieferte Quelltext von `/aufgabe`, when darin gesucht wird, then kommt kein Mitgliedsname und kein Hinweis auf Zuständigkeit vor

## Spec Change Log

**2026-08-27 — Das Akzeptanzkriterium zu `returning()` griff in der geschriebenen Form nicht; die Projektion hängt jetzt am Typ statt am Augenschein.**

Das Kriterium lautete: wird `returning(sichtbareSpalten)` in `aufgabeAnlegen` durch `returning()` ersetzt, endet `npm run check` mit 1. Ausgeführt endete es mit **0**. Der Grund ist keine Nachlässigkeit, sondern TypeScript selbst: das Typsystem ist strukturell, und `returning()` liefert eine vollständige `Task`-Zeile, die alle Felder von `SichtbareAufgabe = Omit<Task, 'completedBy' | 'completedAt'>` trägt — **plus** zwei. Damit ist sie zuweisbar. Die Überschussprüfung, auf die sich `sichtbareSpalten` mit seinem `satisfies Record<keyof SichtbareAufgabe, unknown>` stützt, greift nur auf **Objektliteralen**; ein Funktionsrückgabewert ist keines. Die Rückgabeannotation allein trug die Zusage also nie — bei `aufgabeAnlegen` nicht und bei den zwei Mutationen aus Story 1.4 ebenso wenig.

Gebaut wurde statt dessen ein benannter Typ in `src/lib/server/db/queries/tasks.ts`:

```ts
type NurSichtbar = SichtbareAufgabe & Partial<Record<'completedBy' | 'completedAt', never>>;
```

Die zwei verbotenen Felder dürfen **fehlen** — eine richtig projizierte Zeile hat sie nicht —, aber kein Wert passt hinein. Eine Zeile mit `completedBy: number | null` ist damit nicht mehr zuweisbar, und der teure Fehler wird zum Typfehler. Nach aussen ändert sich nichts: `NurSichtbar` ist `SichtbareAufgabe` mit zwei optionalen Feldern, jede Zuweisung an `SichtbareAufgabe[]` bleibt gültig, und zur Laufzeit entsteht kein Byte.

**Warum alle vier Abfragefunktionen und nicht nur die neue.** Der Dateikopf von `queries/tasks.ts` benennt „ein `returning()` über alles" seit Story 1.4 als den teuren Fehler, bei dem AD-5 still fällt — und erhebt diesen Anspruch für **jede** Funktion der Datei, weil jedes der drei Ergebnisse in einer Antwort landet. Diese Zusage war bis hierher unbelegt. Eine Datei, in der eine Funktion typgeprüft ist und drei nur nach Augenschein, ist schlimmer als eine, in der keine es ist: sie liest sich, als wäre die Regel durchgesetzt. Der Eingriff ist typ-only, ohne Laufzeitwirkung und ohne Änderung an einer Signatur, die eine Route sieht.

Belegt durch Mutation: `returning(sichtbareSpalten)` → `returning()` in `aufgabeAnlegen` lässt `npm run check` jetzt mit 1 enden. Die Zeile steht in der Mutationstabelle in `README.md`.

## Design Notes

**Warum der Query-Parameter und nicht ein Flash-Cookie.** Ein `redirect()` aus einer form action verwirft den Rückgabewert; die Meldung braucht einen Träger über die Weiterleitung hinweg. Ein Cookie wäre einmalig und liesse die URL sauber, führte aber ein zweites Cookie neben dem Sitzungs-Cookie ein — bisher gibt es bewusst genau eines, und ein Cookie, das eine `load` schreibend wieder löscht, ist ein Mechanismus, den danach jede Story kennen muss. Der Parameter ist sichtbar, und genau das ist auch sein Vorteil: er steht in der Adresszeile, er ist von Hand nachvollziehbar, und er braucht keinen neuen Begriff. Der Preis — die Meldung erscheint bei jedem Neuladen erneut — ist bei einer Bestätigung ohne Folgen tragbar und ausdrücklich abgenommen.

**Warum die Live-Region diesmal den Fokus nimmt.** Eine Live-Region sagt nur *Änderungen* an. Nach dem Ablegen ist `/` eine frisch gemountete Route, ihr Inhalt steht von Anfang an da und würde stumm bleiben. Das ist derselbe Grund, aus dem Story 1.3 nach `aufnehmen` `fokusNach` aufruft. Der Fokus wird darum genau einmal geholt — beim Ankommen mit dem Parameter — und ausdrücklich **nicht** nach dem Abhaken, wo der Daumen auf dem Kästchen bleiben soll. Zwei Fälle, eine Region, eine Bedingung.

**Warum ein `<input>` und kein `<textarea>`.** Eine Aufgabe ist ein Satz, kein Absatz: `Tunnel 2 Blattläuse nachbehandeln`. Ein einzeiliges Feld schickt bei der Eingabetaste ab — im Garten, mit Handschuhen, ist das ein Griff weniger. `.feld` trägt ohnehin `min-height: var(--touch)`, das mehrzeilige Muster mit 16em gehört zur Massen-Eingabe von Story 2.1 und wäre hier ein leeres Feld, das nach einem Aufsatz aussieht.

**Warum die Grenze in die Route gehört und nicht in die Datenbank.** `text` ist `notNull` ohne CHECK — ein Leertext käme durch. Die Grenze ist eine Auslegung von „eine Aufgabe ist ein Satz" und keine Eigenschaft der Daten; sie in eine Migration zu giessen hiesse, sie nur noch mit einer Migration ändern zu können. Sie steht darum an derselben Stelle wie die 80 für Mitgliedsnamen, mit derselben Prüfkette und derselben Begründung im Kommentar.

## Verification

**Commands:**

- `npm run check` -- expected: Exit 0 mit `--fail-on-warnings`; belegt zugleich, dass `aufgabe/+page.server.ts` im Skript-Programm auflösbar ist
- `npm run lint` -- expected: Exit 0 über die ganze siebengliedrige Kette
- `npm run db:check` -- expected: Exit 0 **ohne** neue Migration — der Drift-Lauf meldet „No schema changes"
- `npm run smoke` -- expected: Exit 0, jede Zeile der Matrix ausgeführt belegt, `ERWARTETE_BEHAUPTUNGEN` stimmt
- `env -u DATABASE_PATH -u SESSION_SECRET -u ORIGIN npm run build` -- expected: Exit 0
- `curl -s localhost:4173/aufgabe -b <Cookie> | grep -c 'button-primary'` -- expected: `1`

**Manual checks (if no CLI):**

- `/aufgabe` bei 375px in Hell **und** Dunkel: Beschriftung sichtbar, Feld und Knopf ab 44px, Fokusring auf beiden, genau ein primärer Knopf, kein Zurück-Pfeil
- Einen Text eingeben und ablegen: die Seite landet auf `/`, `Abgelegt.` steht dort, und die neue Aufgabe ist die letzte in der Liste
- Leer ablegen: die Feldkante wird breiter (nicht rot), darunter steht der Satz, und auf `/` ist nichts entstanden
- Einen Text mit Leerraum vorn, hinten und doppelt in der Mitte ablegen: in der Liste steht er einfach gefaltet
- Auf `/` mit leerem Pool: `Nichts offen.` und **darunter** `+ Aufgabe`
- Mit VoiceOver nach dem Ablegen: `Abgelegt.` wird angesagt
- Mit abgeschaltetem JavaScript ablegen: es funktioniert, die Meldung steht sichtbar da

## Suggested Review Order

**Die Erfassung selbst — Regel, Prüfung, Weiterleitung**

- Einstieg: die action in ganzer Länge — prüfen, anlegen, weiterleiten, sonst nichts.
  [`aufgabe/+page.server.ts:150`](../../src/routes/aufgabe/+page.server.ts#L150)

- Die Prüfkette in der Reihenfolge aus Story 1.3; die Faltung ist das Gespeicherte.
  [`aufgabe/+page.server.ts:97`](../../src/routes/aufgabe/+page.server.ts#L97)

- Die Grenze 200 samt der benannten Asymmetrie zwischen Codepoints und `maxlength`.
  [`aufgabe/+page.server.ts:58`](../../src/routes/aufgabe/+page.server.ts#L58)

**Die Datenschicht — und der Typ, der die Projektion trägt**

- `NurSichtbar` macht aus der Zusage von AD-5 einen Typfehler statt einer Sichtprüfung.
  [`queries/tasks.ts:61`](../../src/lib/server/db/queries/tasks.ts#L61)

- Anlegen ohne Vorbedingung; `created_at` bleibt im Schema, nicht hier.
  [`queries/tasks.ts:94`](../../src/lib/server/db/queries/tasks.ts#L94)

**Das Flash-Muster — wie die Meldung die Weiterleitung überlebt**

- Der Parameter wird zum Wahrheitswert; der Satz bleibt der Oberfläche.
  [`+page.server.ts:83`](../../src/routes/+page.server.ts#L83)

- Zwei Quellen, eine Region: ein Ausgang aus `form` gewinnt, weil er der jüngere ist.
  [`+page.svelte:53`](../../src/routes/+page.svelte#L53)

- Der Fokusgriff genau einmal — sonst bliebe `Abgelegt.` auf frischer Route stumm.
  [`+page.svelte:92`](../../src/routes/+page.svelte#L92)

- Die Region trägt `tabindex="-1"`; ohne sie liefe der Griff ins Leere.
  [`+page.svelte:205`](../../src/routes/+page.svelte#L205)

**Die Oberfläche**

- Der Erfassen-Knopf steht hinter dem `{#if}` — darum auch unter `Nichts offen.`
  [`+page.svelte:310`](../../src/routes/+page.svelte#L310)

- Literales `action`, damit Gate-Regel 11 die Verbindung zur action sehen kann.
  [`aufgabe/+page.svelte:90`](../../src/routes/aufgabe/+page.svelte#L90)

- Der Fehlersatz steht immer im Markup — sonst sagt ihn kein Screenreader an.
  [`aufgabe/+page.svelte:128`](../../src/routes/aufgabe/+page.svelte#L128)

- `try/finally` um `update()`: der einzige Knopf der Seite darf nicht hängenbleiben.
  [`aufgabe/+page.svelte:41`](../../src/routes/aufgabe/+page.svelte#L41)

**Beleg**

- Der Story-Block: jede Matrixzeile ausgeführt, dazu die Verdrahtungsprüfungen.
  [`smoke-zugang.ts:2206`](../../scripts/smoke-zugang.ts#L2206)

- Die Erfassenseite im Modulindex — ohne `load`, mit ausgeführtem Beleg dafür.
  [`smoke-zugang.ts:555`](../../scripts/smoke-zugang.ts#L555)
