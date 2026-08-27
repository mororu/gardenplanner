# Gemeinschaftsgarten

Aufgabenliste für einen Gemeinschaftsgarten: rund zwanzig Gärtner\*innen sehen auf
dem Handy, was offen ist, und haken mit einem Griff ab. Serverseitig gerenderter
SvelteKit-Monolith, eine SQLite-Datei, nur online.

Dieser Stand ist Story 1.5: eine Aufgabe vor Ort erfassen. Es gibt
Titelleiste, Navigationsleiste, das PWA-Manifest, die SQLite-Datenschicht mit
`members` und `tasks`, den einzigen Zugangsweg (`GET /i/<token>` löst die
Einladung ein, ein Wächter lässt ohne gültige Sitzung niemanden weiter), die
Verwaltung unter `/verwaltung` — und auf `/` die ganze Schleife: die offenen
Aufgaben, abgehakt mit einem Griff, und unter dem Pool der Knopf `+ Aufgabe`,
der auf `/aufgabe` führt.

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
Datei legt es die Tabellen und die Migrationskette selbst an), erzeugt ein Token, speichert
dessen SHA-256-Hash und gibt den Klartext-Link **genau einmal** aus:

```
http://localhost:5173/i/NXpe6MFBD0LjD4ftXGppqAJL2vt-aVibzj_b_J_5Hrg
```

In der Datenbank steht nur der Hash; ein verlorener Link lässt sich nicht
wiederherstellen.

Diese Zeile ist die einzige Stelle, an der ein Token **auf der Konsole**
erscheint — seit Story 1.3 nicht mehr die einzige im System. `/verwaltung` zeigt
beim Aufnehmen und beim Neuausstellen ebenfalls einen Klartext-Link, dort im
Rumpf **einer** POST-Antwort. Beides ist derselbe Handel: einmal sichtbar,
danach nur noch als Hash vorhanden.

Und auch nicht einfach neu erzeugen: `create-admin` legt **nur das erste**
Mitglied an und bricht ab, sobald es schon eines gibt — sonst entstünde
unbemerkt ein zweiter Admin mit einem zweiten lebenden Link.

**Der Alleinverwalter ist eine Sollbruchstelle, und zwar mit Ansage.** Es gibt
genau eine Adminperson und keinen Weg, eine zweite zu machen: `create-admin`
läuft nur auf einem leeren System, und `/verwaltung` nimmt ausschliesslich
Mitglieder ohne Adminrechte auf. Wer also den Admin-Link verliert und kein
angemeldetes Gerät mehr hat, kommt in die Verwaltung nicht zurück — es ist
niemand da, der ihm einen neuen ausstellen könnte. Der Ausweg führt dann über
die Datenbank: die Admin-Zeile in `members` löschen und `create-admin` erneut
laufen lassen. Die Sitzung überlebt einen verlorenen Link übrigens: das Cookie
hängt an der `member_id` und nicht am Token, und es läuft ein Jahr. Der Verlust
schlägt erst beim Gerätewechsel zu.

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
CSS-Kommentare vorher aus. Zwölf Regeln:

1. In `.svelte` und `.css` unter `src/` kein Farbliteral — weder Hex noch
   `rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`, `color(` noch ein CSS-Farbname —,
   kein rohes `px`/`rem`-Literal ausser `0` und **kein rohes `ms`/`s`-Literal
   ausser `0`** im Wert von `transition`, `animation` und deren
   `-duration`/`-delay`-Langformen. Der Zeitteil kam mit Story 1.4 dazu: die
   Anwendung hat genau **eine** Animation (140ms, der Übergang der
   Aufgabenzeile), und der Massteil prüfte nur `px` und `rem` — ein hartes
   `140ms` wäre durchgekommen und `--duration-quick` von seinem ersten Tag an
   umgehbar gewesen. In `.html` unter `src/` gilt
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
10. Jede `.css` unter `src/lib/styles/` wird von mindestens einer Datei unter
    `src/routes/` importiert. Ein Stilblatt, das niemand einbindet, ist für
    eslint, svelte-check und vite build vollständig unsichtbar: die Datei ist
    gültig, sie wird nur nie geladen. Belegt hat das die gelöschte Importzeile
    von `bedienelemente.css` — gate blieb grün, während alle 44px-Trefferfelder
    aus der Auslieferung fielen.
11. Jedes `action="?/name"` im Markup unter `src/routes/` hat einen
    gleichnamigen Eintrag in der `actions` der Nachbar-`+page.server.ts`. Ein
    verschriebener Name passiert `check`, `eslint` und `smoke` grün, und der
    Knopf tut am laufenden Server nichts. Die Form `action="/pfad?/name"` deutet
    die Regel bewusst nicht.
