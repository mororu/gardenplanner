# Epic 3 Context: Verbindlichkeit ohne Nachfragen

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Zwei Arten von Verbindlichkeit, die heute im Gruppenchat ausgehandelt werden, stehen künftig namentlich im System. Der Tränkedienst ist wochenweise bis drei Monate im Voraus zugeteilt, mit genau einer zuständigen Person pro Woche; wer diese Woche dran ist, erkennt es beim Öffnen der Startseite, ohne zu suchen. Unregelmässiges wie das Abholen von Setzlingen wird mit Titel und Termin ausgeschrieben und von einer Person verbindlich übernommen — für alle sichtbar, ob und von wem. Damit entfällt die Umfrage im Chat, und niemand muss mehr jemanden bitten. Der Unterschied zum Aufgaben-Pool aus Epic 1 ist der Kern: dort ist alles namenlos und jede greift, was sie schafft; hier trägt eine Sache genau einen Namen, bevor sie getan wird.

## Stories

- Story 3.0: Das ausgelieferte HTML gegen einen echten Server prüfen — **Vorarbeit, läuft vor 3.1** (aufgesetzt am 2026-08-28). Gehört fachlich zu keinem Epic, legt keine Tabelle an und ändert keine Oberfläche: ein zweites Prüfskript startet die gebaute Anwendung auf einem freien Port gegen eine Wegwerf-Datenbank, statt SvelteKit mit Attrappen nachzustellen. Sie schliesst vier zurückgestellte Posten auf einmal; beide folgenden Stories bekommen die Abdeckung geschenkt.
- Story 3.0.1: Einen Mitgliedsnamen korrigieren — **Vorbedingung, läuft vor 3.1** (aufgesetzt am 2026-08-29). Eine `umbenennen`-action auf `/verwaltung`, inline je Mitgliedszeile, ohne modalen Dialog. Sie löst die Vorbedingung aus den Cross-Story Dependencies ein und zieht die Namensregel in ein geteiltes Modul `src/lib/mitgliedsname.ts`, das danach drei Leser hat — `aufnehmen`, `umbenennen` und `scripts/create-admin.ts`. Legt keine Tabelle an und ändert kein Schema. Kein Reaktivieren, kein Undo, keine Historie der alten Namen.
- Story 3.1: Dienstplan mit Namen und laufender Woche
- Story 3.2: Einzelaufgabe ausschreiben und übernehmen

## Requirements & Constraints

- **Genau eine zuständige Person pro Dienstwoche**, bis drei Monate im Voraus. Ein Tausch ist das **Ersetzen des Namens** — kein neuer Datensatz, keine Tauschverhandlung im System, keine Anfrage, die jemand annehmen müsste.
- **Der Diensthinweis auf der Startseite fehlt ganz, wenn kein eigener Dienst läuft** — er ist nicht leer, sondern nicht vorhanden. Er ist nicht abhakbar und nicht wegklickbar: ein Dienst ist keine Aufgabe.
- **Ein deaktiviertes Mitglied wird nie gelöscht.** Seine künftigen Dienstwochen bleiben als Datensatz stehen und werden überall als **unbesetzt** dargestellt, bis die Verwaltung sie neu besetzt. Das ist der einzige Weg, auf dem eine Woche unbesetzt wird.
- **Eine Einzelaufgabe hat zwei Zustände.** Frei: Titel, Termin, `noch niemand`, Knopf `Übernehmen`. Übernommen: Titel, Termin, Name, kein Knopf. Auf `/` erscheinen **nur freie**; übernommene stehen auf ihrer eigenen Seite.
- **Das Übernehmen ist verbindlich und wird deshalb bestätigt** — die einzige Bestätigung im Aufgabenbereich. Das Abhaken im Pool bleibt eine einzige Interaktion ohne Rückfrage; diese Ausnahme darf nicht dorthin ausstrahlen.
- **`tasks` bekommt weiterhin keine Zuständigkeitsspalte.** Der Pool bleibt namenlos; wer abgehakt hat, wird gespeichert und erscheint in keiner Ansicht und in keinem Text.
- **Namen verlassen mit diesem Epic zum ersten Mal die Mitgliederverwaltung** und stehen im Dienstplan vor allen, jede Woche. Angelegt und geändert werden sie trotzdem ausschliesslich dort.
- Kein Zustand hängt allein an der Farbe: **unbesetzt trägt das Wort**, so wie überfällig den Text trägt.
- Kontrast 4.5:1 für Text und 3:1 für Bedienelement-Umrisse, geprüft in Hell **und** Dunkel; Trefferfelder ≥ 44 × 44 px; bedienbar bei 375px. Oberfläche Deutsch in Schweizer Rechtschreibung ohne Eszett, Du-Form.
- Qualitätstor: `npm run build` und `npm run lint` sauber plus manuelles Prüfen am 375px-Viewport in beiden Modi. Es gibt bewusst kein Testframework — die Prüfskripte in der Lint-Kette sind der Ersatz.

