---
title: 'Story 1.1 — Gerüst und Gestaltungsrahmen'
type: 'feature'
created: '2026-08-26'
status: 'in-progress'
review_loop_iteration: 1
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

Kein eigener Code vorhanden — der erste Versuch wurde nach der Review zurückgenommen. Vorlagen im Referenzprojekt `/Users/manuelagner/Documents/webs/beehiveJournal` — **nur lesen**.

- `svelte.config.js` -- übernehmen. **Runes werden global über `vitePlugin.dynamicCompileOptions` erzwungen**; `filename` optional behandeln (`filename?.includes`), sonst TypeError bei virtuellen Modulen.
- `vite.config.ts` -- übernehmen: `loadEnv` + `Object.assign(process.env, env)`. **`vite-plugin-pwa` NICHT verwenden** — siehe Design Notes.
- `eslint.config.js` -- vier Blöcke mit nach Pfad getrennten Globals übernehmen, **aber die Regelsätze anders einhängen**: in `eslint-plugin-svelte` 3.23 und `typescript-eslint` 8.68 sind `configs.recommended` **Arrays**. `...svelte.configs.recommended.rules` ist ein No-op und lässt den Svelte-Regelsatz leer. Darum `src/lib/server/` und `src/lib/client/` jetzt anlegen, auch wenn `server/` leer bleibt.
- `src/app.html` -- Vorlage für `lang="de"`, Manifest-Link, iOS-Metas. Dort existieren fast keine Custom Properties; hier kommt ein echter Token-Block hin. Schriften nicht per Google-Fonts-`<link>`.
- `src/routes/+layout.svelte` -- Vorlage für `$props()` mit `children: Snippet` und `{@render children()}`. Abweichung: keine Auth, keine Menülogik.
- `static/manifest.webmanifest`, `static/icons/` -- Vorlage für Struktur und Icon-Grössen.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- gepinnte Versionen ohne Caret; Skripte `dev`, `build`, `preview`, `check`, `lint`, `format`, `gate`; `@fontsource-variable/figtree` und `@fontsource-variable/inter` je 5.3.0. `check` läuft mit **`--fail-on-warnings`**. `lint` ruft am Ende `gate` auf. `prepare` ist `svelte-kit sync` **ohne** `|| echo`. Drizzle und better-sqlite3 mitinstallieren, **kein** `vite-plugin-pwa`, **kein** `workbox-window` -- die Tore müssen scharf sein, nicht dekorativ
- [x] `scripts/gate.mjs` -- ausführbares Prüfskript, das mit Exit 1 endet, wenn eines gilt: ein Hex-Wert steht in einer `.svelte`-Datei · ein `var(--x, …)` trägt einen Fallback · ein in `src/` benutztes `var(--x)` ist in `app.html` nicht deklariert · `eslint --print-config` meldet für eine `.svelte`-Datei null `svelte/*`-Regeln. Jede Verletzung nennt Datei und Zeile -- die Invarianten der Spec waren bisher von keinem Tor gedeckt
- [x] `.npmrc` -- `engine-strict=true` und **`save-exact=true`** -- sonst schreibt das nächste `npm install` ein Caret und bricht die Pinnung
- [x] `.prettierrc`, `.prettierignore`, `tsconfig.json` -- nach Vorlage, `strict` und `moduleResolution: bundler`
- [x] `eslint.config.js` -- vier Blöcke; die Regelsätze von `typescript-eslint` **und** `eslint-plugin-svelte` als Arrays einhängen, sodass beide auf `.svelte` aktiv sind; `.claude/` und `build/` in `ignores`; ein Block für `**/*.js` mit Node-Globals -- ohne das prüft das Lint-Tor die gelieferte Oberfläche nicht
- [x] `svelte.config.js`, `vite.config.ts` -- `adapter-node`, globale Runes mit optionalem `filename`. Kein PWA-Plugin: das Manifest liegt handgepflegt in `static/`, die Installierbarkeit hängt allein daran -- ein nie registrierter Service Worker ist toter Ballast
- [x] `.env.example` -- `DATABASE_PATH`, `SESSION_SECRET`, **`ORIGIN`**, `PORT`; **kein** `NODE_ENV`. Keine Werte, aber ein Satz je Variable -- ohne `ORIGIN` weisen die CSRF-Prüfungen von `adapter-node` hinter nginx später jeden form-action-POST ab
- [x] `src/app.html` -- `lang="de"`, Manifest-Link, unqualifiziertes `theme-color` **plus** das per-Schema-Paar, iOS-Metas, `favicon.ico`, Apple-Icon in 180px, und der vollständige `:root`-Token-Block für Hell **und** Dunkel aus `DESIGN.md`
- [x] `src/app.d.ts` -- Typgerüst
- [x] `src/lib/components/TitleBar.svelte` -- volle Breite, Akzent gefüllt, Name `Gemeinschaftsgarten`, keine Knöpfe
- [x] `src/lib/components/NavBar.svelte` -- vier beschriftete Ziele, aktives Ziel farbig **und** mit 2px-Kante, `env(safe-area-inset-bottom, 0px)`, `z-index`, Beschriftungen am selben Mass wie der Inhalt ausgerichtet, kein `order` auf einem `position: fixed`-Element -- Rahmen aller späteren Oberflächen
- [x] `src/routes/+layout.svelte` -- Rahmen so aufbauen, dass **DOM-Reihenfolge und sichtbare Reihenfolge in beiden Umbruchzuständen übereinstimmen**; keine visuelle Umsortierung per `order`. Inter nur mit `latin` und `latin-ext` importieren -- Leserichtung ist Fokusreihenfolge (WCAG 2.4.3, 1.3.2)
- [x] `src/routes/+page.svelte` -- `<h1>` in der `display`-Rolle als Seitentitel, darunter der leere Zustand `Nichts offen.`, ohne Erfassen-Knopf -- `DESIGN.md` schreibt den Seitentitel im Rhythmus fest, und ohne `h1` hat das Dokument keine Gliederung
- [x] `static/manifest.webmanifest`, `static/icons/` -- `"id": "/"`, `display: standalone`, `orientation: portrait`, `start_url: /`, Farben aus den Tokens; Icons 192, 512, 512-maskable plus `favicon.ico` und 180px
- [x] `README.md` -- Start, Umgebungsvariablen inklusive `ORIGIN`, alle Skripte einschliesslich `gate` und `preview`

