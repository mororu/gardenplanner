# Epic 2 Context: Der Monatsplan landet in der Liste

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Die monatlich wechselnde planende Person überträgt ihren ganzen Monatsplan — real 20 bis 40 Aufgaben — in einer einzigen Sitzung in den gemeinsamen Pool, statt ihn auf Papier zu schreiben oder in den Gruppenchat zu stellen. Damit erreicht der Plan die Gemeinschaft dort, wo auch alles andere steht, und die planende Person des Folgemonats plant aus dem tatsächlich Erledigten statt aus alten Plänen. Die zweite Hälfte des Epics macht Liegengebliebenes sichtbar: eine Aufgabe, die drei Wochen offen ist, fällt beim Draufschauen auf, ohne zu verschwinden und ohne dass jemand mahnen muss. Der Erfolg dieses Epics hängt an einer einzigen Messlatte — wenn das Ablegen mehr Aufwand kostet als die Papierliste, tut es die rotierende Person nicht.

## Stories

- Story 2.1: Monatsplan in einem Zug ablegen
- Story 2.2: Überfällige Aufgaben erkennen

## Requirements & Constraints

- **Netto kein Mehraufwand gegenüber Papier oder Chat.** Das ist die Abnahmebedingung von Story 2.1 und wird manuell geprüft, indem eine Person einen realen Plan von 20–40 Aufgaben einmal überträgt. Ein Formular mit einem Feld pro Aufgabe verliert diesen Vergleich sofort.
- Ein Monatsplan ist ein Stapel mit **einem gemeinsamen Fälligkeitsdatum** für alle Aufgaben, nicht mit einem Datum pro Zeile.
- Abgelegte Planaufgaben landen im **selben Pool** wie die vor Ort erfassten und werden in keiner Ansicht anders behandelt. Sie bleiben namenlos — der Pool bekommt keine Zuständigkeit im Voraus.
- **Offene Aufgaben verfallen nie.** Überfällig heisst: sichtbar gekennzeichnet, weiter in der Liste, nichts eskaliert, nichts verschwindet. Schwelle sind drei Wochen.
- Eine Planaufgabe mit Fälligkeit am Monatsende darf nicht schon drei Wochen nach dem Anlegen als überfällig gelten — die Frist zählt ab Fälligkeit, ersatzweise ab Anlage.
- Kein Zustand hängt allein an der Farbe: Überfälligkeit trägt immer auch Text, lesbar auch bei Farbfehlsichtigkeit oder ausgeschalteter Farbdarstellung.
- Kontrast 4.5:1 für Text und 3:1 für Bedienelement-Umrisse, geprüft in Hell **und** Dunkel; Trefferfelder ≥ 44 × 44 px; bedienbar bei 375px.
- Oberfläche Deutsch in Schweizer Rechtschreibung ohne Eszett, Du-Form.
- Qualitätstor: `npm run build` und `npm run lint` sauber plus manuelles Prüfen am 375px-Viewport in beiden Modi. Es gibt bewusst kein Testframework.

## Technical Decisions

**Überfälligkeit ist abgeleitet, nicht gespeichert.** Sie wird zur Anzeigezeit berechnet: nicht erledigt **und** `COALESCE(due_at, created_at)` älter als 21 Tage. Es gibt keine `is_overdue`-Spalte, keinen Cron und keinen Hintergrundjob — zwei Wahrheiten würden auseinanderlaufen, sobald ein Job einmal nicht läuft. Die Schwelle steht als benannte Konstante an genau **einer** Stelle.

**`due_at` ist optional und gehört zum Stapel.** Der Monatsplan setzt es einmal für alle Aufgaben des Durchgangs; die Ad-hoc-Erfassung aus Epic 1 lässt es leer. Es ist ein SQLite-Integer in Unix-Sekunden wie alle Zeitspalten — keine ISO-Strings, keine `Date`-Objekte in der Datenbank, Formatierung ausschliesslich über die Datums-Utilities auf der Client-Seite. Die Spaltenerweiterung entsteht über die Migrationskette (`npm run db:generate`), Migrationsdateien werden nie von Hand geändert.

**Datenzugriff bleibt in der Repository-Schicht.** Sowohl das Ablegen des Stapels als auch die Abfrage der offenen Aufgaben mit ihrem Überfälligkeitszustand entstehen als benannte, **synchrone** Funktionen im Aufgaben-Repository — kein Drizzle-Aufruf und kein `db`-Handle in einer Routendatei, kein `async`/`await` in der Datenschicht. Das Einfügen von 20–40 Zeilen ist ein einziger Repository-Aufruf.

**Mutationen laufen als form actions.** Das Ablegen ist eine form action in `+page.server.ts` mit `use:enhance`; es gibt keinen JSON-Endpunkt und kein Mischen von form actions und Request-Handlern in derselben Route. Zählung und Prüfschritt sind keine Domänenmutation und brauchen deshalb keinen Server-Rundgang. Nach der Mutation folgt die Weiterleitung auf die Liste; Aktualität kommt ausschliesslich aus `load` plus `invalidateAll()`, kein Polling, kein Push.