## Technical Decisions

**Zwei getrennte Entitäten mit unterschiedlicher Verbindlichkeit, keine gemeinsame Basis.** `duty_weeks` trägt Dienstart, ISO-Jahr, ISO-Kalenderwoche und eine **nicht nullbare** Mitgliedsspalte — eindeutig über die ersten drei. `signup_tasks` trägt Titel, Termin und eine **nullbare** Mitgliedsspalte. Keine Basistabelle, keine Typspalte über die Aufgabenarten, `tasks` bleibt unverändert. Die drei Arten sind verschieden verbindlich, und genau das soll das Schema zeigen. Die Dienstart steht als Spalte, obwohl nur der Tränkeplan gefordert ist — eine zweite Art braucht dann keine Schemaänderung, aber auch keine Oberfläche in diesem Epic.

**Datenzugriff bleibt in der Repository-Schicht.** Je Entität ein Modul mit benannten, **synchronen** Funktionen; kein Drizzle-Aufruf und kein Datenbank-Handle in einer Routendatei, **kein `async`/`await` in der Datenschicht**. Zeitspalten sind SQLite-Integer in Unix-Sekunden — keine ISO-Strings, keine `Date`-Objekte in der Datenbank. Schemaerweiterungen laufen über die Migrationskette; Migrationsdateien werden nie von Hand geändert.

**Die ISO-Wochenrechnung ist neu und gehört an die eine Stelle, an der die Zeit schon wohnt** — dasselbe Modul, das Zone, Monatsende und Überfälligkeitsschwelle trägt. Es hängt von nichts ab und bleibt von beiden Seiten und von nacktem Node ladbar. Eine zweite Wochenrechnung in einer Route oder Komponente wäre eine zweite Wahrheit über denselben Kalender.

**Mutationen laufen als form actions** in `+page.server.ts` mit `use:enhance` — Zuteilen, Ersetzen, Ausschreiben, Übernehmen. Kein JSON-Endpunkt, kein Mischen von form actions und Request-Handlern in derselben Route, **literale `action="?/name"`** (AD-9). Aktualität kommt nach der Mutation aus `load`, nie aus Polling oder Push.

**Die Startseite führt genau drei Blöcke in dieser Reihenfolge:** Diensthinweis, freie Einzelaufgaben, Aufgaben-Pool. Beide Fach-Stories fügen dort einen Block ein; keine Unterseite darf exklusiv informieren, sie darf nur vertiefen. Zustand nur mit Runes; Fehler in Routen über SvelteKits `error(status, { message })`.

**Zugang:** der Wächter schützt jeden Pfad ausser dem Einladungspfad — keine Route dieses Epics braucht eine eigene erste Schranke. Eine **zweite** Stufe ist offen und gehört in der Story entschieden: das Neubesetzen einer Woche schreiben die Quellen der Verwaltung zu, ohne festzulegen, ob das die geschützte Route meint oder nur die Rolle. Ausschreiben und Übernehmen dürfen ausdrücklich alle.

## UX & Interaction Patterns

**Der Dienstplan ist eines der vier Navigationsziele** — ein Ort, den man mehr als einmal im Monat aufsucht. Das **Ausschreiben** einer Einzelaufgabe liegt dagegen hinter `Mehr`, neben Monatsplan und Verwaltung.

**Diensthinweis.** Eine Zeile auf erhabener Fläche mit 3px linker Kante in der Akzentfarbe, fast eckigem Radius, Haarlinie ringsum, verlinkt auf den Dienstplan, mit Wochendatum. Ohne eigenen Dienst fehlt der ganze Block.

**Dienstplan.** Die Wochen der nächsten drei Monate mit je einer Person. **Ziffern in Tabellenstellung** (`font-variant-numeric: tabular-nums`) — eine Wochenliste, deren Zahlen springen, liest sich schlecht. Unbesetzte Wochen stehen mit `— unbesetzt —`.

**Einzelaufgabe übernehmen.** Der Knopf trägt das Verb `Übernehmen`. Die Bestätigung nennt, was übernommen wird — Titel und Termin im selben Satz, in der Form `Du übernimmst: <Titel>, <Termin>.` Danach steht der Name daneben und der Knopf ist fort. Das ist neben dem Widerruf einer Einladung die einzige Stelle im Produkt, an der ein modaler Dialog erlaubt ist.

