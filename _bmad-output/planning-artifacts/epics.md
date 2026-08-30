---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - '_bmad-output/specs/spec-gartengemeinschaft-koordination/SPEC.md'
  - '_bmad-output/specs/spec-gartengemeinschaft-koordination/scope-priorities.md'
  - '_bmad-output/specs/spec-gartengemeinschaft-koordination/stories.yaml'
  - '_bmad-output/planning-artifacts/architecture/architecture-Gartenplaner-2026-08-26/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-Gartenplaner-2026-08-26/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-Gartenplaner-2026-08-26/EXPERIENCE.md'
---

# Gemeinschaftsgarten - Epic Breakdown

## Overview

Dieses Dokument enthält die Epic- und Story-Aufteilung für **Gemeinschaftsgarten**, das Koordinationswerkzeug der Gartengemeinschaft. Es zerlegt die Anforderungen aus SPEC, Architektur-Spine und den beiden UX-Spines in implementierbare Stories.

Der Story-Schnitt aus `stories.yaml` (7 Stories) ist abgesegnet und wird nicht neu verhandelt. Diese Datei bringt ihn in das Format, das `sprint_plan.py` parst, und ergänzt die Stories, die aus Architektur und UX neu hinzukommen.

## Requirements Inventory

### Functional Requirements

FR1: Jede\*r Gärtner\*in sieht die aktuell offenen Aufgaben als Liste, ohne Zwischenschritt zwischen Öffnen und Liste. (CAP-1)
FR2: Eine offene Aufgabe wird mit genau einer Interaktion und ohne Eingabe als erledigt markiert und ist danach für alle anderen aus der offenen Liste verschwunden, sobald diese laden. (CAP-2)
FR3: Wer im Garten etwas entdeckt, erfasst vor Ort eine einzelne Aufgabe, ohne den Monatsplan anzufassen. (CAP-4)
FR4: Die planende Person legt einen Monatsplan von 20–40 Aufgaben in einer Sitzung ab, mit einem gemeinsamen Fälligkeitsdatum für den ganzen Stapel. (CAP-3)
FR5: Offene Aufgaben verfallen nie; nach drei Wochen ohne Erledigung werden sie sichtbar als überfällig gekennzeichnet. (Constraint, AD-8)
FR6: Wochenweise Dienste sind bis drei Monate im Voraus namentlich zugeteilt, genau eine zuständige Person pro Dienstwoche. (CAP-5)
FR7: Die betrachtende Person erkennt auf der Startseite ohne Suchen, dass ihre Dienstwoche läuft. (CAP-5, AD-14)
FR8: Ein in einer Dienstwoche zugeteilter Name wird durch einen anderen ersetzt. (CAP-5)
FR9: Eine unregelmässig anfallende verbindliche Einzelaufgabe wird mit Titel und Termin ausgeschrieben. (CAP-6)
FR10: Eine ausgeschriebene Einzelaufgabe wird von einer Person verbindlich übernommen; jederzeit ist sichtbar, ob sie übernommen ist und von wem. (CAP-6)
FR11: Nachschlagewissen wird als freies Textblatt angelegt, gelesen und geändert; die Blätter gelten unabhängig von einzelnen Beeten. (CAP-7)
FR12: Die Verwaltung nimmt eine Person auf und erzeugt dabei deren persönlichen Einladungslink. (CAP-8)
FR13: Der Einladungslink wird eingelöst und stellt die Sitzung her; danach ist der Link für weitere Geräte derselben Person weiterhin gültig. (CAP-8, AD-3, AD-10)
FR14: Die Verwaltung beendet den Zugang einer Person; deren abgehakte Aufgaben bleiben in der Historie, künftige Dienstwochen erscheinen als unbesetzt. (CAP-8, AD-11)

### NonFunctional Requirements

NFR1: Erledigen kostet genau eine Interaktion — kein Formular, kein Statusfeld, kein Pflichtkommentar, keine Begründung, kein Bestätigungsdialog.
NFR2: Kein Aufwand, der pro Beet oder pro Pflanze anfällt. Ausschlusskriterium bei 40+ Beeten.
NFR3: Das Ablegen des Monatsplans erzeugt netto keinen Mehraufwand gegenüber Papier oder Chat.
NFR4: Nach dem einmaligen Einlösen des Einladungslinks liegt zwischen Öffnen und Aufgabenliste kein weiterer Schritt; keine wiederkehrende Anmeldung.
NFR5: Mobile-first. Bedienbar bei 375px Breite; jedes interaktive Element hat ein Trefferfeld von mindestens 44 × 44 px.
NFR6: Nur online. Keine Offline-Fähigkeit, auch nicht für das Abhaken; keine lokale Synchronisation, keine Konfliktauflösung.
NFR7: Abhaken ist sofort für alle sichtbar. Es gibt kein privates Erledigen.
NFR8: Wer abgehakt hat, wird gespeichert, erscheint aber in keiner Ansicht und in keinem Text — auch nicht als Tooltip.
NFR9: Kontrast mindestens 4.5:1 für Text und 3:1 für Bedienelement-Umrisse, in Hell **und** Dunkel.
NFR10: Oberfläche durchgehend Deutsch in Schweizer Rechtschreibung ohne Eszett, `<html lang="de">`.
NFR11: Pflicht-Umgebungsvariablen (`DATABASE_PATH`, `SESSION_SECRET`, `ORIGIN`) werfen beim **Start des Servers**, wenn nicht gesetzt oder untauglich. Kein Fallback-Standardwert.
NFR12: Einladungstokens liegen ausschliesslich als SHA-256-Hash in der Datenbank; der Klartext-Link ist nach dem einmaligen Anzeigen nicht rekonstruierbar.
NFR13: `npm run build` und `npm run lint` laufen sauber, bevor eine Story fertig ist. Es gibt kein Testframework (bewusst, siehe Architektur-Spine unter Deferred).

### Additional Requirements

**🚨 Kein Starter-Template — aber ein Referenzprojekt.** Die Architektur-Spine schreibt keinen Greenfield-Starter vor, sondern übernimmt die erprobte Struktur von `beehiveJournal`. Es existiert **kein Projektskelett**: keine `package.json`, kein SvelteKit-Gerüst, keine Datenbankverbindung, keine Migrationen, keine Schrift-Dateien, keine Token-Definitionen. **Epic 1 Story 1 muss das Skelett sein**, sonst hat Story „Zugang und Mitgliederverwaltung" keinen Boden.

