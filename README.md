# Gemeinschaftsgarten

Aufgabenliste für einen Gemeinschaftsgarten: rund zwanzig Gärtner\*innen sehen auf
dem Handy, was offen ist, und haken mit einem Griff ab. Serverseitig gerenderter
SvelteKit-Monolith, eine SQLite-Datei, nur online.

Dieser Stand ist Story 1.1: Gerüst und Gestaltungsrahmen. Es gibt Titelleiste,
Navigationsleiste, den leeren Zustand auf `/` und das PWA-Manifest — noch keine
Datenbank, keine Anmeldung und keine Aufgaben.

## Voraussetzungen

- Node 24 oder neuer (`engine-strict=true`, die Version wird beim Installieren geprüft)
- npm 11 oder neuer

## Start

```sh
npm install          # installiert exakt die gepinnten Versionen
cp .env.example .env # danach die Werte einsetzen
npm run dev          # Entwicklungsserver auf http://localhost:5173
```

Für den Produktionsbau:

```sh
npm run build
npm run preview      # baut nicht neu, sondern zeigt den Bau lokal
node build/index.js  # so läuft der Bau auf dem Server (adapter-node)
```

## Umgebungsvariablen

Alle Werte stehen in `.env` (lokal) beziehungsweise in der Umgebung des
Containers. `.env.example` ist die Vorlage und enthält bewusst keine Werte.

| Variable         | Bedeutung                                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_PATH`  | Pfad zur SQLite-Datei. Lokal etwa `./data/dev.sqlite`, im Container `/data/db.sqlite`. Ab Story 1.2 Pflicht, ohne Vorgabewert.                                             |
| `SESSION_SECRET` | Geheimnis für die Signatur des Sitzungs-Cookies, 32 Byte Zufall (`openssl rand -base64 32`). Ab Story 1.2 Pflicht, ohne Vorgabewert.                                       |
| `ORIGIN`         | Vollständige öffentliche Herkunft, etwa `https://garten.example.ch`. Ohne diesen Wert weist `adapter-node` hinter nginx jeden POST einer form action als CSRF-Verstoss ab. |
| `PORT`           | Port des Node-Servers, im Container `3000`. Der Vite-Dev-Server nutzt unabhängig davon `5173`.                                                                             |

## Skripte

| Skript            | Zweck                                                                                                                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`     | Entwicklungsserver mit Hot Reload.                                                                                                                                                                                                                    |
| `npm run build`   | Produktionsbau nach `build/` über `adapter-node`.                                                                                                                                                                                                     |
| `npm run preview` | Zeigt den vorhandenen Produktionsbau lokal an.                                                                                                                                                                                                        |
| `npm run check`   | `svelte-check` mit `--fail-on-warnings`; eine Barrierefreiheits-Warnung ist damit ein Fehler.                                                                                                                                                         |
| `npm run gate`    | Prüft den Gestaltungsrahmen: kein Hex in einer Komponente, kein `var()` mit Fallback, jedes benutzte Token im `:root`-Block von `src/app.html` deklariert (und keines nur im dunklen Block), beide ESLint-Regelsätze auf `.svelte` tatsächlich aktiv. |
| `npm run lint`    | `prettier --check`, dann `eslint`, dann `gate`.                                                                                                                                                                                                       |
| `npm run format`  | Schreibt die Formatierung mit Prettier.                                                                                                                                                                                                               |

Das Qualitätstor vor jeder Abgabe:

```sh
npm run build && npm run lint && npm run check
```

Dazu kommt der Blick von Hand auf `/` bei 375px Breite, in Hell und in Dunkel.
Es gibt bewusst kein Testframework.

## Gestaltungsrahmen

Jeder Farb-, Grössen-, Radius- und Abstandswert steht als CSS Custom Property im
`:root`-Block in `src/app.html`, einmal für Hell und einmal für Dunkel.
Komponenten lesen jeden Wert über eine Custom Property und nie mit Fallback;
`npm run gate` erzwingt das in beide Richtungen. Die Schriften Figtree und Inter
liegen selbst gehostet in `src/lib/styles/fonts.css` und kommen aus
`@fontsource-variable/*` — zur Laufzeit geht keine Anfrage an einen fremden Host.

Die Werte kommen aus
`_bmad-output/planning-artifacts/ux-designs/ux-Gartenplaner-2026-08-26/DESIGN.md`.
Bei Widerspruch gewinnt diese Datei.
