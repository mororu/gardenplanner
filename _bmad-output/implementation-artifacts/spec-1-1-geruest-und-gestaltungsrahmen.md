---
title: 'Story 1.1 — Gerüst und Gestaltungsrahmen'
type: 'feature'
created: '2026-08-26'
status: 'in-progress'
review_loop_iteration: 2
baseline_commit: '6fb5bb1cf2115cbdf1c5558fd337d48724e0ea67'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Gartenplaner-2026-08-26/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Das Repository enthält nur Planungsartefakte. Es gibt kein Projekt — keine `package.json`, kein SvelteKit-Gerüst, keine Design-Tokens, keine Schriften. Jede weitere Story von Epic 1 setzt das voraus.

**Approach:** Ein lauffähiges SvelteKit-Projekt mit dem gepinnten Stack aufsetzen und den Gestaltungsrahmen einziehen, den alle späteren Oberflächen benutzen: Token-Block für Hell und Dunkel, selbst gehostete Schriften, Titelleiste, untere Navigationsleiste, PWA-Manifest. Sichtbares Ergebnis: `/` zeigt Titelleiste, Navigation und `Nichts offen.` auf dem Handy, installierbar vom Home-Bildschirm.

## Boundaries & Constraints

**Always:**
- Versionen exakt wie in `epic-1-context.md`. **TypeScript 6.0.3, nicht 7.x** (SvelteKit, `svelte-check`, `typescript-eslint` deckeln unter 7). `adapter-node`, nie `adapter-auto`.
- Jeder Farb-, Grössen-, Radius- und Abstandswert aus einer CSS Custom Property im `:root`-Block. **Kein Hex-Wert in einem Komponenten-`<style>`.** Werte in `DESIGN.md`.
- Dunkler Modus über eigene Token-Werte, nicht über Invertierung oder Filter.
- Zur Laufzeit keine Netzanfrage an einen fremden Host. Schriften aus `@fontsource-variable/*`.
- Svelte 5 Runes durchgehend. Kein `export let`, kein `$:`, keine Store-Writables.
- Oberflächentexte deutsch in Schweizer Rechtschreibung, nie das Zeichen Eszett. `<html lang="de">`.
- Trefferfelder mindestens 44 × 44 px, gelesener Text mindestens 16px, alle Grössen in `rem`.

**Ask First:**
- Abweichung von einer gepinnten Version, aus welchem Grund auch immer.
- Einführung einer Komponentenbibliothek, eines CSS-Frameworks oder eines Utility-Class-Systems.
- Jede Datei unter `src/lib/server/db/` — die Datenbankschicht ist bewusst nach Story 1.2 verschoben.

**Never:**
- Keine Datenbankverbindung, kein Schema, keine Migration, kein `drizzle.config.ts`, keine `db:*`-Skripte, keine Domänentabellen — alles Story 1.2.
- Kein `argon2`, keine Passwörter, kein Login, kein Auth-Guard, kein `hooks.server.ts`.
- Kein Service-Worker-Datencache: `VitePWA` liefert nur Manifest und Icons, kein `navigateFallback`, keine `runtimeCaching`-Regel auf serverseitig gerenderte Routen.
- Kein Erfassen-Knopf auf `/` — der kommt mit Story 1.5.
- Keine Schatten, Farbverläufe, Pillen-Radien, Symbole ohne Beschriftung, Illustrationen.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Startseite hell | `/` bei 375px, helles Gerät | Titelleiste, `Nichts offen.`, untere Leiste mit vier Zielen, `Aufgaben` aktiv | N/A |
| Startseite dunkel | `prefers-color-scheme: dark` | Dieselbe Struktur mit den Dunkel-Token | N/A |
| Zum Home-Bildschirm | Installation aus dem Handy-Browser | Start ohne Browser-Leiste, Hochformat, eigenes Icon | N/A |
| Unbekannter Pfad | `/gibtsnicht` | SvelteKit-Standardfehlerseite, Rahmen bleibt sichtbar | Keine eigene Fehlerseite in dieser Story |

</frozen-after-approval>

## Code Map

Kein eigener Code — zwei Versuche wurden nach Review zurückgenommen (`a3b6fa9`). Vorlagen im Referenzprojekt `/Users/manuelagner/Documents/webs/beehiveJournal` — **nur lesen**.

