---
title: 'Wellness-Tagebuch gebündelt nach Beet, Kultur und Mittel'
type: 'feature'
created: '2026-10-12'
status: 'done'
baseline_commit: '3914cdbcf767981b8b6208911b500f52abf39dd2'
review_loop_iteration: 1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Das Tagebuch auf `/wellness` zeigt jede Behandlung als eigene Karte. Bei wiederholten Mitteln (Schachtelhalm alle 14 Tage) wird die Liste lang und unübersichtlich (Manuel, 12.10.2026: «nicht gäbig»).

**Approach:** Das Tagebuch wird gebündelt: Beet (aufklappbar) > Kultur > Mittel. Pro Mittel steht eine Zeile mit der letzten Anwendung und der Anzahl; die Einzeleinträge mit Ändern und Wegnehmen liegen aufklappbar darunter (Entscheid Manuel, 12.10.2026, Vorschlag «Beet > Kultur > Mittel»).

## Boundaries & Constraints

**Always:**
- Gruppenschlüssel wie heute in `stelle` (src/lib/wellness.ts): Mittel, Kultur, Ort Zeichen für Zeichen, ohne Normalisierung.
- Reihenfolge der Beete und Kulturen wie `nachBeet`: natürlich (`Beet 3` vor `Beet 12`), ohne Ort bzw. ohne Kultur zuunterst. Mittel innerhalb einer Kultur: jüngste letzte Anwendung zuerst. Einzeleinträge: jüngste zuerst.
- Beschriftungen: Beet = Ort; ohne Ort `Ohne Beet`; ohne Kultur `Ohne Kultur`.
- Mittelzeile: `{Mittel}`, darunter `zuletzt {datumKurz} · {n}×`, bei gesetzter Wiederholung der jüngsten Anwendung zusätzlich ` · alle {x} Tage`.
- Einzeleintrag: `{datumKurz} · {vor wann} · {Name}` (Name `unbekannt` wenn null) mit Ändern und Wegnehmen wie heute; Formulare, actions, Fehlersätze und Rückfrage unverändert.
- Das erste Beet ist offen, die übrigen zu. Ein Beet und ein Mittel sind zusätzlich offen, wenn darin ein Eintrag abgewiesen wurde oder die Wegnehmen-Rückfrage steht — vom Server her entschieden, damit der Fokus sein Ziel findet (auch ohne JavaScript).
- Gliederung nach DESIGN.md: Beet ist ein `details.abschnitt` (Kopf mit `ZeichenWinkel`), Kultur ein Zwischentitel ohne eigenen Behälter, Mittel eine Karte, Einzeleinträge innerhalb der Karte getrennt, ohne Karte in der Karte. Trefferflächen ab 44px.
- `Steht wieder an` und das Eintragen-Formular bleiben, wie sie sind.

**Ask First:** Änderungen an Datenbank, Abfragen, actions oder an `Steht wieder an`; eine Suche oder ein Filter im Tagebuch.

**Never:** Normalisieren von Gross/Klein oder Leerraum beim Bündeln; Offenhalten nach einer Abweisung, das **nur** vom Client abhängt (ohne JavaScript entscheidet der Server); zweite Kopie der Ändern-Felder im Markup; Beet oder Mittel, die mit JavaScript nach einem Erfolg von selbst zuklappen.

**Nachverhandelt am 12.10.2026 (Manuel, nach dem Review):** Mit JavaScript darf der Browser den Aufklappzustand führen. Was aufgeklappt ist, bleibt offen; nach einer Abweisung oder Rückfrage öffnet er die umgebenden `details` (Beet, Mittel, Formular), auch wenn sie von Hand zugeklappt wurden. Ohne JavaScript gilt die Server-Regel oben unverändert.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Wiederholung | 4× Schachtelhalm, Tomaten, Beet 3, letzte am 15.9. mit 14 Tagen | eine Mittelzeile `zuletzt 15. Sep. 2026 · 4× · alle 14 Tage`, 4 Einträge darunter | N/A |
| Zwei Kulturen | Schachtelhalm auf Tomaten und Kohl in Beet 3 | ein Beet, zwei Kulturtitel, je eine Mittelzeile | N/A |
| Ohne Kultur/Ort | Kompost, null, null | Beet `Ohne Beet`, Kultur `Ohne Kultur`, zuunterst | N/A |
| Schreibweise | `Schachtelhalm` und `schachtelhalm` | zwei Mittelzeilen | N/A |
| Abweisung | Ändern eines Eintrags in Beet 7 mit leerem Mittel | Beet 7, Mittel und Ändern offen, Fokus am Feld | Fehlersatz wie heute |
| Leer | kein Eintrag | Leerzustand wie heute | N/A |

