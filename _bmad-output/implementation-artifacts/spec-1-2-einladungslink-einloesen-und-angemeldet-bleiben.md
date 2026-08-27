---
title: 'Story 1.2 — Einladungslink einlösen und angemeldet bleiben'
type: 'feature'
created: '2026-08-26'
status: 'done'
review_loop_iteration: 3
baseline_commit: 'e688e7deeef20d27281ebfc6018a443fb6fdf7fe'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Die Anwendung hat keine Datenbank und keine Identität. `/` ist für jeden offen, es gibt kein Mitglied, kein Token, keine Sitzung — und keinen Weg, das erste Mitglied anzulegen. Story 1.1 hat die Datenschicht bewusst hierher verschoben (`deferred-work.md`).

**Approach:** Die Datenschicht einziehen (SQLite mit WAL, Drizzle-Schema, Migrationskette, Repository) und darauf den einzigen Zugangsweg bauen: `GET /i/<token>` löst die Einladung ein und stellt ein signiertes Sitzungs-Cookie aus, ein Wächter lässt ohne gültige Sitzung niemanden weiter, ein CLI-Skript erzeugt das erste Admin-Mitglied samt Klartext-Link. Sichtbares Ergebnis: nach einem Antippen des Links zeigt `/` die Liste, dauerhaft, ohne je etwas einzugeben.

## Boundaries & Constraints

**Always:**
- Versionen wie in `epic-1-context.md`; neu nur `jose` 6.2.10 und `@types/better-sqlite3` 9.6.0 — beide dort schon gepinnt.
- **Kein Vorgabewert für eine Umgebungsvariable, nirgends.** `DATABASE_PATH`, `SESSION_SECRET` und `ORIGIN` **brechen beim Start** — nicht im Betrieb und nicht beim Modulladen — mit benannter deutscher Meldung und ohne Stacktrace. Modulladen ist ausdrücklich die falsche Stelle: SvelteKits `analyse`-Schritt importiert beim Bauen jedes Servermodul, ein Wurf dort macht `npm run build` im frisch geklonten Zustand unmöglich. `SESSION_SECRET` unter 32 Zeichen ist ebenfalls ein Fehler. `drizzle.config.ts` und `create-admin` prüfen weiterhin selbst, weil sie ausserhalb des Servers laufen.
- Datenschicht **synchron**: kein `async`, `await` oder `Promise` unter `src/lib/server/db/`.
- Datenzugriff nur über benannte Funktionen aus `queries/*.ts`. Kein Drizzle-Aufruf und kein `db`-Handle unter `src/routes/`.
- In `members` liegt **nur** der SHA-256-Hash. Der Klartext wird nie gespeichert, nie geloggt, nie ausgeliefert — ausser genau einmal auf der Konsole von `create-admin`.
- Das Token bleibt bis zum Widerruf gültig und **mehrfach einlösbar** — ein zweites Gerät braucht keinen neuen Link.
- **Bei jedem Aufruf** wird `is_active` in der Datenbank geprüft, nie nur das Cookie.
- Deutsch in Schweizer Rechtschreibung, nie das Zeichen Eszett. Kein Hex-Wert in einem Komponenten-`<style>`. Zeitstempel als Integer in Unix-Sekunden.

**Ask First:**
- Abweichung von einer gepinnten Version; jede weitere Abhängigkeit, insbesondere `tsx`, `dotenv-cli`, `argon2`.
- Ein zweites Cookie, ein Server-Sitzungsspeicher oder eine Sitzungstabelle.
- Jede Änderung an `NavBar.svelte` oder `TitleBar.svelte`.

**Never:**
- Kein Passwort, kein Login-Formular, kein Registrierungsvorgang.
- Keine Domänentabelle ausser `members` — `tasks` ist Story 1.4, der Rest Epic 3.
- Keine Verwaltungsoberfläche, kein Aufnehmen oder Widerrufen über die Oberfläche — Story 1.3.
- Kein `+server.ts` ausser `src/routes/i/[token]/+server.ts`. Kein JSON-Endpunkt.
- Keine Ratenbegrenzung im Anwendungscode — nginx, Story 1.6.
- Keine Unterscheidbarkeit zwischen einem nie existierenden und einem widerrufenen Token — in keinem Statuscode, keiner Meldung, keiner Kopfzeile.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Einladung einlösen | `GET /i/<gültiges Token>`, Mitglied aktiv | Cookie `sitzung` gesetzt, 303 auf `/` | N/A |
| Gerätewechsel | dasselbe Token, zweites Gerät | funktioniert gleich, erste Sitzung bleibt gültig | N/A |
| Wiederkehr | gültiges Cookie | Liste direkt, ohne Zwischenschritt, Cookie gleitend erneuert | N/A |
| **Kein Zugang** — vier Fälle: kein Cookie, Cookie manipuliert oder abgelaufen, Token unbekannt, Mitglied `is_active = 0` | beliebiger Pfad | **Ein** Statuscode 403 und **ein** Satz: `Dieser Link gilt nicht mehr. Melde dich in der Gartengruppe.` **Ohne Rahmen** — eine eigenständige Minimalseite ohne Titelleiste und Navigationsleiste; eine Leiste mit vier Zielen, die alle auf dieselbe Abweisung führen, hilft niemandem | Das Cookie bleibt liegen und wird **nicht** gelöscht; harmlos, weil Mitglied und `is_active` bei jedem Aufruf neu aus der Datenbank kommen. Nie ein Stacktrace. Die vier Fälle sind in Status, Kopfzeilen und Rumpf ununterscheidbar |
| Erstes Mitglied | `npm run create-admin -- Anna`, leeres System | Migration läuft, Mitglied mit `is_admin = 1`, Klartext-Link **einmal** auf der Konsole | Name fehlt → Meldung, Exit 1 |
| Pflichtvariable fehlt | `DATABASE_PATH` leer | Start bricht mit benannter Meldung ab | nie ein Fallback-Pfad |

</frozen-after-approval>

## Code Map

Alles hier ist am Stand `e688e7d` **empirisch geprüft** (Sondierung angelegt, verifiziert, zurückgenommen) — nicht neu herleiten:

