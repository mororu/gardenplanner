# Epic 1 Context: Die Gemeinschaft kommt rein und sieht, was zu tun ist

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Alle rund zwanzig Gärtner\*innen erreichen die Anwendung über ihren persönlichen Einladungslink auf dem Handy, sehen beim Öffnen sofort die offenen Aufgaben, haken mit einem Griff ab und erfassen selbst neue. Weil kein Projektskelett existiert — keine `package.json`, kein SvelteKit-Gerüst, keine Datenbank, keine Tokens, keine Schriften —, legt dieses Epic zusätzlich Fundament und Gestaltungsrahmen, und es bringt die Anwendung auf den Server: eine Anwendung auf einem Entwicklerrechner hakt niemand ab. Danach ist die tragende Produktannahme testbar, ob zwanzig Freiwillige tatsächlich abhaken — das gesamte Adoptionsrisiko sitzt hier.

## Stories

- Story 1.1: Gerüst und Gestaltungsrahmen
- Story 1.2: Einladungslink einlösen und angemeldet bleiben
- Story 1.3: Mitglieder aufnehmen und Zugang beenden
- Story 1.4: Offene Aufgaben sehen und abhaken
- Story 1.5: Aufgabe vor Ort erfassen
- Story 1.6: Betrieb und Deployment

## Requirements & Constraints

- **Abhaken kostet genau eine Interaktion.** Kein Formular, kein Statusfeld, kein Pflichtkommentar, keine Begründung, kein Bestätigungsdialog.
- Abhaken ist sofort für alle sichtbar; es gibt kein privates Erledigen. **Wer abgehakt hat, wird gespeichert, erscheint aber in keiner Ansicht und in keinem Text** — auch nicht als Titel-Attribut.
- **Identität kommt ausschliesslich aus dem Einladungslink**, nie aus einer Eingabe. Keine Passwörter, kein Registrierungsvorgang. Nach dem einmaligen Einlösen liegt zwischen Öffnen und Liste kein weiterer Schritt und keine wiederkehrende Anmeldung.
- Tokens liegen nur als SHA-256-Hash in der Datenbank; der Klartext-Link wird genau einmal angezeigt. Ein nie existierendes und ein widerrufenes Token führen zur identischen Fehlerseite, ohne Hinweis auf den Fall.
- Zugang beenden heisst deaktivieren, nicht löschen: abgehakte Aufgaben bleiben in der Historie, künftige Dienstwochen erscheinen als unbesetzt.
- Aufgaben im Pool sind namenlos, ohne Zuständigkeit im Voraus. Namen an allem macht das Werkzeug zum Dienstplan und vertreibt die spontan Kommenden.
- Kein Aufwand pro Beet oder pro Pflanze — bei 40+ Beeten Ausschlusskriterium.
- Mobile-first, bedienbar bei 375px (geprüft auch bei 430px), Trefferfelder mindestens 44 × 44 px.
- Nur online. Keine Offline-Fähigkeit, auch nicht für das Abhaken, keine lokale Synchronisation, keine Konfliktauflösung.
- Oberfläche durchgehend Deutsch in Schweizer Rechtschreibung ohne Eszett, `<html lang="de">`, Du-Form.
- `DATABASE_PATH` und `SESSION_SECRET` werfen beim Modulladen mit klarer Meldung, wenn nicht gesetzt — nie ein Fallback-Wert.
- Qualitätstor: `npm run build` und `npm run lint` sauber, plus manuelles Prüfen am 375px-Viewport in Hell und Dunkel. Es gibt bewusst kein Testframework.

## Technical Decisions

**Paradigma.** Geschichteter SSR-Monolith: eine SvelteKit-Anwendung, ein Prozess, eine SQLite-Datei. Abhängigkeiten laufen strikt einwärts — Routen auf Repository, Auth und Client-Utilities; Repository auf Schema und DB-Handle; Schema auf nichts. Keine Services, Warteschlangen oder Hintergrundjobs.

