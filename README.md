# Gemeinschaftsgarten

Aufgabenliste für einen Gemeinschaftsgarten: rund zwanzig Gärtner\*innen sehen auf
dem Handy, was offen ist, und haken mit einem Griff ab. Serverseitig gerenderter
SvelteKit-Monolith, eine SQLite-Datei, nur online.

Dieser Stand ist Story 1.2: Einladungslink einlösen und angemeldet bleiben. Es
gibt Titelleiste, Navigationsleiste, den leeren Zustand auf `/`, das
PWA-Manifest, die SQLite-Datenschicht mit `members` und den einzigen Zugangsweg:
`GET /i/<token>` löst die Einladung ein, ein Wächter lässt ohne gültige Sitzung
niemanden weiter. Noch keine Aufgaben und keine Verwaltungsoberfläche.

Das Projekt ist an npm gebunden: `npm run db:generate` ruft
`node_modules/drizzle-kit/bin.cjs` über einen festen Pfad, und der setzt npms
flache Ablage (Hoisting) voraus. Mit pnpm oder Yarn PnP liegt die Datei
woanders.

## Voraussetzungen

- Node 24 oder neuer (`.nvmrc`), npm 11 oder neuer. `engine-strict=true` lässt
  `npm install` mit einer klaren Meldung abbrechen, wenn die Version nicht passt.
- `save-exact=true`: jede Abhängigkeit wird ohne Caret gepinnt.

## Start

`cp .env.example .env` allein genügt **nicht**: die Vorlage lässt die drei
Pflichtwerte absichtlich leer, und der Start bricht dann per Entwurf ab. Dieses
Tripel ist für die lokale Entwicklung gedacht und kopierbar:

```sh
npm install                     # installiert exakt die gepinnten Versionen
mkdir -p data                   # SQLite legt das Verzeichnis nicht selbst an
cat > .env <<ENV
DATABASE_PATH=./data/dev.sqlite
SESSION_SECRET=$(openssl rand -base64 32)
ORIGIN=http://localhost:5173
ENV
npm run dev                     # Entwicklungsserver auf http://localhost:5173
```

Das `<<ENV` steht bewusst **ohne** Anführungszeichen: nur so ersetzt die Shell
`$(openssl …)` und in `.env` landet ein echtes Geheimnis. Wer den Wert lieber
sieht, führt `openssl rand -base64 32` einzeln aus und setzt ihn von Hand ein.
Ein Wert unter 32 Zeichen oder aus weniger als acht verschiedenen Zeichen wird
beim Start abgewiesen.

### Vom leeren System zum ersten Link

Ohne Mitglied kommt niemand herein — auch nicht der Mensch, der die Anwendung
gerade gestartet hat. Es gibt bewusst kein Registrierungsformular. Der einzige
Weg zum ersten Mitglied ist dieses Skript:

```sh
npm run create-admin -- Anna
```

Es startet die Datenschicht, lässt die Migrationen laufen (auf einer leeren
Datei legt es Tabelle und Migrationskette selbst an), erzeugt ein Token, speichert
dessen SHA-256-Hash und gibt den Klartext-Link **genau einmal** aus:

```
http://localhost:5173/i/NXpe6MFBD0LjD4ftXGppqAJL2vt-aVibzj_b_J_5Hrg
```

Diese Zeile ist die einzige Stelle im ganzen System, an der ein Token im
Klartext erscheint. In der Datenbank steht nur der Hash; ein verlorener Link
lässt sich nicht wiederherstellen.

Und auch nicht einfach neu erzeugen: `create-admin` legt **nur das erste**
Mitglied an und bricht ab, sobald es schon eines gibt — sonst entstünde
unbemerkt ein zweiter Admin mit einem zweiten lebenden Link. Ist der erste Link
weg, bevor Story 1.3 die Verwaltungsoberfläche bringt, führt der Weg über die
Datenbank: die Zeile in `members` löschen und `create-admin` erneut laufen
lassen.

Der Link wird auf dem Handy einmal angetippt: der Server stellt ein signiertes
Cookie aus und leitet mit 303 auf `/`. Danach liegt zwischen Öffnen und Liste
kein weiterer Schritt. Dasselbe Token lässt sich beliebig oft einlösen — ein
zweites Gerät braucht keinen neuen Link, und die erste Sitzung bleibt gültig.

