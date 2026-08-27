---
title: 'Story 1.3 — Mitglieder aufnehmen und Zugang beenden'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 1
baseline_commit: '581ceeccdce96616d90221325bcef90784c3047d'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nach Story 1.2 kommt genau eine Person in die Anwendung — die, für die `scripts/create-admin.ts` gelaufen ist; sein Zweitlauf-Schutz verweist wörtlich auf diese Story. Für die anderen neunzehn Gärtner\*innen gibt es keinen Weg herein und für niemanden einen Weg hinaus: `is_admin` und `is_active` stehen im Schema, werden aber von keiner Oberfläche gelesen oder gesetzt. `/mehr` existiert nicht, die Navigationsleiste führt dort ins Leere.

**Approach:** `/mehr` als Einstieg zu den seltenen Handlungen anlegen und darunter `/verwaltung` als ersten geschützten Bereich: aufnehmen mit einmaliger Anzeige des Klartext-Links, Link neu ausstellen, Einladung widerrufen — deaktivieren, nicht löschen. Weil es im Projekt bisher kein Formular gibt, setzt diese Story zugleich das Formularmuster (form action mit `use:enhance`), die Knopf- und Feldklassen des Gestaltungsrahmens und das einzige Rot der Anwendung.

## Boundaries & Constraints

**Always:**

- Alles unter `/verwaltung` verlangt `locals.mitglied.isAdmin` (AD-11). Ein Nicht-Admin wird mit `redirect(303, '/')` weggeleitet — kein Fehler, keine Meldung, keine eigene Seite. Die Schranke liegt in **einer** benannten Funktion und greift in der `load` **und** in jeder action; eine action ohne Schranke ist der Fehler, den die Oberfläche nicht sichtbar macht.
- Der Klartext des Tokens entsteht in der action, verlässt den Server genau einmal im Rückgabewert dieser action und wird nie gespeichert, nie geloggt, nie in eine URL, ein Cookie oder eine Weiterleitung gelegt. In `members` steht ausschliesslich der SHA-256-Hash (AD-10). Nach einem Neuladen ist der Link fort und nicht rekonstruierbar.
- Jeder Datenbankzugriff läuft über neue benannte, **synchrone** Funktionen in `src/lib/server/db/queries/members.ts` (AD-1, Gate-Regel 9). Kein `drizzle-orm`, kein `better-sqlite3`, kein `datenbank()` unter `src/routes/`.
- Jede Mutation ist eine form action in `+page.server.ts`, aufgerufen aus einem `<form method="POST">` mit `use:enhance` (AD-9). Kein `+server.ts`, kein JSON-Endpunkt, kein Mischen.
- Widerrufen setzt `is_active = 0`. Keine Zeile wird gelöscht, kein Name geändert, kein Hash geleert (AD-11).
- Ein Admin kann den **eigenen** Zugang nicht widerrufen und den eigenen Link nicht neu ausstellen. Geprüft in der action, nicht nur in der Oberfläche: sonst hängt die Unversehrtheit der Verwaltung an einem fehlenden Knopf.
- Aufgenommene Mitglieder entstehen immer mit `is_admin = 0`. Es gibt keine Oberfläche, die Adminrechte vergibt.
- Rot ist neu und kommt nur hier vor: **ein** Tokenpaar hell/dunkel in `src/app.html`, in beiden Blöcken (Gate-Regel 3 und 4), Kontrast gemessen und in den Design Notes belegt. Rot ist nie der einzige Träger einer Bedeutung — der Knopf sagt `Einladung widerrufen`.
- Kein Hex-Wert, keine Farbfunktion, kein rohes `px`/`rem` in einem Komponenten-`<style>`; kein `var()` mit Fallback (Gate-Regel 1 und 2). Trefferfelder über `var(--touch)`.
- Oberfläche deutsch in Schweizer Rechtschreibung ohne Eszett, Du-Form, bedienbar bei 375px, geprüft in Hell **und** Dunkel. Rückmeldung im Perfekt desselben Verbs (`Aufnehmen` → `Aufgenommen.`).
- `src/routes/verwaltung/+page.server.ts` und `src/routes/mehr/+page.server.ts` importieren **relativ mit `.ts`-Endung** und beziehen Typen aus `@sveltejs/kit`, nie aus `./$types` und nie über `$lib`. Grund ist geprüft, nicht vermutet: `scripts/smoke-zugang.ts` lädt diese Module, und `tsconfig.scripts.json` kennt weder das virtuelle `./$types` noch die `$lib`-Zuordnung. Dieselbe Begründung steht schon in `src/routes/i/[token]/+server.ts`.

**Ask First:**

- Eine Oberfläche, die Adminrechte vergibt oder entzieht.
- Ein Reaktivieren eines beendeten Zugangs.
- Eine `unique`-Bedingung auf `members.name` oder irgendeine andere Schemaänderung — diese Story legt keine Tabelle und keine Spalte an.
- Ein Umbau von `scripts/smoke-zugang.ts` auf einen echten Server. Das steht als bewusst zurückgestellter Posten in `deferred-work.md`; diese Story erweitert die Attrappe um POST und `FormData` und rührt die Bauform nicht an.

**Never:**

- Kein Löschen eines Mitglieds, kein Hard-Delete, kein Leeren des Namens.
- Kein Klartext-Token in der Datenbank, in einem Protokoll, in einer URL, in einem Cookie, in `localStorage`.
- Kein Versand des Links durch die Anwendung — keine E-Mail, kein Messenger. Der Link geht von Hand weiter.
- Kein Zurück-Pfeil. Kein modaler Dialog ausser der einen Widerruf-Bestätigung.
- Kein `{@html}` für den Link, kein `{#each}` ohne Key.
- `/dienstplan` und `/wissen` bleiben unangetastet.
- Keine Zählung erledigter Aufgaben, kein Name an irgendetwas Erledigtem — auch nicht vorbereitend.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `/mehr` als Admin | GET, `isAdmin = 1` | Seite mit eigenem Namen und dem Eintrag `Verwaltung` | N/A |
| `/mehr` als Nicht-Admin | GET, `isAdmin = 0` | Dieselbe Seite **ohne** den Eintrag, mit Leerzustandssatz | N/A |
| `/verwaltung` als Admin | GET, `isAdmin = 1` | Aufnahmeformular und alle Mitglieder, aktive und beendete | N/A |
| `/verwaltung` als Nicht-Admin | GET, `isAdmin = 0` | `redirect(303, '/')` | Kein Fehler, keine Meldung, kein Hinweis auf den Bereich |
| Aufnehmen gelingt | POST `aufnehmen`, `name = 'Anna Meier'` | Mitglied mit `is_admin = 0`, `is_active = 1`; action gibt Name und Klartext-Link **einmal** zurück; Liste enthält die Zeile | N/A |
| Name leer oder nur Leerzeichen | POST `aufnehmen`, `name = '   '` | `fail(400)`; kein Mitglied, **kein Token erzeugt** | Meldung am Feld, Eingabe bleibt stehen |
| Seite nach dem Aufnehmen neu laden | GET nach erfolgreichem POST | Der Link ist fort und nirgends abrufbar | N/A |
| Link neu ausstellen | POST `neuAusstellen`, fremdes aktives Mitglied | Neuer Hash ersetzt den alten; neuer Klartext-Link einmal; der alte Link ergibt die Fehlerseite aus 1.2 | N/A |
| Widerrufen | POST `widerrufen`, fremdes aktives Mitglied | `is_active = 0`, Zeile bleibt vollständig; alter Link ergibt die Fehlerseite aus 1.2 | N/A |
| Widerrufen oder Neuausstellen auf sich selbst | POST, `mitgliedId = locals.mitglied.id` | `fail(400)`, nichts geändert | Meldung, dass die Verwaltung sonst ohne Zugang bliebe |
| Unbekannte, fehlende oder nicht numerische `mitgliedId` | POST `mitgliedId = '999'` / fehlt / `'abc'` | `fail(400)`, nichts geändert | Ein Satz für alle drei Fälle — keine Auskunft, ob die Zeile existiert |
| Widerrufen auf ein schon beendetes Mitglied | POST `widerrufen`, `is_active = 0` | `fail(400)`, nichts geändert | Derselbe Satz wie beim unbekannten Mitglied |
| POST als Nicht-Admin | POST auf jede der drei actions, `isAdmin = 0` | `redirect(303, '/')`, nichts geändert | N/A |