12. In keinem HTML-Kommentar unter `src/` steht eine SvelteKit-Marke wie
    `%sveltekit.head%`. Die Ersetzung fragt nicht, wo die Marke steht; der
    eingesetzte Kopfbereich bringt eigene Kommentarmarken mit, und deren Ende
    schliesst den umgebenden Kommentar vorzeitig. Gefunden hat das kein
    Werkzeug, sondern das Auge des Users.

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
`Canvas` und `CanvasText` in `src/error.html` dürfen nicht fallen; ein
Farbliteral hinter einer `//`-Adresse in derselben Zeile muss weiterhin fallen;
und im Zeitteil der Regel 1 dürfen `var(--duration-quick)`, eine Null mit
Einheit, eine Zahl **ohne** Einheit im Wert einer Bewegungs-Eigenschaft (die
Wiederholungszahl einer Animation), `transition-property` und `cubic-bezier`
nicht fallen.
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

Seit Story 1.3 fährt das Skript zusätzlich die Routenmodule von `/verwaltung`
und `/mehr` direkt, mit gesetztem `locals.mitglied` und mit **echten**
Formulardaten (`POST` mit `FormData`, damit `await request.formData()` in der
action wirklich etwas zu parsen hat). Belegt sind dort: ein Nicht-Admin bekommt
auf die `load` **und** auf jede der drei actions `303` auf `/` und ändert dabei
nichts; `aufnehmen` legt `is_admin = 0`/`is_active = 1` an und gibt den Klartext
genau einmal heraus, während in der Datenbank dessen Hash steht und der Klartext
in **keiner** Datenbankdatei vorkommt (die Suche geht über `smoke.sqlite` **und**
`-wal`, sonst fände sie auch den Hash nicht); ein Name aus Leerzeichen ergibt
`400`, legt kein Mitglied an und lässt kein Token nach draussen; `neuAusstellen`
ersetzt den Hash derselben Zeile, der alte Link wird danach mit `403`
abgewiesen und der neue mit `303` eingelöst; `widerrufen` setzt `is_active = 0`
und lässt Name und Hash stehen; Selbstwiderruf und Selbst-Neuausstellen ändern
nichts; und eine fehlende, nicht numerische, unbekannte oder schon beendete
`mitgliedId` ergibt in beiden actions denselben Satz, ohne die Tabelle
anzufassen. Zuletzt wird jeder Token-Hash aus `members` im Rückgabewert beider
`load`-Funktionen gesucht — gefunden wird keiner.

Seit Story 1.4 fährt es zusätzlich `src/routes/+page.server.ts` — `load` und
beide actions. Belegt sind dort: die `load` gibt genau die offenen Aufgaben,
**älteste zuerst** (die drei Vorbereitungszeilen werden ausdrücklich nicht in der
Reihenfolge ihres `created_at` eingefügt, sonst wäre eine Sortierung nach der Id
grün); in den Seitendaten steht weder ein `completed`-Feldname noch der
Zeitstempel eines Erledigten; `abhaken` gelingt auch für ein Mitglied **ohne**
Adminrechte, setzt `completed_by` auf dessen Id und `completed_at` auf jetzt, und
die Zeile fehlt danach in einer frischen `load`; ein **zweites** `abhaken` auf
dieselbe Zeile ergibt `400` und lässt den ersten Abhakenden unverändert — das ist
das Wettrennen zweier gleichzeitiger Abhaker, entschieden in der `where`-Klausel;
`wiederOeffnen` leert beide Spalten, auch für jemanden, der nicht abgehakt hat,
und die Zeile steht danach wieder an ihrem Platz nach `created_at`; und eine
fehlende, nicht numerische, unbekannte `aufgabeId` sowie der falsche
Erledigt-Zustand ergeben in **beiden** actions denselben Satz, ohne die Tabelle
anzufassen.

Zwei Behauptungen dort sind ausdrücklich **Textprüfungen** und kein ausgeführter
Nachweis: dass der `use:enhance`-Rückruf in `src/routes/+page.svelte`
`update({ reset: false, invalidateAll: false })` ruft, und dass die Seite kein
`<label>` trägt. Beide Zusagen hängen an genau einer Textstelle und wären sonst
still zu brechen — die Svelte-Schicht deckt in diesem Projekt keine ausgeführte
Prüfung. Beide laufen auf der Datei **ohne Kommentare**: die Komponente erklärt
an beiden Stellen wörtlich, was dort zu stehen hat, und auf dem Rohtext hätten
sich die Behauptungen an der eigenen Begründung erfüllt. Gemessen.

