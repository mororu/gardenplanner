# Epic 3 Context: Verbindlichkeit ohne Nachfragen

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Zwei Arten von Verbindlichkeit, die heute im Gruppenchat ausgehandelt werden, stehen künftig namentlich im System. Der Tränkedienst ist wochenweise bis drei Monate im Voraus zugeteilt, mit genau einer zuständigen Person pro Woche; wer diese Woche dran ist, erkennt es beim Öffnen der Startseite, ohne zu suchen. Unregelmässiges wie das Abholen von Setzlingen wird mit Titel und Termin ausgeschrieben und von einer Person verbindlich übernommen — sichtbar für alle, ob und von wem. Damit entfällt die Umfrage im Chat, und niemand muss mehr jemanden bitten. Der Unterschied zum Aufgaben-Pool aus Epic 1 ist der Kern: dort ist alles namenlos und jede greift, was sie schafft; hier trägt eine Sache genau einen Namen, bevor sie getan wird.

## Stories

- Story 3.1: Dienstplan mit Namen und laufender Woche
- Story 3.2: Einzelaufgabe ausschreiben und übernehmen

## Requirements & Constraints

- **Genau eine zuständige Person pro Dienstwoche**, bis drei Monate im Voraus. Ein Tausch ist das **Ersetzen des Namens** — kein neuer Datensatz, keine Tauschverhandlung im System, keine Anfrage, die jemand annehmen müsste.
- **Der Diensthinweis auf der Startseite fehlt ganz, wenn kein eigener Dienst läuft** — er ist nicht leer, sondern nicht vorhanden. Er ist nicht abhakbar und nicht wegklickbar: ein Dienst ist keine Aufgabe.
- **Ein deaktiviertes Mitglied wird nie gelöscht.** Seine künftigen Dienstwochen bleiben als Datensatz stehen und werden überall als **unbesetzt** dargestellt, bis die Verwaltung sie neu besetzt.
- **Eine Einzelaufgabe hat zwei Zustände.** Frei: Titel, Termin, `noch niemand`, Knopf `Übernehmen`. Übernommen: Titel, Termin, Name der Person, kein Knopf. Auf `/` erscheinen **nur freie**; übernommene stehen auf ihrer eigenen Seite.
- **Das Übernehmen ist verbindlich und wird deshalb bestätigt** — die einzige Bestätigung im Aufgabenbereich. Das Abhaken im Pool bleibt eine einzige Interaktion ohne Rückfrage; diese Ausnahme darf nicht dorthin ausstrahlen.
- **`tasks` bekommt weiterhin keine Zuständigkeitsspalte.** Der Pool bleibt namenlos. Wer eine Aufgabe erledigt hat, wird gespeichert und erscheint in keiner Ansicht und in keinem Text.
- **Namen verlassen mit diesem Epic zum ersten Mal die Mitgliederverwaltung** und stehen im Dienstplan vor allen, jede Woche. Angelegt und geändert werden sie trotzdem ausschliesslich in der Verwaltung.
- Kein Zustand hängt allein an der Farbe: **unbesetzt trägt das Wort**, so wie überfällig den Text trägt.
- Kontrast 4.5:1 für Text und 3:1 für Bedienelement-Umrisse, geprüft in Hell **und** Dunkel; Trefferfelder ≥ 44 × 44 px; bedienbar bei 375px.
- Oberfläche Deutsch in Schweizer Rechtschreibung ohne Eszett, Du-Form.
- Qualitätstor: `npm run build` und `npm run lint` sauber plus manuelles Prüfen am 375px-Viewport in beiden Modi. Es gibt bewusst kein Testframework.

## Technical Decisions

**Zwei getrennte Entitäten mit unterschiedlicher Verbindlichkeit, und keine gemeinsame Basis.** `duty_weeks` trägt Dienstart, ISO-Jahr, ISO-Kalenderwoche und eine **nicht nullbare** Mitgliedsspalte — eindeutig über die ersten drei, denn eine Dienstwoche hat genau eine Person. `signup_tasks` trägt Titel, Termin und eine **nullbare** Mitgliedsspalte — null oder ein Übernehmer. Keine gemeinsame Basistabelle, keine Typspalte über die Aufgabenarten, und `tasks` bleibt unverändert. Die drei Arten sind verschieden verbindlich, und genau das soll das Schema zeigen.