</frozen-after-approval>

## Code Map

Am Stand `581ceec` sondiert und belegt — nicht neu herleiten:

- **Der Wächter setzt keine Adminrechte durch.** `src/hooks.server.ts:80-109` lädt das Mitglied bei jedem Aufruf frisch, prüft `is_active` und legt `event.locals.mitglied = ohneTokenHash(mitglied)` ab (`:104`). `isAdmin` wird nirgends im Baum gelesen. Die Adminschranke ist vollständig neu.
- **`locals.mitglied` trägt `isAdmin`.** Typ `AngemeldetesMitglied` (`src/lib/server/db/schema.ts:56`, `src/app.d.ts:14-26`) lässt nur `inviteTokenHash` weg. Der Admin-Check braucht **keine** zusätzliche Abfrage.
- **Eine 403 aus einer Route ist nicht die 403 des Wächters.** Der Wurf des Wächters verlässt SvelteKit über den Fatal-Pfad in `src/error.html`, ohne Rahmen. Ein `error()` aus einer `+page.server.ts` läuft normal durch `resolve` und landet in `src/routes/+error.svelte`. Dort wählt `:24` nach der **Meldung**, nicht nach dem Status — eine leere 403-Meldung fällt auf `KEIN_ZUGANG` zurück und zeigte „Dieser Link gilt nicht mehr". **Diese Story wirft deshalb gar keine 403, sondern leitet weiter** (EXPERIENCE.md:105); die Falle bleibt trotzdem notiert.
- **Gestaltungstokens stehen in `src/app.html:45-150`**, nicht in `+layout.svelte`. `:root` ab `:51` ist Hell, der Block `@media (prefers-color-scheme: dark)` ab `:139` überschreibt genau die acht Farben. `src/lib/styles/fonts.css` trägt nur `@font-face`.
- **Verfügbare Tokens:** Farben `--surface-base`, `--surface-raised`, `--ink-primary`, `--ink-secondary`, `--hairline`, `--accent`, `--accent-ink`, `--overdue`. Rollen `display`, `section`, `task`, `body`, `meta`, `label`, `action` (je `-font/-size/-weight/-line`, teils `-tracking`) — `--action-*` ist die Knopfrolle. Dazu `--radius-sm/md/lg`, `--space-1`…`--space-6`, `--gutter`, `--measure`, `--touch`, `--navbar-height`, `--border-hairline/-active/-marker`. **Kein Rot, kein Formfeld-Token.**
- **`button-primary` und `button-quiet` existieren nicht.** `src/lib/components/` enthält nur `NavBar.svelte` und `TitleBar.svelte`; im ganzen Baum gibt es kein `<form>`, kein `use:enhance`, keine `actions`, kein Textfeld. Spezifikation der Klassen: DESIGN.md:255-261.
- **Fokus und Sprunglink sind global gelöst.** `:focus-visible` in `src/app.html:172-175`, Sprunglink und `<main id="inhalt" tabindex="-1">` in `src/routes/+layout.svelte:33-40`. Neue Seiten brauchen dafür nichts; sie tragen je genau ein `<h1 class="seitentitel">` in der `display`-Rolle wie `+page.svelte` und `+error.svelte`.
- **Gate-Regeln, die hier greifen** (`scripts/gate.mjs`): Regel 1 (`:661-750`) verbietet Hex, Farbfunktionen, die 148 Farbnamen, jede Systemfarbe und jedes rohe `px`/`rem` ≠ 0 in `<style>` **und** `style="…"`. Regel 2 (`:607`) verbietet `var()`-Fallbacks. Regel 3 (`:617`) verlangt jedes `var(--x)` als Deklaration in `app.html` — **Token zuerst dort anlegen**. Regel 4 (`:559-581`) prüft **beide** Richtungen: ein Farbwert ohne Dunkel-Pendant und ein Dunkel-Wert ohne Hell-Pendant sind je ein Verstoss; die Erkennung ist wertbasiert (`istFarbwert`, `:289`), ein neues `--danger: #…` zählt automatisch. Regel 9 (`:629-659`) fasst alle vier verbotenen Importformen auf eine Basis zusammen; eigenständiges `import type` ist ausgenommen, ein Inline-`{ type A, b }` nicht. Regel 7 (`:872`) arbeitet über das globale Muster `**/*.svelte` — für neue Dateien ist nichts nachzutragen. Regel 5, 6 und 8 sind nicht berührt.
- **`resolve()` aus `$app/paths` ist Pflicht für interne Ziele** (`svelte/no-navigation-without-resolve`, aktiv über `eslint.config.js:56-76`) und im Baum **nirgends** vorhanden: die drei Treffer für `resolve` sind SvelteKits `resolve(event)` und `node:path`. Ein literales `href={resolve('/verwaltung')}` erfüllt die Regel. Der `eslint-disable`-Block in `src/lib/components/NavBar.svelte:34-47` bleibt nötig, aber aus einem anderen Grund als dort behauptet: der `href` kommt aus einer Variablen, durch die die Regel nicht hindurchsieht. Ebenfalls scharf: `svelte/require-each-key`, `svelte/no-at-html-tags`.
- **Repository und Bausteine.** `src/lib/server/db/queries/members.ts` hat `mitgliederZaehlen`, `mitgliedNachTokenHash`, `mitgliedNachId`, `mitgliedAnlegen` (`:47-61`, nimmt einen fertigen `inviteTokenHash` — die Route erzeugt das Token selbst). Auflisten, Deaktivieren und Neuausstellen fehlen. `src/lib/server/token.ts` liefert `tokenErzeugen()` und `tokenHashen()`, frei von SvelteKit-Importen. `inviteTokenHash` ist `unique().notNull()` — Neuausstellen ist ein `UPDATE` derselben Zeile, kein `INSERT`. Auf `name` gibt es **keine** Eindeutigkeitsbedingung (`scripts/create-admin.ts:88-89`).
- **`sitzungLoeschen` in `src/lib/server/auth.ts:125-127` wurde ausdrücklich für diese Story bereitgehalten.** Mit dem Verbot des Selbstwiderrufs gibt es hier keinen Aufrufer: ein Widerruf trifft immer ein fremdes Cookie, das der Wächter beim nächsten Aufruf ohnehin verwirft. Der Kommentar dort ist auf diesen Stand zu bringen, statt eine Verwendung zu behaupten, die es nicht gibt.
- **Prüfkette.** `npm run lint` ist `prettier && eslint && gate && gate:selftest && db:check && db:check:selftest && smoke` (`package.json:24`). `npm run check` zieht `tsconfig.scripts.json` mit, also transitiv jedes Modul, das `scripts/**` importiert. **Ohne Schemaänderung ist kein `db:generate` nötig** und `db:check` bleibt grün (`scripts/db-check.ts:219-322`).
- **`scripts/smoke-zugang.ts`, wiederverwendbar:** `pruefen`/`pruefenGleich` (`:121`,`:131`), `Kekse` (`:219`), `Ereignis` (`:272`, gebundene eigene Eigenschaften, damit Destrukturierung nicht bricht), `routeAufrufen` (`:329`, dynamischer Import mit `isRedirect`/`isHttpError`-Fang), `antwortOderRot`/`abweisungOderRot` (`:393`,`:410`), `wegwerfVerzeichnis` (`:96`), Rohdatei-Suche nach dem Klartext via `readFileSync(…, 'latin1')` (`:1040-1046`). **`Ereignis` baut `new Request(this.url)` ohne Methode und ohne Body (`:283`)** — für eine action ist POST mit `FormData` zu ergänzen. **`ERWARTETE_BEHAUPTUNGEN = 109` (`:76`) ist von Hand gepflegt und muss exakt nachgezogen werden.**
- **`scripts/create-admin.ts:68-74`** verweist auf „das kommt mit Story 1.3". Der Text ist nachzuziehen; das Wort `erste` muss darin bleiben, weil `scripts/smoke-zugang.ts:1004` es behauptet.

