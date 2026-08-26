# Gemeinschaftsgarten

Aufgabenliste für einen Gemeinschaftsgarten: rund zwanzig Gärtner\*innen sehen auf
dem Handy, was offen ist, und haken mit einem Griff ab. Serverseitig gerenderter
SvelteKit-Monolith, eine SQLite-Datei, nur online.

Dieser Stand ist Story 1.1: Gerüst und Gestaltungsrahmen. Es gibt Titelleiste,
Navigationsleiste, den leeren Zustand auf `/` und das PWA-Manifest — noch keine
Datenbank, keine Anmeldung und keine Aufgaben.

## Voraussetzungen

- Node 24 oder neuer (`.nvmrc`), npm 11 oder neuer. `engine-strict=true` lässt
  `npm install` mit einer klaren Meldung abbrechen, wenn die Version nicht passt.
- `save-exact=true`: jede Abhängigkeit wird ohne Caret gepinnt.

## Start

```sh
npm install          # installiert exakt die gepinnten Versionen
cp .env.example .env # danach die Werte einsetzen
npm run dev          # Entwicklungsserver auf http://localhost:5173
```

Produktionsbau und Produktionsstart:

```sh
npm run build        # baut nach build/ über adapter-node
npm start            # startet den Bau, also node build/index.js — so läuft es auf dem Server
```

`npm run preview` ist etwas anderes: das ist Vites eigene Vorschau des Baus für
einen schnellen Blick von Hand, nicht der Produktionsstart.

## Umgebungsvariablen

Alle Werte stehen in `.env` (lokal) beziehungsweise in der Umgebung des
Containers. `.env.example` ist die Vorlage; die Werte bleiben dort leer, der
Beispielwert steht jeweils im Kommentar darüber.

In diesem Stand liest die Anwendung noch keine dieser Variablen — sie sind
vorbereitet, damit die Betriebsumgebung von Anfang an vollständig ist.

| Variable         | Bedeutung                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_PATH`  | Pfad zur SQLite-Datei. Lokal etwa `./data/dev.sqlite`, im Container `/data/db.sqlite`. Wird mit Story 1.2 zur Pflicht, ohne Vorgabewert.                                                 |
| `SESSION_SECRET` | Geheimnis für die Signatur des Sitzungs-Cookies, 32 Byte Zufall (`openssl rand -base64 32`). Wird mit Story 1.2 zur Pflicht, ohne Vorgabewert.                                           |
| `ORIGIN`         | Vollständige öffentliche Herkunft, etwa `https://garten.example.ch`. Ohne diesen Wert weist `adapter-node` hinter einem Reverse Proxy jeden POST einer form action als CSRF-Verstoss ab. |
| `PORT`           | Port des Node-Servers, im Container `3000`. Der Vite-Dev-Server nutzt unabhängig davon `5173`.                                                                                           |

## Skripte

| Skript                  | Zweck                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Entwicklungsserver mit Hot Reload.                                                                 |
| `npm run build`         | Produktionsbau nach `build/` über `adapter-node`.                                                  |
| `npm run preview`       | Vites Vorschau des vorhandenen Baus — zum Anschauen, nicht zum Betreiben.                          |
| `npm start`             | Produktionsstart: `node build/index.js`.                                                           |
| `npm run check`         | `svelte-check` mit `--fail-on-warnings`; damit ist auch eine Barrierefreiheits-Warnung ein Fehler. |
| `npm run gate`          | Prüft die acht Regeln des Gestaltungsrahmens (siehe unten).                                        |
| `npm run gate:selftest` | Richtet das Tor auf `scripts/gate-fixtures/` und beweist, dass jede der acht Regeln beisst.        |
| `npm run lint`          | `prettier --check`, dann `eslint`, dann `gate`, dann `gate:selftest`.                              |
| `npm run format`        | Schreibt die Formatierung mit Prettier.                                                            |

Das Qualitätstor vor jeder Abgabe:

```sh
npm run build && npm run lint && npm run check
```

Dazu kommt der Blick von Hand auf `/` bei 375px Breite, in Hell und in Dunkel.
Es gibt bewusst kein Testframework — deshalb muss das Tor sich selbst prüfen,
siehe `npm run gate:selftest`.

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
CSS-Kommentare vorher aus. Acht Regeln:

1. In `.svelte` und `.css` unter `src/` kein Farbliteral — weder Hex noch
   `rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`, `color(` noch ein CSS-Farbname —
   und kein rohes `px`/`rem`-Literal ausser `0`. Ausgenommen ist allein der
   Token-Block in `src/app.html`; die Bedingung einer Medienabfrage ist
   ausgenommen, weil sie keine Custom Property lesen kann.
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

Jeder Lesefehler und jeder Fehlschlag eines Unterprozesses wird als benannte
Verletzung gemeldet, nie als Stacktrace.

`npm run gate:selftest` richtet das Tor auf `scripts/gate-fixtures/`. Dort liegt
je ein Kleinprojekt mit einer absichtlichen Verletzung pro Regel, darunter ein
von Prettier über drei Zeilen umbrochenes `var()` mit Fallback, ein `rgb()`, ein
Hex in einer `.css`, ein nur in einem Kommentar erwähntes Token, ein nur im
Hell-Block deklariertes Farb-Token, ein unbalancierter Dunkel-Block, eine
abweichende Manifest-Farbe, ein nicht existierender Icon-Pfad und eine
`eslint.config.js` mit dem No-op `...configs.recommended.rules`. Der Selbsttest
endet mit Fehler, wenn eine dieser Verletzungen nicht gefunden wird. Das
Verzeichnis steht in `.prettierignore` und in den `ignores` von
`eslint.config.js`: die Proben sind absichtlich kaputt und dürfen nicht
formatiert oder gelintet werden.

## Was noch nicht hier ist

- Datenbank, Schema, Migrationen, Einladungslinks, Sitzungen: Stories 1.2 bis 1.5.
- Docker Compose, nginx als TLS-Terminierung, certbot, Backup-Skript und
  Runbook: **Story 1.6**. In diesem Stand gibt es davon nichts.
- Es gibt bewusst keinen Service Worker: `static/manifest.webmanifest` und die
  Icons genügen für die Installation zum Home-Bildschirm, und ein Datencache
  würde Erledigtes als offen zeigen.