Seit Story 1.5 kommt `src/routes/aufgabe/+page.server.ts` dazu — die eine action
`ablegen`, gefahren mit einem Ereignis **ohne** `locals.mitglied`, weil sie keine
Identität liest. Belegt sind dort: ein Versand mit Leerraum vorn, hinten und
doppelt in der Mitte legt genau **eine** Zeile mit gefaltetem Text an, deren
`created_at` in Unix-Sekunden bei jetzt liegt und deren Erledigt-Spalten leer
sind, und leitet mit `303` auf `/?abgelegt`; die neue Aufgabe steht danach als
jüngste am Ende der `load` von `/`, die `abgelegt: true` **nur** mit dem
Parameter gibt und keinen Satz mitliefert; ein leeres Feld, reiner Leerraum,
reine Nullbreiten-Zeichen, Umbruch mit Tabulator, ein fehlendes Feld und ein
**Blob statt eines Strings** ergeben alle `400` mit `feld: 'text'`, demselben Satz
und unveränderter Zeilenzahl, während die Eingabe unverändert zurückkommt; genau
200 Codepoints gehen durch, 201 nicht, und 200 Buchstaben plus ein Emoji sind
201 — mit `.length` statt `[...text]` wäre diese Zeile grün geblieben; ein Text
**mit** einem Nullbreiten-Zeichen darin, der lesbar bleibt, geht als Gegenprobe
durch und steht gesäubert in der Tabelle.

Elf weitere **Textprüfungen** stehen dort, aus demselben Grund wie die zwei der
Startseite — die Svelte-Schicht deckt kein ausgeführtes Werkzeug, und diese
Zusagen hängen an genau einer Textstelle:

- **die Verdrahtung des Formulars** auf `/aufgabe`: `name="text"`,
  `value={eingabe}`, `aria-describedby` auf `text-fehler`, das `id="text-fehler"`
  am Satz und `use:enhance={versand}` am Formular. Benennt man das Feld um,
  endet **jeder** Versand mit `400` — und ohne diese Zeile bliebe die ganze
  Prüfliste grün, weil die Behauptungen ihr `FormData` selbst bauen.
- **die Never-Zusagen** derselben Seite: sichtbare `<label for="text">` mit Text,
  kein `placeholder`, kein Zurück-Knopf und kein Zurück-Link, kein `<textarea>`,
  genau ein Eingabefeld, genau ein `button-primary`.
- **der Fehlersatz ist eine immer vorhandene Live-Region** und nicht bedingt
  gerendert.
- **die Doppelsperre** ist vollständig: `imFlug`, `cancel()` und
  `disabled={imFlug}` am Knopf — die drei zusammen sind die Sperre, einzeln
  nicht.
- **das `maxlength` am Feld** wird gegen `TEXT_HOECHSTLAENGE` aus der Route
  gehalten. Die Zahl steht zweimal; ohne dieses Band bliebe das Attribut beim
  nächsten Ändern der Grenze stehen.
- **keine Identität** auf `/aufgabe` — weder in der Komponente noch in der
  `+page.server.ts` kommt `locals`, ein Mitglied oder eine Zuständigkeit vor.
- **der `+ Aufgabe`-Anker ist verortet**, nicht bloss gezählt: der `{#if}`-Block
  des Pools wird klammerbalanciert geschnitten, und darin darf kein
  `button-primary` stehen. Schöbe man den Anker in den `{:else}`-Zweig, zählte
  weiter genau einer und der leere Pool stünde wieder ohne Knopf da.
- **`/` trägt genau einen `button-primary`.** „Höchstens ein primärer Knopf pro
  Seite" war bis hierher eine Prüfung von Hand, die kein Werkzeug kennt — auch
  `gate` nicht.
- **die Meldungsregion trägt `tabindex="-1"` und `bind:this`** in einer
  Behauptung: ohne das erste ist `focus()` ein stiller Leerlauf.
- **`Abgelegt.` hängt an `form === null` und `data.abgelegt`**, und der
  `abgehakt`-Zweig steht dahinter — ein vorhandenes `form` gewinnt gegen den
  Parameter.
- **der fokussierende `$effect`** hängt an demselben Wahrheitswert, prüft das
  gebundene Element, **bevor** er das Einmal-Flag verbraucht, und holt den Fokus.

