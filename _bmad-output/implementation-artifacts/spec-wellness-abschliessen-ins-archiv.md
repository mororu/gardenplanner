---
title: 'Wellness: Kultur im Beet abschliessen, erst dann ins Archiv'
type: 'feature'
created: '2026-10-12'
status: 'done'
baseline_commit: '7aab327bf090fb1c244463f2541b946e70e7f4a6'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Seit `ee5af00` steht jede einzelne Behandlung sofort im Archiv, auch solange die Reihe noch läuft. Das Archiv soll aber nur zeigen, was fertig ist (Manuel, 12.10.2026).

**Approach:** Auf `/wellness` lässt sich eine **Kultur im Beet** abschliessen (z. B. «Tomaten in Beet 3», alle Mittel). Abgeschlossenes verschwindet von `/wellness` und steht erst dann im Archiv, als **eine** Zeile je Abschluss. Direkt nach dem Abschliessen lässt er sich auf `/wellness` rückgängig machen. «Wegnehmen» bleibt endgültiges Löschen eines Fehleintrags (Entscheide Manuel, 12.10.2026).

## Boundaries & Constraints

**Always:**
- Neue nullbare Spalte `treatments.abgeschlossen_am` (Unix-Sekunden), Migration über `npm run db:generate`. Offen heisst `abgeschlossen_am IS NULL`.
- Abschliessen trifft alle **offenen** Zeilen mit gleichem Ort und gleicher Kultur (null-gleich-null, Zeichen für Zeichen wie `stelle`), mit **einem** gemeinsamen Zeitpunkt.
- Abgeschlossene Zeilen erscheinen nirgends mehr, wo heute offene gelesen werden: Tagebuch, `Steht wieder an`, Planzeile `{n} Wellnessbehandlung(en) fällig` auf `/`.
- Knopf `Abschliessen` am Kulturtitel im gebündelten Tagebuch, auch bei `Ohne Kultur`. **Nachverhandelt am 12.10.2026 (Manuel, nach dem Review): mit Rückfrage**, nach dem Muster der Wegnehmen-Rückfrage (erster Klick fragt, ohne JavaScript über die action ohne `bestaetigt`), Text z. B. `Tomaten in Beet 3 abschliessen? Die Behandlungen verschwinden von hier und stehen danach im Archiv.` mit `Abbrechen` (zuerst) und `Abschliessen`. Grund: `Rückgängig` hält nur bis zum nächsten Laden.
- Nach dem Abschliessen Meldung `Abgeschlossen: {Kultur}, {Beet}.` mit Knopf `Rückgängig`; er setzt genau die Zeilen dieses Abschlusses (Ort, Kultur, Zeitpunkt) wieder auf offen. Der Knopf lebt nur in dieser Meldung, nach dem nächsten Laden ist er fort. Funktioniert ohne JavaScript.
- Archiv: einzelne Behandlungen stehen dort **nicht mehr**. Je Abschluss (Ort, Kultur, Zeitpunkt) eine Zeile: Text `{Beet} · {Kultur}` (`Ohne Beet`/`Ohne Kultur` wie im Tagebuch), darunter die Mittel mit Anzahl, z. B. `Schachtelhalm 4×, Brennnesseljauche 2×` (Mittel nach jüngster Anwendung zuerst), darunter `{Abschlussdatum} · Wellness`. Kein Name. Datum und Monat ist der Abschluss.
- Die Suche im Archiv findet auch die Mittel dieser Zeile.
- `/archiv` bleibt ohne action.

**Ask First:** Abschliessen ganzer Beete oder einzelner Mittel; Rückgängig aus dem Archiv heraus; Änderung an `Wegnehmen`.