- **Node 25.8 strippt TypeScript von sich aus**, `node scripts/x.ts` läuft ohne Flag → kein `tsx`. `--env-file-if-exists=.env` lädt `.env` → kein `dotenv-cli`.
- **Importe innerhalb `src/lib/server/` tragen die Endung `.ts`.** Nacktes Node löst `./schema.js` **nicht** auf eine `.ts`-Datei auf (ENOENT), `./schema.ts` schon; Vite und `svelte-check` verkraften beides. Daher `allowImportingTsExtensions: true` — es überschreibt nichts aus `.svelte-kit/tsconfig.json`. Geprüft: `check` 578 Dateien 0 Fehler, `build` grün, `eslint` still.
- **`better-sqlite3` 13.0.3 liefert keine Typen.** `@types/better-sqlite3` 9.6.0 ist die neueste verfügbare und typisiert die benutzte Fläche (`new Database()`, `.pragma()`) fehlerfrei — das ist die in 1.1 offen gelassene Typfrage.
- **`drizzle.config.ts` verlangt `dbCredentials.url`** für `dialect: 'sqlite'`, auch wenn `generate` die Datenbank nie öffnet.
- **`migrate()` auf einer leeren Datei** legt `__drizzle_migrations` plus Schema an, `journal_mode` steht danach auf `wal`, `is_admin` kommt als echtes `boolean` zurück. Damit läuft `create-admin` auf einem leeren System ohne vorherigen Migrationsschritt — aufgerufen aus `datenschichtStarten()`, nicht beim Modulladen.
- **`drizzle/` landet nicht im Build** — `build/` enthält keine `.sql`-Datei, `migrationsFolder` ist arbeitsverzeichnisrelativ. **Für Story 1.6 festhalten: Verzeichnis ins Image kopieren.**
- `scripts/gate.mjs` -- läuft nur über `src/` (`.svelte .css .html .ts .js`), `static/` und `eslint.config.js`; `scripts/` und neue Wurzelverzeichnisse sieht es nie. Regel 7 braucht bei neuen `.svelte`-Dateien keinen Nachtrag. Probenliste endet `:856`, Doku-Kopf `:17-34`.
- `eslint.config.js` -- Block `**/*.{ts,mts,cts}` erfasst `drizzle.config.ts` und `scripts/create-admin.ts` schon mit Node-Globals. `.gitignore` deckt `*.sqlite*` und `.env` schon ab. **Beide unverändert.**
- `src/app.d.ts` -- alle Blöcke auskommentierte Rümpfe; `App.Locals` füllt diese Story.
- `src/routes/+layout.svelte:14` -- `children: Snippet` über `$props()`; Reihenfolge Sprunglink, `TitleBar`, `NavBar`, `<main id="inhalt">`.
- **Zwei Fehlerhüllen, und die Grenze zwischen ihnen ist gemessen, nicht vermutet.** Ein `error()` aus `handle` erreicht `+error.svelte` **nie**: `respond.js` fängt es und antwortet über `handle_fatal_error` → `static_error_page`, also mit `src/error.html`. Am laufenden Server bestätigt — die 403 des Wächters trägt weder `TitleBar` noch `NavBar`, und **keine** `set-cookie`-Kopfzeile, weil `add_cookies_to_headers` nur auf einer Antwort aus `resolve` und im Redirect-Zweig läuft. `+error.svelte` greift allein für Fehler **innerhalb** des Routings, etwa einen unbekannten Pfad bei gültiger Sitzung; dort ist der Rahmen sichtbar. Ein `rewrite` in `handle` gibt es in 2.70.3 nicht, und `reroute` läuft vor `handle` ohne Zugriff auf Cookies — es gibt also keinen dritten Weg.
- **`init` ist die Stelle für Fail-Fast, nicht das Modulladen.** `analyse.js` importiert beim Bauen jedes Servermodul, ruft aber `init` nicht auf. Gemessen: mit Prüfung beim Modulladen bricht `npm run build` ohne `SESSION_SECRET` ab.
- Für die Zugangsseite nur **bereits deklarierte** Tokens (`--display-*`, `--body-*`, `--ink-*`, `--gutter`, `--space-*`, `--measure`). Kein neues Token, sonst greift Gate-Regel 4.
- Vorlagen in `/Users/manuelagner/Documents/webs/beehiveJournal` — **nur lesen**: `src/lib/server/db/index.ts:9-45` (Fail-Fast, Pragmas, `migrate`), `schema.ts:16-24` (Tabellenform, `$infer*`), `queries/hives.ts:117-136` (synchron, `satisfies`, `.get()`), `auth.ts:59-109` (HS256 mit `jose`, Cookie-Optionen). **Nicht übernehmen:** `argon2`, `tsx`, `dotenv-cli`, `adapter-auto`, JSON-Endpunkte, Guard im Layout-Load statt in `hooks.server.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- `jose` 6.2.10, `@types/better-sqlite3` 9.6.0, ohne Caret. Skripte `db:generate` (`node --env-file-if-exists=.env node_modules/drizzle-kit/bin.cjs generate` — der Pfad auf `bin.cjs` ist Absicht, weil `--env-file` nur für Node-Skripte gilt), `create-admin`, `db:check` und `smoke`. **`lint` ruft zusätzlich `db:check` und `smoke`** — beide prüfen Zusagen dieser Story, die sonst von keinem Befehl berührt werden
- [x] `tsconfig.json` + `tsconfig.scripts.json` -- `allowImportingTsExtensions: true` mit Begründung. **Zweites Programm für `scripts/**` und `drizzle.config.ts`**, von `check` mitgerufen: `.svelte-kit/tsconfig.json` deckt nur `src/**`, `create-admin.ts` liegt also heute aussen. Folge, wenn es so bleibt: ein Umbenennen in `queries/members.ts` fällt nicht auf, der erste Admin entsteht still **ohne** Adminrechte, weil ein unbekanntes Feld auf den SQL-Vorgabewert `false` zurückfällt
- [x] `drizzle.config.ts` -- `dialect: 'sqlite'`, `schema: './src/lib/server/db/schema.ts'`, `out: './drizzle'`, `dbCredentials.url` aus `DATABASE_PATH` mit Fail-Fast; die Meldung ist benannt, nie ein Stacktrace
- [x] `src/lib/server/db/schema.ts` -- `members`: `id`, `name`, `invite_token_hash` (`unique`, `notNull`), `is_admin`, `is_active` (beide `{ mode: 'boolean' }`), `created_at` **über `$defaultFn`** statt in der Einfügefunktion — sonst muss jede künftige Einfügestelle den Zeitstempel wiederholen, und eine wird ihn vergessen. `Member`/`NewMember` über `$inferSelect`/`$inferInsert`
- [x] `drizzle/0000_*.sql` und `drizzle/meta/` -- über `npm run db:generate` erzeugen, mitliefern, **von Hand nie ändern**; `drizzle/` in `.prettierignore`, damit die Dateien Zeichen für Zeichen bleiben, was der Generator geschrieben hat
- [x] `src/lib/server/db/index.ts` -- **Modulladen bleibt nebenwirkungsfrei.** `datenschichtStarten()` prüft `DATABASE_PATH`, öffnet `new Database`, setzt `journal_mode = WAL`, `foreign_keys = ON` **und `busy_timeout`** (ohne das wirft der erste gleichzeitige Schreibzugriff sofort `SQLITE_BUSY`, und `create-admin` neben dem laufenden Entwicklungsserver ist der Normalfall) und ruft `migrate(db, { migrationsFolder: 'drizzle' })`. Fehlender Ordner, nicht schreibbares Verzeichnis, fehlgeschlagenes Pragma: je eine benannte Meldung. Ein Import allein öffnet keine Verbindung
- [x] `src/lib/server/db/queries/members.ts` -- synchron: `mitgliedNachTokenHash`, `mitgliedNachId`, `mitgliedAnlegen`. Nur diese Namen benutzen Route und Skript
- [x] `src/lib/server/token.ts` -- `tokenErzeugen()` (32 Byte `randomBytes`, base64url) und `tokenHashen()` (SHA-256 hex). **Kein Import aus `$app/*`, `$env/*` oder `@sveltejs/kit`** — sonst ist die Datei aus dem CLI-Skript nicht ladbar
- [x] `src/lib/server/auth.ts` -- HS256 über `jose`; `sitzungAusstellen`, `sitzungLesen` (jeder Fehler ergibt `null`, nie ein Wurf nach aussen), `sitzungLoeschen`. Cookie `sitzung`: `httpOnly`, `sameSite: 'lax'`, `path: '/'`, `maxAge` ein Jahr, `secure` ausserhalb der Entwicklung. Nur die `member_id` im Nutzinhalt. Die Prüfung von `SESSION_SECRET` wandert in `init`; sie verlangt **≥ 32 Zeichen und mindestens 8 verschiedene** — `'a'.repeat(32)` ist kein Geheimnis, die Meldung behauptete es aber. Der Kommentar zu `sitzungLoeschen` sagt wahrheitsgemäss, dass die Kopfzeile auf dem Fatal-Pfad des Wächters nicht ausgeliefert wird
- [x] `src/app.d.ts` -- `App.Locals.mitglied: Member | null`; die Rümpfe für spätere Stories bleiben stehen
- [x] `src/hooks.server.ts` -- drei Ausfuhren. **`init`**: ruft `datenschichtStarten()` und prüft `SESSION_SECRET` sowie `ORIGIN`; schlägt eine Prüfung fehl, wird die benannte Meldung ausgegeben und der Prozess beendet, nie ein Stacktrace. `ORIGIN` gehört dazu, weil sonst der erste Formularversand im Betrieb an einem CSRF-Fehler stirbt — genau der Ausfallmodus, gegen den AD-13 geschrieben ist. **`handle`**: Bypass für die Einlöseroute, **auch mit Schrägstrich am Ende** (`/^\/i\/[^/]+\/?$/`) — der Hook läuft vor der Normalisierung, ein gültiger Link mit angehängtem `/` würde sonst abgewiesen; sonst Cookie lesen, Mitglied laden, `is_active` prüfen, `locals.mitglied` setzen, Cookie gleitend erneuern, bei Fehlschlag `error(403, …)`. Setzt `Referrer-Policy: no-referrer` auf jede Antwort: die Identität steht im Pfad. **`handleError`**: gibt den deutschen Satz zurück statt `Internal Error`, und der Klartext eines Tokens erscheint in keiner Protokollzeile
- [x] `src/routes/i/[token]/+server.ts` -- `GET`: hashen, Mitglied suchen, bei aktivem Treffer Cookie ausstellen und `redirect(303, '/')`, sonst `error(403, …)`. Ein Wurf der Abfrage wird zum selben 403, nie zu einer 500 — sonst verrät der Statuscode, dass es die Zeile gibt. Token nie ins Log, nie in die Antwort
- [x] `src/routes/+error.svelte` -- greift für Fehler **innerhalb** des Routings; Status 403 → der vorgeschriebene Satz, sonst `page.error.message`, leere Meldung fällt auf einen Satz zurück statt auf ein leeres `<h1>`. `<h1>` in der `display`-Rolle, Text in `body`, eigener `<title>`, **keine Farbe als Signal**
- [x] `src/error.html` -- die Rückfallhülle für alles aus `handle`, also für die 403 des Wächters: `lang="de"`, ein `<h1>` mit dem Satz, Systemfarben statt wiederholter Token, kein Rot, kein Verweis auf eine Schrift oder ein Stilblatt. `GrayText` **nicht** benutzen — das ist die Farbe für Deaktiviertes und wird absichtlich kontrastarm gerendert
- [x] `scripts/create-admin.ts` -- **Name und `ORIGIN` werden geprüft, bevor die Datenschicht geladen wird.** Heute zieht der Import am Dateikopf die Datenbank hoch, also legt ein Aufruf ohne Namen erst eine Datenbank samt `-wal` und `-shm` an und sagt danach „Es fehlt der Name". `ORIGIN` muss eine absolute `http(s)`-Adresse sein, sonst ist der ausgegebene Link unklickbar und das Klartext-Token verbraucht. Danach `datenschichtStarten()` ausdrücklich rufen, Token erzeugen, Hash speichern, `is_admin = 1`, `${ORIGIN}/i/${token}` **einmal** ausgeben. Ein Fehlschlag beim Einfügen ergibt eine benannte Meldung und Exit 1. Importe relativ mit `.ts`-Endung, nie über `$lib`
- [x] `scripts/gate.mjs` + `scripts/gate-fixtures/` -- **Regel 9** schärfen: der Selbsttest verlangt heute nur *einen* Treffer je Probe, und die Form `db/index` deckt **keine** Probe — genau die Form, die als Akzeptanzkriterium steht. Also eine Probe je verbotener Form (`drizzle-orm`, `$lib/server/db`, `$lib/server/db/index`, relativer Pfad auf `db/index.ts`) und eine Erwartung je Probe statt „mindestens einer". **Regel 1 auf `.html` unter `src/` ausdehnen** ausser `app.html`, nur Farbliterale: `src/error.html` trägt Gestaltungswerte und wird heute von keiner Regel gelesen, ein Hex oder ein Rot käme dort ungehindert durch. Doku-Kopf auf die tatsächliche Regelzahl heben
- [x] `scripts/smoke-zugang.ts` -- **der ausgeführte Nachweis der Zusagen dieser Story**, im Geist von `gate:selftest`. Iteration 2 hat es gebaut, aber drei Zusagen blieben ungepinnt — jede davon ist durch Mutation belegt und muss rot werden:
  1. **Ein widerrufenes, gespeichertes Token durch `einloesen()`.** Bisher ging nur ein *unbekanntes* Token durch die Einlöseroute; das widerrufene Mitglied wurde ausschliesslich über den Wächter geprüft. Entfernt man `|| !mitglied.isActive` aus der **Route**, bleiben `lint` und `smoke` grün, und ein widerrufenes Token antwortet 303 statt 403 — ein Aufzählungskanal, den der eingefrorene Block ausdrücklich verbietet.
  2. **Widerruf einer bereits lebenden Sitzung.** Bisher wurde das Mitglied deaktiviert, *bevor* sein Cookie existierte. Damit genügt ein Wächter, der jedes Mitglied einmal pro Prozess nachschlägt. Also: Cookie ausstellen, Aufruf gelingt, dann `is_active = 0` setzen, und **derselbe** Keks muss beim nächsten Aufruf 403 ergeben.
  3. **Die Cookie-Eigenschaften.** Die Attrappe `Kekse.set` verwarf das Optionsobjekt, deshalb war kein einziges Attribut geprüft: `httpOnly` zu entfernen liess `lint` **und** `smoke` grün. Also `set(name, wert, optionen)` mitschreiben und `httpOnly`, `sameSite`, `path` und `maxAge` behaupten. Das ist das einzige Zugangsmittel der Anwendung.
  Ausserdem: die Byte-Gleichheit darf nicht tautologisch sein — sie verglich die Ausgabe einer reinen Funktion mit sich selbst, nachdem Status und Satz zwei Blöcke vorher schon behauptet worden waren; sie muss echte Antwortobjekte samt Kopfzeilen vergleichen. Der Satz muss im gerenderten **`<h1>`** behauptet werden, nicht irgendwo im Dokument, sonst darf die einzige sichtbare Zeile falsch sein. `Referrer-Policy` ist auf den **tokentragenden** `/i/`-Antworten zu behaupten, nicht nur auf dem gewachten Pfad. `sitzungsgeheimnisPruefen()` ist mit leerer Zeichenkette, 31 Zeichen und `'a'.repeat(32)` auszuführen. Jede Behauptung, die heute in einem `if` steht, braucht einen `else`-Zweig, der rot wird; jeder `spawnSync` einen `timeout` und eine Prüfung auf `lauf.error`
- [x] `scripts/create-admin.ts` (Korrekturen) -- **Name aus allen Argumenten** (`process.argv.slice(2).join(' ').trim()`): heute liest es `argv[2]`, und `npm run create-admin -- Anna Meier` legt stillschweigend „Anna" an — belegt, in der Datenbank steht `[{"name":"Anna"}]`. Der Name ist die einzige menschenlesbare Identität im System. **Zweitlauf-Schutz**: gibt es schon Mitglieder, abbrechen mit dem Hinweis auf Story 1.3, statt einen zweiten Admin und einen zweiten lebenden Link zu erzeugen. Der Fehlerhinweis darf keine `unique`-Bedingung auf `name` behaupten, die es nicht gibt
- [x] `src/lib/server/herkunft.ts` (Korrektur) -- `ORIGIN` mit Pfad oder Abfrageteil wird abgewiesen oder auf `adresse.origin` reduziert: `https://garten.example.ch/app?x=1` ergibt heute einen unklickbaren Link, und das Einmal-Token ist dabei verbraucht — genau der Fehlschlag, den die Funktion verhindern soll
- [x] `src/hooks.server.ts` (Korrektur) -- `handleError` darf einen unbekannten Pfad nicht mit „Etwas ist schiefgelaufen" beantworten: bei gültiger Sitzung liefert `/gibtsnicht` heute Status 404 mit diesem Satz, obwohl nichts schiefgegangen ist. Ein eigener deutscher Satz für „gibt es nicht". Ausserdem den Fall „Cookie gültig, Mitgliedszeile weg" dokumentieren — er ist implementiert, aber Matrix und `texte.ts` zählen nur vier Fälle
- [x] `src/routes/+error.svelte` (Korrektur) -- die Sonderbehandlung darf nicht am nackten Status 403 hängen: Story 1.3 führt eigene 403-Fälle ein (Verwaltung), die dann fälschlich „Dieser Link gilt nicht mehr" zeigen würden
- [x] `scripts/gate.mjs` (Korrekturen) -- Regel 9 erfasst auch einen direkten `better-sqlite3`-Import in einer Route; `ohneKommentare` blendet **auch Zeilenkommentare** aus, denn der JSDoc behauptet das schon, es stimmt aber nicht — ein auskommentierter Import unter `src/routes/` gäbe heute einen falschen Verstoss. Die `erwartet`-Zahlen der Proben werden begründet oder aus der Probe abgeleitet; die Prosa in `regel-1-farbliteral-und-mass` nennt fünf Verletzungen, es sind sechs
- [x] `src/lib/texte.ts` (Korrektur) -- der Kopfkommentar behauptet zwei Unwahrheiten: es gibt zwei Wurfstellen, nicht vier, und `smoke` vergleicht **nicht** den Satz in `src/error.html` mit der Konstante — dort steht nur der Platzhalter. Ein Kommentar, der eine nicht existierende Prüfung verspricht, ist schlimmer als keiner
- [x] `## Spec Change Log` (Korrektur) -- der vierte Eintrag des Umsetzungsagenten behauptet weiterhin, `npm run build` brauche die Pflichtvariablen. Seit dem `init`-Hook ist das falsch und widerspricht Akzeptanzkriterium, README und `.env.example`. Eintrag richtigstellen, nicht löschen
- [x] `README.md` (Korrekturen) -- der Schnellstart ist nicht befolgbar: `cp .env.example .env` schreibt drei leere Pflichtwerte, das folgende `npm run dev` bricht per Entwurf ab. Ein kopierbares Tripel für lokal angeben. Warnen, dass `npm run preview` und ein `npm start` über nackte HTTP-Verbindung das `Secure`-Cookie verwerfen und damit jede Anmeldung scheitern lassen. Login-CSRF und Verbindungsvorschau auf `GET /i/<token>` als benannt akzeptiertes Risiko festhalten, wie die nginx-Protokolle es schon sind
- [x] `.env.example` -- `DATABASE_PATH` und `SESSION_SECRET` sind Pflicht, mit Erzeugungsbefehl; `ORIGIN` ist Pflicht für Server **und** `create-admin`; `PORT` ist optional und `adapter-node` nimmt ohne sie 3000 — die Behauptung, keine Variable habe einen Vorgabewert, ist für `PORT` falsch
- [x] `README.md` -- `create-admin`, `db:generate`, `db:check`, `smoke`; der Weg vom leeren System zum ersten Link; dass `drizzle/` beim Produktionsstart neben `build/` liegen muss; dass die 403 des Wächters **ohne** Rahmen erscheint und das Cookie dort liegen bleibt; dass das Projekt npm-gebunden ist (der `bin.cjs`-Pfad setzt Hoisting voraus); und ein Hinweis für Story 1.6, `/i/` aus dem nginx-Zugriffsprotokoll herauszuhalten

**Iteration 3 — Nachträge. Jede dieser Behauptungen kann heute nicht scheitern; das ist durch Demonstration belegt:**
- [x] `scripts/smoke-zugang.ts` -- **`secure` behaupten.** Es ist das fünfte Cookie-Attribut, die Attrappe zeichnet es auf, keine Behauptung liest es. `secure: false` setzen lässt `lint`, `smoke` und `check` grün — von mir mutiert. Dieselbe Klasse wie die `httpOnly`-Lücke aus Iteration 2, ein Attribut weiter. Der Doku-Kommentar der Hilfsfunktion sagt „die vier Attribute" und meint fünf
- [x] `scripts/smoke-zugang.ts` -- **Byte-Gleichheit über Antworten, die nicht aus zwei Werten neu gebaut sind.** Der Abdruck kommt aus `fehlerseite(status, meldung)`, einer reinen Funktion über genau die zwei Werte, die `abweisungOderRot` vorher schon einzeln behauptet hat. Die Behauptung kann nur als Zweitsymptom eines anderen Fehlschlags rot werden. Konkret unentdeckt: `setHeaders({'cache-control':'no-store'})` an **einer** der beiden Wurfstellen — die „keine Kopfzeile"-Hälfte der Anti-Aufzählungs-Regel ist damit behauptet, aber nicht gemessen. Die Abweisungs-Variante von `Ausgang` trägt ausserdem kein `kekse`-Feld, verwirft also Cookie-Aktivität auf dem Abweisungspfad, bevor eine Behauptung sie sehen könnte
- [x] `scripts/smoke-zugang.ts` -- **`set-cookie` und `content-type` der 403 nicht gegen ein selbstgebautes Objekt prüfen.** Die Kopfzeilenliste ist ein Literal in `fehlerseite`, eine Funktion neben der Behauptung, die sie prüft. Beide Behauptungen sind unfalsifizierbar: das in Iteration 1 entfernte `sitzungLoeschen` vor dem Wurf wieder einzusetzen bleibt unentdeckt
- [x] `scripts/smoke-zugang.ts` -- **`handleError` ausführen.** Von keiner Behauptung erreicht; der `resolve`-Stub antwortet für jeden Pfad ausser `/i/` mit 200, es entsteht also nie ein 404. Die beiden Konstanten zu tauschen stellt die in Iteration 2 gemessene Regression wieder her, `lint` bleibt 0. Ebenso unentdeckt: die Token-Schwärzung aus `handleError` entfernen, womit ein Klartext-Token in `console.error` landet. Die Funktion hat keine SvelteKit-Abhängigkeit und ist direkt aufrufbar
- [x] `src/hooks.server.ts` + `scripts/smoke-zugang.ts` -- **den `init`-Hook selbst prüfen, nicht nur seine drei Funktionen.** Dass die Prüfungen dort verdrahtet sind, beobachtet nichts: einen Aufruf in ein schluckendes `catch` zu wickeln oder `process.exit(1)` zu entfernen lässt alles grün, und der Server startet ohne `ORIGIN`. Damit `init` prüfbar wird, gehört der werfende Teil in eine aufrufbare Funktion, die der Hook nur noch in Meldung und Exit übersetzt
- [x] `drizzle.config.ts` + `scripts/db-check.ts` -- **die Konfiguration ausführen, nicht ihren Text durchsuchen.** `db:check` fährt den Generator mit eigenen Flaggen und prüft die Datei nur mit zwei `includes`. Den Fail-Fast durch `?? './data/dev.sqlite'` zu ersetzen lässt beide `includes` passen und alles grün — obwohl der eingefrorene Block genau diesen erfundenen Vorgabewert verbietet. `dialect` ist von gar keiner Prüfung gedeckt. Also: `db:generate` in einem Wegwerfverzeichnis ohne `DATABASE_PATH` ausführen und Exit 1 samt benannter Meldung behaupten
- [x] `scripts/smoke-zugang.ts` -- **„zweites Gerät" prüft heute eine Zeichenkette zweimal.** `setIssuedAt()` und `setExpirationTime('31536000s')` sind sekundengenau, zwei Einlösungen im selben Sekundenfenster ergeben ein byte-identisches JWT. Vier Behauptungen hängen an einem Wert, und ob es zwei sind, entscheidet der Zufall der Sekundengrenze. Das war ein KEEP-Punkt, den ich fälschlich als belegt gemeldet habe
- [x] `scripts/smoke-zugang.ts` -- **die gleitende Erneuerung zählt die eigene Saat mit.** Die Attrappe zeichnet das *eingehende* Cookie als `Setzung` auf, was echtes SvelteKit nie tut; die Schwelle `>= 2` ist damit schon durch Saat plus **eine** Setzung erfüllt und bedeutet nicht, was sie liest
- [x] `scripts/gate.mjs` -- **Regression an Regel 1 zurücknehmen.** Die Zeilenkommentar-Ausblendung aus Iteration 3 leert in **jeder** Datei den Zeilenrest, auch in `.css` und in `<style>`, wo `//` kein Kommentar ist. Von mir belegt: `url(//cdn.example.com/x.png); color: #ff0000;` in einer Zeile → Regel 1 schweigt; ohne die URL feuert sie. Ausblenden nur dort, wo `//` wirklich ein Kommentar sein kann, und eine **Gegenprobe** anlegen, die beweist, dass die Ausblendung nicht zu weit greift
- [x] `scripts/gate.mjs` -- **Regel 1 auf `.html` kennt die benutzte Farbsprache nicht.** Die Namensliste führt die 148 CSS-Farbnamen, `istFarbwert` erkennt Farbfunktionen — `src/error.html` ist aber ausschliesslich in **Systemfarben** gestaltet (`Canvas`, `CanvasText`, `GrayText`, `Mark`, `LinkText`, `ButtonText`). Die eine Datei, für die die Regel erweitert wurde, wird also auf eine Wertform geprüft, die sie nicht benutzt. Systemfarben in die Farbsprache aufnehmen, mit einer erlaubten Auswahl statt einer Einzelfallprüfung im Prüfskript
- [x] `scripts/gate.mjs` -- **Gegenprobe für Regel 9**, die beweist, dass der **erlaubte** Import durchgeht: jede Probe trägt nur die verbotene Form, eine zu breite Regel bliebe im Selbsttest grün und fiele erst als rätselhafter Verstoss im echten Baum auf. Ausserdem entscheiden, ob ein reines `import type { … } from 'drizzle-orm'` — beim Bauen gelöscht — ein Verstoss sein soll
- [x] `scripts/db-check.ts` -- **eigener Selbsttest.** Es ist das einzige Tor der Kette ohne Fehlerprobe; seine beiden tragenden Prüfungen wurden einmal von Hand belegt. `abbrechen` zu einer Warnung zu machen liesse `lint` grün, während der Drift-Schutz aufhört zu greifen
- [x] Dokumentation und Kommentare, die mehr versprechen als der Code hält -- `NODE_ENV` steuert das `secure`-Flag und damit das Zugangsmittel, steht aber in keiner der beiden Variablentabellen, die beide Vollständigkeit behaupten. `npm start` liest `.env` **nicht**, ungesagt, direkt neben der Einladung, `http://localhost:3000` zu probieren. Die README-Mutationstabelle nennt vier vorher grüne Mutationen; eine davon war laut KEEP-Liste schon rot — aufgeblähte Beweisführung ist genau das, was frühere Runden bestraft haben. Der JSDoc von `herkunftLesen` verspricht, ein Fragment **abzuweisen**, der Code schneidet es still weg. Der Kommentar zu `mitKopfzeilen` sagt „eine einzige Antwort" erreicht die Kopfzeile nicht — die 403 der Einlöseroute nimmt denselben Fatal-Pfad, und das ist die tokentragende Anfrage. `locals.mitglied` trägt den vollständigen `invite_token_hash` in jede Load-Funktion; eine Projektion ohne die Hash-Spalte kostet jetzt nichts und verhindert ein stilles Leck in 1.3. Die README-Aussage, ein verlorener Link liesse sich „ersetzen", ist mit dem neuen Zweitlauf-Schutz falsch
- [x] `## Tasks & Acceptance` -- erledigte Aufgaben auf `[x]` setzen; die Buchhaltung hinkt der Umsetzung nach

**Acceptance Criteria:**
- Given ein frisch geklontes Repository **ohne `.env`**, when `npm install && npm run build` läuft, then endet beides mit 0 — der Bau darf keine Pflichtvariable brauchen, weil `init` beim Analyseschritt nicht läuft
- Given ein Start ohne `SESSION_SECRET`, ohne `ORIGIN` oder mit einem Geheimnis aus 32 gleichen Zeichen, when der Server startet, then bricht er mit einer benannten deutschen Meldung ab, ohne Stacktrace und ohne Fallback
- Given `npm run lint`, when es läuft, then ruft es `gate`, `gate:selftest`, `db:check` und `smoke` und endet mit 0
- Given eine Spalte, die in `schema.ts` ergänzt wird, ohne `db:generate` zu laufen, when `npm run lint` läuft, then endet es mit 1 — sonst baut die Änderung grün und stirbt beim ersten Aufruf
- Given `mitgliedAnlegen` mit umbenanntem Feld, when `npm run check` läuft, then endet es mit 1, weil `scripts/` im Typprüf-Programm liegt
- Given `npm run gate:selftest`, when es läuft, then weist es **je verbotener Importform** einen Regel-9-Treffer nach, `db/index` eingeschlossen, und ein Hex-Wert in `src/error.html` ergibt einen Regel-1-Treffer
- Given `npm run smoke`, when es läuft, then belegt es ausgeführt: widerrufenes Mitglied ergibt 403, die vier Fälle ohne Zugang sind byte-gleich, `locals.mitglied` ist gesetzt, `create-admin` erzeugt `is_admin = 1` und genau eine Link-Zeile, und in `members` steht kein Klartext
- Given `|| !mitglied.isActive` wird aus dem Wächter entfernt, when `npm run lint` läuft, then endet es mit 1 — die Kern-Invariante darf nicht an einem Augenschein hängen
- Given ein gültiger Einladungslink **mit Schrägstrich am Ende**, when er aufgerufen wird, then wird er eingelöst und nicht abgewiesen
- Given `npm run create-admin` ohne Namen, when es läuft, then erscheint die Meldung und Exit 1, **und es entsteht keine Datenbankdatei**
- Given der ausgegebene Link, when er aufgerufen wird, then folgt 303 auf `/`, und ein erneuter Aufruf von `/` zeigt die Liste ohne Zwischenschritt
- Given eine frische Datenbank nach `create-admin`, when `members` gelesen wird, then steht dort ein 64-stelliger Hex-Hash und nirgends der Klartext
- Given jede Antwort des Servers, when die Kopfzeilen gelesen werden, then steht dort `Referrer-Policy: no-referrer`
- Given den Produktionsbau, when `build/` durchsucht wird, then existiert dort keine `.sql`-Datei

### Review Findings

_Code-Review (bmad-code-review), Gruppe A — src/, drizzle.config.ts, drizzle/0000_flashy_eternity.sql — Diff `e688e7d..HEAD`, 2026-08-27. Gruppe B (scripts/) folgt in einem separaten Lauf._

- [x] [Review][Decision] Referrer-Policy fehlt auf beiden 403-Fatal-Pfad-Antworten (Wächter und `/i/<token>`) — Nur der Erfolgsfall (gültiges Token → 303) läuft durch `resolve()` und bekommt den Header über `mitKopfzeilen()`. Beide 403-Fälle werfen `error(403, KEIN_ZUGANG)` direkt und verlassen SvelteKit über `handle_fatal_error`, wo `mitKopfzeilen()` nie läuft. **Entschieden vom User am 2026-08-27: als dritte akzeptierte Ausnahme dokumentiert** (analog zu fehlendem Rahmen und fehlendem `set-cookie` auf denselben zwei Antworten), siehe `## Design Notes`. Code bleibt unverändert. [src/hooks.server.ts, src/routes/i/[token]/+server.ts]
- [x] [Review][Patch] `herkunftLesen()`: unerreichbare Teilbedingung `adresse.pathname !== ''` — eine absolute http(s)-URL hat nie einen leeren `pathname` (mindestens `/`); die Bedingung lässt sich auf `adresse.pathname !== '/'` allein reduzieren, Verhalten bleibt identisch. Behoben. [src/lib/server/herkunft.ts]
- [x] [Review][Defer] `secure`-Cookie-Flag im Entwicklungsmodus, `herkunftLesen`-Fehlerzweige (kaputte URL, falsches Schema, Zugangsdaten) und `datenschichtStarten`s eigene `DATABASE_PATH`-Prüfung sind durch `scripts/smoke-zugang.ts` nicht abgedeckt [scripts/smoke-zugang.ts] — deferred, pre-existing; deckt sich mit der bereits bestehenden Zurückstellung in `deferred-work.md` (Zeile 13–15, vom User am 2026-08-27 entschieden) zur Attrappen-Bauform des Smoke-Skripts. Keine neue Zeile in `deferred-work.md` angelegt, um die dortige Eintragung nicht zu duplizieren.

_Gruppe B — scripts/create-admin.ts, scripts/db-check.ts, scripts/gate.mjs, scripts/smoke-zugang.ts — Diff `e688e7d..HEAD`, 2026-08-27. Acceptance-Auditor hat alle Change-Log-Behauptungen der drei bisherigen Spec-Iterationen live nachgestellt (Mutationstests, vollständiger `npm run lint`- und `build`-Lauf) — keine Verletzung gefunden._

- [x] [Review][Decision] `gate.mjs`s textuelles Scannen von Importen/Kommentaren hat sowohl blinde Flecken als auch Fehlalarm-Risiken: 400-Zeichen-Rückschau für `import type` kann bei langen, von Prettier umgebrochenen Typlisten eine echte Typ-Import-Zeile fälschlich als Wert-Import werten; Import-Spezifizierer je Feld (`import { type A, type B }`) werden nicht erkannt; das `from '...'`-Muster ist nicht an ein echtes `import`/`export`-Statement gebunden (ein String wie `"copied from '$lib/server/db'"` könnte fälschlich Regel 9 auslösen); dynamische Imports über Template-Literale werden nicht gescannt; ein blankes `//` ausserhalb von CSS-Abschnitten könnte den Rest einer Zeile fälschlich als Kommentar ausblenden und eine echte Regel-1/2/3/9-Verletzung dahinter verdecken. Aktuell löst nichts davon auf dem echten Baum aus (`npm run gate`/`gate:selftest` sind grün). **Entschieden vom User am 2026-08-27: als bekannte Grenze stehen lassen**, in `deferred-work.md` vermerkt. [scripts/gate.mjs]
- [x] [Review][Defer] `gate.mjs`s `systemfarben`-Set enthält nur die modernen CSS-Color-Module-4-Schlüsselwörter; ältere Systemfarben-Namen (`Window`, `WindowText`, `Menu`, `MenuText`, `ButtonHighlight`, `ThreeDFace`, `Scrollbar`, `InactiveCaption`, …) stehen weder dort noch in `farbnamen` und treffen auch nicht auf das Hex-/Funktions-Muster — ein Wert wie `color: Window;` würde Regel 1 unbemerkt passieren. **Praktisch ausprobiert und zurückgenommen:** das Ergänzen dieser Namen brach `gate:selftest` (9 statt 6, 7 statt 3, 4 statt 2 Treffer in drei Proben), weil Wörter wie `background`, `window` und `menu` ausserhalb echter Farbwert-Position matchen — dasselbe Präzisionsproblem, das der User unter der Decision oben bewusst als bekannte Grenze stehen liess. Gehört zu derselben `deferred-work.md`-Zeile, keine separate Eintragung. [scripts/gate.mjs]
- [x] [Review][Patch] `create-admin.ts`s Kopfkommentar-Beispiel `npm run create-admin -- Anna` ist seit dem in diesem Diff selbst behobenen Mehrwort-Namen-Fehler veraltet (Iteration 2, Befund 5: „Anna Meier" wurde zu „Anna" verkürzt) — ein Leser, der nur den Kopf überfliegt, hält Einwort-Namen weiterhin für die Norm. Behoben. [scripts/create-admin.ts]
- [x] [Review][Patch] `db-check.ts` trägt denselben `120_000`-ms-Timeout dreifach von Hand an drei `spawnSync`-Aufrufen (`failFastPruefen`, `konfigurationLesen`, `driftPruefen`) — eine benannte Konstante hält Begründung und künftige Anpassung an einer Stelle. Behoben (`SPAWN_TIMEOUT_MS`), `db:check --selftest` verifiziert. [scripts/db-check.ts]
- [x] [Review][Defer] `create-admin.ts` hat eine Prüfen-dann-Handeln-Lücke: `mitgliederZaehlen() > 0` wird gelesen, danach erst eingefügt, ohne Transaktion oder Unique-Zwang dazwischen — zwei nahezu gleichzeitige Läufe könnten beide die Prüfung passieren, bevor einer einfügt. Sehr geringe Eintrittswahrscheinlichkeit: ein manuelles Einmalskript, das ein Betreiber bei der Ersteinrichtung ausführt, nie automatisiert oder parallel. [scripts/create-admin.ts] — deferred, geringes Risiko für ein manuelles Einmal-Setup-Skript.
- [x] [Review][Defer] `scripts/smoke-zugang.ts` deckt keinen Session-/Token-Ablauf-Fall ab (nichts fälscht ein abgelaufenes, sonst wohlgeformtes Sitzungs-Cookie, um die Ablehnung zu belegen) — Test-Abdeckungslücke, gehört zur bereits dokumentierten Attrappen-Limitation des Smoke-Skripts (siehe `deferred-work.md`, Zeile 13–15). [scripts/smoke-zugang.ts]
- [x] [Review][Defer] Keine `SIGINT`/`SIGTERM`-Aufräumbehandlung für `mkdtempSync`-Scratch-Verzeichnisse in `create-admin.ts`, `db-check.ts` und `smoke-zugang.ts` — ein Ctrl-C mitten im Lauf kann Temp-Verzeichnisse zurücklassen; niedriger Wert für lokal ausgeführte Entwicklerwerkzeuge, das Betriebssystem räumt `os.tmpdir()` ohnehin periodisch auf. [scripts/create-admin.ts, scripts/db-check.ts, scripts/smoke-zugang.ts]

## Spec Change Log

- **Zwei Fehlerhüllen statt einer, `src/error.html` kommt hinzu.** Empirisch an
  SvelteKit 2.70.3 geprüft: ein Wurf aus `handle` in `hooks.server.ts` erreicht
  `+error.svelte` nie. `respond.js` fängt ihn im äusseren `catch` und antwortet
  über `handle_fatal_error` → `static_error_page`, also mit der Rückfallvorlage;
  `page/index.js` sagt es für den Fall des Wurzel-Layouts sogar im Kommentar
  ("we have to fall back to error.html"). Die eingebaute Vorlage trägt
  `<html lang="en">`, kein `<h1>` und keinen Rahmen — beides gegen die Vorgaben
  des Epics. Darum liegt jetzt `src/error.html` daneben: `lang="de"`, ein `<h1>`
  mit dem vorgeschriebenen Satz, Systemfarben `Canvas`/`CanvasText` statt
  wiederholter Farbwerte, kein Rot. `src/routes/+error.svelte` bleibt wie
  beschrieben und greift für alles innerhalb des Routings, etwa einen
  unbekannten Pfad bei gültiger Sitzung — dort ist der Rahmen sichtbar.
  **Offen:** Beim 403 des Wächters ist der Rahmen nicht sichtbar. Ihn dort zu
  bekommen verlangte, den Wächter aus `hooks.server.ts` in Seiten-Loads zu
  verlegen — genau die Bauform, die die Boundaries ausschliessen, und sie würde
  "beliebiger Pfad → 403" verlieren, weil ein Pfad ohne Route gar keinen Load
  hat.
- **Das Löschen des Cookies erreicht die Antwort des Wächters nicht.**
  Dieselbe Ursache: `add_cookies_to_headers` läuft in `respond.js` nur auf einer
  Antwort, die aus `resolve` zurückkommt, und im Redirect-Zweig. Auf dem
  Fatal-Pfad fällt jede über `event.cookies` oder `setHeaders` gesetzte
  Kopfzeile weg. `sitzungLoeschen` steht im Wächter und wirkt überall, wo
  SvelteKit Kopfzeilen ausliefert — belegt an `/i/<token>`, das
  `set-cookie: sitzung=; Max-Age=0` mitschickt. Ohne Folge für die Sicherheit,
  weil jeder Aufruf Mitglied und `is_active` neu aus der Datenbank liest: ein
  liegengebliebenes Cookie öffnet nichts. Ohne Folge auch für die
  Anti-Aufzählungs-Regel: alle Fälle des Wächters sind untereinander identisch,
  alle Fälle der Einlöseroute untereinander identisch — belegt für unbekanntes
  gegen widerrufenes Token, gleicher Status, gleiche Kopfzeilen, gleiche
  Rumpflänge. Unterschiedlich sind nur zwei verschiedene Pfade, was über kein
  Token etwas verrät.
- **`drizzle/` steht in `.prettierignore`.** Prettier hat
  `drizzle/meta/*.json` umformatiert; die Dateien sollen Zeichen für Zeichen
  das bleiben, was `db:generate` geschrieben hat.
- **`npm run build` braucht die Pflichtvariablen — richtiggestellt: nein.**
  Der Befund stimmte für die damalige Bauform: die Prüfungen sassen beim
  Modulladen, und SvelteKits Analyseschritt importiert jedes Servermodul einmal,
  also brach schon der Bau ohne `DATABASE_PATH` und `SESSION_SECRET` ab. Genau
  das war Befund 3 aus Iteration 1. Seit die Prüfungen im `init`-Hook stehen,
  gilt das Gegenteil, und es ist gemessen:
  `env -u DATABASE_PATH -u SESSION_SECRET -u ORIGIN npm run build` endet mit 0,
  weil `analyse.js` `init` nie ruft. So steht es im Akzeptanzkriterium, in
  `README.md` und in `.env.example`. Der Eintrag bleibt stehen, damit die
  gemessene Mechanik nicht verloren geht — die Aussage über den heutigen Stand
  ist die zweite Hälfte, nicht die erste.

### Iteration 1 — 2026-08-26

**Auslösende Befunde** (3 Prüf-Layer, 60 Rohbefunde, 29 nach Entdopplung; 3 × `intent_gap`, 16 × `bad_spec`). Am laufenden Server gemessen, nicht aus dem Quelltext geschlossen:

1. **`intent_gap`, hoch** — „Rahmen bleibt sichtbar" war mit `error()` aus `handle` unerfüllbar. Der Wurf verlässt SvelteKit über `handle_fatal_error` → `static_error_page`; die Antwort war 2027 Bytes ohne `TitleBar` und ohne `NavBar`. Kein `rewrite` in 2.70.3, `reroute` ohne Cookie-Zugriff — es gab keinen dritten Weg.
2. **`intent_gap`, mittel** — „Cookie wird gelöscht" trat auf diesem Pfad nicht ein: null `set-cookie` auf der 403, weil `add_cookies_to_headers` nur auf einer Antwort aus `resolve` läuft. Der Aufruf im Wächter war toter Code, der Kommentar in `auth.ts` versprach das Gegenteil.
3. **`intent_gap`, hoch** — „werfen beim Modulladen" machte `npm run build` im frisch geklonten Zustand unmöglich; `analyse.js` importiert jedes Servermodul. Belegt: Abbruch ohne `SESSION_SECRET`.
4. **`bad_spec`** — `/i/<token>/` mit Schrägstrich fiel nicht in den Bypass: eine **gültige** Einladung wurde abgewiesen.
5. **`bad_spec`** — `scripts/create-admin.ts` und `drizzle.config.ts` lagen ausserhalb des Typprüf-Programms (`tsc --listFilesOnly` belegt es). Ein Umbenennen in `queries/members.ts` hätte den ersten Admin still **ohne** Adminrechte entstehen lassen, weil ein unbekanntes Feld auf den SQL-Vorgabewert `false` zurückfällt.
6. **`bad_spec`** — der Regel-9-Selbsttest verlangte nur *einen* Treffer je Probe, und die Form `db/index` deckte keine Probe — genau die Form, die als Akzeptanzkriterium stand. Die halbe Regel hätte still wegfallen können, während `gate:selftest` „jede Regel beisst" meldet.
7. **`bad_spec`** — nichts verglich `schema.ts` mit der Migrationskette; eine Spalte ohne `db:generate` baut grün und stirbt beim ersten Aufruf.
8. **`bad_spec`** — `create-admin` zog die Datenschicht am Dateikopf hoch und legte darum eine Datenbank an, **bevor** es „Es fehlt der Name" sagte.
9. **`bad_spec`** — `src/error.html` trug Gestaltungswerte, wurde aber von keiner Gate-Regel gelesen; Regel 1 gilt nur für `.svelte` und `.css`. Ein Hex-Wert oder Rot wäre dort ungehindert durchgekommen.
10. Weitere: `ORIGIN` serverseitig nie geprüft (CSRF-Fehler erst im Betrieb), kein `handleError` (Stacktrace statt deutschem Satz), kein `busy_timeout` (`SQLITE_BUSY`), `SESSION_SECRET` nur gezählt statt geprüft (`'a'.repeat(32)` bestand), `created_at` in der Abfrage statt im Schema, Token im Pfad ohne `Referrer-Policy`, `locals.mitglied` von nichts gelesen.

**Vom Menschen entschieden:** Die Matrix gibt nach, nicht der Mechanismus — die 403 des Wächters ist eine rahmenlose Minimalseite, das Cookie bleibt liegen. Fail-Fast wandert in den `init`-Hook, der Wortlaut wird auf „beim Start" gezogen, wie AD-13 es ohnehin sagt.

**Geändert:** Der eingefrorene Block sagt jetzt die Wahrheit über Rahmen und Cookie. Fail-Fast sitzt in `init`, das Modulladen ist nebenwirkungsfrei. Neu: `db:check` und `smoke` in der `lint`-Kette, ein zweites Typprüf-Programm für `scripts/`, Regel 9 mit einer Probe je verbotener Importform, Regel 1 auf `.html`, `handleError`, `busy_timeout`, `Referrer-Policy`, Toleranz für den Schrägstrich, Prüfungen vor dem Import in `create-admin`.

**Vermiedener Bekannt-Schlecht-Zustand:** Eine Spezifikation, die drei Zusagen macht, die der Code nachweislich nicht hält — und ein Satz Qualitätstore, der grün meldet, während die Kern-Invariante der Story (`is_active` bei jedem Aufruf) an einem `curl` von Hand hängt. Der Verification-Gap-Prüfer hat genau diese Lücke demonstriert: er hat `|| !mitglied.isActive` entfernt, und `lint`, `check` und `build` blieben grün — ein widerrufenes Mitglied kam mit 200 durch.

**KEEP — im laufenden Baum verifiziert, muss die Neuableitung überleben:**
- `src/error.html` in der gebauten Form: `lang="de"`, ein `<h1>`, Systemfarben statt wiederholter Token, kein Rot, kein externer Verweis. Nur `GrayText` ersetzen.
- Die Ununterscheidbarkeit von widerrufenem und unbekanntem Token: **byte-gleich** gemessen, gleicher Status, gleiche Kopfzeilen, gleiche Rumpflänge. Ein Satz aus `src/lib/texte.ts`, zwei Wurfstellen.
- Einlösen (303 + `set-cookie … HttpOnly`), zweites Gerät mit demselben Token, gleitende Erneuerung, Widerruf wirkt beim nächsten Aufruf — alle vier am laufenden Server bestätigt.
- Der Wächter in `hooks.server.ts` statt in einem Layout-Load, samt Begründung im Kommentar: ein Layout-Load hätte für jede neue Route eine neue Gelegenheit, vergessen zu werden.
- `datenschichtStarten()` auf leerer Datei: `__drizzle_migrations` plus Schema, `journal_mode = wal`, `is_admin` als echtes `boolean`.
- 32 Byte `randomBytes` → 43 Zeichen base64url, SHA-256 → 64 Hex. `token.ts` frei von SvelteKit-Importen.
- `.ts`-Endungen in den Importen unter `src/lib/server/` plus `allowImportingTsExtensions`; `drizzle/` in `.prettierignore`.
- Die drei Change-Log-Einträge des Umsetzungsagenten oben: sie halten die gemessene SvelteKit-Mechanik fest und dürfen nicht verloren gehen.

### Iteration 2 — 2026-08-26

**Auslösende Befunde** (3 schreibgeschützte Layer, 3 × `high` durch Mutation belegt). Der Code ist verhaltensmässig richtig — was fehlt, sind Tore, die ihn festhalten. Das ist genau die Fehlerklasse aus Iteration 1, eine Datei weiter:

1. **`high` — `is_active` in der Einlöseroute war ungepinnt.** `smoke` schickte nur ein *unbekanntes* Token durch `einloesen()`; das widerrufene Mitglied wurde ausschliesslich über den Wächter geprüft. Mutation belegt: `|| !mitglied.isActive` aus der Route entfernt → `lint` und `smoke` **grün**, und ein widerrufenes Token antwortet 303 statt 403. Damit stünde ein Aufzählungskanal offen, den der eingefrorene Block in keinem Statuscode erlaubt. (`lint` wurde bei meinem ersten Versuch rot, aber nur wegen der Formatierung meines Edits — nach `prettier --write` war alles grün.)
2. **`high` — Widerruf einer lebenden Sitzung war nie geprüft.** Das Mitglied wurde in `smoke` deaktiviert, *bevor* sein Cookie existierte (Zeile 189 gegen 267), und das einzige Mitglied mit wiederholt benutztem Cookie wurde nie widerrufen. Ein Wächter, der jedes Mitglied einmal pro Prozess nachschlägt, hätte alle Behauptungen erfüllt — während „ein Widerruf muss sofort wirken", die Voraussetzung von Story 1.3, still ausfällt.
3. **`high` — kein einziges Cookie-Attribut war geprüft.** Die Attrappe `Kekse.set(name, wert)` verwarf das Optionsobjekt. Mutation belegt: `httpOnly: true` entfernt → `lint` und `smoke` **grün**. Das Sitzungs-Cookie ist das einzige Zugangsmittel der Anwendung; es hätte skriptlesbar werden können, ohne dass ein Tor zuckt.
4. **`medium`** — die Byte-Gleichheit war tautologisch (reine Funktion gegen sich selbst, nach vorher behauptetem Status und Satz), ohne Kopfzeilen und ohne echte HTTP-Antwort. Der Satz wurde irgendwo im Dokument behauptet, nicht im gerenderten `<h1>`. `Referrer-Policy` nur auf dem gewachten Pfad, nicht auf den tokentragenden. `sitzungsgeheimnisPruefen()` von nichts ausgeführt — die Schwäche aus Iteration 1 hätte zurückkehren können.
5. **`medium`, von mir ausgeführt belegt** — `npm run create-admin -- Anna Meier` legt „Anna" an und verwirft den Rest; die Datenbank enthält `[{"name":"Anna"}]`. Kein Zweitlauf-Schutz. `herkunftLesen` akzeptiert `https://host/app?x=1`. Ein unbekannter Pfad bei gültiger Sitzung antwortet 404 mit „Etwas ist schiefgelaufen".
6. **`medium`** — Regel 9 erfasst `better-sqlite3` nicht; `ohneKommentare` blendet keine Zeilenkommentare aus, obwohl der JSDoc es behauptet. Der Kopfkommentar in `texte.ts` verspricht eine Prüfung, die es nicht gibt. Der vierte Change-Log-Eintrag behauptet weiterhin, der Bau brauche Pflichtvariablen. Der README-Schnellstart ist nicht befolgbar.

**Widerlegt statt durchgewinkt:** Die Klartext-Prüfung sei durch WAL wirkungslos — nein, `better-sqlite3` schreibt beim Schliessen zurück, es entsteht keine `-wal`-Datei, und der Hash steht nachweislich in der Hauptdatei, der Klartext nicht. `GrayText` in `error.html` — kommt dort ausdrücklich nicht vor. Meine eigene Memoisierungs-Mutation zu Befund 2 war untauglich, sie zerbrach den Erfolgsfall; die Lücke ist über die Reihenfolge im Skript belegt, nicht über jene Mutation.

**Geändert:** Die Smoke-Aufgabe buchstabiert die drei fehlenden Nachweise aus, statt „prüfe die Zusagen" zu sagen — Iteration 2 hat genau meine Liste umgesetzt, die Lücke lag in der Liste. Dazu neun benannte Korrekturen an Code, Tor, Kommentar und Dokumentation.

**Vermiedener Bekannt-Schlecht-Zustand:** Ein Prüfskript, das als Testersatz verkauft wird, während drei Mutationen an der Sicherheitsschicht — Widerruf beim Einlösen, Widerruf einer lebenden Sitzung, `httpOnly` — sämtliche Tore grün lassen. Iteration 1 hat diese Klasse einmal bezahlt.

**KEEP zusätzlich zu Iteration 1 — von mir am laufenden Baum belegt, muss überleben:**
- Die drei Tore, die **beissen**: `is_active` aus dem **Wächter** entfernt → `smoke` rot; Spalte ohne `db:generate` → `db:check` rot; `db/index.ts`-Import in einer echten Route → Regel 9 rot, in der relativen Form, die Iteration 1 nicht abdeckte.
- `env -u DATABASE_PATH -u SESSION_SECRET -u ORIGIN npm run build` → **Exit 0**. Der `init`-Hook trägt, das Akzeptanzkriterium hält.
- Link **mit** Schrägstrich am Ende: 308 → 303 → 200 mit Rahmen und `Nichts offen.`
- Widerrufenes gegen unbekanntes Token über `/i/`: byte-gleich, 2395 B, gleiche Kopfzeilen.
- `error.html` ohne `GrayText`, mit `meta referrer`, ohne Hex, ohne externen Verweis.
- `datenschichtStarten()` mit `busy_timeout`; Klartext nicht in der Datenbankdatei, Hash schon.

### Iteration 3 — 2026-08-27

**Auslösende Befunde** (3 schreibgeschützte Layer). Die drei `high`-Lücken aus Iteration 2 sind geschlossen und von mir durch Mutation belegt: `is_active` in der Einlöseroute → 2 rote Behauptungen, `httpOnly` → 3, Memoisierung des Mitglieds → 4, `is_active` im Wächter → 4, jeweils `lint` 1 und danach wieder 0. Die vier Korrekturen ebenfalls ausgeführt belegt.

**Was diese Runde gefunden hat, ist dieselbe Krankheit an neuen Stellen:** sieben Behauptungen, die nicht scheitern können, plus eine Regression an einem alten Tor.

1. **`secure` ist das eine ungeprüfte Cookie-Attribut** — von mir mutiert, alle Tore grün. Die `httpOnly`-Klasse aus Iteration 2, ein Attribut weiter.
2. **Regression an Regel 1**, eingeführt durch die Zeilenkommentar-Korrektur dieser Iteration: `url(//cdn…); color: #ff0000;` in einer Zeile → Regel 1 schweigt; ohne die URL feuert sie. In einem `<style>`-Block ist `//` kein Kommentar. Von mir mit Gegenprobe belegt.
3. **Byte-Gleichheit bleibt tautologisch** — der Abdruck stammt aus einer reinen Funktion über zwei Werte, die vorher schon behauptet wurden. Die Korrektur aus Iteration 2 war dem Buchstaben nach erfüllt, der Sache nach nicht. Ich hatte sie als behoben gemeldet; das war falsch.
4. **`set-cookie` und `content-type` der 403** gegen ein selbstgebautes Objekt geprüft — unfalsifizierbar.
5. **`handleError` und der `init`-Hook** von keiner Behauptung erreicht. Die Konstanten in `handleError` zu tauschen stellt die Regression aus Iteration 2 wieder her, `lint` bleibt 0; einen `init`-Aufruf in ein schluckendes `catch` zu wickeln lässt den Server ohne `ORIGIN` starten.
6. **`drizzle.config.ts`** wird von nichts ausgeführt, `db:check` umgeht es. Ein erfundener Vorgabewert für `DATABASE_PATH` bliebe grün — verboten im eingefrorenen Block.
7. **„Zweites Gerät" prüft eine Zeichenkette zweimal** — sekundengenaue `iat`/`exp` ergeben ein byte-identisches JWT. Ebenfalls ein KEEP-Punkt, den ich fälschlich als belegt gemeldet hatte.
8. **Regel 1 auf `.html`** kennt Systemfarben nicht — die eine Datei, für die die Regel erweitert wurde, ist ausschliesslich in Systemfarben gestaltet.

**Ursache, benannt:** `smoke` stellt SvelteKit nach — `resolve`-Stub, Cookie-Attrappe, eigene `fehlerseite`. Jede nachgestellte Grenze erzeugt Behauptungen, die sich selbst bestätigen. Ich habe dem User empfohlen, das Skript stattdessen gegen einen echten Server laufen zu lassen; er hat entschieden, die Lücken einzeln zu flicken und die Bauform zu behalten. Das ist umgesetzt, und die Empfehlung bleibt für eine spätere Story festgehalten.

**Vermiedener Bekannt-Schlecht-Zustand:** Ein Prüfskript mit 81 Behauptungen, von denen sieben unabhängig vom geprüften Verhalten immer grün sind — gefährlicher als ein Skript mit 20 ehrlichen, weil die Zahl Sicherheit suggeriert.

**KEEP zusätzlich zu Iteration 1 und 2 — von mir am laufenden Baum belegt:**
- Die vier Mutationen, die rot werden: `is_active` in Route **und** Wächter, `httpOnly`, Memoisierung. Die Fehlermeldung bei der Memoisierung nennt ausdrücklich „lebende Sitzung: derselbe Keks wird nach dem Widerruf abgewiesen — durchgelassen mit 200".
- `create-admin -- Anna Meier` speichert „Anna Meier"; ein zweiter Lauf bricht mit Verweis auf Story 1.3 ab; `ORIGIN=https://garten.example.ch/app?x=1` wird mit benannter Meldung abgewiesen.
- `/gibtsnicht` mit gültiger Sitzung: Status 404, Satz „Diese Seite gibt es nicht.", Rahmen sichtbar.
- `env -u DATABASE_PATH -u SESSION_SECRET -u ORIGIN npm run build` → Exit 0.
- Der `RangeError`-Fund des Umsetzungsagenten: `new Response(…, {status: 0})` in der Fehler-Platzhalterlogik brach den Mutationslauf ab, **bevor** gezählt wurde — rot aus dem falschen Grund. Der Platzhalter muss einen gültigen Status tragen.

## Design Notes

**Ein Statuscode, ein Text.** Kein Cookie, ein manipuliertes Cookie, ein unbekanntes und ein widerrufenes Token führen alle auf 403 mit demselben Satz. Das ist nicht Bequemlichkeit, sondern die Anti-Aufzählungs-Regel: jede Verzweigung im Text oder im Status wäre ein Kanal, an dem sich ablesen liesse, welcher Fall vorliegt. Darum `error(403)` aus dem Wächter statt einer Weiterleitung auf eine eigene Route — es gibt keine zweite Oberfläche, die man vergleichen könnte.

**Der Preis dafür ist bezahlt und benannt:** dieser Wurf verlässt SvelteKit über den Fatal-Pfad, deshalb trägt die Seite keinen Rahmen, keine `set-cookie`- und keine `Referrer-Policy`-Kopfzeile. Alle drei sind gemessen, alle drei stehen so in der Matrix, und alle drei sind verkraftbar — die Navigationsleiste wäre für jemanden ohne Zugang ohnehin ein Angebot ins Leere, ein liegengebliebenes Cookie öffnet nichts, weil `is_active` bei jedem Aufruf frisch aus der Datenbank kommt, und ein fehlender Referrer auf genau der einen tokentragenden Anfrage, die mit einer 403 endet, trägt kein Token weiter — das Token steht nur im Pfad einer *erfolgreichen* Anfrage, und die läuft durch `resolve()` und bekommt den Header. Was **nicht** verkraftbar wäre: dass diese Eigenschaft nur heute gilt. Darum prüft `scripts/smoke-zugang.ts` sie ausgeführt, nicht per Augenschein — die `Referrer-Policy`-Lücke auf dem Fatal-Pfad fehlt in dieser Prüfung noch (vom User am 2026-08-27 als dritte akzeptierte Ausnahme entschieden, code-review von Gruppe A) und ist über `curl` gegen einen `/i/`-403 nachzuholen, nicht nur gegen `/`.

**Warum bei jedem Aufruf in die Datenbank.** Ein signiertes Cookie ist ein Versprechen aus der Vergangenheit. Story 1.3 verlangt, dass Widerrufen sofort wirkt; ein Jahr Cookie-Laufzeit und `is_active` nur beim Einlösen zu prüfen hiesse, ein ausgetretenes Mitglied behält bis zu ein Jahr Zugang. Die Prüfung kostet eine indizierte SQLite-Abfrage pro Aufruf, synchron, bei zwanzig Personen unmessbar.

```ts
// src/lib/server/token.ts — bewusst frei von SvelteKit-Importen,
// damit dieselbe Datei aus der Route und aus dem CLI-Skript ladbar ist.
export function tokenErzeugen(): string {
	return randomBytes(32).toString('base64url'); // 43 Zeichen
}
export function tokenHashen(token: string): string {
	return createHash('sha256').update(token).digest('hex'); // 64 Zeichen
}
```

## Verification

**Commands:**
- `env -u DATABASE_PATH -u SESSION_SECRET -u ORIGIN npm run build` -- expected: Exit 0; der Bau braucht keine Pflichtvariable
- `npm run lint` -- expected: Exit 0; ruft `gate`, `gate:selftest`, `db:check` und `smoke`
- `npm run check` -- expected: Exit 0 mit `--fail-on-warnings`, `scripts/` und `drizzle.config.ts` eingeschlossen
- `npm run smoke` -- expected: Exit 0, jede Zusage der Matrix ausgeführt belegt
- `npm run gate:selftest` -- expected: Exit 0, je Regel und je verbotener Importform ein Nachweis
- `SESSION_SECRET=$(printf 'a%.0s' {1..32}) npm run dev` -- expected: benannte Meldung, kein Stacktrace, Exit ungleich 0
- `curl -si localhost:5173/i/<token>/` -- expected: `303` — der Schrägstrich am Ende sperrt niemanden aus
- `curl -sI localhost:5173/` -- expected: `Referrer-Policy: no-referrer`
- `find build -name '*.sql'` -- expected: leer

**Manual checks (if no CLI):**
- Die 403-Seite bei 375px in Hell und Dunkel: ein `<h1>`, der vorgeschriebene Satz, **kein** Rahmen, kein Rot, lesbarer Kontrast auch für die Statuszeile
- Ein unbekannter Pfad **mit** gültiger Sitzung: dort greift `+error.svelte`, und der Rahmen ist sichtbar
- Denselben Link auf einem zweiten Gerät öffnen: beide bleiben angemeldet

## Suggested Review Order

**Der Zugangsweg — hier zuerst hinsehen**

- Der Wächter: jeder Aufruf liest Mitglied und `is_active` frisch aus der Datenbank, nie nur das Cookie.
  [`hooks.server.ts:80`](../../src/hooks.server.ts#L80)

- Der einzige Pfad ohne Sitzung, mit Toleranz für den Schrägstrich am Ende.
  [`hooks.server.ts:24`](../../src/hooks.server.ts#L24)

- Die einzige Stelle, die ein Cookie ausstellt; danach ist die `member_id` die alleinige Identitätsquelle.
  [`+server.ts:36`](../../src/routes/i/[token]/+server.ts#L36)

- Ein Satz aus einer Konstante, zwei Wurfstellen — die Anti-Aufzählungs-Regel hängt daran.
  [`texte.ts`](../../src/lib/texte.ts)

**Fail-Fast beim Start, nicht beim Modulladen**

- Die drei Prüfungen in einer aufrufbaren Funktion, damit der Hook prüfbar ist.
  [`hooks.server.ts:37`](../../src/hooks.server.ts#L37)

- Warum `init` und nicht Modulladen: der Analyseschritt des Baus importiert jedes Servermodul.
  [`hooks.server.ts:54`](../../src/hooks.server.ts#L54)

- `ORIGIN` muss eine reine Herkunft sein — Pfad, Abfrageteil und Fragment werden abgewiesen.
  [`herkunft.ts:56`](../../src/lib/server/herkunft.ts#L56)

**Die Datenschicht — synchron und ohne Nebenwirkung beim Import**

- Verbindung, Pragmas, `busy_timeout` und Migration in einer benannten Funktion.
  [`db/index.ts:33`](../../src/lib/server/db/index.ts#L33)

- Nur der Hash liegt in der Tabelle, mit `unique` — zwei Mitglieder mit einem Token wären zwei Identitäten an einem Link.
  [`schema.ts:25`](../../src/lib/server/db/schema.ts#L25)

- 32 Byte Zufall, SHA-256; frei von SvelteKit-Importen, damit das CLI-Skript die Datei laden kann.
  [`token.ts:13`](../../src/lib/server/token.ts#L13)

- Cookie-Optionen an einer Stelle: `httpOnly`, `sameSite`, `path`, ein Jahr, `secure`.
  [`auth.ts:31`](../../src/lib/server/auth.ts#L31)

- Jeder Fehlschlag ergibt `null`, nie einen Wurf nach aussen.
  [`auth.ts:97`](../../src/lib/server/auth.ts#L97)

**Die zwei Fehlerhüllen — die Grenze ist gemessen, nicht vermutet**

- Die Rückfallhülle für alles aus `handle`: die 403 des Wächters trägt keinen Rahmen.
  [`error.html:69`](../../src/error.html#L69)

- Greift nur innerhalb des Routings; Auswahl über die Meldung, nicht über den nackten Status.
  [`+error.svelte:24`](../../src/routes/+error.svelte#L24)

- Ein unbekannter Pfad bekommt seinen eigenen Satz, und kein Token erreicht eine Protokollzeile.
  [`hooks.server.ts:152`](../../src/hooks.server.ts#L152)

**Die Tore — der eigentliche Ertrag dieser Story**

- Warum die Attrappe aufzeichnet statt zu verwerfen: der Abdruck ist nicht mehr eine reine Funktion zweier Werte.
  [`smoke-zugang.ts:314`](../../scripts/smoke-zugang.ts#L314)

- Der Abdruck einer Abweisung: Status, alle Kopfzeilen, Rumpfbytes und Nebenwirkungen.
  [`smoke-zugang.ts:438`](../../scripts/smoke-zugang.ts#L438)

- Gebundene Eigenschaften statt Prototyp-Methoden — sonst bringt eine destrukturierende Route das Skript zum Absturz.
  [`smoke-zugang.ts:219`](../../scripts/smoke-zugang.ts#L219)

- Die Saat zählt nicht als Setzung, damit die Schwelle der gleitenden Erneuerung bedeutet, was sie liest.
  [`smoke-zugang.ts:229`](../../scripts/smoke-zugang.ts#L229)

- Jeder unerwartete Wurf wird eine benannte Verletzung, nie ein Stacktrace.
  [`smoke-zugang.ts:35`](../../scripts/smoke-zugang.ts#L35)

- Regel 9: kein Datenzugriff unter `src/routes/`, vier verbotene Formen plus Gegenprobe.
  [`gate.mjs:629`](../../scripts/gate.mjs#L629)

- Regel 1 kennt jetzt Systemfarben — die eine Datei, für die sie erweitert wurde, benutzt nur solche.
  [`gate.mjs:22`](../../scripts/gate.mjs#L22)

- Warum die Probenzahlen exakt sind: „mindestens einer" liess in Iteration 1 die halbe Regel wegfallen.
  [`gate.mjs:1030`](../../scripts/gate.mjs#L1030)

- Der Selbsttest des Drift-Schutzes, als Unterprozess, damit der Exitcode beobachtet wird.
  [`db-check.ts:376`](../../scripts/db-check.ts#L376)

**Peripherie**

- Name aus allen Argumenten, Prüfungen vor dem Laden der Datenschicht.
  [`create-admin.ts:38`](../../scripts/create-admin.ts#L38)

- `locals.mitglied` wird ohne die Hash-Spalte projiziert, damit ein künftiges `load` sie nicht ausliefert.
  [`hooks.server.ts:104`](../../src/hooks.server.ts#L104)
