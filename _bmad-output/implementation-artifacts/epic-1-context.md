# Epic 1 Context: Die Gemeinschaft kommt rein und sieht, was zu tun ist

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Alle rund zwanzig Gärtner\*innen erreichen die Anwendung über ihren persönlichen Einladungslink auf dem Handy, sehen beim Öffnen sofort die offenen Aufgaben, haken mit einem Griff ab und erfassen selbst neue Aufgaben. Weil es kein Projektskelett gibt — keine `package.json`, kein SvelteKit-Gerüst, keine Datenbank, keine Tokens, keine Schriften —, legt dieses Epic zusätzlich das Fundament und den Gestaltungsrahmen, und es bringt die Anwendung auf den Server: eine Anwendung auf einem Entwicklerrechner hakt niemand ab, der Nutzen entsteht erst mit dem Betrieb. Nach diesem Epic ist die tragende Produktannahme testbar — nämlich ob eine Gruppe von zwanzig Freiwilligen tatsächlich abhakt. Das gesamte Adoptionsrisiko des Produkts sitzt genau hier.

## Stories

- Story 1.1: Gerüst und Gestaltungsrahmen
- Story 1.2: Einladungslink einlösen und angemeldet bleiben
- Story 1.3: Mitglieder aufnehmen und Zugang beenden
- Story 1.4: Offene Aufgaben sehen und abhaken
- Story 1.5: Aufgabe vor Ort erfassen
- Story 1.6: Betrieb und Deployment

## Requirements & Constraints

- **Abhaken kostet genau eine Interaktion.** Kein Formular, kein Statusfeld, kein Pflichtkommentar, keine Begründung, kein Bestätigungsdialog. Alles, was diesen Handgriff verteuert, bricht den Kernnutzen.
- **Abhaken ist sofort für alle sichtbar**, es gibt kein privates Erledigen. Wer abgehakt hat, wird gespeichert, erscheint aber in keiner Ansicht und in keinem Text — auch nicht als Titel-Attribut oder Tooltip.
- **Identität kommt ausschliesslich aus dem Einladungslink**, nie aus einer Eingabe. Keine Passwörter, kein Registrierungsvorgang. Nach dem einmaligen Einlösen liegt zwischen Öffnen und Aufgabenliste kein weiterer Schritt und keine wiederkehrende Anmeldung.
- **Einladungstokens liegen nur als SHA-256-Hash** in der Datenbank; der Klartext-Link wird genau einmal angezeigt und ist danach nicht rekonstruierbar. Ein nie existierendes und ein widerrufenes Token führen zur identischen Fehlerseite, ohne Hinweis darauf, welcher Fall vorliegt.
- **Zugang beenden heisst deaktivieren, nicht löschen.** Abgehakte Aufgaben bleiben in der Historie, künftige Dienstwochen erscheinen als unbesetzt.
- **Aufgaben im Pool sind namenlos** — keine Zuständigkeit im Voraus. Namen an allem macht das Werkzeug zum Dienstplan und vertreibt die spontan Kommenden.
- **Kein Aufwand pro Beet oder pro Pflanze.** Bei 40+ Beeten Ausschlusskriterium.
- **Mobile-first**, bedienbar bei 375px Breite, geprüft auch bei 430px. Jedes interaktive Element hat ein Trefferfeld von mindestens 44 × 44 px.
- **Nur online.** Keine Offline-Fähigkeit, auch nicht für das Abhaken; keine lokale Synchronisation, keine Konfliktauflösung.
- **Oberfläche durchgehend Deutsch in Schweizer Rechtschreibung ohne Eszett**, `<html lang="de">`, Du-Form.
- **Pflicht-Umgebungsvariablen** (`DATABASE_PATH`, `SESSION_SECRET`) werfen beim Modulladen, wenn nicht gesetzt — mit klarer Meldung und ohne jeden Fallback-Wert.
- **Qualitätstor:** `npm run build` und `npm run lint` laufen sauber, bevor eine Story fertig ist, plus manuelles Prüfen am 375px-Viewport in Hell und Dunkel. Es gibt bewusst kein Testframework.

## Technical Decisions

**Paradigma.** Geschichteter SSR-Monolith: eine SvelteKit-Anwendung, ein Prozess, eine SQLite-Datei. Abhängigkeiten laufen strikt einwärts — Routen dürfen auf Repository, Auth und Client-Utilities zugreifen, das Repository nur auf Schema und DB-Handle, das Schema auf nichts aus der App. Keine Services, keine Warteschlangen, keine Hintergrundjobs.

