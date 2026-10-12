---
title: 'Wellnessbehandlungen im Archiv'
type: 'feature'
created: '2026-10-11'
status: 'done'
baseline_commit: 'c229cb3ade35e2b1b660f6de1778044d4a0a5675'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Das Archiv (`/archiv`) zeigt, was im Garten schon getan ist, kennt aber nur abgehakte Aufgaben und abgeschlossene Termine. Eine Wellnessbehandlung ist ebenfalls getane Arbeit und steht heute nur im Tagebuch auf `/wellness`.

**Approach:** Die load von `/archiv` liest das Tagebuch als dritte Quelle und führt es mit den zwei bestehenden zu einer Liste zusammen, als dritte Archivart `wellness` (Entscheid Manuel, 11.10.2026).

## Boundaries & Constraints

**Always:**
- Herkunftswort an der Zeile: `Wellness`.
- Zeilentext: `Mittel · Kultur · Ort`, fehlende Angaben (Kultur, Ort sind nullbar) fallen samt Trenner weg. Nur Mittel → `Schachtelhalm`.
- Datum der Zeile ist `angewendetAm`. **Kein Name** (Entscheid Manuel, 11.10.2026): die Zeile bleibt namenlos wie eine Poolaufgabe, `uebernehmer` ist immer null, und `name` verlässt die load nicht.
- Die Liste bleibt durchgehend absteigend nach Zeitpunkt sortiert; bei Gleichstand stabile Reihenfolge Pool, Termine, Wellness.
- Die Suche findet `Wellness` und alles, was an der Zeile steht (sie liest schon Text, Name, Herkunftswort, Datum — keine eigene Erweiterung nötig).
- `/archiv` bleibt ohne action.

**Ask First:** eine Änderung an `/wellness`, an der Tabelle `treatments` oder an `treatments.ts` über eine reine Lesefunktion hinaus.

**Never:** Behandlungen aus dem Tagebuch entfernen oder kopieren; eine gemeinsame Abfrage über mehrere Tabellen (AD-3/AD-4: zusammengeführt wird in der load); `intervallTage`, `createdAt` oder den Namen der eintragenden Person im Archiv zeigen oder in die Seitendaten geben.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Vollständig | Schachtelhalm, Tomaten, Beet 3, eingetragen von Vera | `Schachtelhalm · Tomaten · Beet 3`, darunter `15. Sep 2026 · Wellness`, kein Name | N/A |
| Ohne Kultur | Kompost, null, Beet 7 | `Kompost · Beet 7` | N/A |
| Nur Mittel | Gesteinsmehl, null, null | `Gesteinsmehl` | N/A |
| Suche | `wellness` | nur Wellnesszeilen, Trefferansage | N/A |

</frozen-after-approval>

## Code Map

- `src/routes/archiv/+page.server.ts` -- `load()` (Z. ~86), Typ `Archivart = 'aufgabe' | 'termin'` (Z. ~84), `Archivzeile` mit `text`, `erledigtAm`, `uebernehmer`. Hier die dritte Quelle anhängen, Kommentar „Zwei Quellen" und Sortierabsatz mitziehen.
- `src/lib/server/db/queries/treatments.ts` -- `behandlungenLesen()` (Z. 89) liefert alle Zeilen mit `mittel`, `kultur`, `ort`, `angewendetAm` (und `name`, das hier nicht weitergegeben wird); nur lesen, nicht ändern.
- `src/routes/archiv/+page.svelte` -- `herkunft()` (Z. ~23) bildet `art` auf das Wort ab, heute als ternärer Ausdruck über zwei Werte; `durchsuchbar()` nutzt `herkunft`, damit ist die Suche automatisch gedeckt. Namenszeile rendert bei `uebernehmer !== null`.
- `scripts/smoke-zugang.ts` -- Archivblock ab Z. 10786: Längenbehauptung `erledigteAufgabenAuflisten().length + abgeschlosseneEinzelaufgabenLesen().length` muss die Behandlungen mitzählen; `ERWARTETE_BEHAUPTUNGEN = 733` (Z. 272) mitziehen.
- `src/lib/server/db/queries/tasks.ts` -- eigener, privater Typ `Archivzeile` (Z. ~113), nicht derselbe; nicht anfassen.

## Tasks & Acceptance