- `svelte.config.js` -- übernehmen; Runes global über `dynamicCompileOptions`, `filename` explizit gegen `undefined` prüfen.
- `vite.config.ts` -- übernehmen. **Kein `vite-plugin-pwa`.**
- `eslint.config.js` -- vier Blöcke mit nach Pfad getrennten Globals. In `eslint-plugin-svelte` 3.23 und `typescript-eslint` 8.68 sind `configs.recommended` **Arrays** — `.rules` darauf ist `undefined`.
- `src/app.html` -- Vorlage für `lang="de"`, Manifest-Link, iOS-Metas. Hier kommt der Token-Block hin; Schriften nicht per CDN.
- `src/routes/+layout.svelte` -- Vorlage für `$props()` mit `children: Snippet` und `{@render children()}`.
- `static/manifest.webmanifest`, `static/icons/` -- Vorlage für Struktur und Icon-Grössen.

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/gate.mjs` -- das Prüfskript. **Analyse über den gesamten Dateitext, nie zeilenweise** (Prettier bricht `var(...)` um). Nimmt ein optionales Zielverzeichnis als Argument. Jeder Lesefehler und jeder Fehlschlag eines Unterprozesses wird als benannte Verletzung gemeldet, nie als Stacktrace. Acht Regeln:
  1. In `.svelte` und `.css` unter `src/` kein Farbliteral — weder Hex noch `rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`, `color(` noch ein CSS-Farbname — und kein rohes `px`/`rem`-Literal ausser `0`. Ausgenommen ist allein der Token-Block in `app.html`.
  2. Kein `var()` mit Fallback-Wert.
  3. Jedes in `src/` benutzte `var(--x)` ist im `:root`-Block deklariert. Der Block wird **per Klammertiefe** geschnitten, CSS-Kommentare werden vorher entfernt — eine Erwähnung in einem Kommentar oder eine Deklaration in einem anderen Selektor zählt nicht.
  4. **Beide Richtungen:** jedes Farb-Token aus `:root` hat einen Wert im Dunkel-Block, und kein Token existiert nur im Dunkel-Block. Ein fehlender, leerer oder unbalancierter Dunkel-Block ist selbst eine Verletzung.
  5. Die `theme-color`-Metas und die Farben in `static/manifest.webmanifest` stimmen mit den zugehörigen Tokens überein, Schreibweise unerheblich.
  6. Jeder Icon- und Manifest-Pfad aus `app.html` und aus dem Manifest existiert unter `static/`.
  7. Für **jede** `.svelte`-Datei liefert `eslint --print-config` mindestens so viele `svelte/*`- und `@typescript-eslint/*`-Regeln, wie die Plugins in ihren `recommended`-Arrays führen. Die Zahlen werden aus den Plugins abgeleitet, nicht im Code festgeschrieben. Lokales eslint-Binary, nicht `npx`.
  8. Tokens, die nirgends benutzt werden, werden als Hinweis gemeldet — kein Fehler, sie sind für spätere Stories reserviert.
- [ ] `scripts/gate-fixtures/` und `gate:selftest` -- Dateien mit absichtlichen Verletzungen, je eine pro Regel, darunter ein von Prettier umbrochenes `var()` mit Fallback, ein `rgb()`, ein Hex in einer `.css`, ein nur im Kommentar erwähntes Token, ein nur im Hell-Block deklariertes Farb-Token, ein kaputter Dunkel-Block, eine abweichende Manifest-Farbe und ein nicht existierender Icon-Pfad. `gate:selftest` richtet das Tor auf dieses Verzeichnis und endet mit Fehler, wenn **eine** Verletzung nicht gefunden wird -- ein Prüfskript, das seine eigene Wirksamkeit nicht beweist, täuscht Sicherheit vor
- [ ] `package.json` -- gepinnte Versionen ohne Caret; `dev`, `build`, `preview`, `start`, `check`, `lint`, `format`, `gate`, `gate:selftest`. `check` mit `--fail-on-warnings`, `lint` ruft `gate` und `gate:selftest`, `prepare` ist `svelte-kit sync` ohne `|| echo`. `engines` für Node **und** npm. `@types/better-sqlite3` **weglassen** -- 9.6.0 passt nicht zu better-sqlite3 13; die Typfrage gehört in Story 1.2. Kein `vite-plugin-pwa`, kein `workbox-window`
- [ ] `.npmrc`, `.nvmrc`, `.editorconfig`, `.prettierrc`, `.prettierignore`, `tsconfig.json` -- `engine-strict`, `save-exact`; `tsconfig` überschreibt **nicht**, was `.svelte-kit/tsconfig.json` schon setzt
- [ ] `eslint.config.js` -- vier Blöcke; beide Regelsätze als Arrays eingehängt und auf `.svelte` wirksam; `files`-Zuordnung der Plugin-Konfigurationen erhalten; Blöcke für `**/*.{js,mjs,cjs}` und `**/*.{ts,mts,cts}`; `ignores` deckungsgleich mit `.prettierignore` plus `_bmad/`, `_bmad-output/`, `.claude/`
- [ ] `svelte.config.js`, `vite.config.ts` -- `adapter-node`, globale Runes, kein PWA-Plugin
- [ ] `.env.example` -- `DATABASE_PATH`, `SESSION_SECRET`, `ORIGIN`, `PORT`; kein `NODE_ENV`; keine Behauptung im Präsens über Prüfungen, die erst in 1.2 entstehen; `ORIGIN` mit Beispielwert im Kommentar statt leer
- [ ] `src/app.html` -- `lang="de"`, `viewport-fit=cover`, `color-scheme: light dark`, Manifest-Link, `favicon.ico`, Apple-Icon 180, unqualifiziertes `theme-color` plus per-Schema-Paar, `meta description`, Standard-`<title>`, und der `:root`-Token-Block für Hell und Dunkel aus `DESIGN.md` -- ohne `viewport-fit` liefert `env(safe-area-inset-bottom)` auf iOS immer 0 und die feste Leiste liegt im installierten Modus unter dem Home-Indikator
- [ ] `src/app.d.ts` -- Typgerüst
- [ ] `src/lib/components/TitleBar.svelte` -- volle Breite, Akzent gefüllt, Name `Gemeinschaftsgarten`, keine Knöpfe
- [ ] `src/lib/components/NavBar.svelte` -- vier beschriftete Ziele; aktiv per **Segmentgrenze** (`pfad === href || pfad.startsWith(href + '/')`), nicht per nacktem `startsWith`; `env(safe-area-inset-bottom, 0px)`; `z-index`; eigenes `--navbar-height` statt `--touch` als Höhe; Beschriftungen am selben Mass wie der Inhalt; kein `order` auf einem fixierten Element; ein etwaiges `eslint-disable` gilt **nur** für den `each`-Block und wird mit `eslint-enable` geschlossen
- [ ] `src/routes/+layout.svelte` -- Skip-Link auf `<main id="inhalt" tabindex="-1">`; DOM- und Sichtreihenfolge im Kommentar **wahrheitsgemäss** beschreiben (unter 600px weichen sie ab, weil die Leiste fixiert ist); Reserve unten aus `--navbar-height`; Inter nur `latin` und `latin-ext`
- [ ] `src/routes/+page.svelte` -- `<h1>` in der `display`-Rolle, darunter `Nichts offen.`, kein Erfassen-Knopf
- [ ] `src/lib/styles/fonts.css` -- `format('woff2') tech(variations)`, Preload der zwei tatsächlich benutzten Schnitte, `font-synthesis: none`
- [ ] `static/manifest.webmanifest`, `static/icons/` -- `"id": "/"`, `display: standalone`, `start_url: /`, **kein** `orientation`-Zwang (WCAG 1.3.4), Farben aus den Tokens; Icons 192, 512, 512-maskable, 192-maskable, 180 und `favicon.ico`
- [ ] `README.md` -- Start, Umgebungsvariablen mit `ORIGIN`, alle Skripte; die Torbeschreibungen entsprechen der Umsetzung; `npm run preview` ist Vites Vorschau, der Produktionsstart ist `npm start`; Docker und nginx als Story 1.6 kennzeichnen statt als vorhanden zu beschreiben

**Acceptance Criteria:**
- Given ein frisch geklontes Repository, when `npm install && npm run build && npm run lint && npm run check` läuft, then endet jeder Befehl mit 0 und die installierte TypeScript-Version ist 6.0.3
- Given `npm run gate:selftest`, when es läuft, then endet es mit 0 und weist für **jede** der acht Regeln nachweislich eine Verletzung nach
- Given eine Verletzung, die Prettier über zwei Zeilen umbricht, when `npm run format && npm run gate` läuft, then endet `gate` mit 1 -- Formatieren darf eine Verletzung nie verstecken
- Given ein Farb-Token, das aus dem Dunkel-Block gelöscht wird, when `npm run gate` läuft, then endet es mit 1
- Given `rgb(220 38 38)`, `rebeccapurple` oder `padding: 13px` in einer Komponente, when `npm run gate` läuft, then endet es mit 1
- Given ein Token, das nur in einem CSS-Kommentar oder in einem Nicht-`:root`-Selektor erscheint, when eine Komponente es benutzt, then endet `gate` mit 1
- Given eine geänderte Akzentfarbe in `:root`, when `npm run gate` läuft, then endet es mit 1, weil Metas und Manifest nicht mehr übereinstimmen
- Given ein nicht existierender Icon-Pfad im Manifest, when `npm run gate` läuft, then endet es mit 1
- Given jede `.svelte`-Datei, when `eslint --print-config` darauf läuft, then sind beide Regelsätze vollständig aktiv, gemessen gegen die `recommended`-Arrays der Plugins
- Given ein `{#each}` ohne Key und ein `<img>` ohne `alt`, when `lint` bzw. `check` läuft, then endet jeder mit einem Fehler
- Given `/` bei 375px, when die Seite betrachtet wird, then trägt sie genau ein `<h1>`, einen erreichbaren Skip-Link, und jedes Navigationsziel ist mindestens 44px hoch mit einem Wort als Beschriftung
- Given `/wissenschaft` als Pfad, when die Navigation gerendert wird, then ist **kein** Ziel als aktiv markiert
- Given der Produktionsbau, when `build/client/` durchsucht wird, then existiert kein `sw.js` und keine `workbox`-Datei
- Given die laufende Anwendung, when die Netzanfragen beim Laden von `/` beobachtet werden, then geht keine Anfrage an einen fremden Host
- Given die fertige Anwendung, when `src/lib/server/db/` geprüft wird, then existiert dort keine Datei

## Spec Change Log

### Iteration 1 — 2026-08-26

**Auslösende Befunde (6 × `bad_spec`, 4 × `high`), alle im laufenden Baum nachgewiesen:**
1. `...svelte.configs.recommended.rules` ist ein No-op (Flat-Config-Array) — `.svelte` hatte 0 `svelte/*` und 0 `@typescript-eslint/*`-Regeln; fehlender `each`-Key und `{@html}` liefen durch.
2. `svelte-check` ohne `--fail-on-warnings`: `<img>` ohne `alt` → WARNING, Exit 0.
3. Umbenanntes `--accent` → alle Tore grün, Titelleiste ohne Füllung.
4. `order: 2` ab 600px: Sichtreihenfolge ungleich DOM- und Tab-Reihenfolge (WCAG 2.4.3, 1.3.2).
5. Kein `<h1>`, `--display-*` nirgends benutzt — `DESIGN.md` fordert den Seitentitel.
6. Service Worker gebaut, nie registriert — 18 KB toter Ballast.

**Geändert:** Tore scharf gestellt (`--fail-on-warnings`, `gate`-Skript für Token- und Hex-Invarianten, korrekt eingehängte Regelsätze, `save-exact`). Sechs Akzeptanzkriterien prüfen jetzt die Tore selbst statt nur ihren Exit-Code. `vite-plugin-pwa` und `workbox-window` entfallen. `ORIGIN` kommt in `.env.example`, `NODE_ENV` verschwindet. 13 Patch-Befunde in die Tasks eingearbeitet.

**Vermiedener Bekannt-Schlecht-Zustand:** Ein Gerüst, dessen drei Qualitätstore grün melden, während sie die gelieferte Oberfläche nicht prüfen — und das diese Blindheit an die Stories 1.2 bis 1.6 weitervererbt.

**KEEP:** exakt gepinnte Versionen ohne Caret · TypeScript 6.0.3 · Node 24 · Token-Block mit den 16 gegen `DESIGN.md` gerechneten Farbwerten, `--touch` 2.75rem, `--measure` 37.5rem · 0 Hex in `.svelte`, 0 `var()`-Fallbacks · Schriften selbst gehostet, 0 fremde Hosts · vier Navigationsziele mit **Wort statt Symbol** und `aria-current="page"` · `preload-data="tap"` statt `hover` · Border-Breiten als rem-Tokens · ein Umbruchpunkt bei 37.5rem · deutsche Texte ohne Eszett · vier ESLint-Blöcke mit nach Pfad getrennten Globals · `src/lib/server/db/` bleibt leer.

### Iteration 2 — 2026-08-26

**Auslösende Befunde (8 × `bad_spec`, 4 × `high`), sechs davon im laufenden Baum demonstriert:**
1. Regeln 2 und 3 von `gate.mjs` arbeiteten **zeilenweise**. Prettier bricht lange `var(...)` um — in dieser von Prettier erzeugten Form blieb das Tor grün. `npm run format` verwandelte eine erkannte Verletzung in eine unerkannte.
2. Die Dunkel-Prüfung lief **nur in eine Richtung**: `--accent` aus dem Dunkel-Block gelöscht → „56 Tokens deklariert, alles gut", Exit 0.
3. Regel 1 verbot nur Hex und nur in `.svelte`: `rgb()`, `hsl()`, Farbnamen, `padding: 13px` und ein Hex in `fonts.css` gingen durch.
4. `hellTokens` akzeptierte jedes `--x:` in `app.html` — auch in einem Kommentar und in einem Nicht-`:root`-Selektor.
5. Token-Werte standen dreifach (Tokens, `theme-color`-Metas, Manifest) ohne Abgleich; `gate` las `static/` nie.
6. Manifest- und Icon-Pfade waren ungeprüfte Zeichenketten.
7. Keine Fehlerbehandlung um Dateilesen und `eslint --print-config`.
8. Die Klammersuche im Dunkel-Block hatte kein `-1`-Schutz, keinen Unbalanciert- und keinen Mehrfachmarker-Schutz.

**Ursache:** `gate.mjs` war in einem Satz Prosa spezifiziert; die Umsetzung hat genau diese vier Wörter implementiert. Das Tor ist der Testersatz dieses Projekts.

**Geändert:** Das Tor ist jetzt mit acht Regeln ausbuchstabiert, arbeitet über den gesamten Dateitext statt zeilenweise, prüft beide Richtungen des Dunkel-Blocks, liest `static/` mit, leitet seine Schwellen aus den Plugins ab und meldet Lesefehler als Verletzung. Neu: **`gate:selftest` gegen ein Verzeichnis mit absichtlichen Verletzungen** — das Tor muss seine eigene Wirksamkeit beweisen. 18 Patch-Befunde eingearbeitet, darunter `viewport-fit=cover`, `color-scheme: light dark`, Skip-Link, Segmentgrenzen-Vergleich in `istAktiv`, `orientation`-Zwang entfernt (WCAG 1.3.4) und `@types/better-sqlite3` gestrichen.

**Vermiedener Bekannt-Schlecht-Zustand:** Ein Prüfskript, das als Testersatz verkauft wird und dessen Regeln von der eigenen Formatierung, von `rgb()`, von einem Kommentar und von einem fehlenden Dunkel-Wert ausgehebelt werden — während es „alles gut" meldet.

**KEEP (zusätzlich zu Iteration 1):** die vier scharfen Tore und `--fail-on-warnings` · die 37 svelte- und 20 ts-Regeln, die auf `.svelte` wirksam waren · `injectRegister`-freier Verzicht auf das PWA-Plugin · das `<h1>` in der `display`-Rolle · die fünf Fehlerproben, die bereits bissen (Hex einzeilig, `var()`-Fallback einzeilig, Dunkel-Token umbenannt, `{#each}` ohne Key, `<img>` ohne `alt`).

## Design Notes

**Das Tor ist der Testersatz dieses Projekts — also muss es sich selbst prüfen.** Iteration 1 behauptete, ein fehlendes Token bricht sichtbar; falsch, es brach still. Iteration 2 baute ein Tor, das sechs Wege offen liess. Darum gibt es jetzt `gate:selftest`: ein Verzeichnis mit absichtlichen Verletzungen, gegen das das Tor beweisen muss, dass es jede findet.

```css
:root {
  --surface-base: #F5F4EF; --ink-primary: #1C221B; --accent: #2F6B3F; /* … */
}
@media (prefers-color-scheme: dark) {
  :root { --surface-base: #12160F; --ink-primary: #E9EDE4; --accent: #7FBB8C; /* … */ }
}
```

Komponenten schreiben `var(--accent)` ohne Fallback. **Kein PWA-Plugin** — Installierbarkeit hängt an Manifest und Icons.

## Verification

**Commands:**
- `npm run gate:selftest` -- expected: Exit 0, jede der acht Regeln nachweislich wirksam
- `npm run lint` -- expected: Exit 0; ruft `gate` und `gate:selftest`
- `npm run check` -- expected: Exit 0 mit `--fail-on-warnings`
- `npm run build` -- expected: Exit 0
- `npm run format && npm run gate` -- expected: Formatieren verändert kein Prüfergebnis
- `ls build/client/sw.js` -- expected: existiert nicht
- `ls src/lib/server/db` -- expected: existiert nicht

**Manual checks (if no CLI):**
- `/` bei 375px in Hell und Dunkel: Titelleiste, `<h1>`, `Nichts offen.`, vier beschriftete Ziele
- Skip-Link mit der Tastatur erreichbar und wirksam
- Ab 600px: Navigation oben
- Zum Home-Bildschirm hinzufügen: eigenes Icon, kein Ausrichtungszwang