## Tasks & Acceptance

**Execution:**

- [x] `src/app.html` -- `--danger` in `:root` **und** im Dunkel-Block ergänzen (`#A32E22` / `#E8877B`, gemessen in den Design Notes). Nur dieses eine Paar: der zerstörende Knopf ist durchsichtig mit rotem Text und rotem Umriss, es gibt keine gefüllte rote Fläche und darum kein `--danger-ink`. Zuerst hier, sonst schlägt Regel 3 beim ersten `var(--danger)` fehl
- [x] `src/lib/styles/bedienelemente.css` -- neue globale Klassen, eingebunden in `src/routes/+layout.svelte:3` neben `fonts.css`: `.button-primary`, `.button-quiet`, `.button-quiet--zerstoerend` (Text und Umriss `var(--danger)`), `.feld` und `.feld__beschriftung`. Volle Spaltenbreite, `min-height: var(--touch)`, `--radius-md`, Knopftext in der `action`-Rolle. Global und nicht als Komponente, weil 1.4 und 1.5 dieselben Knöpfe brauchen und eine Klasse ohne Fassade billiger ist als eine Komponente mit Durchreiche
- [x] `src/lib/server/adminschranke.ts` -- `adminOderWeg(locals)`: wirft `redirect(303, '/')`, wenn `locals.mitglied` fehlt oder `isAdmin` falsch ist. **Eine** Funktion für vier Aufrufstellen (`load` plus drei actions); eine Kopie je action ist genau die Stelle, an der eine vergessen wird
- [x] `src/lib/server/db/queries/members.ts` -- synchron ergänzen: `mitgliederAuflisten()` (alle, aktive zuerst, dann nach Name), `mitgliedDeaktivieren(id)` und `einladungNeuAusstellen(id, inviteTokenHash)`. `mitgliederAuflisten` gibt `AngemeldetesMitglied[]` zurück, also **ohne** `inviteTokenHash` — eine vollständige Zeile landete über `data` der `load` im ausgelieferten HTML jeder Verwaltungsseite, und der Hash sähe dort wie eine beliebige Kennung aus. Entweder über `ohneTokenHash` (`src/lib/server/db/schema.ts:70`) oder als Spaltenauswahl im `select`, nie als `select()` über alles. Beide Mutationen geben zurück, ob eine Zeile getroffen wurde, und beide fassen ausschliesslich ein **aktives** Mitglied an — sonst müsste die Route die Bedingung wiederholen und eine der drei Stellen tut es falsch
- [x] `src/lib/texte.ts` -- zwei Konstanten für die Sätze mit je zwei Wurfstellen: Selbstwiderruf abgelehnt und Mitglied nicht ansprechbar (unbekannt, fehlend, nicht numerisch, schon beendet — **ein** Satz für alle vier, sonst entsteht ein Aufzählungskanal). Einmalige Beschriftungen bleiben nach bestehender Konvention in der Komponente
- [x] `src/routes/mehr/+page.server.ts` + `+page.svelte` -- `load` gibt Name und `istAdmin`; die Seite trägt `<h1>Mehr</h1>`, darunter `Angemeldet als …`, den Eintrag `Verwaltung` nur für Admins über `href={resolve('/verwaltung')}`, und für alle anderen den Leerzustandssatz im Ton von `Nichts offen.`
- [x] `src/routes/verwaltung/+page.server.ts` -- `load` mit `adminOderWeg` und der Mitgliederliste; drei actions `aufnehmen`, `neuAusstellen`, `widerrufen`, jede beginnt mit `adminOderWeg`. `aufnehmen` prüft den getrimmten Namen **bevor** ein Token entsteht. Klartext nur im Rückgabewert, nie in einer Weiterleitung. Importe relativ mit `.ts`, Typen aus `@sveltejs/kit`
- [x] `src/routes/verwaltung/+page.svelte` -- `<h1>Verwaltung</h1>`; die Einmal-Anzeige des Links direkt darunter, wenn die action einen geliefert hat: Name, der Link in einem `readonly`-Feld, das bei Fokus alles markiert, ein `button-quiet` `Link kopieren` und der Satz, dass er nur jetzt zu sehen ist. Dann das Aufnahmeformular mit dem einzigen `button-primary` der Seite, dann die Liste mit Key. Eigene Zeile als `Du` markiert und ohne Knöpfe; beendete Zeilen mit Satz statt Farbe und ohne Knöpfe. Alle drei Formulare mit `use:enhance`
- [x] `src/routes/verwaltung/+page.svelte` -- Widerruf-Bestätigung als **ein** wiederverwendetes `<dialog>` mit `showModal()`, Name eingesetzt, `Widerrufen` rot und `Abbrechen` still. Der rote Knopf in der Zeile ist `type="button"` und öffnet nur; abgeschickt wird aus dem Dialog. Ohne JavaScript widerruft damit nichts — die richtige Ausfallrichtung für eine zerstörende Aktion, und `<dialog>` bringt Esc, Fokusfang und Hintergrund von sich aus
- [x] `src/lib/components/NavBar.svelte` -- Kommentar richtigstellen: unbebaut sind nur noch `/dienstplan` und `/wissen`, und der `eslint-disable`-Block bleibt, weil der `href` aus einer Variablen kommt, nicht weil Routen fehlen. Keine Verhaltensänderung
- [x] `src/lib/server/auth.ts` -- Kommentar zu `sitzungLoeschen` auf den Stand bringen: diese Story ruft es nicht, weil der Selbstwiderruf verboten ist und ein fremdes Cookie beim nächsten Aufruf ohnehin abgewiesen wird
- [x] `scripts/create-admin.ts` -- der Zweitlauf-Hinweis sagt nicht mehr „das kommt mit Story 1.3", sondern nennt `/verwaltung` als den Weg, der jetzt existiert. Das Wort `erste` muss darin bleiben
- [x] `scripts/smoke-zugang.ts` -- `Ereignis` um POST mit `FormData` erweitern und die Zusagen dieser Story **ausgeführt** belegen, jede durch Mutation als rot-werdend geprüft: Nicht-Admin auf `load` und auf jede der drei actions ergibt 303 auf `/`; `aufnehmen` legt `is_admin = 0`/`is_active = 1` an, liefert den Klartext genau einmal, und der Hash in der Datenbank ist `tokenHashen(klartext)`; der Klartext steht nicht in der Rohdatei; leerer Name ergibt `fail(400)` **ohne** dass ein Mitglied oder ein Token entsteht; `neuAusstellen` ersetzt den Hash, der alte Klartext wird von der Einlöseroute mit 403 abgewiesen, der neue mit 303 eingelöst; `widerrufen` setzt `is_active = 0`, lässt Name und Hash stehen und der Link ergibt danach 403; Selbstwiderruf und Selbst-Neuausstellen ändern nichts; unbekannte, fehlende, nicht numerische und schon beendete `mitgliedId` ergeben denselben Satz. `ERWARTETE_BEHAUPTUNGEN` exakt nachziehen
- [x] `README.md` -- `/mehr` und `/verwaltung` beschreiben: wie ein Mitglied aufgenommen wird, dass der Link nur einmal erscheint und von Hand weitergegeben wird, dass Neuausstellen den alten Link ungültig macht, dass Widerrufen deaktiviert und nicht löscht, und dass Adminrechte ausschliesslich `create-admin` vergibt