- Stack ist gepinnt und live gegen die npm-Registry geprüft: SvelteKit 2.70.3, Svelte 5.56.10, adapter-node 5.5.7, vite-plugin-svelte 7.3.0, TypeScript **6.0.3** (nicht 7.0.2 — ausserhalb der Peer-Ranges von SvelteKit, svelte-check und typescript-eslint), Vite 8.2.2, drizzle-orm 0.45.2, drizzle-kit 0.31.10, better-sqlite3 13.0.3, jose 6.2.10, @types/better-sqlite3 9.6.0, ESLint 10.9.1, eslint-plugin-svelte 3.23.0, typescript-eslint 8.68.0, Prettier 3.9.6.
- Basis-Image `node:24-alpine`. Node 20 der Referenz genügt nicht: better-sqlite3 13 verlangt `engines: node >=22`. Node 24 „Krypton" ist der aktuelle LTS.
- `argon2` entfällt vollständig — mit Einladungslinks gibt es keine Passwörter. `jose` bleibt für das signierte Sitzungs-Cookie.
- Datenzugriff ausschliesslich über `$lib/server/db/queries/*.ts`; kein Drizzle-Aufruf in einer Routendatei (AD-1).
- Die Datenschicht ist synchron: Repository-Funktionen geben Werte direkt zurück, kein `async`/`await` in `src/lib/server/db/` (AD-2).
- Drei getrennte Tabellen ohne gemeinsame Zuständigkeitsspalte: `tasks`, `duty_weeks`, `signup_tasks` (AD-4).
- Alle Zeitstempel sind Unix-Sekunden als SQLite-Integer (AD-6).
- Keine Push-Kanäle: Daten kommen nur aus `load`-Funktionen, nach jeder Mutation `invalidateAll()` (AD-7).
- Überfälligkeit ist abgeleitet, nicht gespeichert: `COALESCE(due_at, created_at)`, keine Spalte, kein Job (AD-8).
- Mutationen ausschliesslich als form actions in `+page.server.ts` mit `use:enhance`; einzige Ausnahme `GET /i/<token>` (AD-9).
- **Betrieb und Deployment sind in keiner Story abgedeckt:** Docker Compose mit drei Services (app nie öffentlich exponiert, nginx als TLS-Terminierung, certbot), Named Volume für die SQLite-Datei, Multi-Stage Dockerfile mit non-root User, WAL-sicheres `backup.sh` per Host-Cron, Ratenbegrenzung auf `/i/`, Runbook. Ziel ist ein Infomaniak VPS light.
- Offener Betriebspunkt: falls die nativen Kompilate von better-sqlite3 den VPS light überfordern, ist der Ausweg ein lokal gebautes Image über eine Registry.

### UX Design Requirements

UX-DR1: Design-Tokens als CSS Custom Properties anlegen — 8 Farben für Hell und 8 für Dunkel, 7 Typografie-Rollen, 3 Radien, die 4px-Abstandsskala plus `gutter`, `measure` und `touch`. Werte aus `DESIGN.md` Frontmatter, keine Hex-Werte in Komponenten-`<style>`.
UX-DR2: Dunkler Modus gleichrangig umsetzen, nicht invertiert: eigene Token-Werte, aufgehellter Akzent `#7FBB8C`, Titelleistenschrift `#0E1410`. Beide Modi in derselben Story prüfen.
UX-DR3: Schriften Figtree und Inter selbst hosten, gebündelt aus den npm-Paketen `@fontsource-variable/*`. Kein Laden von Googles CDN — die Anwendung verspricht der Gemeinschaft keine Datenweitergabe an Dritte.
UX-DR4: Komponente `title-bar` — volle Breite, Akzent gefüllt, Produktname in `section`-Typografie, ohne Knöpfe und ohne Navigation.
UX-DR5: Komponente `nav-bar` — fest am unteren Rand, vier Ziele (Aufgaben · Dienstplan · Wissen · Mehr), Beschriftung als Wort ohne Symbol, aktives Ziel in Akzentfarbe **und** mit 2px-Kante, `padding-bottom: env(safe-area-inset-bottom)`. Ab 600px Fensterbreite wandert die Leiste nach oben.
UX-DR6: Komponente `task-row` mit `task-box` — nur das Kästchen ist antippbar (sichtbar 22px, Trefferfeld 44px), der Text nicht. Das Kästchen ist ein echtes Formular-Bedienelement mit Beschriftung aus dem Aufgabentext.
UX-DR7: Zustand „in dieser Sitzung erledigt" — die Zeile bleibt an ihrem Platz, durchgestrichen und gedämpft, Kästchen gefüllt mit Haken; Übergang 140ms, entfällt bei `prefers-reduced-motion`. Sie verschwindet erst beim nächsten Laden.
UX-DR8: Zustand „überfällig" — zweite Textzeile `seit N Wochen überfällig` in Lehmbraun. Der Text ist Pflicht; kein Zustand hängt allein an der Farbe. Lehmbraun, nicht Rot: Rot ist ausschliesslich für Zerstörendes reserviert.
UX-DR9: Komponente `duty-banner` — nur vorhanden, wenn die betrachtende Person diese Woche Dienst hat; 3px linke Kante in Akzentfarbe, nicht abhakbar, nicht schliessbar, verlinkt auf den Dienstplan.
UX-DR10: Komponenten `button-primary` und `button-quiet` — volle Spaltenbreite, mindestens 44px hoch, höchstens ein primärer pro Seite, Knopftext trägt ein Verb und bei Mengen die Zahl (`25 Aufgaben ablegen`). Zerstörende Aktionen in derselben Form, aber Text und Umriss in Rot.
UX-DR11: Massen-Eingabe des Monatsplans in zwei Schritten — Schritt 1: Datumsfeld `Fällig bis` (vorbelegt Monatsende) plus `textarea-bulk` mit mindestens 16em Höhe, eine Aufgabe pro Zeile, mitlaufende Zählung `N Aufgaben erkannt`, leere Zeilen zählen nicht. Schritt 2: erkannte Zeilen als Liste, jede mit `×` zum Entfernen, kein Bearbeiten pro Zeile.
UX-DR12: Leere Zustände und Fehlertexte nach den Tonfall-Regeln — `Nichts offen.` statt `Keine Einträge vorhanden`; `Dieser Link gilt nicht mehr. Melde dich in der Gartengruppe.` ohne Hinweis darauf, ob das Token je existierte; Rückmeldung im Perfekt desselben Verbs wie der Knopf.
UX-DR13: Barrierefreiheits-Boden — Trefferfelder ≥44px, Kontrast geprüft in beiden Modi, kein Zustand nur über Farbe, sichtbarer Tastaturfokus auf allem Bedienbaren, Leserichtung als Fokusreihenfolge, Schriftgrösse nie unter 12px und gelesener Text nie unter 16px, alle Grössen in `rem`.
UX-DR14: Keine Schatten und keine Pillen-Radien. Tiefe entsteht ausschliesslich tonal über zwei Ebenen (Grund und Karte) plus Haarlinie.
UX-DR15: Ausdrücklich nicht bauen — Fortschrittsbalken, Serien, Abzeichen, Ranglisten, Zählungen erledigter Aufgaben, Wischgesten, Push-Benachrichtigungen, Illustrationen, Maskottchen, Bestätigungsdialog beim Abhaken, Symbole ohne Beschriftung, unendliches Nachladen.
UX-DR16: Acht Oberflächen gemäss Informationsarchitektur — `/`, `/aufgabe`, `/dienstplan`, `/wissen`, `/mehr`, `/monatsplan`, `/einzelaufgaben/neu`, `/verwaltung`. Seltene Handlungen liegen hinter `/mehr`; `/verwaltung` erscheint dort nur für Admins.