Die geprüften Ausschnitte werden vorher auf einfache Leerzeichen geglättet und
der `$effect` wird am Bezeichner `fokusGeholt` gesucht statt an seiner Position:
ein reiner Formatierungslauf von Prettier oder ein zweiter Effekt darf die
Prüfliste nicht rot machen. Der Preis jeder Textprüfung ist benannt: sie belegt,
dass die Stelle **dasteht**, nicht, dass sie **wirkt**.

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
| `invalidateAll: false` aus dem Rückruf auf `/` entfernt         | Story 1.4    | die Textprüfung an `+page.svelte`          |
| ein `<label>` um den Aufgabentext                               | Story 1.4    | die Textprüfung an `+page.svelte`          |
| `completed_at IS NULL` aus `aufgabeAbhaken` entfernt            | Story 1.4    | zweites `abhaken`, der erste Abhakende     |
| `completed_by` in die Projektion der offenen Aufgaben           | Story 1.4    | zwei Seitendaten-Behauptungen, `check`     |
| ein rohes `140ms` in einem Komponenten-`<style>`                | Story 1.4    | `gate`, Regel 1                            |
| die Längenprüfung aus `ablegen` entfernt                        | Story 1.5    | `smoke`, 201 Codepoints                    |
| `returning()` statt `returning(sichtbareSpalten)`               | Story 1.5    | `check`, die Annotation `NurSichtbar`      |
| `action="?/ablegen"` verschrieben                               | Story 1.5    | `gate`, Regel 11                           |
| `name="text"` am Feld in `name="aufgabentext"` umbenannt        | Story 1.5    | `smoke`, die Verdrahtung des Formulars     |
| `+ Aufgabe` in den `{:else}`-Zweig geschoben                    | Story 1.5    | `smoke`, die Verortung des Ankers          |
| `tabindex="-1"` an der Meldungsregion entfernt                  | Story 1.5    | `smoke`, tabindex und bind:this            |
| `maxlength` am Feld von der Konstante abgekoppelt               | Story 1.5    | `smoke`, das Band zur Längengrenze         |
| die `load` von `/` liest `locals`                               | Story 1.5    | `smoke`, das werfende Ereignis             |

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
  nackten Status: ein `status === 403 ? …` zeigte bei jeder künftigen 403 aus
  einer Route fälschlich „Dieser Link gilt nicht mehr", obwohl der Link tadellos
  gilt. `/verwaltung` ohne Adminrechte war der erwartete erste Fall dieser Art
  und ist es nicht geworden — dort wird weitergeleitet statt geworfen.
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

## Aufgaben sehen und abhaken

`/` ist die ganze Anwendung in einem Bild. Die Seite führt genau drei Blöcke in
dieser Reihenfolge — Diensthinweis, freie Einzelaufgaben, offener Pool. Die
ersten zwei kommen mit Epic 3 und rendern in diesem Stand nichts; die Reihenfolge
steht trotzdem schon, weil sie eine Entscheidung über die Aufmerksamkeit im
Garten ist und nicht eine Folge davon, in welcher Reihenfolge gebaut wurde.

Der dritte Block trägt unter der Marke `OFFEN` alle offenen Aufgaben, **älteste
zuerst**, vollständig und ohne Nachladen. Erledigte erscheinen nicht — auch nicht
durchgestrichen, auch nicht eingeklappt.

- **Ein Antippen erledigt.** Kein Formular, kein Statusfeld, kein Pflichtkommentar,
  kein Bestätigungsdialog, kein zweiter Knopf. Es ist das einzige
  Interaktionsmuster, das jede Person kennen muss.
- **Nur das Kästchen ist antippbar**, nicht die Zeile und nicht der Text. Sichtbar
  22px, Trefferfeld 44px über Innenabstand — ein Trefferfeld über die ganze Zeile
  würde im Beet, mit Handschuhen, versehentlich Aufgaben erledigen. Der
  Aufgabentext ist toter Text.
- **Das Kästchen ist ein echtes `<input type="checkbox">`** in einem Formular, kein
  `<div>` mit Klick-Handler. Seine Beschriftung entsteht über `aria-labelledby`
  aus dem sichtbaren Aufgabentext **und** einem verborgenen Verb: ein Screenreader
  liest `Beet 25 Nüsslisalat jäten, erledigen` mit der Rolle Kontrollkästchen.
  Bewusst **kein** `<label for>` — ein Label schaltet sein Bedienelement, und
  damit wäre der Text wieder antippbar.
- **Die Zeile bleibt an ihrem Platz stehen**, durchgestrichen und gedämpft,
  Kästchen gefüllt mit Haken. Sie verschwindet erst beim nächsten Laden — dann
  auch für alle anderen. So ist ein Fehlgriff sofort sichtbar. Der Preis dieser
  Entscheidung ist benannt: die Liste ist nach dem Antippen nicht mehr frisch, und
  das Abhaken ist die eine Mutation der Anwendung, die **kein** `invalidateAll()`
  auslöst.
- **Nochmaliges Antippen öffnet die Aufgabe wieder** und setzt `completed_by` und
  `completed_at` zurück auf leer.