**Iteration 1 — Nachträge aus der Review. Jeder Punkt ist durch Mutation belegt oder durch Demonstration am laufenden Baum; keiner ist eine Vermutung:**

- [x] `src/routes/verwaltung/+page.svelte` -- **der Einmal-Link darf nicht an `form` hängen.** Jedes weitere Formularergebnis der Seite ersetzt `form` und löscht damit einen Wert, der per Entwurf nicht wiederherstellbar ist: wer aufnimmt und danach irgendetwas antippt, hat den Link verloren, bevor er ihn weitergegeben hat. In lokalen Zustand übernehmen, nur bei geglücktem `aufnehmen`/`neuAusstellen` setzen, und dort stehen lassen, bis die Seite verlassen wird. Der Fehlschlag einer anderen action löscht ihn nicht
- [x] `src/routes/verwaltung/+page.server.ts` -- `setHeaders({ 'cache-control': 'no-store' })` in **beiden** actions, die Klartext zurückgeben. Ohne die Kopfzeile liegt das Token im Verlauf und im Plattenzwischenspeicher des Browsers, und ohne JavaScript ist die POST-Antwort ein vollständiges Dokument mit dem Link darin. Das ist die einzige Kopfzeile, die die Zusage „nie gespeichert" aus dem eingefrorenen Block überhaupt trägt
- [x] `scripts/gate.mjs` + `scripts/gate-fixtures/` -- **Regel 10: jede `.css` unter `src/lib/styles/` muss unter `src/routes/` importiert werden.** Belegt: die Importzeile von `bedienelemente.css` aus `+layout.svelte` gelöscht lässt `gate` mit 0 durchlaufen, bei unveränderter Hinweiszahl. Ausgeliefert würden dann Knöpfe ohne Trefferfeld, ohne das einzige Rot und ein Textfeld unter 16px, das iOS beim Fokus hineinzoomt — der Verlust der gesamten Bedienelement-Gestaltung, unsichtbar für die ganze Kette. Mit Fehlerprobe **und** Gegenprobe, `erwartet` je Probe begründet, Doku-Kopf auf die neue Regelzahl
- [x] `scripts/gate.mjs` + `scripts/gate-fixtures/` -- **Regel 11: jedes `action="?/name"` braucht einen gleichnamigen Eintrag in der `actions` der Nachbar-`+page.server.ts`.** Belegt: `action="?/neuAusstellen"` zu `?/neuAusstellenTippfehler" verschrieben lässt `check` (624 Dateien, 0 Fehler), `eslint` und `smoke` (158 Behauptungen) alle grün — der Knopf tut am laufenden Server nichts. Das Prüfskript ruft die actions über den Namensindex und umgeht SvelteKits Auflösung, kann diese Klasse also grundsätzlich nicht fangen. Mit Fehlerprobe und Gegenprobe
- [x] `src/lib/server/db/queries/members.ts` -- **Sortierung nach `localeCompare` mit `de-CH`**, nicht `asc(members.name)`. SQLites Vorgabekollation ist BINARY: `Ärni` und jeder kleingeschriebene Name landen hinter `Zoe` — in einer Schweizer Gartengruppe der Normalfall. Die Zeilen holen und in JavaScript sortieren, weiterhin synchron
- [x] `src/lib/texte.ts` -- `SELBSTWIDERRUF_ABGELEHNT` passt nur auf eine der zwei Wurfstellen: wer den eigenen Link **neu ausstellen** will, liest „kannst du hier nicht beenden". Neutral formulieren, sodass der Satz auf beide actions passt, und den Konstantennamen mitziehen
- [x] `src/routes/verwaltung/+page.server.ts` -- **Namensprüfung härten:** Nullbreiten-Zeichen (`U+200B`–`U+200D`, `U+2060`, `U+FEFF`) aussieben und eine Längengrenze von 80 Zeichen serverseitig durchsetzen, `maxlength` am Feld dazu. Ein Name aus Nullbreiten-Zeichen besteht `trim()` und erzeugt eine Zeile ohne lesbaren Namen — und es gibt keine Umbenennen-Aktion, der Fehler ist also endgültig
- [x] `src/lib/styles/bedienelemente.css` + `src/routes/verwaltung/+page.svelte` -- **Doppelversand.** Zwei Antippen auf einem langsamen Telefon legen zwei Mitglieder an; angezeigt wird nur der Link des zweiten, das erste Mitglied hat dann einen Link, den niemand kennt. Über den `use:enhance`-Rückruf während des Fluges sperren. Ursache mitbeheben: die CSS kennt ausschliesslich Ruhezustände — kein `:active`, kein `:disabled`, keine Gestaltung für das `aria-invalid`, das das Markup setzt. Ein Knopf, der einen Druck nie quittiert, erzeugt den Doppeldruck. `--border-active` liegt für Zustandskanten bereit
- [x] `src/routes/verwaltung/+page.svelte` -- **Dialog.** `showModal()` fokussiert das erste fokussierbare Element, und das ist `Widerrufen`: ein Enter direkt nach dem Öffnen widerruft ohne weiteres Zutun, und der zerstörende Knopf liegt zudem über `Abbrechen`, also unter dem Daumen. `Abbrechen` zuerst im DOM und fokussiert. Dazu `aria-describedby` auf den erklärenden Satz und eine `::backdrop`-Regel aus Tokens statt der Systemfarbe, die der Kommentar derselben Datei ausdrücklich vermeiden will. `zuWiderrufen` nach dem Schliessen zurücksetzen und `dialog === null` abfangen
- [x] `src/routes/verwaltung/+page.svelte` -- **Aufnahmezeitpunkt anzeigen.** `createdAt` reist über `ohneHashSpalte` in jede ausgelieferte Seite und wird nirgends gezeigt — genau die Regel, die `src/routes/mehr/+page.server.ts` als Begründung führt. Zugleich ist es das einzige Merkmal, das zwei gleichnamige Zeilen unterscheidbar macht: ohne Eindeutigkeit auf `name` nennt der Bestätigungsdialog nur den Namen, und der Widerruf kann die falsche Zeile treffen. In Zeile und Dialog anzeigen, formatiert über `src/lib/client/utils/date.ts`, falls es die Datei zu diesem Zeitpunkt gibt — sonst hier anlegen
- [x] `src/routes/verwaltung/+page.svelte` + `src/routes/mehr/+page.svelte` -- **Screenreader und Dokumentstruktur.** `role="status"` und `role="alert"` hängen an Elementen, die erst mit ihrem Text in den DOM kommen; viele Screenreader lesen das nicht vor. Leere Live-Regionen im Markup vorhalten und nach dem Versand den Fokus setzen — heute erscheint die Einmal-Anzeige oben, während der Fokus unten am Knopf steht, und bei zwanzig Mitgliedern liegt die Meldung zu einer Zeilenaktion ausserhalb des Sichtfelds. Ausserdem: beide Seiten brauchen einen `<svelte:head><title>` wie `src/routes/+error.svelte:38`, das einzige `<h2>` darf nicht die Rückmeldung sein, und Aufnahmeformular wie Mitgliederliste brauchen je einen zugänglichen Namen
- [x] `src/lib/server/db/schema.ts` + `src/lib/server/db/queries/members.ts` -- **die zwei Spaltenlisten gegeneinander absichern.** `ohneHashSpalte` und `ohneTokenHash` schreiben dieselben fünf Spalten aus und begründen das beide mit „eine neue Spalte soll hier auffallen" — nichts erzwingt, dass sie in **beiden** auffällt. Eine neue Spalte, die nur in einer nachgetragen wird, fehlt still in der Liste oder reist still in die Seite. Eine Typprüfung, die die Auswahl gegen `AngemeldetesMitglied` hält, schliesst das
- [x] `src/lib/server/herkunft.ts` -- der JSDoc nennt „zwei Stellen brauchen den Wert und dieselbe Prüfung" und zählt die neue dritte nicht mit. Die Route baut den Link aus `url.origin` und das ist richtig — im Betrieb leitet `adapter-node` ihn aus `ORIGIN` ab, im Entwicklungsserver soll er gerade abweichen. Die Stelle mitzählen und diese Begründung dort festhalten, statt eine Gleichheit zu behaupten, die niemand prüft
- [x] `README.md` -- **drei Zusagen sind seit dieser Story falsch und stehen weiter in Dateien, die dieser Diff angefasst hat.** „Diese Zeile ist die einzige Stelle im ganzen System, an der ein Token im Klartext erscheint" gilt nicht mehr (auch im Kommentar von `scripts/create-admin.ts`); der Rettungsweg „stellt eine andere Adminperson einen neuen aus" gilt für null Installationen, weil eine zweite Adminperson nie entstehen kann — der Alleinverwalter ist als Sollbruchstelle zu benennen; und „nach dem Verlassen der Seite fort" ist auf das Belegbare zurückzunehmen. Die Liste der benannt akzeptierten Risiken um die neuen Kanten erweitern: ein Widerruf ist ohne Datenbankeingriff unumkehrbar, ein Tippfehler im Namen bleibt für immer stehen, niemand protokolliert wer wen widerrufen hat, und der Klartext-Link liegt nach `Link kopieren` in einer Zwischenablage, die iOS und Android geräteübergreifend synchronisieren
- [x] `src/routes/verwaltung/+page.svelte` -- der Rückfallsatz „Tippe in das Feld — der Link ist dann markiert." fordert zum Tippen auf, was in einem `readonly`-Feld gerade nicht geht. Antippen ist gemeint
- [x] `scripts/smoke-zugang.ts` -- die neuen Zusagen **ausgeführt** belegen, jede per Mutation als rot-werdend nachgewiesen: die Namensfolge innerhalb der aktiven Gruppe; `ichId` aus der `load`; `no-store` auf beiden Klartext-Antworten; der Satz beim Selbst-Neuausstellen; der Nullbreiten- und der Überlängen-Name; der `mitglied === null`-Zweig von `adminOderWeg` und derselbe Zweig in `mehr/+page.server.ts` über `alsMitglied(pfad, null)`. `ERWARTETE_BEHAUPTUNGEN` exakt nachziehen
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- der bestehende Eintrag nennt weiter `ERWARTETE_BEHAUPTUNGEN = 109`, es sind 158; genau die Reibung, die er vorhergesagt hat. Richtigstellen und die neuen Rückstellungen dieser Story anfügen: kein Umbenennen, kein Reaktivieren, kein Undo-Fenster, keine Prüfung der Svelte-Schicht (es gibt kein Komponenten-Testwerkzeug), keine Kontrastprüfung im Gate — die Werte von `--danger` stehen als gemessen im Kommentar und werden von nichts nachgerechnet — und `sitzungLoeschen` ohne Aufrufer

**Acceptance Criteria:**

- Given `npm run lint` und `npm run check`, when sie laufen, then enden beide mit 0 — `smoke` eingeschlossen, ohne `db:generate`, weil sich das Schema nicht ändert
- Given `adminOderWeg` wird aus **einer** der drei actions entfernt, when `npm run lint` läuft, then endet es mit 1 — die Schranke darf nicht daran hängen, dass die Oberfläche den Knopf verbirgt
- Given die Prüfung auf den eigenen `mitgliedId` wird aus `widerrufen` entfernt, when `npm run lint` läuft, then endet es mit 1
- Given `mitgliedDeaktivieren` wird zu einem `DELETE` geändert, when `npm run lint` läuft, then endet es mit 1
- Given ein Admin nimmt jemanden auf, when die Seite danach neu geladen wird, then ist der Link fort, und in `members` steht ein 64-stelliger Hex-Hash und nirgends der Klartext
- Given ein `--danger`-Wert wird nur im Hell-Block ergänzt, when `npm run gate` läuft, then endet es mit 1
- Given `/verwaltung` bei 375px in Hell und Dunkel, when die Seite geprüft wird, then trägt sie genau ein `<h1>`, genau einen `button-primary`, Trefferfelder ab 44px, sichtbaren Tastaturfokus auf allem Bedienbaren, und Rot erscheint ausschliesslich am Widerruf
- Given ein Mitglied, dessen Zugang beendet wurde, when `/verwaltung` gelesen wird, then steht seine Zeile dort mit Namen, als beendet **im Text** gekennzeichnet und ohne Knöpfe
- Given der ausgelieferte Quelltext von `/verwaltung` und `/mehr`, when darin nach den Hashes aus `members.invite_token_hash` gesucht wird, then kommt keiner davon vor

**Acceptance Criteria — Iteration 1:**
- Given die Importzeile von `bedienelemente.css` wird aus `src/routes/+layout.svelte` entfernt, when `npm run gate` läuft, then endet es mit 1
- Given ein `action="?/…"` im Markup wird verschrieben oder ein Aktionsname serverseitig umbenannt, when `npm run gate` läuft, then endet es mit 1
- Given die Sortierung in `mitgliederAuflisten` wird auf eine andere Spalte umgestellt, when `npm run smoke` läuft, then endet es mit 1
- Given `ichId` wird auf einen festen Wert gesetzt, when `npm run smoke` läuft, then endet es mit 1
- Given `no-store` wird aus einer der beiden Klartext-actions entfernt, when `npm run smoke` läuft, then endet es mit 1
- Given der Einmal-Link steht auf der Seite, when eine andere action ein Ergebnis liefert — auch einen Fehlschlag —, then bleibt der Link sichtbar
- Given ein Name aus Nullbreiten-Zeichen oder über 80 Zeichen, when `aufnehmen` läuft, then `fail(400)`, kein Mitglied und kein Token
- Given der Bestätigungsdialog ist gerade geöffnet, when sofort Enter gedrückt wird, then wird nichts widerrufen
- Given `npm run gate:selftest`, when es läuft, then weist es für jede neue Regel eine Fehlerprobe **und** eine Gegenprobe nach

## Spec Change Log

### Iteration 1 — 2026-08-27

**Auslösende Funde.** Drei Review-Schichten (Blind Hunter, Edge Case Hunter, Verification Gap) auf dem Stand nach der ersten Umsetzung. Nach Dedupe drei hohe und vierzehn mittlere Funde, kein `intent_gap`. Die drei hohen sind alle von derselben Art — die Prüfkette kann sie nicht fangen, und das ist jeweils durch Mutation am laufenden Baum belegt:

1. Der Einmal-Link hängt an `form` und wird von jedem weiteren Formularergebnis der Seite gelöscht. Betrifft den einen Wert der Story, der per Entwurf nicht wiederherstellbar ist.
2. Ein verschriebenes `action="?/name"` passiert `check`, `eslint` und `smoke` grün; der Knopf ist tot. Das Prüfskript ruft die actions über den Namensindex und umgeht SvelteKits Auflösung.
3. Die gelöschte Importzeile von `bedienelemente.css` lässt `gate` mit unveränderter Hinweiszahl grün — samt Verlust aller 44px-Trefferfelder, des einzigen Rots und der 16px, die iOS am Hineinzoomen hindern.

**Was geändert wurde.** `## Tasks & Acceptance` um einen Nachtragsblock mit siebzehn Aufgaben und neun Akzeptanzkriterien erweitert. Zwei neue Gate-Regeln (10: Stilblatt eingebunden, 11: Aktionsname aufgelöst) schliessen die zwei Klassen, die die Kette strukturell nicht sah. Der eingefrorene Block wurde nicht angefasst; die Namenslänge von 80 Zeichen und das Aussieben der Nullbreiten-Zeichen sind eine angenommene Auslegung von „ein Mitglied hat einen lesbaren Namen" und dem User beim Abschluss ausdrücklich vorzulegen.

