# Epic 4 Context: Wissen liegt im System, nicht im Kopf

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Nachschlagewissen, das heute in zwei bis drei erfahrenen Köpfen liegt — gute Nachbarn, Starkzehrer, was wann in welcher Reihenfolge —, wird einmal aufgeschrieben und ist danach von jedem Handy abrufbar. Wer neu ist, muss niemanden fragen, und wer erfahren ist, erklärt es nicht zwanzig Mal. Ein Blatt ist Titel plus Freitext und gilt für den ganzen Garten, ausdrücklich **nicht** pro Beet und nicht pro Pflanze: genau daran hängt der Nutzen, denn bei 40+ Beeten wäre jede beetweise Pflege ein Ausschlusskriterium und das Blatt bliebe leer. Blätter sind gemeinschaftlich — wer eines ändert, ändert es für alle, ohne Autor, ohne Version, ohne Verlauf. Dieses Epic ist das einzige mit Priorität SHOULD; alle sieben MUST-Capabilities stehen davor und sind gebaut.

## Stories

- Story 4.1: Referenz-Sheets lesen und schreiben

## Requirements & Constraints

- **Ein Blatt ist Titel plus Freitext, sonst nichts.** Keine Autorenspalte, keine Versionen, kein Bearbeitungsverlauf, kein Zeitpunkt „zuletzt geändert von". Die Abwesenheit ist der Entscheid, nicht eine Auslassung: gemeinschaftliches Wissen ohne Besitz.
- **Kein Editor mit Werkzeugleiste.** Ein einfaches Textfeld. Absätze und Zeilenumbrüche müssen beim Anzeigen erhalten bleiben — das ist die einzige Formatierungszusage. Ob Auszeichnung (Listenpunkte, Fettschrift) je erlaubt wird, ist als offene UX-Frage markiert und für dieses Epic mit **reiner Text** beantwortet.
- **Kein Aufwand pro Beet oder pro Pflanze.** Ein Blatt gilt unabhängig von einzelnen Beeten; es gibt keine Verknüpfung Blatt↔Beet und keine Pflanzendatenbank. Die Story hat ein eigenes Abnahmekriterium, das genau das prüft.
- **Die Liste zeigt nur Titel**, ein Antippen öffnet das Blatt mit seinem Text.
- **Alle angemeldeten Mitglieder dürfen lesen, anlegen und ändern.** Keine Admin-Schranke, keine Rolle. Der Wächter in `hooks.server.ts` schützt den Pfad ohnehin; eine zweite Stufe gibt es hier nicht.
- **Die Startseite bleibt unberührt.** Wissen ist keine Aufgabenart und bekommt keinen Block auf `/` — die drei Blöcke dort sind abschliessend. Wissen ist ein Nachschlageort, kein „was ist zu tun".
- Kein Zustand hängt allein an der Farbe; leere Zustände tragen einen Satz. Kontrast 4.5:1 für Text und 3:1 für Bedienelement-Umrisse, geprüft in Hell **und** Dunkel; Trefferfelder ≥ 44 × 44 px; bedienbar bei 375px. Oberfläche Deutsch in Schweizer Rechtschreibung ohne Eszett, Du-Form.
- Qualitätstor: `npm run build` und `npm run lint` sauber — die Prüfskripte hängen in der Lint-Kette — plus manuelles Prüfen am 375px-Viewport in beiden Modi. Es gibt bewusst kein Testframework.

## Technical Decisions

**Eine Tabelle, `sheets`, ohne Autorenspalte.** Der Namensentscheid vom 2026-08-30 legt sie als `sheets(id, titel, text, created_at)` fest — **Domänenspalten deutsch, Infrastrukturspalten englisch**, die Regel steht in den *Consistency Conventions*. `titel` ist damit dieselbe Spalte wie in `signup_tasks`, `text` dieselbe wie in `tasks`. Zeitspalten sind SQLite-Integer in Unix-Sekunden.

> **Widerspruch, in der Story zu schliessen:** das ERD in der ARCHITECTURE-SPINE trägt `SHEETS { id, title, body, updated_at }` und ist auf dem Stand vom 2026-08-26, also **vor** dem Namensentscheid. Die Story folgt dem Entscheid und zieht das ERD nach, statt beides stehen zu lassen.

**Datenzugriff ausschliesslich über die Repository-Schicht (AD-1).** `src/lib/server/db/queries/sheets.ts` — kebab-case-Regel, hier folgenlos, weil der Name ein Wort ist. Benannte, **synchrone** Funktionen; kein Drizzle-Aufruf und kein Datenbank-Handle in einer Routendatei, kein `async`/`await` in der Datenschicht. Zeilentypen kommen aus `$inferSelect`/`$inferInsert`, Einfügewerte tragen `satisfies`. Die Schemaerweiterung läuft über `npm run db:generate`; Migrationsdateien werden nie von Hand geändert.