- **Niemand sieht, wer abgehakt hat.** Nicht im Text, nicht als Titel-Attribut,
  nicht in einem `data-`Attribut und nicht in den Seitendaten. `completed_by` und
  `completed_at` werden trotzdem gesetzt. Das ist keine Zusage der Oberfläche,
  sondern eine Eigenschaft des Typs: `SichtbareAufgabe` in
  `src/lib/server/db/schema.ts` hat die zwei Spalten nicht, und jede Abfrage in
  `queries/tasks.ts` projiziert schon in der Datenbank ohne sie. Die Seite
  **kann** den Abhakenden nicht ausliefern, weil das Feld nicht existiert.
- **Aufgaben sind namenlos und haben keine Zuständigkeit im Voraus.** `tasks` trägt
  keine Spalte dafür, und jedes Mitglied darf jede Aufgabe abhaken. Namen an
  allem macht das Werkzeug zum Dienstplan und vertreibt die spontan Kommenden.
- **Ein Satz für vier Zustände.** Eine fehlende, eine nicht numerische, eine
  unbekannte `aufgabeId` und der falsche Erledigt-Zustand ergeben alle `400` mit
  demselben Satz. Der letzte Fall ist zugleich der Ausgang des Wettrennens: haken
  zwei Personen dieselbe Aufgabe im selben Moment ab, trifft das zweite `UPDATE`
  keine Zeile — die Vorbedingung `completed_at IS NULL` steht in der
  `where`-Klausel und nicht in der Route. Der erste Abhakende bleibt gespeichert,
  und der zweite erfährt nicht, welcher der Fälle vorlag.
- **Der Übergang in den durchgestrichenen Zustand dauert 140ms** und ist die
  einzige Animation der Anwendung. Er steckt in
  `@media (prefers-reduced-motion: no-preference)`: keine Bewegung ist der
  Standardfall, Bewegung die ausdrücklich eingeschaltete Ausnahme.
- **Unter dem Pool steht `+ Aufgabe`** — in **beiden** Zuständen, also auch
  unter `Nichts offen.`. Der Knopf ist ein `<a>` und kein `<button>`: er
  navigiert nur, er tut nichts. Er ist zugleich der einzige primäre Knopf dieser
  Seite; die Kästchen sind Kästchen.

## Eine Aufgabe erfassen

`/aufgabe` ist **ein Feld und ein Knopf**. Kein Fälligkeitsdatum, keine
Kategorie, kein Beet, keine Priorität, kein Zuständiger, kein zweites Feld: wer
im Beet steht und Blattläuse entdeckt, tippt einen Satz und ist fertig. Ein
einzeiliges `<input>` und kein `<textarea>` — eine Aufgabe ist ein Satz, kein
Absatz, und die Eingabetaste legt sie ab. Es gibt keinen Zurück-Knopf: eine
Formularseite schliesst mit ihrer Aktion, und die Systemgeste des Browsers
genügt.

- **Was geprüft wird, wird serverseitig geprüft**, in derselben Kette wie der
  Mitgliedsname: Nullbreiten-Zeichen entfernen, jede Folge von Leerraum zu einem
  Leerzeichen falten, trimmen, leer abweisen, Codepoints zählen. Gespeichert wird
  die **gefaltete** Fassung — aus `  Beet   25   jäten  ` wird `Beet 25 jäten`.
  Ein leeres Feld, reiner Leerraum, reine Nullbreiten-Zeichen, ein fehlendes Feld
  und ein Datei-Upload statt eines Textes fallen alle auf denselben Satz und
  legen **nichts** an. Das `maxlength` am Feld ist die Bequemlichkeit, die
  Prüfung in der action die Regel: ein POST braucht kein Feld.
- **Höchstens 200 Zeichen**, einschliessend gemeint und nach Codepoints gezählt
  (ein Emoji ist ein Zeichen, nicht zwei). `Tunnel 2 Blattläuse nachbehandeln`
  braucht 34; 200 lassen Raum für Ort und Zusatz und halten die Zeile in der
  Liste lesbar. Die Grenze steht in der Route und **nicht** als CHECK in der
  Datenbank: sie ist eine Auslegung von „eine Aufgabe ist ein Satz" und keine
  Eigenschaft der Daten — in einer Migration liesse sie sich nur noch mit einer
  Migration ändern.
- **Ein abgewiesener Versand sagt zweierlei auf einmal.** Die Feldkante wird
  breiter (`aria-invalid`), und darunter steht ein Satz, der über
  `aria-describedby` am Feld hängt: der Zustand hängt nicht allein an der Farbe.
  Die Kante ist ausdrücklich **nicht** rot — Rot ist in dieser Anwendung dem
  zerstörenden Knopf vorbehalten. Die Eingabe bleibt im Feld stehen.