**Bewusste Abweichung vom Workflow, vom User am 2026-08-27 entschieden.** Der `bad_spec`-Pfad schreibt vor: Code verwerfen, neu herleiten. Stattdessen werden die Funde auf dem bestehenden Code eingearbeitet. Begründung: die Funde sind fast ausnahmslos additiv (Regel ergänzen, Behauptung ergänzen, Kopfzeile setzen, Fokusreihenfolge drehen); keiner sagt, der Aufbau sei falsch. Dem gegenüber standen 1846 Zeilen verifizierter Arbeit mit vier nachgefahrenen Mutationsbelegen. Das eingegangene Risiko ist Flickwerk an den Nahtstellen statt eines Neuentwurfs — abzulesen künftig daran, ob die nächste Runde Funde **innerhalb** der hier geflickten Stellen bringt.

**Vermiedener Bekannt-Schlecht-Zustand.** Eine Verwaltung, die scheinbar vollständig geprüft ist, während drei ihrer tragenden Eigenschaften an nichts hängen: der weitergebbare Link, die Erreichbarkeit jedes Knopfs und die gesamte Bedienelement-Gestaltung samt Trefferfeldern.

**KEEP — das hat getragen und muss jede Neuherleitung überleben:**
- `adminOderWeg` gibt das Mitglied zurück, statt nur zu werfen: die actions beziehen ihre eigene Id aus derselben Prüfung, die sie schützt. Vier Aufrufstellen, eine Funktion.
- `mitgliedDeaktivieren` und `einladungNeuAusstellen` tragen die Bedingung `is_active = 1` **in der Abfrage** und geben `null` zurück, wenn keine Zeile getroffen wurde. Die Route macht daraus einen einzigen Satz für alle vier unerreichbaren Zustände — kein Aufzählungskanal.
- `ohneHashSpalte` als **eine** Konstante für jede Funktion, deren Ergebnis eine `load` verlässt, ausgeschrieben statt über eine Auslassung gebildet.
- Der rote Knopf in der Zeile ist `type="button"` und öffnet nur; abgeschickt wird aus dem Dialog. Ohne JavaScript widerruft damit nichts — die richtige Ausfallrichtung für eine zerstörende Aktion.
- Die vier Mutationsbelege der ersten Runde (`adminOderWeg` entfernt, Selbst-Id-Prüfung entfernt, `DELETE` statt Deaktivieren, `--danger` nur hell) sind gefahren und rot geworden. Sie bleiben Akzeptanzkriterien.
- `--danger` `#a32e22` / `#e8877b` mit der gemessenen Kontrasttabelle.
- Die Importdisziplin der Routenmodule: relativ mit `.ts`, Typen aus `@sveltejs/kit`, damit `tsconfig.scripts.json` sie auflöst.