**Never:** Abgeschlossene Zeilen löschen oder kopieren; den Namen der eintragenden Person ins Archiv geben; `intervallTage`/`createdAt` in die Archiv-Seitendaten.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Abschluss | Beet 3/Tomaten: Schachtelhalm 4×, Jauche 2× offen | alle 6 abgeschlossen, von `/wellness` und aus `Steht wieder an` fort; Archiv eine Zeile `Beet 3 · Tomaten` / `Schachtelhalm 4×, Brennnesseljauche 2×` | N/A |
| Andere Kultur | Beet 3/Kohl offen | bleibt offen | N/A |
| Rückgängig | direkt nach dem Abschluss | alle 6 wieder offen, Archivzeile fort | N/A |
| Ohne Kultur/Ort | Kompost, null, null | `Ohne Beet · Ohne Kultur` | N/A |
| Neue Reihe | nach Abschluss neuer Eintrag Beet 3/Tomaten | neue offene Gruppe; späterer zweiter Abschluss gibt zweite Archivzeile | N/A |
| Veraltet | Abschliessen, aber nichts mehr offen (zweites Gerät) | nichts geändert | Satz wie `BEHANDLUNG_NICHT_ANSPRECHBAR` |

</frozen-after-approval>

## Code Map

- `src/lib/server/db/schema.ts` -- `treatments` (ab ca. :770): Spalte ergänzen, Kommentar wie die Nachbarspalten; `drizzle/` neue Migration 0013.
- `src/lib/server/db/queries/treatments.ts` -- `behandlungenLesen` (:89) auf offen beschränken; neue Abfragen für Abschliessen, Zurücknehmen und abgeschlossene Zeilen. Leser: `src/routes/wellness/+page.server.ts`, `src/routes/+page.server.ts` (:400 ff., fällig), `src/routes/archiv/+page.server.ts`.
- `src/routes/wellness/+page.server.ts` / `+page.svelte` -- neue actions `abschliessen` und `zuruecknehmen` (literale `action="?/…"`, Gate-Regel 11); Kulturtitel im gebündelten Tagebuch (`buendeln`, src/lib/wellness.ts:435); Meldungs-/Fokuslogik `versand`; `abweisen` aus src/lib/server/abweisen.ts.
- `src/routes/archiv/+page.server.ts` / `+page.svelte` -- `ausDemTagebuch` (:133) ersetzen durch abgeschlossene Gruppen; `Archivzeile` um eine Zusatzzeile erweitern (null für Aufgabe/Termin); `durchsuchbar` liest sie mit.
- `scripts/smoke-zugang.ts`, `scripts/smoke-sicht.ts`, `scripts/pruefserver.ts` -- bestehende Wellness-im-Archiv-Proben (Schlüssel `wellness-{id}`, drei gesäte Zeilen, Wellness-Suche) auf Abschlüsse umstellen; `ERWARTETE_BEHAUPTUNGEN` nachziehen; `scripts/db-check.ts` falls er Spalten zählt.

## Tasks & Acceptance

**Execution:**
- [x] Schema, Migration, Abfragen -- Spalte, offen/abgeschlossen lesen, abschliessen, zurücknehmen.
- [x] `/wellness` -- Knopf, actions, Meldung mit Rückgängig, mit und ohne JavaScript.
- [x] `/` -- fällig zählt nur Offenes (über `behandlungenLesen`, kein zweiter Filter).
- [x] `/archiv` -- Abschlusszeilen statt Einzelbehandlungen, Suche.
- [x] Prüfungen -- jede Matrixzeile; Mutationen vorführen und festhalten.

**Acceptance Criteria:**
- Given eine abgeschlossene Kultur, when `/`, `/wellness` und `/archiv` geladen werden, then fehlt sie in Planzeile, Tagebuch und `Steht wieder an` und steht als eine Zeile im Archiv.
- Given die Prüfkette, when sie läuft, then ist sie grün; `db:check` kennt die Migration.

## Verification

**Grüner Lauf am 12.10.2026** (nach dem Review und der Rückfrage): `npm run build`; `npm run lint` mit gate (sechzehn Regeln), gate:selftest (46 Fehlerproben), kontrast:selftest 24, db:check samt Selbsttest (3 Fehlerproben), smoke 773, smoke:selftest 15, smoke:http 191, smoke:sicht 106 — gezählt, wie die Läufe sie melden, also je mit der Schlusszählung (`ERWARTETE_BEHAUPTUNGEN` steht je eins tiefer: 772, 14, 190, 105); `npm run check` 0 Fehler; `npm run db:check` grün.