</frozen-after-approval>

## Code Map

Stand nach dem Bau und dem ersten Review-Durchgang (12.10.2026). Zeilennummern gemessen mit `grep -n`.

- `src/lib/wellness.ts` -- `stelle` (:253, Schlüssel), `letzteJeStelle` (:278), `nachBeet` (:326), `leerZuletzt` (:344), `natuerlich` (:366), **neu** `buendeln` (:435) mit den Typen `Mittelbuendel`, `Kulturbuendel`, `Beetbuendel`. Sortiert nicht selbst, sondern legt `nachBeet` darüber und bündelt über Maps in der Reihenfolge der ersten Zeile. Keine `anzahl`: die Seite liest `eintraege.length`.
- `src/routes/wellness/+page.svelte` -- `geordnet` (:74, für `Steht wieder an`), `tagebuch = buendeln(data.tagebuch)` (:87, zweite Sortierung begründet), `AENDERFELDER` (:176), `zeileAbgewiesen` (:236), `eintraegeOffen` (:252), `istOffen`/`merken` (:288, Anfangszustand festgehalten, danach `ontoggle`), `aufklappen` (:381), `versand` (:389), Tagebuch als `section.tagebuch` (:729–928).
- `src/routes/archiv/+page.svelte` -- Vorbild für zweistufiges Aufklappen, unverändert.
- `src/lib/styles/bedienelemente.css` -- unverändert. Die Drehung `details[open] > .zeilenform__griff .aufklapp` greift auch am Einträge-Griff ausserhalb einer `.zeilenform` (gemessen in `smoke:sicht`). Die vier neuen Regeln (`.eintraege > summary`, `.eintraege__zeile`, `.eintraege__zeile + .eintraege__zeile`, `.tagebuch`) stehen im `<style>` der Seite, weil keine zweite Seite sie liest.
- `scripts/smoke-zugang.ts` -- sieben Proben zu `buendeln` ab :10692. Live-Regionen-Zählung im Quelltext (:4279, `hoeflich: 9, unterbrechend: 34`) unverändert grün. `ERWARTETE_BEHAUPTUNGEN` 739 → 746.
- `scripts/smoke-sicht.ts` -- Abschnitt `/wellness` ab :1571, vierzehn Behauptungen. `ERWARTETE_BEHAUPTUNGEN` 79 → 93.
- `scripts/pruefserver.ts` -- Saat mit **vier** Behandlungen (:367, eine zweite Schachtelhalmbrühe in Beet 7 vor 34 Tagen); `behandlungen` reist mit `tage` und `intervallTage` an den Sichtlauf.
- `scripts/gate.mjs` -- Regel 15 (summary braucht `.aufklapp`), Regel 11 (literales `action`), beide grün.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/wellness.ts` -- reine Funktion, die `nachBeet`-geordnete Zeilen zu Beet > Kultur > Mittel > Einträge bündelt (je Mittel: jüngste Zeile, Anzahl) -- die Seite rendert nur noch.
- [x] `scripts/smoke-zugang.ts` -- Proben für die Bündelung über alle Matrixzeilen ausser Abweisung/Leer; Mutation vorführen.
- [x] `src/routes/wellness/+page.svelte` -- Tagebuch auf die Bündelung umbauen; Offen-Bedingungen für Beet/Mittel aus `zeileAbgewiesen`/`frage`; ein Ändern-Markup, keine Dublette; Kommentare an der neuen Gliederung richtigstellen.
- [x] `src/lib/styles/bedienelemente.css` -- nur falls nötig, geteilte Klassen für Kulturtitel und Einträge in der Karte.
- [x] `scripts/smoke-sicht.ts` -- auf /wellness das erste Beet offen und die Mittelzeile mit Anzahl messen; eine Abweisung in einem nicht-ersten Beet öffnet Beet und Mittel und fokussiert das Feld; Mutation vorführen.

**Acceptance Criteria:**
- Given mehrere Behandlungen mit gleichem Mittel, Kultur und Ort, when `/wellness` geladen wird, then steht dafür genau eine Mittelzeile mit Anzahl, und die Einträge sind erst nach Aufklappen sichtbar.
- Given eine Abweisung beim Ändern, when die Seite ohne JavaScript zurückkommt, then sind Beet, Mittel und Formular offen.
- Given die Prüfkette, when sie läuft, then ist sie grün und die Zahl der Live-Regionen im Quelltext unverändert.

## Design Notes

Vier logische Ebenen, aber nur zwei Behälter: Abschnitt (Beet) und Karte (Mittel). Kultur ist ein Titel, die Einträge sind getrennte Zeilen in der Karte, das Aufklappen darin ein leichter Griff wie `.zeilenform__griff`. So bleibt DESIGN.md:271 («zwei Ebenen … eine halbe dritte») gewahrt.

## Verification

**Commands:**
- `npm run build && npm run lint` -- expected: grün. Die Kette enthält `smoke:sicht`, und der braucht einen Chrome oder Chromium auf der Maschine (`CHROME_PFAD` überschreibt die Suche); ohne ihn scheitert der Lauf mit Ansage.
- `npm run smoke:sicht` -- einzeln nach `npm run build`; trägt die Aufklapp-, Fokus- und Mittelzeilen-Proben zu `/wellness`.
- `npm run check` -- expected: 0 Fehler.

## Spec Change Log

- **12.10.2026, Nachverhandlung der Never-Klausel (Manuel, nach dem Review).** Was: mit JavaScript führt der Browser den Aufklappzustand; das Markup setzt nur den Anfang, und `versand` öffnet nach einer Abweisung oder Rückfrage die Kette der umgebenden `details`. Warum: `open={…}` war reaktiv; nach einem geglückten Ändern fiel der Ausdruck auf false und Svelte klappte das Beet unter der Hand zu, und eine zweite Abweisung in einem von Hand zugeklappten Beet (true → true) liess es zu, sodass der Fokus ins Leere ging. Vermiedener Zustand: ein Beet, das nach einem Erfolg verschwindet, und ein Fokus auf einem Feld ohne Darstellung.
- **12.10.2026, Bauform des Anfangszustands.** Was: `istOffen` hält den Anfang je Schlüssel in einem gewöhnlichen Objekt fest und liest danach den mit `ontoggle` gemerkten Zustand (`$state`). Warum: ein `untrack` am Ausdruck genügte nicht — Svelte schreibt `open` als Eigenschaft in einem gemeinsamen Effekt aller Angaben des Blocks, der bei jeder Änderung neu läuft; gemessen im Sichtlauf (Beet nach geglücktem Ändern zu). Vermiedener Zustand: derselbe Selbst-Zuklapper wie oben, nur seltener. Grenze: ein Aufklapper, der mit demselben Schlüssel neu entsteht, bekommt den gemerkten Zustand zurück.
- **12.10.2026, Abweisung in Hochbeet 3 statt Beet 7.** Was: die Proben zur Abweisung und Rückfrage gehen an das **zweite** Beet der Saat (`Hochbeet 3`), nicht an Beet 7 wie in der Matrix. Warum: Beet 7 ist das erste und steht ohnehin offen; eine Zusage über das Öffnen wäre dort grün, ohne etwas zu belegen. Vermiedener Zustand: eine Wache, die die Zeile der Matrix scheinbar abdeckt und nichts misst.
- **12.10.2026, Saat erweitert.** Was: eine zweite Schachtelhalmbrühe in Beet 7 (vor 34 Tagen, älter als die erste). Warum: sonst sähe der Sichtlauf nur `1×`, und die Bündelung wäre nie gerendert. `Steht wieder an` bleibt unverändert, weil die jüngste Anwendung dieselbe bleibt.
- **12.10.2026, Leerzustand.** Was: belegt ist nur `buendeln([])` → `[]` in `smoke`. Der gerenderte Leerzustand steht in keinem Lauf, weil die Saat immer Behandlungen trägt; sein Markup ist unverändert geblieben.
- **26.10.2026, Verweis auf `spec-beet-schreibweise.md`.** Seit jener Spec speichert `ortPruefen` den Ort in einer Schreibweise (`42`, `B42` → `Beet 42`), und ältere Zeilen werden beim Start umgeschrieben. Der Gruppenschlüssel und die _Never_-Klausel „Normalisieren ... beim Bündeln" bleiben wörtlich richtig: vereinheitlicht wird beim Speichern, nicht beim Bündeln. Was sich für das Tagebuch ändert: `42` und `Beet 42` kommen dort gar nicht mehr als zwei Werte an.

### Vorgeführte Mutationen

Jede Zeile: was absichtlich verändert wurde, und was daraufhin rot wurde. Danach jeweils zurückgesetzt und grün.

Erster Bau:
- `smoke`: Mittelschlüssel in `buendeln` über `zeile.mittel.toLowerCase()` statt `stelle` → 2 rot (Wiederholung mit Anzahl 5, Schreibweise).
- `smoke`: `buendeln` ohne `nachBeet` → alle 4 damaligen Proben rot.
- `smoke:sicht`: Beet nur über `beetstelle === 0` geöffnet → beide damaligen Abweisungsproben rot.
- `smoke:sicht`: Mittel mit `open={false}` statt `eintraegeOffen` → beide damaligen Abweisungsproben rot.
- `smoke:sicht`, keine Mutation, sondern ein echter Befund beim ersten Lauf: ein `{#if}` schluckte das Leerzeichen, gerendert stand `1×· alle 14 Tage`.

Review-Durchgang:
- `smoke`: Beetzuordnung über einen Vergleich mit dem vorigen Beet statt der Map → „`Beet 03` und `Beet 3` … genau zwei Beete" rot (drei Beete, das dritte leer).
- `smoke`: `letzte` bei jeder weiteren Zeile überschrieben → 3 rot (Wiederholung, Schreibweise, Gleichstand am selben Tag: letzte 20 statt 21).
- `smoke`: `buendeln` gibt für eine leere Eingabe ein leeres Beet zurück → „aus keiner Zeile wird kein Beet" rot.
- `smoke:sicht` (1a): `aufklappen(ziel)` nach einer Abweisung entfernt → beide JS-Abweisungsproben rot (Beet und Mittel zu, kein Fokus), dazu die Erfolgsprobe, weil das Beet nie aufging.
- `smoke:sicht` (1b): `istOffen` gibt den reaktiven Ausdruck zurück (der Zustand vor dem Review) → „nach einem geglückten Ändern … bleiben Beet und Mittel offen" rot.
- `smoke:sicht` (1b): `merken` ausser Kraft gesetzt (nur festgehaltener Anfang, kein `ontoggle`) → dieselbe Erfolgsprobe rot.
- `smoke:sicht` (2): den `frage`-Teil aus `eintraegeOffen` entfernt → „ohne JavaScript … Wegnehmen-Rückfrage" rot. Die JS-Probe bleibt dabei grün, weil `aufklappen` die Kette öffnet; sie hat ihre eigene Mutation:
- `smoke:sicht` (2): `aufklappen` bei der Rückfrage in `versand` entfernt → „mit JavaScript öffnet die Wegnehmen-Rückfrage …" rot (Frage nicht sichtbar).
- `smoke:sicht` (4): den Anhang ` · alle {x} Tage` immer gerendert → Mittelzeilen-Probe rot (`Kompost: "… · 1× · alle null Tage"`).
- `smoke:sicht` (5): `.eintraege__zeile + .eintraege__zeile` zu `.eintraege__zeile` → Trennlinien-Probe rot (`1px, 1px`).
- `smoke:sicht` (5): die Drehung in `bedienelemente.css` auf `details.zeilenform[open]` verengt → Winkel-Probe rot (`zu none, offen none`). Damit ist gemessen, dass die geteilte Regel auch ausserhalb einer `.zeilenform` greift; am Blatt ist nichts geändert.
- `smoke:sicht`: alle Beete anfangs offen → Beete-Probe und „das zweite Beet ist zu" rot.
- `smoke:sicht`: Einträge-Griff ohne Mindesthöhe und Innenabstand → Griff-Probe rot (18px).
- `smoke:sicht`: vierte Saatzeile entfernt → „im ersten Beet steht eine Karte mit mehr als einem Eintrag" rot, die Schlusszählung ebenfalls (91 statt 93), kein Wurf.
- `smoke:sicht`: das zweite Beet im Test auf einen nicht vorhandenen Index gesetzt → „das zweite Beet trägt eine Zeile mit Ändern-Formular" rot, Schlusszählung 87 statt 93, kein Wurf an einer Null.
- Ein echter Befund dieses Durchgangs, keine Mutation: die erste Fassung mit `untrack` am `open` hielt die Erfolgsprobe nicht (Beet nach geglücktem Ändern zu). Daraus entstand die Bauform mit festgehaltenem Anfang und `ontoggle` (siehe oben).


## Suggested Review Order

**Bündelung**

- Einstieg: reine Funktion Beet > Kultur > Mittel > Einträge über Maps, auf `nachBeet`.
  [`wellness.ts:435`](../../src/lib/wellness.ts#L435)

- Die Seite rendert nur die Bündel.
  [`+page.svelte:87`](../../src/routes/wellness/+page.svelte#L87)

**Aufklappen**

- Tagebuch als benannte Region; Beet-`details` mit Anfangszustand vom Server.
  [`+page.svelte:729`](../../src/routes/wellness/+page.svelte#L729)

**Prüfungen**

- Verschränkte Beete `Beet 03`/`Beet 3` ergeben zwei Bündel.
  [`smoke-zugang.ts:10845`](../../scripts/smoke-zugang.ts#L10845)

- Sichtlauf: Beete, Mittelzeilen, Abweisung und Rückfrage mit und ohne JavaScript.
  [`smoke-sicht.ts:1601`](../../scripts/smoke-sicht.ts#L1601)