**Nachträge zur Iteration 1, entschieden nach der Umsetzung:**

- **Namenslänge 80 Zeichen und Aussieben der Nullbreiten-Zeichen: vom User am 2026-08-27 bestätigt.** Damit ist es eine Entscheidung und keine Auslegung mehr. Der eingefrorene Block bleibt unverändert; die Regel steht in den Nachtragsaufgaben und ist mit sechs Behauptungen belegt, davon eine Gegenprobe, dass ein lesbarer Name mit einem eingestreuten Nullbreiten-Zeichen **angenommen** und nicht abgewiesen wird.
- **Ein `<title>` in `src/app.html` wurde entfernt — Abweichung über den Aufgabentext hinaus, geprüft und angenommen.** Die Aufgabe verwies auf `src/routes/+error.svelte:38` als Vorbild. Das Vorbild war wirkungslos: `src/app.html` trug ein eigenes title-Element **vor** `%sveltekit.head%`, und bei mehreren nimmt der Browser das erste — der Titel der Fehlerseite hat seit Story 1.2 nie gegriffen, und zwei title-Elemente sind zudem kein gültiges HTML. Die Story hat es entfernt und `/` einen eigenen Titel gegeben, also zwei Dateien ausserhalb der Aufgabenliste angefasst. Gemessen am laufenden Server: `/` → `Aufgaben`, `/mehr` → `Mehr`, `/verwaltung` → `Verwaltung`, `/gibtsnicht` → `Diese Seite gibt es nicht.`, und genau **ein** title-Element je Seite. Der Umsetzungsagent hat die Abweichung selbst gemeldet statt sie still zu setzen — das ist das gewünschte Verhalten und der Grund, warum sie hier steht.
- **Der erklärende Kommentar in `src/app.html` enthielt das Wort `<title>` wörtlich** und wurde in Prosa umformuliert. Er wird auf jeder Seite mit ausgeliefert, und die zwei Vorkommen im Kommentar liessen jede Suche nach doppelten title-Elementen fehlschlagen — mich selbst beim Nachprüfen zuerst. Kein Verhaltensfehler, aber genau die Sorte Falle, die dieses Projekt sonst aus Kommentaren heraushält.