**Gepinnter Stack, nicht verhandelbar.** SvelteKit 2.70.3, Svelte 5.56.10, adapter-node 5.5.7, vite-plugin-svelte 7.3.0, **TypeScript 6.0.3 — nicht 7.0.2**, weil SvelteKit, `svelte-check` und `typescript-eslint` alle drei Obergrenzen unter 7 deklarieren. Vite 8.2.2, drizzle-orm 0.45.2, drizzle-kit 0.31.10, better-sqlite3 13.0.3, jose 6.2.10, vite-plugin-pwa 1.3.0, workbox-window 7.4.1, @types/better-sqlite3 9.6.0, ESLint 10.9.1, eslint-plugin-svelte 3.23.0, typescript-eslint 8.68.0, Prettier 3.9.6. Basis-Image **`node:24-alpine` — nicht `node:20`**, weil better-sqlite3 13 `engines: node >=22` verlangt; Node 24 ist der aktuelle LTS. **`argon2` kommt nicht vor** — mit Einladungslinks gibt es keine Passwörter; `jose` signiert allein das Sitzungs-Cookie.

**Bindende Entscheide.**

- Datenzugriff ausschliesslich über benannte Funktionen aus `$lib/server/db/queries/*.ts`. Kein Drizzle-Aufruf und kein `db`-Handle in einer Routendatei; neue Abfragen entstehen im Repository, nie inline.
- Die Datenschicht ist **synchron**: Repository-Funktionen geben Werte direkt zurück, kein `Promise`, kein `async`/`await` unter `src/lib/server/db/`. `WAL` und `foreign_keys` werden beim Start in `db/index.ts` gesetzt, nie in einer Migration.
- `GET /i/<token>` ist der einzige Pfad, der ein Sitzungs-Cookie ausstellt (signiert, `httpOnly`), und die einzige erlaubte Ausnahme von der form-action-Regel. Danach ist die `member_id` aus dem Cookie die einzige Identitätsquelle. Das Token bleibt bis zum Widerruf gültig und mehrfach einlösbar, damit ein Gerätewechsel keinen neuen Link braucht. 32 Byte aus `crypto.randomBytes`, base64url im Link.
- Alle Domänenmutationen sind form actions in `+page.server.ts` mit `<form method="POST">` und `use:enhance`. Keine JSON-Endpunkte, kein Mischen von form actions und Request-Handlern in derselben Route.
- Drei getrennte Tabellen ohne gemeinsame Zuständigkeitsspalte: `tasks` (ohne jede Spalte für einen vorab Zuständigen), `duty_weeks`, `signup_tasks`. Keine Basistabelle, keine Typspalte über alle drei. `members` trägt `name`, `invite_token_hash`, `is_admin`, `is_active`. `tasks.completed_by` und `tasks.completed_at` werden gesetzt, aber nie angezeigt.
- Alle Zeitstempel sind SQLite-Integer in Unix-Sekunden (`Math.floor(Date.now() / 1000)`). Keine ISO-Strings, keine `Date`-Objekte in der Datenbank; Formatierung nur über `src/lib/client/utils/date.ts`.
- Keine Push-Kanäle: Daten kommen ausschliesslich aus `load`-Funktionen, nach jeder Mutation `invalidateAll()`. Kein Polling, kein SSE, kein WebSocket.
- Der Service Worker cacht keine Daten: `vite-plugin-pwa` liefert nur Manifest und Icons, kein `navigateFallback`, keine `runtimeCaching`-Regel auf serverseitig gerenderte Routen. Sonst sieht die Gemeinschaft erledigte Aufgaben als offen.
- Alles unter `/verwaltung` erfordert `members.is_admin = 1`. Mitglieder entstehen ausschliesslich dort — einzige Ausnahme ist das CLI-Skript `scripts/create-admin.ts` für das erste Admin-Mitglied, das den Klartext-Link genau einmal auf der Konsole ausgibt.
- Die Startseite `/` führt genau drei Blöcke in dieser Reihenfolge: Diensthinweis (falls die betrachtende Person diese Woche Dienst hat), freie Einzelaufgaben, offener Aufgaben-Pool. In diesem Epic entsteht nur der dritte Block; die Reihenfolge ist trotzdem jetzt anzulegen, damit Epic 3 nur einsortiert.