**Commands:**
- `npm run build && npm run lint` -- grün (inkl. `smoke:sicht`, braucht Chrome).
- `npm run check` -- 0 Fehler. `npm run db:check` -- grün.

## Spec Change Log

- **2026-10-12 — Ändern, Wegnehmen und Wiederholen treffen nur offene Zeilen.** Nicht wörtlich im Spec, aber aus _Never_ abgeleitet (abgeschlossene Zeilen nicht löschen oder kopieren): `behandlungLesen`, `behandlungAendern` und `behandlungWegnehmen` tragen seither `abgeschlossen_am IS NULL`. Vermeidet den Zustand, dass eine veraltete Seite eine Zeile löscht oder umschreibt, die schon im Archiv steht. Eine Kennung einer abgeschlossenen Zeile bekommt `BEHANDLUNG_NICHT_ANSPRECHBAR`.
- **2026-10-12 — Der Abschlusszeitpunkt ist je Ort und Kultur eindeutig.** Liegt schon ein Abschluss derselben Kultur auf oder nach `jetzt`, nimmt `kulturAbschliessen` eine Sekunde danach. Vermeidet, dass zwei Abschlüsse in derselben Sekunde (Matrixzeile _Neue Reihe_) zu einer Archivzeile zusammenfliessen und ein Rückgängig des zweiten auch den ersten öffnet.
- **2026-10-12 — „Satz wie `BEHANDLUNG_NICHT_ANSPRECHBAR`" ist dieser Satz selbst.** Keine neue Konstante; dieselbe Lage (veraltete Seite), dieselbe Handlung (neu laden).
- **2026-10-12 — Der Hinweissatz auf /archiv nennt die abgeschlossenen Kulturen mit**, der auf /wellness sagt, dass eine fertige Kultur abgeschlossen wird und dann im Archiv steht. Sonst behaupteten beide Sätze einen Stand, den es nicht mehr gibt.

- **2026-10-12 — Nach der Migration sind alle bestehenden Behandlungen offen** (`abgeschlossen_am` ist null). Die seit `ee5af00` einzeln im Archiv stehenden Wellnesszeilen verschwinden darum aus dem Archiv, bis die erste Kultur abgeschlossen wird. Gewollt: das Archiv zeigt nur noch, was fertig ist.
- **2026-10-12 (Review) — Fehlt `ort` oder `kultur` im POST oder trägt eines eine Datei, weisen `abschliessen` und `zuruecknehmen` mit `BEHANDLUNG_NICHT_ANSPRECHBAR` ab.** Vorher galt ein fehlendes Feld als null und schloss die echte Gruppe `Ohne Beet`/`Ohne Kultur`.
- **2026-10-12 (Review) — `Rückgängig` lebt nur in der Oberfläche in der Meldung.** Die action `zuruecknehmen` nimmt jeden Abschluss mit passendem Ort, Kultur und Zeitpunkt zurück — dieselbe Offenheit wie Ändern und Wegnehmen. Steht schon eine neue offene Reihe derselben Kultur, fliessen die zurückgenommenen Zeilen mit ihr zu einer Gruppe zusammen (gewollt, geprüft).
- **2026-10-12 (Review) — Der Knopf `Abschliessen` wird über `aria-describedby` mit Kultur und Beet beschrieben** (`Tomaten Beet 7`), nicht nur mit der Kultur.
- **2026-10-12 (Review) — Ein Typ für abgeschlossene Zeilen**: `AbgeschlosseneAnwendung` in src/lib/wellness.ts; die Abfrage liefert ihn, `AbgeschlosseneBehandlung` ist entfallen.