Produktionsbau und Produktionsstart:

```sh
npm run build        # baut nach build/ über adapter-node
npm start            # startet den Bau, also node build/index.js — so läuft es auf dem Server
```

`npm run build` braucht **keine** Umgebungsvariable: die Prüfungen sitzen im
`init`-Hook, und den ruft SvelteKits Analyseschritt nicht. Ein frisch geklontes
Repository ohne `.env` baut durch.

**`drizzle/` muss beim Produktionsstart neben `build/` liegen.** Der Ordner
landet nicht im Bau — `build/` enthält keine einzige `.sql`-Datei —, und
`migrationsFolder` ist arbeitsverzeichnisrelativ. Fehlt er, endet der Start mit
einer benannten Meldung statt mit einer halb migrierten Datenbank. Für Story 1.6
heisst das: das Verzeichnis gehört ins Image kopiert.

`npm run preview` ist etwas anderes: das ist Vites eigene Vorschau des Baus für
einen schnellen Blick von Hand, nicht der Produktionsstart.

> **Anmelden geht in `preview` und `start` über nacktes HTTP nicht.** Das
> Sitzungs-Cookie trägt `Secure` überall ausser in der Entwicklung
> (`NODE_ENV=development`, was `vite dev` setzt). Über `http://localhost:4173`
> beziehungsweise `http://localhost:3000` verwirft der Browser ein
> `Secure`-Cookie — das Einlösen antwortet mit 303 und `set-cookie`, aber das
> Cookie kommt nie zurück, und `/` weist danach mit 403 ab. Das ist kein Fehler,
> sondern der Grund für den Schalter: im Betrieb steht nginx mit TLS davor.
> Wer die gebaute Anwendung von Hand durchklicken will, nimmt `npm run dev` oder
> stellt einen TLS-Endpunkt davor. Ein `Secure`-Cookie über HTTP zuzulassen wäre
> der falsche Ausweg: dann liegt die Sitzung im Betrieb einmal im Klartext auf
> der Leitung, und ein einziger Fehlgriff in der Proxy-Konfiguration genügt.

## Umgebungsvariablen

Alle Werte stehen in `.env` (lokal) beziehungsweise in der Umgebung des
Containers. `.env.example` ist die Vorlage; die Werte bleiben dort leer, der
Beispielwert steht jeweils im Kommentar darüber.

Drei Variablen sind Pflicht und haben **keinen** Vorgabewert. Fehlt eine davon,
gibt der Server beim Start eine benannte deutsche Meldung aus und endet — kein
Stacktrace, kein Fallback-Pfad, kein erfundenes Geheimnis. Geprüft wird im
`init`-Hook, also beim Start und nicht beim Bauen.

| Variable         | Bedeutung                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_PATH`  | **Pflicht.** Pfad zur SQLite-Datei. Lokal etwa `./data/dev.sqlite`, im Container `/data/db.sqlite`. Das Verzeichnis muss existieren.                                                                                                                                                                                                                    |
| `SESSION_SECRET` | **Pflicht.** Geheimnis für die Signatur des Sitzungs-Cookies (`openssl rand -base64 32`). Mindestens 32 Zeichen und mindestens acht verschiedene — `aaaa…` besteht die Prüfung nicht.                                                                                                                                                                   |
| `ORIGIN`         | **Pflicht**, für den Server und für `create-admin`. Reine Herkunft als absolute `http(s)`-Adresse — Schema, Host, höchstens ein Port, etwa `https://garten.example.ch`. Ein Pfad oder Abfrageteil wird abgewiesen, weil der Einladungslink sonst unklickbar wäre. Ohne `ORIGIN` weist `adapter-node` jeden POST einer form action als CSRF-Verstoss ab. |
| `PORT`           | Optional — die einzige Variable mit Vorgabewert: ohne sie nimmt `adapter-node` `3000`. Der Vite-Dev-Server nutzt unabhängig davon `5173`.                                                                                                                                                                                                               |
| `NODE_ENV`       | Optional, aber wirksam: steuert das `Secure`-Flag des Sitzungs-Cookies und damit das einzige Zugangsmittel. Nur bei `development` fehlt `Secure`; `vite dev` setzt den Wert selbst. Siehe die Warnung oben.                                                                                                                                             |