**Gepinnter Stack, nicht verhandelbar.** SvelteKit 2.70.3, Svelte 5.56.10, adapter-node 5.5.7, vite-plugin-svelte 7.3.0, **TypeScript 6.0.3 — nicht 7.0.2**, weil SvelteKit, `svelte-check` und `typescript-eslint` alle drei Obergrenzen unter 7 deklarieren. Vite 8.2.2, drizzle-orm 0.45.2, drizzle-kit 0.31.10, better-sqlite3 13.0.3, jose 6.2.10, vite-plugin-pwa 1.3.0, workbox-window 7.4.1, @types/better-sqlite3 9.6.0, ESLint 10.9.1, eslint-plugin-svelte 3.23.0, typescript-eslint 8.68.0, Prettier 3.9.6. Basis-Image **`node:24-alpine` — nicht `node:20`**, weil better-sqlite3 13 `engines: node >=22` verlangt. **`argon2` kommt nicht vor** — mit Einladungslinks gibt es keine Passwörter; `jose` signiert allein das Sitzungs-Cookie.

**Bindende Entscheide.**

- Datenzugriff ausschliesslich über benannte Funktionen aus `$lib/server/db/queries/*.ts`. Kein Drizzle-Aufruf und kein `db`-Handle in einer Routendatei; neue Abfragen entstehen im Repository, nie inline.
- Die Datenschicht ist **synchron**: Repository-Funktionen geben Werte direkt zurück, kein `Promise`, kein `async`/`await` unter `src/lib/server/db/`. `WAL` und `foreign_keys` setzt der Start in `db/index.ts`, nie eine Migration.
- `GET /i/<token>` ist der einzige Pfad, der ein Cookie ausstellt (signiert, `httpOnly`), und die einzige Ausnahme von der form-action-Regel. Danach ist die `member_id` aus dem Cookie die einzige Identitätsquelle. Das Token bleibt bis zum Widerruf gültig und mehrfach einlösbar, damit ein Gerätewechsel keinen neuen Link braucht: 32 Byte aus `crypto.randomBytes`, base64url im Link.
- Alle Domänenmutationen sind form actions in `+page.server.ts` mit `use:enhance`. Keine JSON-Endpunkte, kein Mischen von form actions und Request-Handlern in einer Route.
- Drei getrennte Tabellen ohne gemeinsame Zuständigkeitsspalte: `tasks` (ohne jede Spalte für einen vorab Zuständigen), `duty_weeks`, `signup_tasks`. Keine Basistabelle, keine Typspalte darüber. `members` trägt `name`, `invite_token_hash`, `is_admin`, `is_active`. `tasks.completed_by` und `completed_at` werden gesetzt, aber nie angezeigt.
- Zeitstempel sind SQLite-Integer in Unix-Sekunden (`Math.floor(Date.now() / 1000)`); keine ISO-Strings, keine `Date`-Objekte in der Datenbank, Formatierung nur über `src/lib/client/utils/date.ts`.
- Keine Push-Kanäle: Daten kommen nur aus `load`-Funktionen, nach jeder Mutation `invalidateAll()`. Kein Polling, kein SSE, kein WebSocket.
- Der Service Worker cacht keine Daten: `vite-plugin-pwa` liefert nur Manifest und Icons, kein `navigateFallback`, keine `runtimeCaching`-Regel auf serverseitig gerenderte Routen — sonst sieht die Gemeinschaft Erledigtes als offen.
- Alles unter `/verwaltung` erfordert `is_admin = 1`. Mitglieder entstehen ausschliesslich dort; einzige Ausnahme ist `scripts/create-admin.ts` für das erste Admin-Mitglied, das den Klartext-Link genau einmal auf der Konsole ausgibt.
- Die Startseite `/` führt genau drei Blöcke in dieser Reihenfolge: Diensthinweis, freie Einzelaufgaben, offener Pool. Dieses Epic baut nur den dritten; die Reihenfolge ist trotzdem jetzt anzulegen.