- **2026-10-12 (Manuel, nach dem Review) — Rückfrage vor dem Abschliessen**, gebaut nach dem Muster der Wegnehmen-Rückfrage: ein POST auf `abschliessen` ohne `bestaetigt` liest nur (`offeneAmOrtZaehlen`) und antwortet `fragenAbschliessen` mit Ort und Kultur, oder mit `BEHANDLUNG_NICHT_ANSPRECHBAR`, wenn nichts offen ist. Die Frage steht an Stelle des Knopfs an der Kultur (`{Kultur} in {Beet} abschliessen? …`, mit `Ohne Kultur`/`Ohne Beet`), `Abbrechen` zuerst als Link, `Abschliessen` mit `bestaetigt=1`. Das Beet steht während der Frage offen — vom Server über `beetOffen`, mit JavaScript über `aufklappen`. Kein Fokussprung, wie beim Wegnehmen. Alle Proben in `smoke`, die direkt abschliessen, schicken jetzt `bestaetigt=1`; die Saat in scripts/pruefserver.ts schliesst über die Abfrageschicht ab und ist davon nicht berührt.

### Vorgeführte Mutationen (je absichtlich rot gemacht, danach zurückgesetzt)

`smoke` (scripts/smoke-zugang.ts, 755 Behauptungen):
- `behandlungenLesen` ohne `.where(offen)` — 5 rot (Abschluss, fällig-Zahl/`Steht wieder an`, Fremdgriff, Neue Reihe, Rückgängig des zweiten).
- Zeitpunkt nicht eindeutig (`abgeschlossenAm = jetzt`) — 3 rot (zweite Archivzeile, Rückgängig des zweiten, Schlüsselmenge mit Zeilenzahl).
- null nicht gleich null (`eq(ort, ort ?? '')`) — 4 rot (load-Ordnung inkl. Wellnesszeile, `Ohne Beet · Ohne Kultur`, Rückgängig lässt den anderen Abschluss, Schlüsselmenge).
- `behandlungWegnehmen` ohne `offen` — 3 rot; `behandlungLesen` ohne `offen` (Wiederholen kopiert) — 5 rot; `behandlungAendern` ohne `offen` — 2 rot.
- `abschlussZuruecknehmen` ohne Zeitpunkt in der Bedingung — 2 rot.
- Mittelordnung umgedreht in `abschluesseBuendeln` — 2 rot.

`smoke:sicht` (scripts/smoke-sicht.ts, 99 Behauptungen):
- `zeile.zusatz` aus `durchsuchbar` genommen — 1 rot (Suche nach `Beinwell`).
- Zusatz in der load auf null — 2 rot (Wellness-Suche, Mittelsuche).
- `abschluss` in /wellness immer null (kein Rückgängig) — rot ab der Probe ohne JavaScript, der Lauf bricht danach ab.
- `behandlungenLesen` ohne `.where(offen)` — 5 rot (Beetordnung, Karten, ohne/mit JavaScript, nach dem Neuladen).

Nach dem Review (2026-10-12), `smoke` (769 Behauptungen):
- Fehlende Felder als null gelesen (`textLesen`-Verhalten in `stelleLesen`) — 7 rot: jede der fünf Proben zu fehlenden Feldern einzeln (je mit eigener offener Zeile), die Zeilen ohne Ort und Kultur, die Mischfälle.
- `abgeschlossenAm = jetzt` — 4 rot, darunter die deterministische Probe mit festem T (`0 / 0 / 1` statt `0 / 1 / 2`).
- Kultur in `amOrt` ignoriert — 5 rot, darunter „eine andere Kultur im selben Beet bleibt offen" (Kohl).
- `uebernehmer: 'Wanda'` an der Wellnesszeile der load — 2 rot (Archivzeile, Name in den Seitendaten).
- Kompost-Abschluss in der Saat weggelassen — 5 rot, darunter die load-Ordnung mit der neuen Bedingung `.some(art === 'wellness')`.
- UPDATE in `kulturAbschliessen` ohne `offen` — 7 rot, darunter „Veraltet … abgewiesen" und „und ändert dabei nichts".
- Fehlender Zeitpunkt nimmt alle Abschlüsse der Stelle zurück (Route ohne Prüfung, Abfrage mit `isNotNull` bei null) — 2 rot (ohne Zeitpunkt; keiner der Versuche ändert etwas). Die Probe „Zeitpunkt keine Zahl" liest denselben Zweig (`zahlLesen` gibt null).
- `abschlussZuruecknehmen` ohne Ort und Kultur — 5 rot, darunter „richtiger Zeitpunkt, anderer Ort".
- Kultur null als `''` verglichen — 6 rot; Ort null als `''` — 6 rot, je mit dem Mischfall.
- `abschlussZuruecknehmen` verweigert, solange eine offene Reihe steht — 2 rot, darunter das Zusammenfliessen.