**Konventionen.** Komponenten als PascalCase `.svelte` in `src/lib/components/`; Repository-Dateien camelCase nach Domäne (`tasks.ts`, `members.ts`); snake_case im Schema, camelCase in TypeScript über das Drizzle-Mapping; Zeilentypen immer über `$inferSelect`/`$inferInsert`, keine handgeschriebenen Interfaces; `satisfies NewTask` auf `.values({...})`; Importe über `$lib/...`, lokale TypeScript-Dateien mit `.js`-Endung (ESM, `moduleResolution: bundler`); Fehler in Routen über SvelteKits `error(status, { message })`, nie `throw new Error`; Zustand ausschliesslich mit Svelte-5-Runes (`$props`, `$state`, `$derived`, `$effect`) — kein `export let`, kein `$:`, keine Store-Writables; Migrationen über `npm run db:generate`, Migrationsdateien nie von Hand ändern.

**Betrieb.** Docker Compose mit drei Diensten auf einem Infomaniak VPS light: `app` (mehrstufig gebaut, non-root, ohne veröffentlichten Port, nur über das interne Bridge-Netz erreichbar), `nginx` als TLS-Terminierung mit Umleitung auf HTTPS und Ratenbegrenzung auf `/i/`, `certbot`. Die SQLite-Datei liegt in einem Named Volume unter `/data`; `scripts/backup.sh` läuft per Host-Cron um 02:00 über `sqlite3 .backup` und hält 30 Tage. Ein Runbook führt von der leeren Maschine bis zur laufenden Anwendung. Zwei Umgebungen, kein Staging. Falls die nativen Kompilate von better-sqlite3 den VPS überfordern, ist der Ausweg ein lokal gebautes Image über eine Registry — eine Betriebsentscheidung, kein Architekturbruch.

## UX & Interaction Patterns

**Bedienkontext, der alles bestimmt:** eine Person steht im Garten, oft in der Sonne, mit erdigen Händen oder Handschuhen, und hat kein Interesse an der Anwendung, sondern an ihrem Beet. Jede Entscheidung wird gegen diese Szene geprüft, nicht gegen einen Schreibtisch.

**Gestaltungsrahmen.** Alle Farben, Typografie-Rollen, Radien und Abstände kommen als CSS Custom Properties aus dem Design-Spine — acht Farben für Hell, acht für Dunkel, sieben Typografie-Rollen, drei Radien, eine 4px-Skala plus `gutter` (16px), `measure` (600px) und `touch` (44px). In keinem Komponenten-`<style>` steht ein Hex-Wert. Der dunkle Modus ist gleichrangig gestaltet, keine Invertierung: eigener aufgehellter Akzent `#7FBB8C`, Titelleistenschrift `#0E1410`; beide Modi werden in derselben Story geprüft. Kein UI-System, kein Tailwind — Svelte-Komponenten mit `<style>`-Blöcken. Figtree und Inter werden als woff2 aus `static/fonts/` selbst gehostet; keine Anfrage an ein fremdes CDN, weil die Anwendung der Gemeinschaft keine Datenweitergabe verspricht.

**Struktur.** Eine Spalte, maximal 600px, zentriert. `title-bar` über die volle Breite, akzentgefüllt, nur der Produktname `Gemeinschaftsgarten`, ohne Knöpfe und Navigation. `nav-bar` fest am unteren Rand mit genau vier beschrifteten Zielen — Aufgaben · Dienstplan · Wissen · Mehr —, jedes mindestens 44px hoch, Beschriftung als Wort ohne Symbol, aktives Ziel in Akzentfarbe **und** mit 2px-Kante, `padding-bottom: env(safe-area-inset-bottom)`. Ab 600px Fensterbreite wandert die Leiste nach oben; das ist der einzige Umbruchpunkt. Tiefe entsteht ausschliesslich tonal über zwei Ebenen (Grund und Karte) plus Haarlinie — keine Schatten, keine Farbverläufe, keine Pillen-Radien. Kein Zurück-Pfeil: Formularseiten schliessen mit ihrer Aktion und leiten auf die Liste zurück.