- **Die Meldung reist als Query-Parameter.** Ein `redirect()` aus einer form
  action verwirft deren Rückgabewert; `ablegen` leitet darum mit `303` auf
  `/?abgelegt`, die `load` von `/` macht daraus einen **Wahrheitswert** (keinen
  Satz), und die Oberfläche setzt `Abgelegt.` — der Knopf trägt das Verb, die
  Meldung dasselbe Verb im Perfekt. Das ist das Flash-Muster dieser Anwendung:
  kein zweites Cookie neben dem Sitzungs-Cookie, kein Store, kein
  `+layout.server.ts`, und es funktioniert ohne JavaScript.
- **Die Live-Region auf `/` nimmt beim Ankommen einmalig den Fokus.** Eine
  Live-Region sagt nur _Änderungen_ an; nach dem Ablegen ist `/` frisch gemountet
  und `Abgelegt.` stünde von Anfang an stumm da. Genau einmal, genau in diesem
  Fall — und ausdrücklich **nicht** nach dem Abhaken, wo der Daumen auf dem
  Kästchen bleiben soll.
- **Ein Doppeltipp legt eine Zeile an, nicht zwei.** Dieselbe Sperre wie in den
  Stories 1.3 und 1.4: `disabled` am Knopf ist der sichtbare und der für die
  Tastatur wirksame Riegel, `cancel()` im `use:enhance`-Rückruf deckt das Fenster
  davor ab.
- **Niemandem zugeordnet.** Es gibt keine Spalte für einen vorab Zuständigen und
  keine für einen Erfassenden — auch nicht „von mir erfasst". Die action liest
  `locals` gar nicht.
- **`created_at` kommt aus dem Schema** (`$defaultFn`, Unix-Sekunden), nie aus der
  Einfügefunktion und nie aus der Route. `completed_by` und `completed_at`
  bleiben leer: eine neue Aufgabe ist offen.

## Mitglieder aufnehmen und Zugang beenden

Alles Seltene liegt unter `/mehr`. Für eine Adminperson steht dort der Eintrag
`Verwaltung`; für alle anderen fehlt er **ganz** — kein ausgegrauter Punkt, keine
Erklärung. Ein Direktaufruf von `/verwaltung` ohne Adminrechte endet mit
`303` auf `/`, nicht mit einer Fehlerseite: für jemanden ohne Adminrechte soll
die Verwaltung nicht existieren, nicht verboten sein. Eine Fehlerseite wäre die
Auskunft, dass es dort etwas gibt.

Die Schranke sitzt in **einer** Funktion (`src/lib/server/adminschranke.ts`) und
greift in der `load` **und** in jeder der drei form actions. Eine action ohne
Schranke wäre der Fehler, den die Oberfläche nicht sichtbar macht: für
Nicht-Admins fehlt der Knopf, ein POST braucht aber keinen.

- **Aufnehmen.** Ein Feld, ein Name, ein Knopf. Danach erscheint der
  Einladungslink **genau einmal** — im Klartext, in einem Feld zum Kopieren, mit
  dem Satz, dass er nur jetzt zu sehen ist. Er wird **von Hand** weitergegeben:
  die Anwendung verschickt nichts, keine E-Mail, keinen Messenger.
- **Der Server kann den Link nach der einen Antwort nicht mehr hergeben.** Das
  ist der belegbare Teil, und er ist Aufbau statt Zusage: der Klartext entsteht
  in der action und steht ausschliesslich im Rumpf **einer** POST-Antwort — kein
  Zwischenspeicher, kein Flash-Cookie, keine Weiterleitung mit Fragment. Ein
  Neuladen ist ein GET, dessen `load` ihn nicht kennt und nicht kennen kann: in
  `members` steht nur der SHA-256-Hash, und der ist nicht umkehrbar. Die POST-
  Antwort trägt `cache-control: no-store`, damit sie nicht im Verlauf und nicht
  im Plattenzwischenspeicher liegenbleibt.

  Was **nicht** behauptet wird: dass der Link damit überall fort ist. Solange
  die Seite offen bleibt, hält die Oberfläche ihn absichtlich fest — sonst
  löschte ihn jeder weitere Knopfdruck, bevor er weitergegeben wäre. Und wer
  `Link kopieren` gedrückt hat, hat ihn in der Zwischenablage des Geräts; siehe
  die benannt akzeptierten Risiken.

- **Link neu ausstellen** ersetzt den Hash derselben Zeile. Der alte Link ist
  damit sofort ungültig und führt auf `Dieser Link gilt nicht mehr.` Das ist der
  Zweck: für ein zweites Gerät braucht es die Aktion **nicht** — ein Token bleibt
  mehrfach einlösbar —, wohl aber für einen verlorenen oder in falsche Hände
  geratenen Link. Die Person behält Id, Name und ihre Historie.