**Iteration 1, Nachtrag vom User gefunden — der title-Kommentar stand sichtbar auf der Seite.**

Der Kommentar in `src/app.html`, der erklärt, warum dort kein title-Element steht, nannte `%sveltekit.head%` wörtlich. SvelteKit ersetzt die Marke **auch innerhalb eines Kommentars**; der eingesetzte Kopfbereich bringt eigene Kommentarmarken mit, und deren Ende schloss den umgebenden Kommentar vorzeitig. Die zweite Hälfte der Erklärung stand danach als sichtbarer Text über der Titelleiste. Der Fehler war schon in der ersten Fassung des Kommentars angelegt und hat meine eigene Korrektur an der Formulierung überlebt.

**Wie er durchkam.** `check`, `lint`, `gate` mit elf Regeln, `smoke` mit 185 Behauptungen und `build` waren alle grün. Meine Nachprüfung hat die Anomalie sogar gemessen — drei `<title>`-Vorkommen im Kopf statt einem — und ich habe sie als „zwei davon stehen im Kommentar" wegerklärt, statt zu erkennen, dass der Kommentar aufgebrochen ist. Gefunden hat es der User am laufenden Server, mit dem Auge.

**Behoben und festgehalten.** Der Kommentar beschreibt die Einfügemarke jetzt in Prosa. Neue **Gate-Regel 12**: in keinem HTML-Kommentar unter `src/` steht eine SvelteKit-Marke. Mit Fehlerprobe (`regel-12-marke-im-kommentar`) und Gegenprobe (`regel-12-marke-ausserhalb`, in der beide echten Marken ausserhalb stehen und ein Kommentar das Wort ohne Prozentzeichen nennt). Durch Mutation belegt: die Marke zurück in den Kommentar gesetzt ergibt `VERSTOSS regel 12 src/app.html:17` und Exit 1. Damit 23 Proben über zwölf Regeln.

**Was daraus für die Bewertung der Flick-Entscheidung folgt.** Dieser Fund liegt **innerhalb** einer in Iteration 1 geflickten Stelle — genau das Kriterium, das der Change-Log-Eintrag als Warnsignal benannt hat. Er stammt allerdings nicht aus der Verwaltungslogik, sondern aus einem Kommentar, den die Iteration nebenbei umformuliert hat; die geflickten Nahtstellen der Story selbst sind davon nicht betroffen. Für die Kernaussage bleibt: die Prüfkette sieht nur, was jemand ihr beigebracht hat, und der ausgelieferte Zustand einer Seite gehört bisher nicht dazu.

## Design Notes

**Der Link erscheint einmal, weil die action ihn zurückgibt — nicht weil etwas ihn versteckt.** Kein Zwischenspeicher, kein Flash-Cookie, keine Weiterleitung mit Fragment: der Klartext steht ausschliesslich im Rumpf **einer** POST-Antwort. Ein Neuladen ist ein GET, dessen `load` ihn nicht kennt und nicht kennen kann — der Hash ist nicht umkehrbar. Damit ist „nach dem Verlassen der Seite nirgends mehr abrufbar" eine Eigenschaft des Aufbaus und nicht eine Zusage der Oberfläche. Der Preis: wer den Link verliert, bevor er ihn weitergibt, braucht `Link neu ausstellen`. Genau dafür ist die Aktion da.

**Neuausstellen macht den alten Link ungültig, und das ist der Zweck.** AD-10 hält fest, dass ein Gerätewechsel keinen neuen Link braucht — das Token bleibt gültig und mehrfach einlösbar. Neuausstellen ist deshalb nicht der Weg für ein zweites Gerät, sondern für einen verlorenen oder in falsche Hände geratenen Link. `invite_token_hash` ist `unique`, es ist ein `UPDATE` derselben Zeile: die Person behält Id, Name und ihre Historie.