**Aufgabenzeile.** Kästchen links, Text rechts. **Nur das Kästchen ist antippbar** — sichtbar 22px, Trefferfeld 44px durch Innenabstand; der Text ist es nicht, weil ein Trefferfeld über die ganze Zeile im Beet versehentlich Aufgaben erledigen würde. Das Kästchen ist ein echtes Formular-Bedienelement mit Beschriftung aus dem Aufgabentext, damit ein Screenreader Text und Erledigen-Aktion vorliest. Ein Antippen erledigt. Danach bleibt die Zeile **an ihrem Platz**, durchgestrichen und gedämpft, Kästchen gefüllt mit Haken; Übergang 140ms, entfällt bei `prefers-reduced-motion`. Sie verschwindet erst beim nächsten Laden — so sieht die Person, dass ihr Tippen angekommen ist, und merkt einen Fehlgriff sofort.

**Knöpfe.** `button-primary` und `button-quiet` über die volle Spaltenbreite, mindestens 44px hoch, höchstens ein primärer pro Seite. Der Knopftext trägt ein Verb und bei Mengen die Zahl. Zerstörende Aktionen nehmen dieselbe Form, aber Text und Umriss in Rot — `Einladung widerrufen` ist der einzige rote Knopf der ganzen Anwendung und eine der zwei erlaubten Bestätigungen.

**Tonfall.** Knöpfe sagen, was passiert (`Ablegen`, `Erledigt`), die Rückmeldung steht im Perfekt desselben Verbs (`Abgelegt.`). Leere Zustände sagen, was gilt: `Nichts offen.` statt `Keine Einträge vorhanden`, darunter der Knopf zum Erfassen. Fehler sagen, was zu tun ist: `Dieser Link gilt nicht mehr. Melde dich in der Gartengruppe.` Zeitangaben in Alltagssprache. Kein Admin-Eintrag auf `/mehr` für Nicht-Admins, und ein Direktaufruf von `/verwaltung` führt auf `/` — kein Fehler.

**Barrierefreiheits-Boden.** Trefferfelder ≥44px; Kontrast 4.5:1 für Text und 3:1 für Bedienelement-Umrisse, geprüft in Hell **und** Dunkel; kein Zustand hängt allein an der Farbe; sichtbarer Tastaturfokus auf allem Bedienbaren, Fokusreihenfolge folgt der Leserichtung; Schriftgrösse nie unter 12px und gelesener Text nie unter 16px, alle Grössen in `rem`.

**Ausdrücklich nicht bauen.** Fortschrittsbalken, Serien, Abzeichen, Ranglisten, Zählungen erledigter Aufgaben, Wischgesten, Push-Benachrichtigungen, Illustrationen, Fotos, Maskottchen, Bestätigungsdialog beim Abhaken, Symbole ohne Beschriftung, unendliches Nachladen, modale Dialoge ausserhalb der zwei genannten Bestätigungen. Jede Zählung würde das Abhaken zu einer Leistung machen und damit sozial teuer — das Gegenteil des Zwecks.

## Cross-Story Dependencies

- **Story 1.1 ist die Voraussetzung für alles.** Sie legt Projektskelett, Datenbankverbindung, Migrationskette, Tokens, Schriften, Titel- und Navigationsleiste sowie den leeren Zustand an, legt aber keine Domänentabelle. Ohne sie hat keine weitere Story Boden.
- **Story 1.2 legt `members` an** und liefert Cookie, Zugangserzwingung und das CLI-Skript für das erste Admin-Mitglied. Story 1.3 baut darauf auf, ohne eine neue Tabelle anzulegen, und die Fehlerseite für ungültige Links entsteht in 1.2 und wird von 1.3 mitbenutzt.
- **Story 1.4 legt `tasks` an**; Story 1.5 nutzt dieselbe Tabelle und bringt zusätzlich den Knopf `+ Aufgabe` auf `/` — vorher ist der leere Zustand aus 1.1 ohne Knopf.
- **Story 1.6 hat keine Codeabhängigkeit nach oben**, wird aber erst sinnvoll, wenn 1.1 bis 1.5 stehen, und muss die Pflicht-Umgebungsvariablen aus 1.1 bedienen.
- **Nach aussen:** Epic 1 steht allein und liefert vollständigen Nutzen. Epic 2, 3 und 4 bauen darauf auf, hängen aber nicht voneinander ab. Epic 2 fasst `queries/tasks.ts` und die Listenansicht aus 1.4 nochmals an (`due_at`, Überfälligkeit) — eine bewusst akzeptierte Überlappung. Epic 3 sortiert Diensthinweis und freie Einzelaufgaben in die von 1.4 angelegte Blockreihenfolge auf `/` ein.