### FR Coverage Map

### FR Coverage Map

FR1: Epic 1 — Offene Aufgaben als Liste sehen
FR2: Epic 1 — Aufgabe mit einer Interaktion abhaken
FR3: Epic 1 — Einzelne Aufgabe vor Ort erfassen
FR4: Epic 2 — Monatsplan als Stapel ablegen
FR5: Epic 2 — Überfällige Aufgaben kennzeichnen, ohne sie verfallen zu lassen
FR6: Epic 3 — Dienstplan namentlich, drei Monate im Voraus
FR7: Epic 3 — Laufende Dienstwoche auf der Startseite
FR8: Epic 3 — Namen in einer Dienstwoche ersetzen
FR9: Epic 3 — Verbindliche Einzelaufgabe ausschreiben
FR10: Epic 3 — Einzelaufgabe verbindlich übernehmen
FR11: Epic 4 — Referenz-Sheets anlegen, lesen, ändern
FR12: Epic 1 — Mitglied aufnehmen und Einladungslink erzeugen
FR13: Epic 1 — Einladungslink einlösen und Sitzung herstellen
FR14: Epic 1 — Zugang beenden, Historie erhalten

Alle 14 funktionalen Anforderungen sind einem Epic zugeordnet. Keine Waise.

> **Nachgezogen am 2026-08-30**, Plan-Ist-Abgleich aus den Retrospektiven Epic 1 (B6, B7, B9) und Epic 3 (A1, A2). Vier Stellen in diesem Dokument beschrieben etwas anderes, als gebaut wurde: die zwei PWA-Pakete waren nie installiert (siehe AD-12), die Pflichtvariablen werfen beim **Start** und nicht beim Modulladen und es sind **drei** statt zwei, und die Schriften kommen als npm-Bündel statt als `woff2` aus `static/fonts/`. Die Zusage von UX-DR3 — kein fremder Host — hält unverändert und ist am Produktionsstapel geprüft. Der vollständige Abgleich steht in `ARCHITECTURE-SPINE.md`.

## Epic List

### Epic 1: Die Gemeinschaft kommt rein und sieht, was zu tun ist

Alle 20 Gärtner\*innen erreichen die Anwendung über ihren persönlichen Einladungslink auf dem Handy, sehen die offenen Aufgaben, haken ab und erfassen selbst neue. Nach diesem Epic ist die tragende Annahme des Produkts testbar: ob eine Gruppe von zwanzig Freiwilligen tatsächlich abhakt.
**FRs covered:** FR1, FR2, FR3, FR12, FR13, FR14

*Implementierungshinweise:* Enthält das Projektskelett (es existiert kein Starter und kein Code) und den Gestaltungsrahmen aus UX-DR1 bis UX-DR5 und UX-DR14. Das Deployment gehört in dieses Epic, weil der Nutzen ohne es nicht existiert — eine Anwendung auf einem Entwicklerrechner hakt niemand ab. Bindende Architekturentscheide: AD-1, AD-2, AD-3, AD-5, AD-6, AD-9, AD-10, AD-11, AD-12, AD-13, AD-14.

### Epic 2: Der Monatsplan landet in der Liste

Die monatlich wechselnde planende Person legt ihren Plan in einem Zug ab, statt ihn auf Papier oder in den Chat zu schreiben. Liegengebliebenes fällt beim Draufschauen auf, ohne zu verschwinden.
**FRs covered:** FR4, FR5

*Implementierungshinweise:* Die zweischrittige Massen-Eingabe aus UX-DR11 ist der Kern; die Messlatte ist NFR3 (nicht aufwendiger als Papier). Überfälligkeit ist abgeleitet, nicht gespeichert (AD-8), Schwelle drei Wochen, Darstellung nach UX-DR8 in Lehmbraun mit Pflichttext. Fasst `queries/tasks.ts` und die Listenansicht aus Epic 1 nochmals an — begrenzte, bewusst akzeptierte Überlappung, weil es eine neue Oberfläche für eine andere Person ist.

### Epic 3: Verbindlichkeit ohne Nachfragen

Tränkedienst und Setzlingsabholung sind namentlich verbindlich geregelt. Die Umfrage im Gruppenchat entfällt, und niemand muss mehr jemanden bitten.
**FRs covered:** FR6, FR7, FR8, FR9, FR10

*Implementierungshinweise:* Zwei getrennte Entitäten mit unterschiedlicher Verbindlichkeit (AD-4): `duty_weeks` mit genau einer Person pro Woche, `signup_tasks` mit null oder einer. Der Diensthinweis auf der Startseite folgt UX-DR9 und der Blockreihenfolge aus AD-14. Ein Tausch ist ein Ersetzen des Namens, keine Verhandlung im System.

*Vorarbeit, aufgesetzt am 2026-08-28:* **Story 3.0 läuft vor Story 3.1** und gehört fachlich zu keinem Epic — sie ist Stufe A des vierstufigen Vorschlags aus `deferred-work.md` (Eintrag 15), war dort schon „als eigene Story vor Epic 2" empfohlen und ist seither offen. Sie legt ein zweites Prüfskript an, das die gebaute Anwendung auf einem freien Port misst statt SvelteKit nachzustellen, und schliesst damit vier Posten auf einmal. Der Nutzen ist am grössten, wenn sie **vor** den zwei Stories dieses Epics steht: jede von ihnen bekommt die Abdeckung geschenkt.