**Konventionen.** PascalCase-Komponenten in `src/lib/components/`; Repository-Dateien camelCase nach Domäne (`tasks.ts`, `members.ts`); snake_case im Schema, camelCase in TypeScript über das Drizzle-Mapping; Zeilentypen über `$inferSelect`/`$inferInsert`, keine handgeschriebenen Interfaces; `satisfies NewTask` auf `.values({...})`; Importe über `$lib/...`, lokale TypeScript-Dateien mit `.js`-Endung (ESM, `moduleResolution: bundler`); Fehler in Routen über `error(status, { message })`, nie `throw new Error`; Zustand nur mit Svelte-5-Runes — kein `export let`, kein `$:`, keine Store-Writables; Migrationen über `npm run db:generate`, Migrationsdateien nie von Hand ändern.

**Betrieb.** Docker Compose mit drei Diensten auf einem Infomaniak VPS light: `app` (mehrstufig gebaut, non-root, ohne veröffentlichten Port, nur im internen Bridge-Netz), `nginx` als TLS-Terminierung mit HTTPS-Umleitung und Ratenbegrenzung auf `/i/`, `certbot`. Die SQLite-Datei liegt in einem Named Volume unter `/data`; `scripts/backup.sh` läuft per Host-Cron um 02:00 über `sqlite3 .backup` und hält 30 Tage. Ein Runbook führt von der leeren Maschine bis zur laufenden Anwendung. Zwei Umgebungen, kein Staging. Überfordern die nativen Kompilate von better-sqlite3 den VPS, ist der Ausweg ein lokal gebautes Image über eine Registry — Betriebsentscheidung, kein Architekturbruch.

## UX & Interaction Patterns

**Bedienkontext, der alles bestimmt:** eine Person steht im Garten, oft in der Sonne, mit erdigen Händen oder Handschuhen, und interessiert sich für ihr Beet, nicht für die Anwendung. Jede Entscheidung wird gegen diese Szene geprüft.

**Gestaltungsrahmen.** Farben, Typografie-Rollen, Radien und Abstände kommen als CSS Custom Properties aus dem Design-Spine: 8 Farben hell, 8 dunkel, 7 Typografie-Rollen, 3 Radien, 4px-Skala plus `gutter` 16px, `measure` 600px, `touch` 44px. Kein Hex-Wert in einem Komponenten-`<style>`. Der dunkle Modus ist gleichrangig gestaltet, keine Invertierung: aufgehellter Akzent `#7FBB8C`, Titelleistenschrift `#0E1410`; beide Modi in derselben Story prüfen. Kein UI-System, kein Tailwind — Svelte-Komponenten mit `<style>`. Figtree und Inter selbst gehostet als woff2 aus `static/fonts/`, keine Anfrage an ein fremdes CDN, weil die Anwendung keine Datenweitergabe an Dritte verspricht.

**Struktur.** Eine Spalte, maximal 600px, zentriert. `title-bar` volle Breite, akzentgefüllt, nur der Produktname, ohne Knöpfe und Navigation. `nav-bar` fest am unteren Rand mit vier beschrifteten Zielen (Aufgaben · Dienstplan · Wissen · Mehr), jedes mindestens 44px hoch, Wort statt Symbol, aktives Ziel in Akzentfarbe **und** mit 2px-Kante, `padding-bottom: env(safe-area-inset-bottom)`; ab 600px Fensterbreite wandert die Leiste nach oben — der einzige Umbruchpunkt. Tiefe entsteht nur tonal über zwei Ebenen plus Haarlinie: keine Schatten, keine Farbverläufe, keine Pillen-Radien. Kein Zurück-Pfeil; Formularseiten schliessen mit ihrer Aktion und leiten auf die Liste zurück.