**Warum weiterleiten und nicht 403.** Für jemanden ohne Adminrechte soll die Verwaltung nicht existieren, nicht verboten sein (EXPERIENCE.md:105). Eine Fehlerseite wäre die Auskunft, dass es dort etwas gibt. `redirect(303, '/')` sagt nichts. Nebeneffekt: die Story braucht keinen neuen Satz in `texte.ts` für diesen Fall und stolpert nicht über die Meldungsauswahl in `+error.svelte:24`.

**Das Rot, gemessen statt behauptet.** Der Design-Spine reserviert Rot für Zerstörendes, legt aber keinen Wert fest — die acht Farben enthalten keines. Ein Paar genügt, weil der Knopf durchsichtig bleibt:

| Paarung | Hell `#A32E22` | Dunkel `#E8877B` | Ziel |
| --- | --- | --- | --- |
| Roter Text auf Karte | 7.07:1 | 6.48:1 | 4.5 |
| Roter Text auf Grund | 6.42:1 | 7.13:1 | 4.5 |
| Roter Umriss auf Karte | 7.07:1 | 6.48:1 | 3.0 |

Beide liegen im Kontrastband des bestehenden Akzents (6.37:1 / 7.43:1), fügen sich also ein, statt herauszuschreien. Zu `--overdue` (Lehmbraun) besteht bei Rotsehschwäche Verwechslungsgefahr; sie ist unschädlich, weil `--overdue` in dieser Story nicht vorkommt und beide Aussagen immer im Text stehen.

## Verification

**Commands:**

- `npm run check` -- expected: Exit 0 mit `--fail-on-warnings`; belegt zugleich, dass die neuen Routenmodule im Skript-Programm auflösbar sind
- `npm run lint` -- expected: Exit 0 über die ganze Kette
- `npm run gate` -- expected: Exit 0; kein Farbliteral und kein rohes Mass in den neuen Dateien, `--danger` in beiden Blöcken
- `npm run smoke` -- expected: Exit 0, jede Zeile der Matrix ausgeführt belegt, `ERWARTETE_BEHAUPTUNGEN` stimmt
- `env -u DATABASE_PATH -u SESSION_SECRET -u ORIGIN npm run build` -- expected: Exit 0
- `npm run db:check` -- expected: Exit 0 ohne vorheriges `db:generate`
- `curl -si localhost:5173/verwaltung` mit dem Cookie eines Nicht-Admins -- expected: `303` und `location: /`

**Manual checks (if no CLI):**

- `/verwaltung` bei 375px in Hell **und** Dunkel: ein `<h1>`, ein primärer Knopf, Rot nur am Widerruf, jede Zeile ab 44px, Fokusring überall sichtbar
- Aufnehmen, Link kopieren, Seite neu laden: der Link ist fort. Denselben Link auf dem Handy öffnen: die Liste erscheint ohne Zwischenschritt
- Widerrufen: Bestätigung erscheint, Esc bricht ab, `Widerrufen` beendet den Zugang; der Link führt danach auf die Fehlerseite aus 1.2
- `/mehr` als Nicht-Admin: kein Eintrag `Verwaltung`, und `/verwaltung` direkt aufgerufen landet auf `/`

## Suggested Review Order

**Die Adminschranke — hier zuerst hinsehen**

- Eine Funktion, vier Aufrufstellen; gibt das Mitglied zurück, damit die actions ihre eigene Id aus derselben Prüfung ziehen.
  [`adminschranke.ts:35`](../../src/lib/server/adminschranke.ts#L35)

- Weiterleiten statt 403: für Nicht-Admins soll die Verwaltung nicht existieren, nicht verboten sein.
  [`mehr/+page.server.ts:18`](../../src/routes/mehr/+page.server.ts#L18)

**Der Einmal-Link — der Wert, der sich nicht wiederherstellen lässt**

- Klartext entsteht hier, verlässt den Server einmal, wird nie gespeichert.
  [`verwaltung/+page.server.ts:152`](../../src/routes/verwaltung/+page.server.ts#L152)

- Die einzige Kopfzeile, die „nie gespeichert" überhaupt trägt — auf beiden Klartext-Antworten, auf keiner anderen.
  [`verwaltung/+page.server.ts:96`](../../src/routes/verwaltung/+page.server.ts#L96)

- Lokaler Zustand statt `form`: der Anfangswert rendert serverseitig mit, der Effekt setzt nur und löscht nie.
  [`verwaltung/+page.svelte:48`](../../src/routes/verwaltung/+page.svelte#L48)

**Die Mutationen — Bedingung in der Abfrage, nicht in der Route**

- `is_active = 1` steht im `WHERE`; `null` heisst vierfach „nicht ansprechbar" und wird zu **einem** Satz.
  [`members.ts:165`](../../src/lib/server/db/queries/members.ts#L165)

- `satisfies Record<keyof AngemeldetesMitglied, unknown>` — eine neue Spalte fällt in beiden Listen auf, nicht nur in einer.
  [`members.ts:76`](../../src/lib/server/db/queries/members.ts#L76)

- Sortierung in JavaScript über `de-CH`: SQLites BINARY stellt Umlaute und Kleinschreibung hinter `Zoe`.
  [`members.ts:126`](../../src/lib/server/db/queries/members.ts#L126)

**Der zerstörende Weg**

- `Abbrechen` zuerst im DOM und fokussiert; ein Enter direkt nach dem Öffnen widerruft nichts.
  [`verwaltung/+page.svelte:202`](../../src/routes/verwaltung/+page.svelte#L202)

- Der Widerruf trifft eine fremde Zeile; ein Satz für beide Selbst-actions, keiner nennt ein einseitiges Verb.
  [`texte.ts:60`](../../src/lib/texte.ts#L60)

- Ein Satz für unbekannt, fehlend, nicht numerisch und schon beendet — kein Aufzählungskanal.
  [`texte.ts:79`](../../src/lib/texte.ts#L79)

**Die zwei Regeln, welche die Review gefordert hat**

- Ein Stilblatt, das niemand einbindet, kostete alle Trefferfelder und das einzige Rot — vorher unsichtbar für die Kette.
  [`gate.mjs:993`](../../scripts/gate.mjs#L993)

- Ein verschriebenes `action="?/name"` passierte `check`, `eslint` und `smoke` grün; der Knopf war tot.
  [`gate.mjs:1046`](../../scripts/gate.mjs#L1046)

**Peripherie**

- Von Hand gepflegt, damit stilles Schrumpfen auffällt: 109 → 158 → 185.
  [`smoke-zugang.ts:88`](../../scripts/smoke-zugang.ts#L88)

- Das einzige Rot der Anwendung, in beiden Modi, Kontrast gemessen.
  [`app.html:78`](../../src/app.html#L78)

- Rot nur an Rand und Text des Widerrufs; die Aktiv-Kante nimmt bewusst die Tintenfarbe.
  [`bedienelemente.css:73`](../../src/lib/styles/bedienelemente.css#L73)