*Vorbedingung, entschieden am 2026-08-28:* Mit Story 3.1 verlässt der Mitgliedsname die Mitgliederliste und steht im Dienstplan vor allen, jede Woche, drei Monate im Voraus. Das bisher bewusst fehlende **Umbenennen** (siehe `deferred-work.md`, Eintrag 11) ist damit nicht mehr tragbar: der einzige Korrekturweg — Zugang beenden und neu aufnehmen — nähme der Person zugleich ihre künftigen Dienstwochen, die dann auf `— unbesetzt —` fallen. Vor oder mit Story 3.1 braucht `/verwaltung` eine kleine `umbenennen`-action. Sie ist die dritte Wurfstelle derselben Namensprüfung; `scripts/create-admin.ts` gehört dann im selben Zug angeglichen. Kein Reaktivieren und kein Undo bleiben ausdrücklich unverändert — die Unumkehrbarkeit ist der Grund, warum „Zugang beenden" etwas bedeutet.

### Epic 4: Wissen liegt im System, nicht im Kopf

Nachschlagewissen — gute Nachbarn, Starkzehrer — ist für alle abrufbar, ohne dass eine erfahrene Gärtnerin gefragt werden muss.
**FRs covered:** FR11

*Implementierungshinweise:* Priorität SHOULD (siehe `scope-priorities.md`). Ein Blatt ist Titel plus Freitext, gemeinschaftlich, ohne Autor und ohne Versionen. Kein Editor mit Werkzeugleiste. Erfüllt NFR2: einmal geschrieben, kein Aufwand pro Beet.

## Reihenfolge und Abhängigkeiten

Epic 1 steht allein und liefert vollständigen Nutzen. Epic 2, 3 und 4 bauen auf Epic 1 auf, hängen aber nicht voneinander ab — nach Epic 1 sind sie in jeder Reihenfolge machbar.

## Zuordnung zum abgesegneten Schnitt

Die sieben Slices aus `stories.yaml` sind vollständig enthalten. Zwei mussten geteilt werden, weil sie eine Dev-Sitzung überschreiten; drei Stories kommen neu hinzu — zwei aus Architektur und UX, eine aus der Triage der zurückgestellten Arbeit vom 2026-08-28.

| `stories.yaml` | wird hier |
| --- | --- |
| — (neu, aus Architektur und UX) | Story 1.1 Gerüst und Gestaltungsrahmen |
| 1 Zugang und Mitgliederverwaltung | Story 1.2 + Story 1.3 |
| 2 Kernschleife | Story 1.4 + Story 1.5 |
| — (neu, aus Architektur) | Story 1.6 Betrieb und Deployment |
| 3 Monatsplan | Story 2.1 |
| 4 Überfällig-Markierung | Story 2.2 |
| — (neu, aus der Triage vom 2026-08-28) | Story 3.0 Das ausgelieferte HTML gegen einen echten Server prüfen |
| 5 Dienstplan | Story 3.1 |
| 6 Einzelaufgabe mit Anmeldung | Story 3.2 |
| 7 Referenz-Sheets | Story 4.1 |

## Epic 1: Die Gemeinschaft kommt rein und sieht, was zu tun ist

Alle 20 Gärtner\*innen erreichen die Anwendung über ihren persönlichen Einladungslink auf dem Handy, sehen die offenen Aufgaben, haken ab und erfassen selbst neue. Nach diesem Epic ist die tragende Annahme des Produkts testbar.

**FRs:** FR1, FR2, FR3, FR12, FR13, FR14

### Story 1.1: Gerüst und Gestaltungsrahmen

As a Gärtnerin,
I want die Anwendung auf meinem Handy öffnen und sofort erkennen, wo ich bin und was es hier gibt,
So that ich sie überhaupt benutzen kann, ohne jemanden zu fragen.

**Acceptance Criteria:**

**Given** ein leeres Repository
**When** `npm install && npm run dev` läuft
**Then** startet eine SvelteKit-Anwendung mit exakt den in `epics.md` gepinnten Versionen, TypeScript 6.0.3 und `adapter-node`
**And** `npm run build` und `npm run lint` laufen beide ohne Fehler und ohne Warnungen

**Given** die laufende Anwendung auf einem Handy bei 375px Breite
**When** ich `/` öffne
**Then** sehe ich die Titelleiste mit `Gemeinschaftsgarten` in Akzentfarbe über die volle Breite
**And** eine feste Leiste am unteren Rand mit vier beschrifteten Zielen `Aufgaben · Dienstplan · Wissen · Mehr`, jedes mindestens 44px hoch, keines mit Symbol statt Wort
**And** der Inhaltsbereich zeigt `Nichts offen.`

**Given** die Anwendung
**When** das Gerät auf dunkles Erscheinungsbild gestellt ist
**Then** gelten die Dunkel-Token aus `DESIGN.md` mit Akzent `#7FBB8C` und Titelleistenschrift `#0E1410`
**And** jeder Farbwert stammt aus einer CSS Custom Property; in keinem Komponenten-`<style>` steht ein Hex-Wert

**Given** die ausgelieferte Anwendung
**When** ich die Netzwerkanfragen beim Laden beobachte
**Then** geht keine Anfrage an einen fremden Host; Figtree und Inter kommen aus dem eigenen Bündel unter `_app/immutable/assets/`

**Given** die Datenbankschicht
**When** die Anwendung startet
**Then** wird die SQLite-Datei aus `DATABASE_PATH` geöffnet, `WAL` und `foreign_keys` sind gesetzt, die Migrationskette läuft an
**And** fehlt `DATABASE_PATH`, `SESSION_SECRET` oder `ORIGIN`, wirft die Anwendung beim Start mit klarer Meldung, ohne Fallback-Wert

*Erfüllt:* NFR5, NFR9, NFR10, NFR11, NFR13, UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR5, UX-DR12, UX-DR13, UX-DR14, UX-DR15, UX-DR16. Legt keine Domänentabellen an.

### Story 1.2: Einladungslink einlösen und angemeldet bleiben

As a neue Gärtnerin,
I want über den Link aus der Gartengruppe hineinkommen und danach nie wieder etwas eingeben müssen,
So that ich die Liste beim Ankommen im Garten in einem Griff offen habe.

**Acceptance Criteria:**

**Given** ein Mitglied mit einem gültigen Einladungstoken
**When** ich `GET /i/<token>` aufrufe
**Then** wird ein signiertes, `httpOnly`-Sitzungs-Cookie gesetzt und auf `/` weitergeleitet
**And** jeder weitere Aufruf von `/` zeigt die Liste direkt, ohne Zwischenschritt und ohne erneute Eingabe