**Aufgabenzeile.** Kästchen links, Text rechts. **Nur das Kästchen ist antippbar** — sichtbar 22px, Trefferfeld 44px durch Innenabstand; ein Trefferfeld über die ganze Zeile würde im Beet versehentlich Aufgaben erledigen. Das Kästchen ist ein echtes Formular-Bedienelement mit Beschriftung aus dem Aufgabentext, damit ein Screenreader Text und Erledigen-Aktion vorliest. Ein Antippen erledigt; die Zeile bleibt **an ihrem Platz**, durchgestrichen und gedämpft, Kästchen gefüllt mit Haken, Übergang 140ms und entfällt bei `prefers-reduced-motion`. Sie verschwindet erst beim nächsten Laden — so ist ein Fehlgriff sofort sichtbar.

**Knöpfe und Tonfall.** `button-primary` und `button-quiet` über die volle Spaltenbreite, mindestens 44px hoch, höchstens ein primärer pro Seite, Knopftext mit Verb und bei Mengen der Zahl. Zerstörendes nimmt dieselbe Form in Rot: `Einladung widerrufen` ist der einzige rote Knopf der Anwendung und eine der beiden erlaubten Bestätigungen. Rückmeldung im Perfekt desselben Verbs (`Ablegen` → `Abgelegt.`). Leere Zustände sagen, was gilt: `Nichts offen.`, darunter der Erfassen-Knopf. Fehler sagen, was zu tun ist: `Dieser Link gilt nicht mehr. Melde dich in der Gartengruppe.` Zeitangaben in Alltagssprache. Für Nicht-Admins fehlt der Verwaltungs-Eintrag auf `/mehr` ganz, ein Direktaufruf führt auf `/` — kein Fehler.

**Barrierefreiheits-Boden.** Trefferfelder ≥44px; Kontrast 4.5:1 für Text und 3:1 für Bedienelement-Umrisse, geprüft in Hell **und** Dunkel; kein Zustand hängt allein an der Farbe; sichtbarer Tastaturfokus auf allem Bedienbaren, Fokusreihenfolge folgt der Leserichtung; nie unter 12px, gelesener Text nie unter 16px, alle Grössen in `rem`.

**Ausdrücklich nicht bauen.** Fortschrittsbalken, Serien, Abzeichen, Ranglisten, Zählungen erledigter Aufgaben, Wischgesten, Push-Benachrichtigungen, Illustrationen, Fotos, Maskottchen, Bestätigungsdialog beim Abhaken, Symbole ohne Beschriftung, unendliches Nachladen, modale Dialoge ausser den zwei genannten Bestätigungen. Jede Zählung macht Abhaken zu einer Leistung und damit sozial teuer — das Gegenteil des Zwecks.

## Cross-Story Dependencies

- **Story 1.1 ist Voraussetzung für alles:** Skelett, Datenbankverbindung, Migrationskette, Tokens, Schriften, Titel- und Navigationsleiste, leerer Zustand. Legt keine Domänentabelle an.
- **Story 1.2 legt `members` an** und liefert Cookie, Zugangserzwingung sowie das CLI-Skript für das erste Admin-Mitglied. Story 1.3 baut darauf auf, ohne neue Tabelle, und nutzt die in 1.2 entstandene Fehlerseite mit.
- **Story 1.4 legt `tasks` an;** Story 1.5 nutzt dieselbe Tabelle und bringt den Knopf `+ Aufgabe` auf `/` — vorher ist der leere Zustand aus 1.1 ohne Knopf.
- **Story 1.6** hat keine Codeabhängigkeit nach oben, wird aber erst mit 1.1 bis 1.5 sinnvoll und muss die Pflicht-Umgebungsvariablen aus 1.1 bedienen.
- **Nach aussen:** Epic 1 steht allein und liefert vollständigen Nutzen. Epic 2 fasst `queries/tasks.ts` und die Listenansicht aus 1.4 nochmals an (`due_at`, Überfälligkeit) — bewusst akzeptierte Überlappung. Epic 3 sortiert Diensthinweis und freie Einzelaufgaben in die von 1.4 angelegte Blockreihenfolge auf `/` ein. Epic 2, 3 und 4 hängen nicht voneinander ab.