**Datum und Zeit.** Alltagssprache in Listen; das ausgeschriebene Datum nur dort, wo es zählt — im Dienstplan und an einer Einzelaufgabe. Termine tragen die Nebentext-Rolle.

**Alle Farben, Grössen und Abstände kommen als CSS Custom Properties aus dem Gestaltungsrahmen** — kein Hex-Wert in einem Komponenten-`<style>`, jede Grösse aus der Typografie-Rampe, jeder Abstand aus der 4px-Skala, keine Schatten, keine Pillen-Radien. Höchstens ein primärer Knopf pro Seite, volle Spaltenbreite, mindestens 44px hoch. Beide Modi in derselben Story prüfen, nicht den dunklen nachträglich.

**Visuelle Referenz:** das Startseiten-Mockup zeigt Diensthinweis und freie Einzelaufgabe im Zusammenspiel mit dem Pool. Für Dienstplan und Einzelaufgaben-Seite **gibt es kein Mockup** — dort tragen die Gestaltungsregeln allein. Bei Widerspruch gewinnen die Spines, nicht das Mockup.

**Ausdrücklich nicht bauen:** Tauschverhandlungen oder Anfragen zwischen Mitgliedern, Erinnerungen oder Push zu Diensten und Terminen, mehrere Übernehmer je Einzelaufgabe, Kommentare, Abzeichen, Zählungen, Wischgesten, unendliches Nachladen, Bestätigungsdialoge irgendwo sonst.

## Cross-Story Dependencies

- **Vorbedingung, entschieden am 2026-08-28 — eingelöst am 2026-08-29 durch Story 3.0.1:** `/verwaltung` braucht eine kleine `umbenennen`-action. Sobald der Name im Dienstplan vor allen steht, jede Woche und drei Monate im Voraus, ist das bisher bewusst fehlende Umbenennen nicht mehr tragbar: der einzige Korrekturweg — Zugang beenden und neu aufnehmen — nähme der Person zugleich ihre künftigen Dienstwochen, die dann auf `— unbesetzt —` fielen. Es ist die dritte Wurfstelle derselben Namensprüfung; das Admin-CLI-Skript gehört im selben Zug angeglichen. Kein Reaktivieren und kein Undo bleiben ausdrücklich unverändert — die Unumkehrbarkeit ist der Grund, warum „Zugang beenden" etwas bedeutet.
- **Story 3.0 läuft vor Story 3.1** und ist von 3.1 und 3.2 fachlich unabhängig. Sie schliesst die Attrappen-Bauform des bestehenden Prüfskripts, prüft die ausgelieferten Seiten ausgeführt statt beschrieben und hängt sich hinter das bestehende Smoke-Skript in die Lint-Kette. Ausdrücklich **nicht** enthalten: Interaktionslogik in reine Funktionen ziehen (Stufe B) und ein kopfloser Browser (Stufe C, bleibt an eine eigene Auslösebedingung gebunden).
- **3.1 und 3.2 hängen nicht voneinander ab.** Sie treffen sich an **einer** Stelle: beide fügen der Startseite einen Block hinzu, und deren Reihenfolge ist festgelegt. Wer zuerst kommt, legt die Blockstruktur an; wer folgt, ordnet sich ein.
- **Beide setzen Epic 1 voraus:** Mitglieder samt Deaktivierung, Zugangserzwingung, Navigationsleiste, `/mehr` und die bestehende Startseite mit dem Pool. Story 3.1 braucht die Deaktivierung ausdrücklich. **Epic 3 hängt nicht von Epic 2 ab** und wird von Epic 4 nicht gebraucht.
- **Die Farbe von `— unbesetzt —` ist entschieden** (2026-08-28) und braucht keine Klärung mehr: ein **eigenes** Token, Ringelblume, bereits im Gestaltungsrahmen deklariert und in beiden Modi gemessen. „Unbesetzt" und „überfällig" sind zwei Aussagen und tragen zwei Farben; im Hellen sind die Töne einander sehr nah, was nachgerechnet und hingenommen ist, weil sie nie auf derselben Seite vorkommen und das Wort ohnehin die Aussage trägt. Story 3.1 benutzt das Token nur noch.
- **Vor dem Start lesen:** `deferred-work-triage-2026-08-28.md`, die Triage der zurückgestellten Arbeit vom 2026-08-28. Drei Posten dort treffen dieses Epic direkt — eine Reihenfolgefalle im Prüfskript, die beim Anhängen neuer Behauptungen zuschlägt; die pro Seite verdoppelten Seitenstile, die mit zwei neuen Seiten weiter wachsen; und die Frage, welches Navigationsziel auf einer Formularroute aktiv ist.