**Given** dasselbe Token
**When** ich es auf einem zweiten Gerät aufrufe
**Then** funktioniert es ebenfalls, damit ein Gerätewechsel keinen neuen Link braucht

**Given** ein Token, das nie existiert hat, und ein widerrufenes Token
**When** ich beide aufrufe
**Then** erscheint in beiden Fällen dieselbe Seite `Dieser Link gilt nicht mehr. Melde dich in der Gartengruppe.` ohne Hinweis darauf, welcher Fall vorliegt

**Given** die Datenbank
**When** ich die Tabelle `members` untersuche
**Then** enthält sie ausschliesslich den SHA-256-Hash des Tokens, nie den Klartext

**Given** ein leeres System
**When** ich `npm run create-admin -- <Name>` ausführe
**Then** entsteht das erste Mitglied mit `is_admin = 1` und der Klartext-Link wird genau einmal auf der Konsole ausgegeben

**Given** kein oder ein ungültiges Sitzungs-Cookie
**When** ich irgendeine Seite ausser `/i/<token>` aufrufe
**Then** werde ich nicht zur Liste gelassen

*Erfüllt:* FR13, NFR4, NFR12, AD-3, AD-10, AD-13. Legt `members` an.

### Story 1.3: Mitglieder aufnehmen und Zugang beenden

As a Verwalterin des Gartens,
I want jemanden aufnehmen und dabei seinen persönlichen Link bekommen, und einen Zugang wieder beenden können,
So that Verbindlichkeit immer an eine bekannte Person hängt und ausgetretene Leute keinen Zugang behalten.

**Acceptance Criteria:**

**Given** ich bin als Mitglied mit `is_admin = 1` angemeldet
**When** ich `/mehr` öffne
**Then** erscheint der Eintrag `Verwaltung`; bei einem Mitglied ohne Adminrechte erscheint er nicht, und ein Direktaufruf von `/verwaltung` führt auf `/`

**Given** die Verwaltung
**When** ich einen Namen eingebe und `Aufnehmen` tippe
**Then** entsteht ein Mitglied und der vollständige Einladungslink wird **genau einmal** angezeigt, kopierbar
**And** nach dem Verlassen der Seite ist derselbe Link nirgends mehr abrufbar

**Given** ein bestehendes Mitglied
**When** ich `Einladung widerrufen` tippe und die Rückfrage bestätige
**Then** ist der Zugang beendet und der alte Link führt auf die Fehlerseite aus Story 1.2
**And** der Knopf ist der einzige rote in der ganzen Anwendung

**Given** ein Mitglied, dessen Zugang beendet wurde
**When** ich die Datenbank und die Ansichten prüfe
**Then** bleiben die von ihm abgehakten Aufgaben in der Historie erhalten
**And** das Mitglied wird nicht gelöscht, sondern auf inaktiv gesetzt

*Erfüllt:* FR12, FR14, AD-11, UX-DR10. Legt keine neue Tabelle an; nutzt `members` aus Story 1.2.

### Story 1.4: Offene Aufgaben sehen und abhaken

As a Gärtnerin,
I want beim Ankommen sehen, was offen ist, und mit einem Griff abhaken, was getan ist,
So that ich weiss, was zu tun ist, und die Liste stimmt, ohne dass ich etwas erklären muss.

**Acceptance Criteria:**

**Given** offene Aufgaben in der Datenbank
**When** ich `/` öffne
**Then** sehe ich sie als Liste unter der Marke `OFFEN`, vollständig, ohne Nachladen
**And** ohne offene Aufgaben steht dort `Nichts offen.`

**Given** eine offene Aufgabe
**When** ich das Kästchen antippe
**Then** ist sie erledigt — ohne Rückfrage, ohne Formular, ohne Eingabe
**And** die Zeile bleibt an ihrem Platz, durchgestrichen und gedämpft, mit gefülltem Kästchen
**And** beim nächsten Laden ist sie verschwunden, auch für alle anderen

**Given** die Aufgabenzeile
**When** ich den Aufgabentext antippe
**Then** passiert nichts — nur das Kästchen ist antippbar, mit einem Trefferfeld von mindestens 44 × 44 px bei 22px sichtbarer Grösse

**Given** eine erledigte Aufgabe in der Datenbank
**When** ich irgendeine Ansicht der Anwendung durchsuche
**Then** ist nirgends zu sehen, **wer** sie abgehakt hat — auch nicht als Titel-Attribut
**And** `completed_by` und `completed_at` sind trotzdem gesetzt

**Given** ein Screenreader
**When** er eine Aufgabenzeile vorliest
**Then** nennt er den Aufgabentext und die Erledigen-Aktion, weil das Kästchen ein echtes Formular-Bedienelement mit Beschriftung ist

*Erfüllt:* FR1, FR2, NFR1, NFR7, NFR8, AD-1, AD-2, AD-5, AD-7, AD-9, AD-14, UX-DR6, UX-DR7, UX-DR13. Legt `tasks` an.

### Story 1.5: Aufgabe vor Ort erfassen

As a Gärtnerin, die etwas entdeckt,
I want die Sache in den gemeinsamen Pool legen, ohne jemanden anzusprechen,
So that die nächste Person, die kommt, sie sieht und niemand darum bitten muss.

**Acceptance Criteria:**

**Given** ich bin auf `/`
**When** ich `+ Aufgabe` tippe
**Then** öffnet sich `/aufgabe` mit einem einzigen Textfeld und einem primären Knopf

**Given** das Formular
**When** ich einen Text eingebe und ablege
**Then** landet die Aufgabe im gemeinsamen Pool, ohne Zuständigen, und ich werde auf `/` zurückgeleitet, wo sie in derselben Liste steht wie die geplanten
**And** die Meldung lautet `Abgelegt.`

**Given** das leere Formular
**When** ich ohne Text ablege
**Then** entsteht keine Aufgabe und das Feld sagt, dass ein Text nötig ist

**Given** die Datenbank
**When** ich die neue Zeile prüfe
**Then** hat sie `created_at` in Unix-Sekunden, kein `due_at`, keinen Zuständigen

*Erfüllt:* FR3, AD-4, AD-6, AD-9, UX-DR10. Legt keine neue Tabelle an; nutzt `tasks` aus Story 1.4. Bringt den Knopf `+ Aufgabe` auf `/` — vorher ist der leere Zustand ohne Knopf.