- **Einladung widerrufen** setzt `is_active = 0`. Es wird **nichts gelöscht**:
  keine Zeile, kein Name, kein Hash. Die Zeile bleibt in der Liste stehen und ist
  dort im **Text** als beendet gekennzeichnet, nicht über eine Farbe. Abgehakte
  Aufgaben bleiben in der Historie, künftige Dienstwochen erscheinen als
  unbesetzt. Der Widerruf wirkt sofort, auch auf eine schon lebende Sitzung — der
  Wächter liest `is_active` bei jedem Aufruf frisch. Es ist die einzige Aktion
  mit einer Bestätigung und der einzige rote Knopf der Anwendung.
- **Adminrechte vergibt ausschliesslich `npm run create-admin`**, und nur für das
  erste Mitglied. Wer unter `/verwaltung` aufgenommen wird, entsteht immer mit
  `is_admin = 0`; es gibt keine Oberfläche, die Adminrechte vergibt oder
  entzieht, und keine, die einen beendeten Zugang reaktiviert.
- **Ein Admin kann sich nicht selbst widerrufen** und den eigenen Link nicht neu
  ausstellen — sonst bliebe die Verwaltung ohne Zugang. Geprüft wird das in der
  action, nicht nur in der Oberfläche: die eigene Zeile trägt keine Knöpfe, aber
  ein POST braucht keinen.
- **Ein Satz für vier Zustände.** Eine fehlende, eine nicht numerische, eine
  unbekannte und eine schon beendete `mitgliedId` ergeben alle `400` mit
  demselben Satz. Jede Abweichung im Wortlaut wäre ein Kanal, an dem sich ablesen
  liesse, welche Zeilen es gibt.

### Benannt akzeptierte Risiken

Diese Anwendung hat Kanten: der Zugang hängt allein an einem Link im Pfad, und
das Abhaken ist bewusst ohne Netz gebaut. Sie sind gesehen, gewogen und
angenommen — nicht übersehen:

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
- **Ein Widerruf ist ohne Datenbankeingriff unumkehrbar.** Es gibt bewusst keine
  Reaktivieren-Aktion und kein Undo-Fenster. Wer die falsche Zeile widerruft,
  nimmt die Person wieder auf — mit neuer Id und neuem Link. Die alte Zeile
  bleibt daneben stehen; ihre Historie hängt an der alten Id und wandert nicht
  mit. Der Bestätigungsdialog nennt darum Namen **und** Aufnahmedatum: auf
  `members.name` gibt es keine Eindeutigkeitsbedingung, zwei Mitglieder dürfen
  gleich heissen.
- **Ein Tippfehler im Namen bleibt für immer stehen.** Es gibt keine
  Umbenennen-Aktion. Der Name ist die einzige menschenlesbare Identität im
  System, und die einzige Korrektur ist Widerrufen plus Neuaufnehmen — was einen
  neuen Link nötig macht. Serverseitig abgewehrt sind nur die Fälle, in denen gar
  kein lesbarer Name entstünde: leere Eingabe, Nullbreiten-Zeichen und mehr als
  80 Zeichen.
- **Niemand protokolliert, wer wen widerrufen hat.** Es gibt kein Audit-Log,
  keine Spalte für den Handelnden und keine Zeitmarke des Widerrufs — nur
  `is_active = 0`. Bei einer Gemeinschaft mit genau einer Adminperson ist die
  Frage „wer war das" trivial beantwortet; die Frage „wann" ist es nicht mehr.
  Angenommen, weil eine Protokolltabelle hier mehr Bauwerk wäre als Nutzen.
- **Nach `Link kopieren` liegt der Klartext in der Zwischenablage.** iOS und
  Android synchronisieren die Zwischenablage geräteübergreifend (Universal
  Clipboard, Gboard-Verlauf), und jede App mit Vordergrundfokus darf sie lesen.
  Der Knopf ist trotzdem da: die Alternative ist Abtippen eines 43 Zeichen langen
  base64url-Tokens von Hand, und ein Tippfehler darin verbrennt einen Link, den
  niemand wiederherstellen kann. `navigator.clipboard` gibt es ohnehin nur auf
  einer sicheren Herkunft; ohne die fällt die Oberfläche auf „Feld antippen,
  Inhalt ist markiert" zurück.
- **Ohne JavaScript hakt nichts ab.** Das Kästchen schickt sein Formular über
  einen `change`-Handler ab; es gibt daneben keinen Knopf, der es ohne
  JavaScript täte. Ein Antippen tut dann **nichts** — und das ist die richtige
  Ausfallrichtung: lieber keine Wirkung als eine versehentlich erledigte
  Aufgabe. Ein Absenden-Knopf pro Zeile wäre der Gegenentwurf und kostet genau
  die Kernzusage, dass Abhaken eine Interaktion kostet. Die Anwendung ist
  ohnehin nur online.