**Mutationen laufen als form actions (AD-9)** in `+page.server.ts` mit `use:enhance` — Anlegen und Ändern. Kein JSON-Endpunkt, kein Mischen von form actions und Request-Handlern in derselben Route, literale `action="?/name"`. Aktualität kommt nach der Mutation aus `load`. Fehler in Routen über SvelteKits `error(status, { message })`. Das Abweisen einer action folgt der einen Form aus `src/lib/server/abweisen.ts`; `result.type === 'error'` wird im `use:enhance`-Rückruf abgefangen und landet in der geteilten Meldungsregion.

**Die Textprüfung hat schon ein Zuhause.** Falten, Längengrenze und Zeilenerkennung liegen in `src/lib/aufgabentext.ts`, die Klasse unsichtbarer Zeichen in `src/lib/unsichtbar.ts`. Eine zweite Fassung derselben Regeln für Blätter wäre eine zweite Wahrheit — prüfen, was übernommen werden kann, bevor Neues entsteht. Sätze mit mehr als einer Wurfstelle gehören nach `src/lib/texte.ts`.

**Gestaltung kommt aus dem geteilten Stilblatt.** `src/lib/styles/bedienelemente.css` trägt die geteilten Rollen (`seite`, `seitentitel`, `fliesstext`, `hinweis`, `fehler`, `leer`, Zeilenformular, Live-Region); Regel 14 des Gestaltungstors leitet diese Rollen ab und schlägt an, wenn eine Seite einen Regelkörper lokal kopiert. Kein Hex-Wert in einem Komponenten-`<style>`, jede Grösse aus der Typografie-Rampe, jeder Abstand aus der 4px-Skala, keine Schatten, keine Pillen-Radien, höchstens ein primärer Knopf pro Seite.

## UX & Interaction Patterns

**Wissen ist eines der vier Navigationsziele** — `Aufgaben · Dienstplan · Wissen · Mehr`. Der Eintrag existiert seit Story 1.1 in der Leiste; dieses Epic füllt das Ziel. Das Anlegen und Ändern liegt **auf** `/wissen` beziehungsweise am Blatt selbst, nicht hinter `Mehr` — anders als Monatsplan und Verwaltung, weil Nachschlagen und Ergänzen dieselbe Bewegung sind.

**Zwei Ansichten:** die Liste der Titel und das einzelne Blatt mit seinem Freitext. Ein Layout, eine Spalte, `max-width: 600px`.

**Kein Zurück-Pfeil bauen.** Formularseiten schliessen mit ihrer Aktion und leiten auf die Liste zurück, mit einer kurzen Meldung im Perfekt desselben Verbs. Die Systemgeste des Browsers genügt.

**Keine modalen Dialoge.** Die zwei erlaubten Ausnahmen im Produkt sind das Übernehmen einer Einzelaufgabe und das Widerrufen einer Einladung; hier gibt es keine. Kein Wischen, keine Animation, kein unendliches Nachladen — die Liste ist vollständig.

**Für `/wissen` gibt es kein Mockup.** Dort tragen die Gestaltungsregeln allein. Bei Widerspruch gewinnen die Spines, nicht das Mockup.

**Ausdrücklich nicht bauen:** Rich-Text-Editor oder Werkzeugleiste, Autorenanzeige, Versionen oder Verlauf, Kommentare, Suche über Blätter, Kategorien oder Verschlagwortung, Verknüpfung zu Beeten oder Pflanzen, Bilder oder Anhänge (es gibt keine Uploads, nginx begrenzt den Body auf 1M).

## Cross-Story Dependencies

- **Epic 4 setzt Epic 1 voraus** — Mitglieder, Zugangserzwingung, Navigationsleiste, Gestaltungsrahmen — und **hängt weder von Epic 2 noch von Epic 3 ab**. Es ist das letzte der vier und wird von keinem gebraucht.
- **Einzige Story im Epic.** Keine epic-internen Abhängigkeiten.
- **Vor dem Start lesen:** die Retrospektive Epic 3 vom 2026-08-30 und `deferred-work.md`. Mehrere offene Aktionspunkte betreffen genau die geteilten Rollen und das Gestaltungstor, die eine neue Seite sofort anfasst — der `fehler`-Zwilling in `bedienelemente.css`, `zeile__text` gegen `fliesstext`, die list-item-Warnung im geteilten `zeilenform__griff`. Eine neue Seite darf keine dieser Kopien vermehren.
- **Nach dieser Story ist der Quellbaum vollständig:** `routes/wissen/` und `queries/sheets.ts` sind im Baum der ARCHITECTURE-SPINE als „Epic 4, noch nicht gebaut" markiert und die einzige verbleibende Ausnahme von der Regel „was hier steht, steht im Baum". Die Markierung gehört mit der Story entfernt.