### Story 1.6: Betrieb und Deployment

As a Betreiber des Gartenwerkzeugs,
I want die Anwendung auf dem VPS betreiben, sichern und wiederherstellen können,
So that die Gemeinschaft sie überhaupt von ihren Handys erreicht und ein Ausfall keine Daten kostet.

**Acceptance Criteria:**

**Given** das Repository auf einem Infomaniak VPS light
**When** ich `docker compose up -d` ausführe
**Then** laufen drei Dienste: `app` auf Basis `node:24-alpine`, `nginx` mit TLS auf 80 und 443, `certbot`
**And** `app` veröffentlicht keinen Port und ist nur über das interne Netz erreichbar
**And** das Image ist mehrstufig gebaut und läuft als non-root-Benutzer

**Given** die laufende Anwendung
**When** ich sie über HTTPS von einem Handy aufrufe
**Then** wird HTTP auf HTTPS umgeleitet, TLS 1.2 und 1.3 sind aktiv, älteres ist abgeschaltet

**Given** einen Container-Neustart und ein `docker compose down` mit anschliessendem `up`
**When** ich danach die Aufgabenliste öffne
**Then** sind alle Daten vorhanden, weil die SQLite-Datei in einem Named Volume unter `/data` liegt

**Given** den Host-Cron
**When** die Sicherung um 02:00 läuft
**Then** entsteht eine WAL-sichere Kopie über `sqlite3 .backup`, und Sicherungen älter als 30 Tage werden entfernt

**Given** den Einladungspfad
**When** jemand `/i/` in kurzer Folge wiederholt aufruft
**Then** greift die Ratenbegrenzung in nginx

**Given** einen Totalausfall
**When** ich dem Runbook folge
**Then** führt es von der leeren Maschine über Zertifikat und Wiederherstellung bis zur laufenden Anwendung

*Erfüllt:* NFR6, AD-13, sowie den Betriebsteil der Architektur-Spine. Legt keine Tabelle an.

## Epic 2: Der Monatsplan landet in der Liste

Die monatlich wechselnde planende Person legt ihren Plan in einem Zug ab, statt ihn auf Papier oder in den Chat zu schreiben. Liegengebliebenes fällt beim Draufschauen auf, ohne zu verschwinden.

**FRs:** FR4, FR5

### Story 2.1: Monatsplan in einem Zug ablegen

As a planende Person dieses Monats,
I want meinen ganzen Plan in einem Durchgang eintragen,
So that es mich nicht mehr Zeit kostet als die Liste auf Papier zu schreiben.

**Acceptance Criteria:**

**Given** ich bin angemeldet
**When** ich `/mehr` → `Monatsplan ablegen` öffne
**Then** sehe ich ein Feld `Fällig bis`, vorbelegt mit dem Ende des laufenden Monats, und darunter ein Textfeld von mindestens 16em Höhe

**Given** das Textfeld
**When** ich 27 Zeilen eingebe oder einfüge, darunter drei leere
**Then** zeigt die Zählung darunter `24 Aufgaben erkannt`

**Given** 24 erkannte Zeilen
**When** ich `Weiter` tippe
**Then** sehe ich die 24 Zeilen als Liste, jede mit einem `×` zum Entfernen, ohne Bearbeitungsmöglichkeit pro Zeile
**And** der Knopf lautet `24 Aufgaben ablegen`

**Given** den Prüfschritt
**When** ich zwei Zeilen entferne und ablege
**Then** entstehen genau 22 Aufgaben, alle mit demselben `due_at`
**And** ich lande auf `/` mit der Meldung `22 Aufgaben abgelegt.` und sehe sie im Pool

**Given** einen realen Monatsplan von 20 bis 40 Aufgaben
**When** eine Person ihn einmal überträgt
**Then** ist der Aufwand nicht höher als die bisherige Papier- oder Chat-Variante (manuelle Prüfung, NFR3)

*Erfüllt:* FR4, NFR3, AD-8, AD-9, UX-DR11. Ergänzt `tasks` um `due_at`.

### Story 2.2: Überfällige Aufgaben erkennen

As a Gärtnerin,
I want beim Draufschauen sehen, was schon lange liegt,
So that Liegengebliebenes auffällt, ohne dass jemand mahnen muss.

**Acceptance Criteria:**

**Given** eine offene Aufgabe, deren `COALESCE(due_at, created_at)` mehr als drei Wochen zurückliegt
**When** ich `/` öffne
**Then** trägt ihre Zeile eine zweite Textzeile `seit N Wochen überfällig` in Lehmbraun
**And** die Aufgabe bleibt in der Liste und verschwindet nicht

**Given** eine Aufgabe aus einem Monatsplan mit `due_at` am Monatsende
**When** ich die Liste drei Wochen nach dem Anlegen öffne, aber vor dem `due_at`
**Then** ist sie **nicht** als überfällig gekennzeichnet

**Given** die Datenbank
**When** ich das Schema prüfe
**Then** gibt es keine Spalte `is_overdue`, keinen Cron und keinen Hintergrundjob; die Schwelle steht als benannte Konstante an genau einer Stelle

**Given** ein Gerät mit ausgeschalteter Farbdarstellung oder eine farbfehlsichtige Person
**When** sie die Liste liest
**Then** ist Überfälligkeit am Text erkennbar, nicht nur an der Farbe

*Erfüllt:* FR5, NFR9, AD-8, UX-DR8, UX-DR13. Legt keine Tabelle an; setzt `due_at` aus Story 2.1 voraus.

## Epic 3: Verbindlichkeit ohne Nachfragen

Tränkedienst und Setzlingsabholung sind namentlich verbindlich geregelt. Die Umfrage im Gruppenchat entfällt, und niemand muss mehr jemanden bitten.

**FRs:** FR6, FR7, FR8, FR9, FR10

### Story 3.0: Das ausgelieferte HTML gegen einen echten Server prüfen

As a Betreiber des Gartenwerkzeugs,
I want ein zweites Prüfskript, das die gebaute Anwendung auf einem freien Port startet und ihre echten Antworten misst,
So that kein Fehler mehr bis zur Benutzung durchkommt, den nur ein echter Server zeigt und eine Attrappe nie zeigen kann.

**Acceptance Criteria:**