**Execution:**
- [x] `src/routes/archiv/+page.server.ts` -- `Archivart` um `'wellness'` erweitern, `behandlungenLesen()` als dritte Quelle mit Schlüssel `wellness-${id}`, Text aus Mittel/Kultur/Ort mit ` · `, `erledigtAm = angewendetAm`, `uebernehmer: null`; Kommentare auf drei Quellen richtigstellen -- die Seite soll alle getane Arbeit zeigen.
- [x] `src/routes/archiv/+page.svelte` -- `herkunft()` als vollständige Abbildung der drei Arten (`Aufgabe`, `Termin`, `Wellness`) -- ein ternärer Ausdruck machte `wellness` still zu `Aufgabe`.
- [x] `scripts/smoke-zugang.ts` -- im Archivblock eine Behandlung säen (vollständig) und eine nur mit Mittel; behaupten: beide stehen mit `wellness-`-Schlüssel, richtigem Text, `erledigtAm = angewendetAm` und `uebernehmer === null` im Archiv, und der Name der eintragenden Person kommt in den Seitendaten nicht vor (dafür ein eigenes Mitglied säen, das keinen Termin hält, sonst stünde sein Name über die Terminzeile ohnehin drin); Längenbehauptung um `behandlungenLesen().length` ergänzen; `ERWARTETE_BEHAUPTUNGEN` nachziehen -- Mutation vorführen (z. B. Trenner oder Quelle entfernen → rot).

**Acceptance Criteria:**
- Given eine eingetragene Behandlung, when `/archiv` geladen wird, then steht sie im Monat ihres Anwendungstags mit `Wellness` an der Zeile und bleibt unverändert im Tagebuch auf `/wellness`.
- Given das Wort `Wellness` im Suchfeld, when gefiltert wird, then erscheinen genau die Wellnesszeilen.
- Given die bisherigen Archivbehauptungen, when die Prüfkette läuft, then bleiben sie grün (Pool und Wellness namenlos, Termin mit Übernehmer, keine action, kein `completed*` in den Seitendaten).

## Design Notes

`angewendetAm` ist ein Tagesende (23:59:59 Europe/Zurich). Eine heute eingetragene Behandlung steht darum über allem, was heute abgehakt wurde. Das ist hinnehmbar: im Archiv zählt der Tag, nicht die Uhrzeit, und die Zeile zeigt nur das Datum.

## Verification

**Commands:**
- `npm run build && npm run lint` -- expected: grün, inklusive `smoke`, `smoke:http`, `smoke:sicht`, `gate`.
- `npm run check` -- expected: keine Typfehler (insbesondere die Abbildung in `herkunft`).

## Spec Change Log

- **2026-10-12 — `scripts/smoke-sicht.ts` mitgezogen, obwohl die Code Map es nicht nennt.** Was: die Saat in `scripts/pruefserver.ts` trägt drei Behandlungen für `/wellness`, und die stehen jetzt zu Recht im Archiv. Zwei Behauptungen über den offenen Monat (`ohne Suche stehen beide abgehakten Zeilen offen da`, `die Suche findet auch den Monat`) erwarteten genau die zwei Poolzeilen und wurden rot. Sie lesen jetzt nur die Zeilen mit dem Herkunftswort `Aufgabe`. Dazu kommt eine Behauptung für das zweite Abnahmekriterium (Suche nach `Wellness` zeigt genau die drei Behandlungen, jede mit `Wellness`, Ansage `3 Treffer`), `ERWARTETE_BEHAUPTUNGEN` 78 → 79. Warum: ob die Behandlung von vor zwei Tagen in den offenen Monat fällt, hängt vom Tag im Monat ab; die Erwartung um diese Zeile zu ergänzen, hätte die Wache vom Kalender abhängig gemacht. Vermiedener bekannt-schlechter Zustand: eine `smoke:sicht`, die an den ersten zwei Tagen eines Monats anders ausfällt als an den übrigen.
- **2026-10-12 — Review-Befunde umgesetzt.** Was:
  - `smoke-zugang.ts` sät jetzt eine dritte Behandlung (`Kompost`, ohne Kultur, `Beet 7`) und behauptet den Text `Kompost · Beet 7`. Damit ist die Matrixzeile «Ohne Kultur» gedeckt.
  - Eine neue Behauptung fordert, dass jede `wellness-`-Zeile genau die Schlüssel `art, erledigtAm, schluessel, text, uebernehmer` trägt und `art === 'wellness'` hat. Das deckt die Never-Klauseln zu `intervallTage`, `createdAt` und dem Namen. Die Vergleiche je Zeile prüfen `art` mit.
  - Die gesäten `angewendetAm` sind Tagesenden über `heuteAlsFeldwert` und `tagesendeInUnixSekunden`, wie /wellness sie schreibt. Die Behauptungen vergleichen gegen den gespeicherten Wert und hängen nicht vom Kalender ab.
  - `smoke-zugang.ts`: `ERWARTETE_BEHAUPTUNGEN` von 737 auf 739.
  - In `smoke-sicht.ts` wartet die Wellnesssuche, bis nur noch Wellnesszeilen sichtbar sind oder die Region `Nichts gefunden.` sagt. Die bisherige Bedingung «Region nicht leer» konnte die Trefferzahl der Monatssuche sehen.
  - Die erwarteten Texte kommen aus `saat.behandlungen`. Dafür gibt `scripts/pruefserver.ts` die drei Behandlungen als neues Feld der Saat zurück.
  - Die Grenze von `herkunftVon` steht jetzt im Kommentar.
  - In `+page.server.ts` und `+page.svelte` ist der doppelte Satz zusammengeführt, und überlange Zeilen sind umgebrochen. Die Kommentare sagen jetzt: Eine Wellnesszeile ist keine unveränderliche Historie. Sie folgt dem Tagebuch, wenn dort geändert oder weggenommen wird.
  - Der sichtbare Hinweissatz auf /archiv bleibt unverändert; ihn entscheidet Manuel in der Textdurchsicht.