**Acceptance Criteria:**
- Given ein frisch geklontes Repository, when `npm install && npm run build && npm run lint && npm run check` läuft, then endet jeder Befehl mit 0, und die installierte TypeScript-Version ist 6.0.3
- Given eine `.svelte`-Datei, when `npx eslint --print-config` darauf läuft, then meldet es **mehr als 20 aktive `svelte/*`-Regeln und mehr als 10 aktive `@typescript-eslint/*`-Regeln**
- Given ein `{#each}` ohne Key in einer Komponente, when `npm run lint` läuft, then endet es mit einem Fehler
- Given ein `<img>` ohne `alt` in einer Komponente, when `npm run check` läuft, then endet es mit einem Fehler statt mit einer Warnung
- Given ein umbenanntes Token in `app.html`, das eine Komponente noch benutzt, when `npm run gate` läuft, then endet es mit Exit 1 und nennt Datei und Zeile
- Given die fertige Anwendung, when in allen `.svelte`-Dateien nach Hex-Werten und nach `var()` mit Fallback gesucht wird, then findet sich keiner
- Given `/` bei 375px, when die Seite betrachtet wird, then trägt sie genau ein `<h1>` in der `display`-Rolle, jedes Navigationsziel ist mindestens 44px hoch und trägt ein Wort, und der Inhalt liegt in maximal 600px zentriert
- Given ein Fenster breiter als 600px, when `/` geladen wird, then steht die Navigation oben, **und die Tab-Reihenfolge folgt der sichtbaren Reihenfolge**
- Given der Produktionsbau, when `build/client/` durchsucht wird, then existiert **kein** `sw.js` und keine `workbox`-Datei
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

## Design Notes

**Der Token-Block ist der Ertrag dieser Story — aber er trägt nur, wenn ein Tor ihn prüft.** Die erste Iteration behauptete, ein fehlendes Token „bricht sofort sichtbar". Das war falsch: es bricht die Darstellung, während `lint`, `check` und `build` grün bleiben. Genau darum gibt es jetzt `scripts/gate.mjs`.

```css
:root {
  --surface-base: #F5F4EF; --ink-primary: #1C221B; --accent: #2F6B3F; /* … */
}
@media (prefers-color-scheme: dark) {
  :root { --surface-base: #12160F; --ink-primary: #E9EDE4; --accent: #7FBB8C; /* … */ }
}
```

Komponenten schreiben ausschliesslich `var(--accent)` **ohne Fallback** — und `gate` erzwingt, dass jedes benutzte Token deklariert ist.

**Kein PWA-Plugin.** Die Installierbarkeit hängt an `manifest.webmanifest` und den Icons in `static/`; Chrome verlangt keinen Service Worker mehr, iOS nie. Ein Plugin, das einen Worker baut, den niemand registriert, liefert nur 18 KB toten Ballast und die Gefahr, dass eine spätere Änderung ihn versehentlich aktiviert.

## Verification

**Commands:**
- `npm run lint` -- expected: Exit 0; enthält den `gate`-Aufruf
- `npm run gate` -- expected: Exit 0; bei einem umbenannten Token Exit 1 mit Datei und Zeile
- `npm run check` -- expected: Exit 0 mit `--fail-on-warnings`; bei einem `alt`-losen `<img>` Exit ungleich 0
- `npm run build` -- expected: Exit 0
- `npx eslint --print-config src/routes/+page.svelte` -- expected: mehr als 20 `svelte/*`- und mehr als 10 `@typescript-eslint/*`-Regeln
- `ls build/client/sw.js` -- expected: existiert nicht
- `ls src/lib/server/db` -- expected: existiert nicht oder ist leer

**Manual checks (if no CLI):**
- `/` bei 375px in Hell und Dunkel: Titelleiste, `<h1>`, `Nichts offen.`, vier beschriftete Ziele, `Aufgaben` aktiv
- Ab 600px: Navigation oben, und die Tab-Reihenfolge folgt der Sichtreihenfolge
- Zum Home-Bildschirm hinzufügen: eigenes Icon, Start im Hochformat ohne Browser-Leiste