**Given** einen gebauten Baum
**When** ich `npm run smoke:http` ausführe
**Then** startet das Skript die Anwendung auf einem freien Port gegen eine **Wegwerf-Datenbank** und beendet Prozess und Verzeichnis auch dann wieder, wenn eine Behauptung rot ist
**And** es kommt **keine neue Abhängigkeit** dazu — reines Node, und `pruefen`, `pruefenGleich` und `wegwerfVerzeichnis` werden mit `scripts/smoke-zugang.ts` geteilt statt kopiert

**Given** einen gestellten Einladungslink
**When** das Skript ihn über HTTP einlöst
**Then** misst es den 303 samt `Location` und das `Set-Cookie` **an der Antwort des Servers**, nicht an einem selbstgebauten Objekt
**And** eine zweite Anfrage mit dem erhaltenen Cookie bekommt 200 auf `/`

**Given** eine Anfrage ohne Sitzungscookie
**When** sie auf `/` trifft
**Then** antwortet der Server mit 403, dem vorgeschriebenen Satz und `content-type: text/html`, und der Rumpf ist die aus `src/error.html` gebaute Hülle mit ersetzten Platzhaltern — gemessen an den Bytes der Antwort, nicht an einer nachgestellten Grenze
**And** auf diesem Pfad stehen die Sicherheitskopfzeilen aus `hooks.server.ts` — die `Referrer-Policy` eingeschlossen, die heute von keiner Prüfung berührt wird

**Given** das ausgelieferte HTML von `/`, `/verwaltung` und `/mehr`
**When** das Skript es liest
**Then** steht darin kein aufgebrochener HTML-Kommentar, kein unersetzter `%sveltekit.…%`-Platzhalter, kein leerer Platzhalter eines Bestätigungstexts und kein Token-Hash
**And** damit sind die zwei Fehler der Klasse A aus Story 1.3 ausgeführt geprüft statt beschrieben

**Given** ein Mitglied ohne Adminrechte
**When** es `/verwaltung` aufruft
**Then** kommt 303 auf `/`, und `/mehr` trägt keinen Verwaltungs-Eintrag; dieselbe Anfrage als Adminperson bekommt 200

**Given** eine mutwillig geänderte Zusage im Code
**When** das Skript läuft
**Then** wird sie rot — jede Behauptung ist durch Mutation belegt, und das Skript zählt seine Behauptungen wie `smoke` gegen eine Konstante

**Given** das Qualitätstor
**When** `npm run lint` läuft
**Then** läuft das neue Skript in der Kette mit, hinter `smoke`

*Erfüllt:* keinen FR — NFR13. Legt keine Tabelle an, ändert keine Route und keine Oberfläche. Schliesst vier Posten aus `deferred-work.md` auf einmal: Eintrag 5 (die Attrappen-Bauform, die sich über drei Review-Runden selbst bestätigte), Stufe A aus Eintrag 15, die Klasse A aus den Einträgen 9 und 17 und die ungeprüfte `Referrer-Policy`. **Ausdrücklich nicht enthalten:** Stufe B (Interaktionslogik in reine Funktionen ziehen) und Stufe C (kopfloser Browser) — Stufe C bleibt an ihre eigene Auslösebedingung gebunden und ist eine Stack-Entscheidung.

### Story 3.1: Dienstplan mit Namen und laufender Woche

As a Gärtnerin mit Tränkedienst,
I want ohne Suchen erkennen, dass diese Woche ich dran bin, und im Plan sehen, wer wann kommt,
So that der Dienst verbindlich ist und ich ihn nicht vergesse.

**Acceptance Criteria:**

**Given** einen gefüllten Dienstplan
**When** ich `/dienstplan` öffne
**Then** sehe ich die Wochen der nächsten drei Monate mit je genau einer zuständigen Person, Ziffern in Tabellenstellung

**Given** ich habe in der laufenden Woche Dienst
**When** ich `/` öffne
**Then** steht über allem ein Hinweis `Diese Woche bist du am Tränken` mit dem Wochendatum, mit linker Kante in Akzentfarbe, verlinkt auf den Dienstplan
**And** der Hinweis ist nicht abhakbar und nicht wegklickbar

**Given** ich habe diese Woche keinen Dienst
**When** ich `/` öffne
**Then** fehlt der Block ganz — er ist nicht leer, sondern nicht vorhanden

**Given** eine zugeteilte Woche
**When** ich den Namen durch einen anderen ersetze
**Then** ist die Woche neu besetzt, ohne neuen Datensatz und ohne Tauschverhandlung im System

**Given** ein Mitglied, dessen Zugang beendet wurde, mit künftigen Dienstwochen
**When** ich den Dienstplan öffne
**Then** stehen diese Wochen als `— unbesetzt —` in Ringelblume, bis sie neu besetzt werden

*Erfüllt:* FR6, FR7, FR8, AD-4, AD-11, AD-14, UX-DR9. Legt `duty_weeks` an, eindeutig über Dienstart, Jahr und Kalenderwoche.

### Story 3.2: Einzelaufgabe ausschreiben und übernehmen

As a Gärtnerin,
I want eine verbindliche Einzelaufgabe ausschreiben und eine andere übernehmen können,
So that Verantwortung nicht in einer Gruppennachricht verdunstet und die Umfrage im Chat entfällt.

**Acceptance Criteria:**

**Given** ich bin angemeldet
**When** ich `/mehr` → `Einzelaufgabe ausschreiben` öffne, Titel und Termin eingebe und ablege
**Then** entsteht eine Einzelaufgabe ohne Übernehmer

**Given** eine freie Einzelaufgabe
**When** ich `/` öffne
**Then** erscheint sie über dem Aufgaben-Pool mit Titel, Termin, `noch niemand` und dem Knopf `Übernehmen`

**Given** eine freie Einzelaufgabe
**When** ich `Übernehmen` tippe
**Then** erscheint eine Bestätigung mit `Du übernimmst: <Titel>, <Termin>.` — die einzige Bestätigung im Aufgabenbereich
**And** nach dem Bestätigen steht mein Name daneben und der Knopf ist weg

**Given** eine übernommene Einzelaufgabe
**When** ich `/` öffne
**Then** erscheint sie dort **nicht** mehr; sie steht auf `/einzelaufgaben`

**Given** die Datenbank
**When** ich das Schema prüfe
**Then** hat `signup_tasks` genau eine nullbare Mitgliedsspalte, und `tasks` hat weiterhin keine Zuständigkeitsspalte

*Erfüllt:* FR9, FR10, AD-4, AD-9, AD-14. Legt `signup_tasks` an.

## Epic 4: Wissen liegt im System, nicht im Kopf

Nachschlagewissen — gute Nachbarn, Starkzehrer — ist für alle abrufbar, ohne dass eine erfahrene Gärtnerin gefragt werden muss.