Nach dem Review, `smoke:sicht` (101 Behauptungen):
- `aria-describedby` nur auf die Marke — 1 rot (Beschreibung `Tomaten` statt `Tomaten Beet 7`).
- Kein Fokussprung nach `zurueckgenommen` — 1 rot (Fokus auf `body`).
- Kein Fokussprung nach `abgeschlossen` — 1 rot (`fokusAufMeldung`).
- `Rückgängig`-Formular mit `display: none` — 1 rot (`knopfSichtbar`). Ein blosses `hidden` wird von `.rueckgaengig { display: flex }` überstimmt und war darum keine Mutation.
- Abschluss aus den Seitendaten statt aus `form` — 3 rot, darunter „nach dem nächsten Laden ist Rückgängig fort".
- Verstecktes Feld `ort` umbenannt — 6 benannte rote Behauptungen, kein TypeError.

Rückfrage vor dem Abschliessen, `smoke` (772) und `smoke:sicht` (105):
- Server ignoriert `bestaetigt` (schliesst beim ersten POST ab) — `smoke` 7 rot, darunter „fragt nur zurück" und „lässt die Datenbank unverändert"; `smoke:sicht` 10 rot, darunter der erste Klick mit und ohne JavaScript.
- Bestätigen-Formular ohne `bestaetigt` — `smoke:sicht` 7 rot, darunter „die Bestätigung schliesst ab" mit und ohne JavaScript.
- `Abbrechen` führt nach /archiv — `smoke:sicht` 3 rot, darunter „Abbrechen lässt alles offen" mit und ohne JavaScript.
- `aufklappen` für die Abschliessen-Frage entfernt — `smoke:sicht` 2 rot (Frage im zugeklappten Beet nicht zu sehen; Abbrechen nicht erreichbar). Die Probe klickt `Abbrechen` nur, wenn er zu sehen ist, und lädt danach frisch — kein Wurf mehr.
- `beetOffen` ohne die Frage (Server öffnet das Beet nicht) — `smoke:sicht` 1 rot (ohne JavaScript).

## Suggested Review Order

**Abschliessen**

- Einstieg: die action mit Rückfrage, erst `bestaetigt` schliesst ab.
  [`+page.server.ts:517`](../../src/routes/wellness/+page.server.ts#L517)

- Ein gemeinsamer, je Ort und Kultur eindeutiger Zeitpunkt für alle offenen Zeilen.
  [`treatments.ts:185`](../../src/lib/server/db/queries/treatments.ts#L185)

- Rückgängig trifft genau die Zeilen eines Abschlusses.
  [`treatments.ts:216`](../../src/lib/server/db/queries/treatments.ts#L216)

**Archiv**

- Je Abschluss eine Zeile mit Mitteln und Anzahl.
  [`wellness.ts:520`](../../src/lib/wellness.ts#L520)

- Die load liest Abschlüsse statt Einzelbehandlungen.
  [`+page.server.ts:151`](../../src/routes/archiv/+page.server.ts#L151)

**Peripherie**

- Migration: eine nullbare Spalte.
  [`0013_acoustic_centennial.sql:1`](../../drizzle/0013_acoustic_centennial.sql#L1)