**Die Oberfläche liegt auf `/monatsplan`,** erreichbar über `/mehr` — eine Handlung, die eine Person höchstens einmal im Monat tut, gehört nicht in die vier Navigationsziele. `tasks` bekommt weiterhin **keine** Spalte für einen vorab Zuständigen. Fehler in Routen über SvelteKits `error(status, { message })`; Zustand nur mit Svelte-5-Runes.

## UX & Interaction Patterns

**Massen-Eingabe in zwei Schritten** — die anspruchsvollste Interaktion des MVP. Visuelle Referenz für beide Schritte in Hell und Dunkel: `ux-designs/ux-Gartenplaner-2026-08-26/mockups/monatsplan.html`; bei Widerspruch gewinnen die Spines, nicht das Mockup.

1. **Schreiben.** Oben ein Datumsfeld `Fällig bis`, vorbelegt mit dem Ende des laufenden Monats, gilt für den ganzen Stapel. Darunter ein einziges mehrzeiliges Textfeld, mindestens 16em hoch — eine Aufgabe pro Zeile, genau die Handlung, die auf Papier stattfindet, und einfügbar aus Notiz oder Chat. Der Text im Feld hat dieselbe Grösse wie die späteren Aufgabenzeilen: was man schreibt, sieht aus wie das, was entsteht. Darunter läuft die Zählung mit (`24 Aufgaben erkannt`) in gedämpfter Nebentext-Optik; leere Zeilen zählen nicht. Ein Knopf: `Weiter`.
2. **Prüfen und ablegen.** Die erkannten Zeilen als Liste, jede mit einem `×` zum Entfernen. **Kein Bearbeiten pro Zeile** — wer ändern will, geht zurück ins Textfeld; ein Editor pro Zeile frisst die Ersparnis wieder auf. Der Schritt existiert, weil beim Einfügen aus einem Chat Zeilen mitkommen, die keine Aufgaben sind. Der primäre Knopf trägt Verb und Zahl: `24 Aufgaben ablegen`.

Danach Weiterleitung auf `/` mit der Meldung im Perfekt desselben Verbs: `22 Aufgaben abgelegt.` Kein Verbleiben im Formular, kein Zurück-Pfeil. Höchstens ein primärer Knopf pro Seite, volle Spaltenbreite, mindestens 44px hoch.

**Überfällige Aufgabenzeile.** Unter dem Aufgabentext eine zweite Zeile in Nebentext-Grösse: `seit N Wochen offen`. Farbe ist das Lehmbraun aus den Tokens (hell `#9A5A12`, dunkel `#D99B4E`) — **absichtlich kein Rot**: eine Aufgabe, die vier Wochen liegt, ist kein Fehler und keine Gefahr, und Rot bleibt allein dem Zerstörenden vorbehalten. Der Text ist Pflicht, die Farbe trägt nie allein. Die Zeile bleibt im Übrigen eine ganz normale Aufgabenzeile: Kästchen antippbar, Text nicht, kein Abzeichen, keine Sortierung nach oben, keine Eskalation.

**Alle Farben, Grössen und Abstände kommen als CSS Custom Properties aus dem Gestaltungsrahmen** — kein Hex-Wert in einem Komponenten-`<style>`, jede Grösse aus der Typografie-Rampe, jeder Abstand aus der 4px-Skala, keine Schatten, keine Pillen-Radien. Beide Modi in derselben Story prüfen, nicht den dunklen nachträglich.

**Ausdrücklich nicht bauen:** Fortschrittsbalken beim Ablegen, Zählungen erledigter Aufgaben, Abzeichen für Überfälligkeit, Wischgesten, Erinnerungen oder Push zu überfälligen Aufgaben, modale Dialoge, unendliches Nachladen.

## Cross-Story Dependencies

- **Story 2.2 setzt Story 2.1 voraus:** die Überfälligkeitsregel braucht das in 2.1 ergänzte `due_at`, sonst zählt sie nur ab Anlagedatum und die Monatsplan-Ausnahme lässt sich nicht bauen.
- **Beide Stories setzen Epic 1 voraus:** Projektskelett, Tokens, Navigationsleiste und `/mehr` aus Story 1.1, die Zugangserzwingung aus 1.2 und vor allem die Tabelle `tasks` samt Listenansicht aus Story 1.4.
- **Bewusst akzeptierte Überlappung mit Epic 1:** dieses Epic fasst das Aufgaben-Repository und die Listenansicht aus 1.4 nochmals an. Eine Zusammenlegung wurde geprüft und verworfen — andere Nutzergruppe, andere Oberfläche.
- **Nach aussen:** Epic 2 hängt nicht von Epic 3 oder 4 ab und wird von ihnen nicht gebraucht; nach Epic 1 ist die Reihenfolge der drei frei.