**FRs:** FR11

### Story 4.1: Referenz-Sheets lesen und schreiben

As a erfahrene Gärtnerin,
I want mein Wissen einmal aufschreiben, statt es zwanzig Mal zu erklären,
So that die anderen nachschauen können, ohne mich zu fragen.

**Acceptance Criteria:**

**Given** angelegte Blätter
**When** ich `/wissen` öffne
**Then** sehe ich ihre Titel als Liste, und ein Antippen öffnet das Blatt mit seinem Freitext

**Given** ich bin angemeldet
**When** ich ein neues Blatt mit Titel und Text anlege
**Then** ist es für alle sichtbar und lesbar

**Given** ein bestehendes Blatt
**When** ich es ändere und ablege
**Then** gilt die Änderung für alle; es gibt keine Versionen, keinen Autor und keinen Bearbeitungsverlauf

**Given** das Bearbeitungsfeld
**When** ich es öffne
**Then** ist es ein einfaches Textfeld ohne Werkzeugleiste; Absätze und Zeilenumbrüche bleiben beim Anzeigen erhalten

**Given** die Anwendung nach dieser Story
**When** ich prüfe, ob irgendwo Aufwand pro Beet oder pro Pflanze entstanden ist
**Then** ist das nicht der Fall — ein Blatt gilt unabhängig von einzelnen Beeten

*Erfüllt:* FR11, NFR2, AD-1, AD-9. Legt `sheets` an, ohne Autorenspalte.

*Namensentscheid, getroffen am 2026-08-30 (Retro Epic 3, Befund D1):* Die Tabelle heisst
`sheets(id, titel, text, created_at)` — **Domänenspalten deutsch, Infrastrukturspalten
englisch**, die Regel steht jetzt in `ARCHITECTURE-SPINE.md` unter *Consistency Conventions*.
`titel` ist damit dieselbe Spalte wie in `signup_tasks`; `text` dieselbe wie in `tasks`, und
das Wort trägt in beiden Sprachen. Die Repository-Datei heisst `sheets.ts` — ein Wort, unter
kebab-case wie camelCase gleich geschrieben, diese Story stolpert also nicht über die
Dateinamenregel. Keine Autoren-, Versions- und Verlaufsspalte, wie die Kriterien sagen.

## Abdeckung der UX-Design-Anforderungen

| UX-DR | Abgedeckt in |
| --- | --- |
| UX-DR1 Tokens | 1.1 |
| UX-DR2 Dunkler Modus | 1.1, danach jede Oberflächen-Story |
| UX-DR3 Selbst gehostete Schriften | 1.1 |
| UX-DR4 `title-bar` | 1.1 |
| UX-DR5 `nav-bar` | 1.1 |
| UX-DR6 `task-row` und `task-box` | 1.4 |
| UX-DR7 Zustand erledigt | 1.4 |
| UX-DR8 Zustand überfällig | 2.2 |
| UX-DR9 `duty-banner` | 3.1 |
| UX-DR10 Knöpfe | 1.3, 1.5, 2.1 |
| UX-DR11 Massen-Eingabe | 2.1 |
| UX-DR12 Leere Zustände und Fehlertexte | 1.1, 1.2, 1.4 |
| UX-DR13 Barrierefreiheits-Boden | 1.1, danach Definition of Done jeder Oberflächen-Story |
| UX-DR14 Keine Schatten, keine Pillen | 1.1 |
| UX-DR15 Was nicht gebaut wird | 1.1 als Grundsatz, gilt für alle |
| UX-DR16 Acht Oberflächen | 1.1 Navigation, jede Story ergänzt ihre Oberfläche |

Alle 16 UX-Design-Anforderungen sind mindestens einer Story zugeordnet.


## Abschlussvalidierung

Maschinell geprüft am 2026-08-26:

- **FR-Deckung:** 14 von 14. Jede funktionale Anforderung ist in der `Erfüllt`-Zeile mindestens einer Story genannt. Keine Waise.
- **NFR-Deckung:** 13 von 13. Story 3.0 trägt keinen FR und keinen UX-DR nach — sie erfüllt NFR13 (Qualitätstor) und ändert an den drei Deckungszahlen nichts.
- **UX-DR-Deckung:** 16 von 16.
- **Tabellenanlage:** keine Story legt eine Tabelle an, die sie nicht braucht. Story 1.1 legt gar keine Domänentabelle an; `members` entsteht in 1.2, `tasks` in 1.4, `due_at` kommt in 2.1 hinzu, `duty_weeks` in 3.1, `signup_tasks` in 3.2, `sheets` in 4.1.
- **Vorwärtsabhängigkeiten:** keine. Jede Story baut ausschliesslich auf früheren auf. Reihenfolge geprüft: 2.2 steht nach 2.1, weil es `due_at` braucht; 1.5 nach 1.4, weil es `tasks` braucht.
- **Epic-Unabhängigkeit:** Epic 1 steht allein. Epic 2, 3 und 4 setzen Epic 1 voraus, aber nicht einander.
- **File Churn:** Epic 2 fasst `queries/tasks.ts` und die Listenansicht aus Epic 1 nochmals an. Zusammenlegung wurde geprüft und begründet verworfen — andere Nutzergruppe, andere Oberfläche, und ein zusammengelegtes Epic hätte sieben Stories.
- **Parser:** `sprint_plan.py` liest 4 Epics und 12 Stories (11 bei der Validierung am 2026-08-26; Story 3.0 kam am 2026-08-28 aus der Triage dazu). Zwei verbleibende Warnungen betreffen den Dokumenttitel und die Abschnittsmarke `## Epic List` — beide von der Vorlage vorgegeben und nicht änderbar.

### Zwei offene Punkte für die Sprint-Planung

1. **Story 1.1 und Story 1.6 sind die grössten.** 1.1 umfasst Projektinitialisierung, gepinnten Stack, Datenbankverbindung, Tokens, selbst gehostete Schriften und den Gestaltungsrahmen; 1.6 umfasst Compose, Dockerfile, nginx, certbot, Sicherung, Ratenbegrenzung und Runbook. Beide könnten eine Dev-Sitzung überschreiten und sind Kandidaten für eine Teilung, falls die Umsetzung sich als zu gross erweist.
2. **Story 1.6 könnte früher laufen.** Sie steht am Ende von Epic 1, ist aber ab Story 1.1 machbar. Wer früh auf dem VPS deployen will, zieht sie nach vorne — die Abhängigkeit erlaubt es.