- **Die Ablege-Meldung steht in der Adresse und lässt sich herbeiführen.** Sie
  reist als `?abgelegt` mit; ein Neuladen von `/?abgelegt` zeigt `Abgelegt.`
  erneut, und wer die Adresse von Hand eintippt, sieht den Satz auch, ohne dass
  etwas entstanden wäre. Der Gegenentwurf wäre ein Flash-Cookie: einmalig und mit
  sauberer Adresse, aber ein zweites Cookie neben dem einen Sitzungs-Cookie, das
  eine `load` schreibend wieder löschen müsste — ein Mechanismus, den danach jede
  Story kennen muss. Bei einer Bestätigung ohne Folgen ist der sichtbare
  Parameter der billigere Preis, und er ist von Hand nachvollziehbar. Angenommen.
- **Ohne JavaScript wird `Abgelegt.` nicht angesagt.** Das Ablegen selbst
  funktioniert vollständig ohne JavaScript — es ist ein gewöhnlicher POST mit
  einer `303` —, und die Meldung steht danach sichtbar auf `/`. Nur der Griff,
  der die Live-Region einmalig fokussiert, fällt aus; ein Screenreader liest den
  Satz dann erst beim Durchgehen der Seite. Angenommen: die sichtbare Bestätigung
  bleibt, und die Anwendung ist ohnehin nur online.
- **Das `maxlength` am Erfassen-Feld zählt anders als die Prüfung dahinter.**
  `maxlength="200"` zählt UTF-16-Einheiten, `textPruefen` zählt Codepoints. Ein
  gültiger Text aus 200 Codepoints, in dem ein Emoji steckt, ist im Browser 201
  Einheiten und lässt sich im Feld nicht zu Ende tippen — die **annehmende**
  Richtung der Codepoint-Zählung ist über das echte Formular also gar nicht
  erreichbar. Die abweisende Richtung stimmt: ein POST braucht kein Feld, und die
  Route zählt richtig. Der Ausweg wäre ein Zähler in JavaScript; er kostet
  Zustand auf einer Seite, die keinen hat, für einen Fall, den eine
  Gartenaufgabe kaum erreicht. Angenommen.
- **Ohne JavaScript greift die Doppelsperre nicht.** `imFlug` und `cancel()`
  leben im `use:enhance`-Rückruf; ohne JavaScript ist das Ablegen ein
  gewöhnlicher POST, und zwei schnelle Antippen erzeugen zwei gleichlautende
  Aufgaben. Es gibt keine Löschen-Aktion, die eine davon wieder wegnähme —
  abhaken ist das Einzige, was bleibt. Eine Entdopplungs-Schranke in der action
  wäre der Gegenentwurf und müsste entscheiden, welche zwei Aufgaben „dieselbe"
  sind; zwei Personen, die am selben Tag `Tunnel lüften` erfassen, meinen unter
  Umständen zwei verschiedene Tunnel. Angenommen: die Anwendung ist ohnehin nur
  online, und der Regelweg trägt die Sperre.
- **Jedes Mitglied kann jede erledigte Aufgabe wieder öffnen** — auch eine
  fremde und eine alte. Es gibt keine Zeitschranke, keine Bindung an die
  abhakende Person und kein Protokoll darüber, wer geöffnet hat. Der Grund ist
  derselbe wie beim namenlosen Pool: eine Prüfung „darf ich das" bräuchte die
  Zuordnung, die AD-2 und AD-5 gerade nicht wollen. In einer Gruppe von zwanzig
  Leuten, die sich kennen, ist das kein Missbrauchsrisiko, sondern der Gegenzug
  zum Fehlgriff mit dem Handschuh.

## Was noch nicht hier ist

- **Eine Aufgabe bearbeiten oder löschen gibt es nicht.** Ein Tippfehler im
  Aufgabentext bleibt stehen; abhaken ist das Einzige, was bleibt. In keiner
  Story von Epic 1 vorgesehen.
- Eine Massen-Eingabe (mehrere Aufgaben auf einmal, mehrzeiliges Feld):
  **Epic 2**. `/aufgabe` legt genau eine Zeile je Versand an.
- Fristen und Überfälligkeit (`due_at`, `seit N Wochen offen`): **Epic 2**. Die
  Spalte gibt es nicht, und `--overdue` ist ein noch unbenutztes Token.
- Diensthinweis und freie Einzelaufgaben, also Block 1 und 2 auf `/`: **Epic 3**.
  Die Reihenfolge ist angelegt, die Blöcke rendern nichts.
- Docker Compose, nginx als TLS-Terminierung, certbot, Backup-Skript und
  Runbook: **Story 1.6**. In diesem Stand gibt es davon nichts.
- Es gibt bewusst keinen Service Worker: `static/manifest.webmanifest` und die
  Icons genügen für die Installation zum Home-Bildschirm, und ein Datencache
  würde Erledigtes als offen zeigen.