**Die Dienstart steht als Spalte, obwohl nur der Tränkeplan gefordert ist.** Eine zweite Dienstart braucht damit keine Schemaänderung — aber auch keine Oberfläche in diesem Epic.

**Datenzugriff bleibt in der Repository-Schicht.** Je Entität ein eigenes Modul mit benannten, **synchronen** Funktionen; kein Drizzle-Aufruf und kein Datenbank-Handle in einer Routendatei, kein `async`/`await` in der Datenschicht. Zeitspalten sind SQLite-Integer in Unix-Sekunden wie überall — keine ISO-Strings, keine `Date`-Objekte in der Datenbank. Die Schemaerweiterung entsteht über die Migrationskette; Migrationsdateien werden nie von Hand geändert.

**Die ISO-Wochenrechnung ist neu und gehört an die eine Stelle, an der die Zeit schon wohnt** — dasselbe Modul, das die Zone, das Monatsende und die Überfälligkeitsschwelle trägt. Es hängt von nichts ab und ist von beiden Seiten und von nacktem Node ladbar; das bleibt seine Bedingung. Eine zweite Wochenrechnung in einer Route oder Komponente wäre eine zweite Wahrheit über denselben Kalender.

**Mutationen laufen als form actions** in `+page.server.ts` mit `use:enhance` — Zuteilen, Ersetzen, Ausschreiben und Übernehmen. Kein JSON-Endpunkt, kein Mischen von form actions und Request-Handlern in derselben Route, literale `action="?/name"`. Nach der Mutation kommt die Aktualität aus `load`, nicht aus Polling oder Push.

**Die Startseite führt genau drei Blöcke in dieser Reihenfolge:** Diensthinweis, freie Einzelaufgaben, Aufgaben-Pool. Beide Stories dieses Epics fügen dort einen Block ein, und keine Unterseite darf exklusiv informieren — sie dürfen vertiefen. Zustand nur mit Runes; Fehler in Routen über SvelteKits `error(status, { message })`.

**Zugang:** der Wächter schützt jeden Pfad ausser dem Einladungspfad, eine Route dieses Epics braucht also keine eigene erste Schranke. Eine **zweite** Stufe ist dagegen offen und gehört in der Story entschieden: das Neubesetzen einer Woche schreiben die Quellen der Verwaltung zu, ohne festzulegen, ob das die geschützte Route meint oder nur die Rolle. Ausschreiben und Übernehmen dürfen ausdrücklich alle — das Übernehmen ist der Kern von Story 3.2.

## UX & Interaction Patterns

**Der Dienstplan ist eines der vier Navigationsziele** und damit ein Ort, den man mehr als einmal im Monat aufsucht. Das **Ausschreiben** einer Einzelaufgabe liegt dagegen hinter `Mehr`, neben dem Monatsplan und der Verwaltung — es passiert selten und gehört nicht in die Leiste.

**Diensthinweis.** Eine Zeile auf erhabener Fläche mit 3px linker Kante in der Akzentfarbe, fast eckigem Radius, Haarlinie ringsum, verlinkt auf den Dienstplan. Er trägt das Wochendatum. Ohne eigenen Dienst fehlt der ganze Block.

**Dienstplan.** Die Wochen der nächsten drei Monate mit je einer Person. **Ziffern in Tabellenstellung** (`font-variant-numeric: tabular-nums`) — eine Wochenliste, deren Zahlen springen, liest sich schlecht. Unbesetzte Wochen stehen mit `— unbesetzt —`; das Wort trägt die Aussage, die Farbe nie allein.

**Einzelaufgabe übernehmen.** Der Knopf trägt das Verb `Übernehmen`. Die Bestätigung nennt, was übernommen wird — Titel und Termin im selben Satz, in der Form `Du übernimmst: <Titel>, <Termin>.` Danach steht der Name daneben und der Knopf ist fort. Das ist neben dem Widerruf einer Einladung die einzige Stelle im Produkt, an der ein modaler Dialog erlaubt ist.