Ein Wert aus der Aufrufzeile gewinnt gegen `.env`. Damit lässt sich eine
Fehlkonfiguration von Hand prüfen:
`SESSION_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa npm run dev`.

**Wer `.env` liest und wer nicht.** `npm run dev` liest sie über
`vite.config.ts`; `npm run create-admin` und `npm run db:generate` über Nodes
`--env-file-if-exists`. **`npm start` liest `.env` nicht** — der
Produktionsstart erwartet die Werte in der Umgebung. Lokal heisst das
`DATABASE_PATH=… SESSION_SECRET=… ORIGIN=… npm start`, sonst bricht der Start
mit der benannten Meldung ab.

## Skripte

| Skript                      | Zweck                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`               | Entwicklungsserver mit Hot Reload.                                                                                   |
| `npm run build`             | Produktionsbau nach `build/` über `adapter-node`.                                                                    |
| `npm run preview`           | Vites Vorschau des vorhandenen Baus — zum Anschauen, nicht zum Betreiben.                                            |
| `npm start`                 | Produktionsstart: `node build/index.js`.                                                                             |
| `npm run check`             | `svelte-check` mit `--fail-on-warnings`, dann `tsc -p tsconfig.scripts.json` für `scripts/` und `drizzle.config.ts`. |
| `npm run gate`              | Prüft die neun Regeln des Gestaltungsrahmens und der Schichtgrenze (siehe unten).                                    |
| `npm run gate:selftest`     | Richtet das Tor auf `scripts/gate-fixtures/` und beweist, dass jede der neun Regeln beisst.                          |
| `npm run db:generate`       | Erzeugt die nächste Migration aus `schema.ts` nach `drizzle/`. Braucht `DATABASE_PATH`.                              |
| `npm run db:check`          | Führt `drizzle.config.ts` aus und vergleicht `schema.ts` mit `drizzle/`.                                             |
| `npm run db:check:selftest` | Richtet `db:check` auf `scripts/db-check-fixtures/` und beweist, dass es beisst.                                     |
| `npm run create-admin`      | Legt das erste Admin-Mitglied an und gibt seinen Einladungslink genau einmal aus.                                    |
| `npm run smoke`             | Führt die Zusagen der Zugangsschicht aus und prüft sie (siehe unten).                                                |
| `npm run lint`              | `prettier --check`, `eslint`, `gate`, `gate:selftest`, `db:check`, `db:check:selftest`, `smoke`.                     |
| `npm run format`            | Schreibt die Formatierung mit Prettier.                                                                              |

Das Qualitätstor vor jeder Abgabe:

```sh
npm run build && npm run lint && npm run check
```

Dazu kommt der Blick von Hand auf `/` bei 375px Breite, in Hell und in Dunkel.
Es gibt bewusst kein Testframework — deshalb muss das Tor sich selbst prüfen
(`npm run gate:selftest`), und deshalb führt `npm run smoke` die Zusagen der
Zugangsschicht aus statt sie zu behaupten.

### Zwei Typprüf-Programme

`.svelte-kit/tsconfig.json` deckt nur `src/**`. `scripts/create-admin.ts` und
`drizzle.config.ts` lägen damit aussen, und ein umbenanntes Feld in
`queries/members.ts` fiele nicht auf — der erste Admin entstünde still **ohne**
Adminrechte, weil ein unbekanntes Feld auf den SQL-Vorgabewert `false`
zurückfällt. Darum gibt es `tsconfig.scripts.json`, und `npm run check` ruft
beide.

Importe unter `src/lib/server/`, in `src/hooks.server.ts` und in
`src/routes/i/[token]/+server.ts` tragen die Endung `.ts` und stehen relativ,
nicht über `$lib`: `scripts/create-admin.ts` und `scripts/smoke-zugang.ts` laden
dieselben Dateien mit nacktem Node, und Node löst weder `$lib` noch eine
`.js`-Endung auf eine `.ts`-Datei auf. Dafür steht
`allowImportingTsExtensions: true` in beiden Programmen.

## Gestaltungsrahmen

Jeder Farb-, Grössen-, Radius- und Abstandswert steht als CSS Custom Property im
`:root`-Block in `src/app.html`, einmal für Hell und einmal für Dunkel.
Komponenten lesen jeden Wert über eine Custom Property und nie mit Fallback.
Die Schriften Figtree und Inter kommen aus `@fontsource-variable/*` und werden
in `src/lib/styles/fonts.css` eingebunden — zur Laufzeit geht keine Anfrage an
einen fremden Host.

Die Werte kommen aus
`_bmad-output/planning-artifacts/ux-designs/ux-Gartenplaner-2026-08-26/DESIGN.md`.
Bei Widerspruch gewinnt diese Datei.

### Was `npm run gate` prüft

`scripts/gate.mjs` liest jede Datei als Ganzes, nie zeilenweise, und blendet
CSS-Kommentare vorher aus. Neun Regeln:

1. In `.svelte` und `.css` unter `src/` kein Farbliteral — weder Hex noch
   `rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`, `color(` noch ein CSS-Farbname —
   und kein rohes `px`/`rem`-Literal ausser `0`. In `.html` unter `src/` gilt
   der Farbteil der Regel: `src/error.html` trägt Gestaltungswerte, die vorher
   keine Regel gelesen hat, und ihre Masse müssen dort als Zahl stehen, weil die
   Seite keinen Zugriff auf den Token-Block hat. **Systemfarben** (`Canvas`,
   `CanvasText`, `GrayText` …) zählen mit zur Farbsprache: in einer Komponente
   sind sie immer falsch, in `.html` ist nur die Auswahl `Canvas`/`CanvasText`
   zugelassen. `src/error.html` ist ausschliesslich in Systemfarben gestaltet —
   ohne diese Erweiterung wurde die eine Datei, für die die Regel ausgedehnt
   wurde, auf eine Wertform geprüft, die sie nicht benutzt. Damit ist auch das
   Verbot von `GrayText` eine Regel und keine Prüfung von Hand mehr.
   Ausgenommen ist allein der Token-Block in `src/app.html`; die Bedingung einer
   Medienabfrage ist ausgenommen, weil sie keine Custom Property lesen kann.
2. Kein `var()` mit Fallback-Wert. Der Fallback verdeckt genau Regel 3.
3. Jedes in `src/` benutzte `var(--x)` ist im `:root`-Block von `src/app.html`
   deklariert. Der Block wird per Klammertiefe geschnitten: eine Erwähnung in
   einem Kommentar oder eine Deklaration in einem anderen Selektor zählt nicht.
4. Beide Richtungen: jedes Farb-Token aus `:root` hat einen Wert im
   Dunkel-Block, und kein Token existiert nur im Dunkel-Block. Ein fehlender,
   leerer, doppelter oder unbalancierter Dunkel-Block ist selbst eine
   Verletzung.
5. Die `theme-color`-Metas und `theme_color`/`background_color` in
   `static/manifest.webmanifest` stimmen mit `--accent` beziehungsweise
   `--surface-base` überein, Schreibweise unerheblich.
6. Jeder Icon- und Manifest-Pfad aus `src/app.html` und aus dem Manifest zeigt
   auf eine Datei, die unter `static/` existiert.
7. Für jede `.svelte`-Datei liefert `eslint --print-config` mindestens so viele
   `svelte/*`- und `@typescript-eslint/*`-Regeln, wie die Plugins in ihren
   `recommended`-Arrays führen. Die Schwellen werden aus den Plugins abgeleitet,
   nicht im Skript festgeschrieben.
8. Tokens, die nirgends benutzt werden, sind ein Hinweis und kein Fehler — sie
   dürfen für spätere Stories reserviert sein.
9. Unter `src/routes/` kein Import von `drizzle-orm`, keiner von
   `better-sqlite3` und keiner des Datenbank-Handles — weder als
   `$lib/server/db` noch als `$lib/server/db/index` noch über einen relativen
   Pfad auf `db/index.ts`. Datenzugriff läuft ausschliesslich über die benannten
   Funktionen aus `src/lib/server/db/queries/*.ts`. Die drei Pfadformen werden
   auf dieselbe Modulform zurückgeführt, statt jede einzeln zu suchen — sonst
   fehlt die dritte. `better-sqlite3` gehört dazu, weil eine Route, die den
   Treiber selbst öffnet, eine zweite Verbindung ohne WAL, ohne `busy_timeout`
   und ohne Migrationsstand hätte. Ein reines `import type { … }` ist
   **ausgenommen**: TypeScript löscht die Anweisung beim Bauen, es entsteht kein
   Modulaufruf, und eine Route darf einen Zeilentyp benennen. Eine Gegenprobe
   hält diese Richtung fest.

Kommentare werden vor jeder Auswertung ausgeblendet: Block- und
HTML-Kommentare überall, **Zeilenkommentare nur dort, wo `//` wirklich ein
Kommentar sein kann** — also nie in `.css` und nie in einem `<style>`-Block.
Die Zeilenregel wird gebraucht, damit ein auskommentierter Import unter
`src/routes/` keinen falschen Verstoss gibt; sie über CSS zu ziehen war eine
Regression und ist gemessen: `url(//cdn.example.com/x.png); color: #ff0000;` in
einer Zeile liess Regel 1 schweigen, weil der Zeilenrest samt Farbliteral
geleert wurde. Die Probe `regel-1b-doppelschraegstrich-in-url` hält beide
Richtungen fest.

Jeder Lesefehler und jeder Fehlschlag eines Unterprozesses wird als benannte
Verletzung gemeldet, nie als Stacktrace.

`npm run gate:selftest` richtet das Tor auf `scripts/gate-fixtures/`. Dort liegt
je ein Kleinprojekt mit einer absichtlichen Verletzung pro Regel, darunter ein
von Prettier über drei Zeilen umbrochenes `var()` mit Fallback, ein `rgb()`, ein
Hex in einer `.css`, ein Hex in `src/error.html`, ein nur in einem Kommentar
erwähntes Token, ein nur im Hell-Block deklariertes Farb-Token, ein
unbalancierter Dunkel-Block, eine abweichende Manifest-Farbe, ein nicht
existierender Icon-Pfad, eine `eslint.config.js` mit dem No-op
`...configs.recommended.rules` — und **je eine Probe pro verbotener Importform**
der Regel 9.

Dazu kommen **Gegenproben**, die beweisen, dass die Regeln nicht zu weit
greifen: erlaubte Importe unter `src/routes/` (Abfragefunktion über Alias und
über relativen Pfad, dazu ein reines `import type`) müssen null Treffer geben;
`Canvas` und `CanvasText` in `src/error.html` dürfen nicht fallen; und ein
Farbliteral hinter einer `//`-Adresse in derselben Zeile muss weiterhin fallen.
Eine zu breite Regel bliebe ohne sie im Selbsttest grün und fiele erst als
rätselhafter Verstoss im echten Baum auf.

Jede Probe trägt ihre erwartete **Trefferzahl** samt Begründung, nicht bloss
„mindestens einer". Vorher hing Regel 9 an einem einzigen Treffer je Probe: die
Hälfte der Regel hätte still wegfallen können, während der Selbsttest weiter
„jede Regel beisst" meldete. Die Begründung zählt auf, welche Verletzungen die
Zahl zusammensetzen — eine nackte Zahl liesse sich beim nächsten roten Lauf
bequem hochsetzen, statt zu fragen, woher der zusätzliche Treffer kommt. Das Verzeichnis steht in `.prettierignore`, in den `ignores` von
`eslint.config.js` und im `exclude` von `tsconfig.scripts.json`: die Proben sind
absichtlich kaputt und dürfen nicht formatiert, gelintet oder typgeprüft werden.

### Was `npm run smoke` prüft

`scripts/smoke-zugang.ts` legt eine Datenbank in einem Wegwerfverzeichnis an,
ruft den echten `handle`-Hook und die echte Einlöseroute mit nacktem Node und
legt über hundert Behauptungen ab: `locals.mitglied` ist gesetzt und trägt die
Hash-Spalte **nicht**, das Cookie wird gleitend erneuert und trägt `httpOnly`,
`sameSite=lax`, `path=/`, ein Jahr `maxAge` und `secure`, ein zweites Gerät
funktioniert mit demselben Token, ein Widerruf wirkt auf eine **bereits lebende**
Sitzung, die Fälle ohne Zugang sind ununterscheidbar, der vorgeschriebene Satz
steht im gerenderten `<h1>`, `Referrer-Policy` steht auch auf der
tokentragenden Antwort, `handleError`, `startPruefen` und der `init`-Hook werden
**ausgeführt**, `sitzungsgeheimnisPruefen()` weist leer, 31 Zeichen und 32
gleiche Zeichen ab, `create-admin` legt `is_admin = 1` an, nimmt den Namen aus
allen Argumenten, weist einen zweiten Lauf und ein `ORIGIN` mit Pfad oder
Fragment ab, und in `members` steht nirgends ein Klartext-Token.

**Was die Vergleiche vergleichen.** Die Fehlerseiten kommen über SvelteKits
**eigene** aus `src/error.html` erzeugte Vorlage (`svelte-kit sync` läuft dazu am
Anfang). Der Abdruck eines Fehlerfalls besteht aus Status, allen Kopfzeilen, den
Rumpfbytes **und jeder Nebenwirkung, die an der Wurfstelle aufgezeichnet wurde**
— Cookie-Setzungen samt Optionsobjekt und jeder `setHeaders`-Aufruf. Ohne diesen
letzten Teil wäre der Abdruck eine reine Funktion über Status und Satz, beides
vorher schon einzeln behauptet, und der Vergleich nur ein Zweitsymptom. Mit ihm
fällt ein `setHeaders` an **einer** der beiden Wurfstellen auf.

Aus demselben Grund zählt die Attrappe ein **eingehendes** Cookie nicht als
Setzung: sonst wäre die Schwelle der gleitenden Erneuerung schon durch die
Vorbereitung erfüllt.

**Die Attrappe verhält sich wie das Original.** Alles, was Produktionscode aus
dem Ereignis oder aus `cookies` herausnehmen darf — `setHeaders`, `get`, `set`,
`delete` — liegt als gebundene eigene Eigenschaft auf der Instanz, nicht als
Prototyp-Methode. SvelteKit baut diese Objekte mit eigenen Funktionen, weshalb
`export async function GET({ params, cookies, setHeaders })` dort idiomatisch
ist; mit Prototyp-Methoden hätte eine so geschriebene Route das Prüfskript mit
einem `TypeError` zum Absturz gebracht, statt geprüft zu werden. Gemessen.

**Ein unerwarteter Wurf ist ein Befund, kein Absturz.** Ein Rahmen um die
Prüfliste übersetzt jeden Wurf in eine benannte Verletzung samt einer einzelnen
beschrifteten Fundstelle, räumt die Wegwerfverzeichnisse weg und endet mit 1 —
dasselbe Versprechen, das `scripts/gate.mjs` schon gibt. Die Schlusszählung
sagt dann, wie viele Behauptungen noch gelaufen sind.

Nicht abgedeckt ist `respond.js`, die Schicht, die den Wurf in die Vorlage
überführt, Kopfzeilen anhängt und Cookies ausliefert. Ihr Verhalten ist am
laufenden Server gemessen und in der Spezifikation festgehalten; im Skript steht
darüber ausdrücklich keine Behauptung. Die Empfehlung, das Skript stattdessen
gegen einen echten Server zu fahren, ist für eine spätere Story notiert.

Am Ende zählt das Skript, wie viele Behauptungen tatsächlich gelaufen sind, und
vergleicht mit einer festen Zahl. Eine Behauptung, die in einem `if`
stillschweigend ausfällt, fällt damit auf.

Der Grund für all das ist gemessen. Die Tabelle nennt nur Mutationen, die
**vorher grün** blieben — eine Mutation, die schon vorher rot war, beweist nichts
über die Prüfung, die dazukam:

| Mutation                                                        | War grün bis | Wird heute rot in                          |
| --------------------------------------------------------------- | ------------ | ------------------------------------------ |
| `\|\| !mitglied.isActive` aus der **Einlöseroute** entfernt     | Iteration 2  | widerrufenes gespeichertes Token           |
| `httpOnly: true` aus den Cookie-Optionen entfernt               | Iteration 2  | drei Cookie-Attribut-Behauptungen          |
| Wächter schlägt jedes Mitglied nur einmal pro Prozess nach      | Iteration 2  | Widerruf einer lebenden Sitzung            |
| `secure: false` in den Cookie-Optionen                          | Iteration 3  | drei Cookie-Attribut-Behauptungen          |
| die beiden Konstanten in `handleError` getauscht                | Iteration 3  | zwei `handleError`-Behauptungen            |
| ein Aufruf in `startPruefen` in ein schluckendes `catch`        | Iteration 3  | `startPruefen` und der `init`-Unterprozess |
| `setHeaders` an **einer** der beiden 403-Wurfstellen            | Iteration 3  | Kopfzeilen-Behauptung und beide Abdrücke   |
| `?? './data/dev.sqlite'` statt Fail-Fast in `drizzle.config.ts` | Iteration 3  | `db:check`, Prüfung Fail-Fast              |
| ein Befund in `db:check` zur Warnung gemacht                    | Iteration 3  | `db:check:selftest`, zwei von drei Proben  |
| Zeilenkommentare wieder in **jeder** Datei ausgeblendet         | Iteration 3  | `gate:selftest`, Probe `regel-1b`          |

`\|\| !mitglied.isActive` aus dem **Wächter** entfernt steht bewusst **nicht** in
der Tabelle: diese Mutation war schon vor Iteration 2 rot.

### Was `npm run db:check` prüft

Drei Prüfungen, und jede **führt etwas aus**, statt Text zu durchsuchen:

1. **Fail-Fast** — der Generator wird mit der echten `drizzle.config.ts` und
   ohne `DATABASE_PATH` aus einem Wegwerfverzeichnis gefahren. Erwartet wird ein
   Abbruch mit einer Meldung, die `DATABASE_PATH` benennt. Die frühere Fassung
   verglich die Datei mit zwei `includes`; ein erfundener Vorgabewert
   (`?? './data/dev.sqlite'`) liess beide passen und alles grün, obwohl der
   eingefrorene Block der Spezifikation genau das verbietet.
2. **Konfiguration** — die Datei wird geladen und ihr Ausfuhrwert gelesen:
   `dialect`, `schema` und `out` kommen von dort und nicht aus Konstanten im
   Prüfskript. `dialect` war vorher von gar keiner Prüfung gedeckt.
3. **Drift** — `drizzle/` wandert in ein Wegwerfverzeichnis, der echte Generator
   läuft darauf. Eine Spalte in `schema.ts` ohne `npm run db:generate` baute
   sonst grün durch und starb beim ersten Aufruf.

`npm run db:check:selftest` richtet das Skript auf `scripts/db-check-fixtures/`:
ein deckungsgleiches Projekt, das schweigen muss, ein Schema mit einer Spalte
ohne Migration, und eine Konfiguration mit erfundenem Vorgabewert statt
Fail-Fast. Jede Probe läuft als **Unterprozess**, damit der Exit-Code beobachtet
ist und nicht bloss die Befundliste — einen Befund zur Warnung zu machen liesse
sonst `lint` grün, während der Schutz aufhört zu greifen.

## Zugang und Fehlerseiten

Identität kommt ausschliesslich aus dem Einladungslink, nie aus einer Eingabe.
Es gibt kein Passwort, kein Login-Formular und keinen Registrierungsvorgang.

- **Ein Statuscode, ein Satz.** Kein Cookie, ein manipuliertes oder abgelaufenes
  Cookie, ein unbekanntes Token und ein deaktiviertes Mitglied führen alle auf
  403 mit `Dieser Link gilt nicht mehr. Melde dich in der Gartengruppe.` Status,
  Kopfzeilen und Rumpflänge sind in allen Fällen identisch — an keiner Stelle
  liesse sich ablesen, welcher Fall vorliegt.
- **Diese 403 erscheint ohne Rahmen.** Sie kommt aus `src/error.html`, nicht aus
  `src/routes/+error.svelte`: ein `error()` aus `handle` verlässt SvelteKit über
  `handle_fatal_error` → `static_error_page` und erreicht das Routing nie.
  Gemessen an 2.70.3. Das ist Absicht — eine Navigationsleiste mit vier Zielen,
  die alle auf dieselbe Abweisung führen, hilft niemandem.
- **Das Cookie bleibt auf dieser Antwort liegen** und wird nicht gelöscht:
  auf demselben Fatal-Pfad liefert SvelteKit keine `set-cookie`-Kopfzeile aus.
  Ohne Folge, weil Mitglied und `is_active` bei **jedem** Aufruf frisch aus der
  Datenbank kommen — ein liegengebliebenes Cookie öffnet nichts, und ein Widerruf
  wirkt beim nächsten Aufruf.
- `src/routes/+error.svelte` greift für Fehler **innerhalb** des Routings, etwa
  einen unbekannten Pfad bei gültiger Sitzung. Dort ist der Rahmen sichtbar. Die
  Auswahl des Satzes hängt dort an der **Meldung** aus dem Wurf und nicht am
  nackten Status: Story 1.3 bringt eigene 403-Fälle mit (Verwaltung ohne
  Adminrechte), und ein `status === 403 ? …` würde dort fälschlich „Dieser Link
  gilt nicht mehr" zeigen.
- Ein unbekannter Pfad bekommt seinen eigenen Satz — `Diese Seite gibt es nicht.`
  Ein 404 mit „Etwas ist schiefgelaufen" zu beantworten wäre eine Lüge, und der
  englische Vorgabetext `Not Found` keine Option: die Oberfläche ist durchgehend
  deutsch.
- Fünf Zustände, zwei Wurfstellen. Neben den vier Fällen der Matrix deckt der
  Wächter auch „Cookie gültig, Mitgliedszeile weg" ab — kein Weg der Anwendung
  löscht eine Zeile, ein Eingriff von Hand an der Datenbank erzeugt den Fall
  trotzdem. Die Aufstellung steht in `src/lib/texte.ts`.
- Jede aus dem Routing ausgelieferte Antwort trägt `Referrer-Policy: no-referrer`
  — die Identität steht im Pfad von `/i/<token>`. Die rahmenlose 403 entsteht
  aussen und trägt die Kopfzeile nicht; dafür steht in `src/error.html` ein
  `<meta name="referrer" content="no-referrer">`, und die Seite verweist auf
  nichts von draussen.

### Benannt akzeptierte Risiken

Ein Zugang, der allein an einem Link im Pfad hängt, hat Kanten. Sie sind
gesehen, gewogen und angenommen — nicht übersehen:

- **Das Klartext-Token steht im Pfad.** Damit landet es in jedem Protokoll, das
  Pfade mitschreibt. **Für Story 1.6 festhalten:** `/i/` gehört aus dem
  nginx-Zugriffsprotokoll herausgehalten, sonst liegt jedes Token in
  `access.log` — und dort liest es sich leichter als aus der Datenbank, in der
  nur der Hash steht. Dazu kommt die Ratenbegrenzung auf `/i/`; im
  Anwendungscode gibt es bewusst keine.
- **Verbindungsvorschau.** Wird der Link in einem Chat verschickt, holt der
  Messenger die Adresse oft selbst ab, um eine Vorschau zu bauen. Das Token ist
  damit auf dessen Servern bekannt. Verbraucht wird es nicht — es bleibt
  absichtlich mehrfach einlösbar, damit ein Gerätewechsel keinen neuen Link
  braucht —, und die Vorschau selbst kann mit dem Cookie nichts anfangen. Der
  Ausweg wäre ein Einmal-Token, und der kostet genau die Eigenschaft, die die
  Gemeinschaft braucht.
- **Login-CSRF.** `GET /i/<token>` stellt ein Cookie aus. Wer jemanden dazu
  bringt, seinen Link zu öffnen, meldet ihn als sich selbst an. In dieser
  Anwendung ist der Gewinn klein — es gibt keine Zahlung, keine fremden Daten,
  und die betroffene Person sieht sofort einen falschen Namen —, und der
  Gegenentwurf (ein Formular mit Token-Feld) wirft die Kernzusage weg: ein
  Antippen, kein Eingeben. Angenommen.
- **Kein Ablauf ohne Widerruf.** Das Cookie läuft ein Jahr, das Token gilt bis
  zum Widerruf. Dafür kommen Mitglied und `is_active` bei **jedem** Aufruf frisch
  aus der Datenbank: Widerrufen wirkt sofort, ohne auf einen Ablauf zu warten.

## Was noch nicht hier ist

- Mitglieder aufnehmen und Zugang beenden über die Oberfläche: **Story 1.3**. In
  diesem Stand entsteht ein Mitglied nur über `npm run create-admin`.
- Aufgaben sehen, abhaken und erfassen: Stories 1.4 und 1.5. `tasks` gibt es
  noch nicht.
- Docker Compose, nginx als TLS-Terminierung, certbot, Backup-Skript und
  Runbook: **Story 1.6**. In diesem Stand gibt es davon nichts.
- Es gibt bewusst keinen Service Worker: `static/manifest.webmanifest` und die
  Icons genügen für die Installation zum Home-Bildschirm, und ein Datencache
  würde Erledigtes als offen zeigen.