- **Vorgeführte Mutationen** (jede rot, danach zurückgesetzt):
  1. Trennerfilter in der load entfernt: `smoke`, «nur mit Mittel» war `Gesteinsmehl ·  · `.
  2. `ausDemTagebuch` aus dem Zusammenführen genommen: `smoke`, Längenbehauptung und die Zeilenvergleiche, 3 rot.
  3. `uebernehmer: behandlung.name`: `smoke`, beide Zeilenvergleiche und «Name kommt nicht vor», 3 rot.
  4. Eintrag `wellness` aus der `Record`-Tabelle in `herkunft()` entfernt: `svelte-check` meldet «Property 'wellness' is missing».
  5. `herkunft()` wieder ternär, neu gebaut: `smoke:sicht` 3 von 80 rot, die Wellnesssuche endet mit `Nichts gefunden.`. Die neue Warte-Bedingung lief nicht in eine Zeitüberschreitung, sie meldete das als rote Behauptung. Zweimal vorgeführt, vor und nach der neuen Warte-Bedingung.
  6. `[mittel, kultur ?? '', ort ?? ''].join(' · ').replace(/( · )+$/, '')`: `smoke`, «ohne Kultur» war `Kompost ·  · Beet 7`, 1 rot.
  7. `createdAt: behandlung.createdAt` in der load: `smoke`, Schlüsselmenge `art,createdAt,erledigtAm,…`, 1 rot.
  8. `art: 'aufgabe'` statt `'wellness'`: `smoke`, alle drei Zeilenvergleiche und die Schlüsselmenge, 4 rot.

## Suggested Review Order

**Die dritte Quelle in der load**

- Einstieg: das Tagebuch wird abgebildet, Text aus Mittel · Kultur · Ort, ohne Namen.
  [`+page.server.ts:133`](../../src/routes/archiv/+page.server.ts#L133)

- Zusammenführen und stabil sortieren; bei Gleichstand Pool, Termine, Wellness.
  [`+page.server.ts:161`](../../src/routes/archiv/+page.server.ts#L161)

- Die dritte Art im Typ; Grundlage für die vollständige Abbildung im Markup.
  [`+page.server.ts:107`](../../src/routes/archiv/+page.server.ts#L107)

**Das Wort an der Zeile und die Suche**

- Record statt ternär: eine vergessene Art bricht `npm run check`.
  [`+page.svelte:28`](../../src/routes/archiv/+page.svelte#L28)

**Prüfungen**

- Drei gesäte Behandlungen, je Zeile genau verglichen.
  [`smoke-zugang.ts:11001`](../../scripts/smoke-zugang.ts#L11001)

- Die Schlüsselmenge deckt die Never-Klauseln zu Name, Intervall, createdAt.
  [`smoke-zugang.ts:11047`](../../scripts/smoke-zugang.ts#L11047)

- Die Suche nach `Wellness` im echten Browser.
  [`smoke-sicht.ts:2455`](../../scripts/smoke-sicht.ts#L2455)

- Die Saat als Liste, damit smoke-sicht die Erwartung ableiten kann.
  [`pruefserver.ts:352`](../../scripts/pruefserver.ts#L352)