**Datum und Zeit.** Alltagssprache in Listen; das ausgeschriebene Datum nur dort, wo es zählt — im Dienstplan und an einer Einzelaufgabe. Termine tragen die Nebentext-Rolle.

**Alle Farben, Grössen und Abstände kommen als CSS Custom Properties aus dem Gestaltungsrahmen** — kein Hex-Wert in einem Komponenten-`<style>`, jede Grösse aus der Typografie-Rampe, jeder Abstand aus der 4px-Skala, keine Schatten, keine Pillen-Radien. Höchstens ein primärer Knopf pro Seite, volle Spaltenbreite, mindestens 44px hoch. Beide Modi in derselben Story prüfen, nicht den dunklen nachträglich.

**Visuelle Referenz:** das Startseiten-Mockup zeigt Diensthinweis und freie Einzelaufgabe im Zusammenspiel mit dem Pool. Für den Dienstplan und die Einzelaufgaben-Seite **gibt es kein Mockup** — dort tragen die Gestaltungsregeln allein. Bei Widerspruch gewinnen die Spines, nicht das Mockup.

**Ausdrücklich nicht bauen:** Tauschverhandlungen oder Anfragen zwischen Mitgliedern, Erinnerungen oder Push zu Diensten und Terminen, mehrere Übernehmer je Einzelaufgabe, Kommentare, Abzeichen, Zählungen, Wischgesten, unendliches Nachladen, Bestätigungsdialoge irgendwo sonst.

## Cross-Story Dependencies

- **Die beiden Stories hängen nicht voneinander ab** — 3.2 braucht nichts aus 3.1. Sie treffen sich aber an **einer** Stelle: beide fügen der Startseite einen Block hinzu, und deren Reihenfolge ist festgelegt. Wer zuerst kommt, legt die Blockstruktur an; wer folgt, ordnet sich ein.
- **Beide setzen Epic 1 voraus:** Mitglieder samt Deaktivierung, die Zugangserzwingung, die Navigationsleiste, `/mehr` und die bestehende Startseite mit dem Aufgaben-Pool. Story 3.1 braucht die Deaktivierung ausdrücklich — sie ist der einzige Weg, auf dem eine Woche unbesetzt wird.
- **Epic 3 hängt nicht von Epic 2 ab** und wird von Epic 4 nicht gebraucht.
- **Vorbedingung aus der Triage vom 2026-08-28, vor oder mit Story 3.1:** `/verwaltung` braucht eine `umbenennen`-action. Sobald der Name im Dienstplan vor allen steht, ist der bisherige Korrekturweg — Zugang beenden und neu aufnehmen — untragbar, weil er der Person zugleich ihre künftigen Dienstwochen nimmt. Die Begründung steht in `epics.md` bei den Implementierungshinweisen zu diesem Epic.
- **Offene Gestaltungsfrage, vor Story 3.1 zu beantworten:** welches Farb-Token `— unbesetzt —` trägt. Die Erlebnisbeschreibung nennt dafür ein Token, das es im Gestaltungsrahmen nicht gibt; die Akzeptanzkriterien verlangen Lehmbraun, und Lehmbraun ist das Token der Überfälligkeit. Zu entscheiden ist, ob „unbesetzt" dasselbe Token trägt wie „überfällig" oder ein eigenes bekommt. Die Torregel für deklarierte Tokens weist ein undeklariertes sofort ab, die Story bliebe also stehen.
- **Vor dem Start lesen:** `deferred-work-triage-2026-08-28.md`. Drei Posten dort treffen dieses Epic direkt — eine Reihenfolgefalle im Prüfskript, die beim Anhängen neuer Behauptungen zuschlägt; die pro Seite verdoppelten Seitenstile, die mit zwei neuen Seiten weiter wachsen; und die Frage, welches Navigationsziel auf einer Formularroute aktiv ist.
