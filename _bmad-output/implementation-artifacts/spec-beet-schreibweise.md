---
title: 'Eine Schreibweise je Beet, auf Ernte und Wellness'
type: 'feature'
created: '2026-10-26'
status: 'in-review'
baseline_commit: 'df663539d60c066ae439e3749d768b29063b4f31'
review_loop_iteration: 0
context: ['spec-ernte-nach-beet.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Der Ort ist Freitext und wird Zeichen für Zeichen verglichen. `42`, `Beet 42` und `B42` sind damit drei Beete, und die Gliederung nach Beet zerfällt. Die reale Liste vom 26.10.2026 mischt `6`, `B2`, `16/17`, `TU`, `Sector C`, `XY`.

**Approach:** Eine Nummer meint immer ein Beet. Die App schreibt den Ort in eine feste Form, bevor er gespeichert wird, und vorhandene Zeilen werden einmal in dieselbe Form gebracht. Gilt für Ernte **und** Wellness (Entscheid Manuel, 26.10.2026, Punkt C).

## Boundaries & Constraints

**Always:**
- Feste Form `Beet {Nummer}`: `42`, `Beet 42`, `beet 42`, `B42`, `B 42` werden zu `Beet 42`; `16/17` zu `Beet 16/17`; `B2` zu `Beet 2` (Entscheid: B2 = Beet 2).
- `Beet` kommt **nur vor eine reine Nummer** (Ziffern, auch `16/17`, auch mit vorangestelltem `B`). Jede andere Bezeichnung (`Sector C`, `XY`, `Tunnel`, `Tunnel 2`) überschreibt das vorbelegte `Beet ` und bleibt, wie sie geschrieben ist (Entscheid Manuel, 26.10.2026). Einzige Umschreibung ohne Nummer: `TU` wird zu `Tunnel` (Entscheid: TU = Tunnel).
- Die Vorbelegung `Beet ` im Ortsfeld bleibt (`ORT_VORGABE`, auf Ernte und Wellness schon heute) und ist überschreibbar.
- Die Regel steht an **einer** Stelle in `src/lib/` und wird von beiden actions und der einmaligen Umschreibung gelesen.
- Die einmalige Umschreibung vorhandener Zeilen ist eine Migration, vor dem Ausrollen mit Sicherung (`scripts/backup.sh`).

**Ask First:** Jede Form, die nicht in der Matrix steht.

**Never:** Gross/Klein von Namen ohne Nummer ändern (`Sector C` bleibt `Sector C`); eine Beet-Tabelle.

## I/O & Edge-Case Matrix

| Scenario | Input | Gespeichert |
|----------|-------|-------------|
| Nur Nummer | `42` | `Beet 42` |
| Schon richtig | `Beet 42` | `Beet 42` |
| Kürzel | `B2` | `Beet 2` |
| Doppelbeet | `33/34` | `Beet 33/34` |
| Tunnel | `TU`, `Tunnel 2` | `Tunnel`, `Tunnel 2` |
| Ohne Nummer | `Sector C`, `XY` | unverändert |
| Leer | `Beet ` | null |

</frozen-after-approval>

## Offene Fragen

1. ~~**`Sector C` und `XY`**~~ — geklärt am 26.10.2026: Bezeichnungen ohne Nummer überschreiben `Beet` und bleiben unverändert (Manuel).
2. ~~**Wellness**~~ — bestätigt am 26.10.2026 (Manuel): Wellness wird gleich vereinheitlicht wie die Ernte — beim Eintragen, beim Ändern einer Behandlung und in der einmaligen Umschreibung vorhandener Zeilen. Danach fallen `42` und `Beet 42` auch im Tagebuch, in `Steht wieder an` und im Archiv auf ein Beet. `spec-wellness-tagebuch-gebuendelt.md` (_Never_: „Normalisieren ... beim Bündeln") bleibt wörtlich richtig, weil nicht beim Bündeln, sondern beim Speichern vereinheitlicht wird; der Eintrag dort bekommt beim Bau einen Verweis hierher.

## Code Map

- `src/lib/ernte.ts` -- `ERNTE_HOECHSTLAENGE` (60) :232, `ORT_ZU_LANG` :238, `ORT_VORGABE` :277, `ortPruefen` :297–302 (faltet mit `aufgabentextFalten`, leer/Vorgabe → null, Länge). Hier hinein gehört der Aufruf der neuen Regel; Kommentar :279–296 mitziehen.
- `src/lib/beet.ts` -- geteiltes Modul seit Teil 1 (`leerZuletzt`, `natuerlich`); natürlicher Ort für die Regel `ortVereinheitlichen` (rein, ohne Abhängigkeiten, über nacktes Node ladbar).
- `src/routes/ernte/+page.server.ts` :139–157 `eintragen` → `ortPruefen`. `src/routes/wellness/+page.server.ts` `felderPruefen` :207–250 (ruft `ortPruefen` :227) für `eintragen` :265 und `aendern` :398; `wiederholen` :326 kopiert `vorlage.ort` (nach der Umschreibung unkritisch); `stelleLesen` :119 übernimmt versteckte Felder ungeprüft für `abschliessen`/`zuruecknehmen`.
- `src/lib/server/db/queries/treatments.ts` -- `amOrt` :146 vergleicht exakt (`eq(treatments.ort, ort)`) für `offeneAmOrtZaehlen` :160, `kulturAbschliessen` :185, `abschlussZuruecknehmen` :216: darum müssen **alle** alten Zeilen (offen und abgeschlossen) umgeschrieben werden. Kommentar :137–145.
- `src/lib/server/db/index.ts` :89 -- `migrate(…, { migrationsFolder: 'drizzle' })` in `datenschichtStarten` (hooks.server.ts:38, pruefserver, smoke-zugang, create-admin). Kein Vorbild für Datenmigration in `drizzle/` (kein UPDATE). Tabellen `harvests` (schema.ts:556) und `treatments` (schema.ts:820).
- `src/lib/wellness.ts` -- Kommentare :247–253 („Zeichen für Zeichen … `Beet 7` und `Beet7`"), :393, :476 werden teilweise unwahr; `spec-wellness-tagebuch-gebuendelt.md` :22/:33 bekommt einen Verweis.
- `scripts/smoke-zugang.ts` -- `ortPruefen` ist heute **nirgends** getestet; Ort-Proben an reinen Funktionen :10957–10998 (`Beet 03`/`Beet 3` bleiben beim Bündeln zwei — gilt weiter, die Vereinheitlichung liegt beim Speichern). `ERWARTETE_BEHAUPTUNGEN = 778` :282.
- `scripts/pruefserver.ts` -- Saat-Orte (`Hochbeet 3`, `Freiland`, `Beet 7`, `Beet 2`, null) sind schon in fester Form; die Umschreibung ändert keinen.
- `scripts/db-check.ts` -- Drift-Prüfung (generate gegen Schema); eine reine Datenumschreibung ohne Schemaänderung bleibt grün.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/beet.ts` -- reine Funktion `ortVereinheitlichen(ort: string): string` nach der Matrix und den Entscheiden im Change Log -- die eine Stelle der Regel.
- [x] `src/lib/ernte.ts` -- `ortPruefen` faltet, vereinheitlicht, prüft dann Länge und leer -- Ernte und Wellness lesen damit dieselbe Regel.
- [x] `src/lib/server/db/index.ts` (oder ein Modul daneben) -- nach `migrate()` ein idempotenter Schritt, der in `harvests` und `treatments` jede Zeile mit `ortVereinheitlichen(ort) !== ort` umschreibt, in einer Transaktion -- vorhandene Zeilen fallen auf ein Beet, auch `abschliessen` trifft sie.
- [x] Kommentare `src/lib/wellness.ts`, `treatments.ts`, `spec-wellness-tagebuch-gebuendelt.md` (Verweis) -- nichts behaupten, was nicht mehr stimmt.
- [x] `scripts/smoke-zugang.ts` -- Proben je Matrixzeile an `ortVereinheitlichen` und an `ortPruefen`; Probe für den Startschritt (Zeilen `42` und `Beet 42` in beiden Tabellen → nach `datenschichtStarten` eine Stelle; zweiter Lauf ändert nichts) -- jede einmal rot vorgeführt.

**Acceptance Criteria:**
- Given eine Ernte mit Ort `13` und eine mit `Beet 13`, when der Server startet, then stehen beide auf /ernte unter einem Beet `Beet 13`.
- Given Wellness-Zeilen `42` und `Beet 42` derselben Kultur, when abgeschlossen wird, then schliesst ein Klick beide ab.
- Given Eingabe `b 2` im Ortsfeld, when eingetragen, then gespeichert `Beet 2`.
- Given `npm run build && npm run lint && npm run check`, then grün.

## Spec Change Log

- **2026-10-26, vor dem Bau — Entscheide unter der Übertragung von Manuel („melde dich bei Problemen und wenn fertig"), Ask First der Matrix:**
  - Gross/Klein egal für das Präfix: `beet 2`, `BEET 2`, `b2`, `B 2` → `Beet 2`; `tu`, `Tu` → `Tunnel`.
  - Führende Nullen fallen weg: `03`, `Beet 03` → `Beet 3` (sonst blieben `Beet 3` und `Beet 03` zwei Beete, genau das, was die Spec beheben soll).
  - Doppelbeete mit Leerzeichen um den Schrägstrich: `16 / 17` → `Beet 16/17`; je Teil führende Nullen weg.
  - Länge wird **nach** dem Vereinheitlichen geprüft (60 Zeichen wie heute).
  - Umschreibung als **TS-Schritt beim Start** nach `migrate()`, nicht als SQL-Migration: SQLite kennt keine Regex, und eine GLOB-Fassung wäre die zweite Kopie der Regel neben `src/lib/beet.ts`. Idempotent, darum unschädlich bei jedem Start; ändert nur Zeilen, deren Ort sich ändert. Kein Vorbild im Repo — bewusst neu.
  - Hingenommen: Fallen zwei frühere Stellen zusammen und tragen Abschlüsse mit gleichem `abgeschlossenAm`, verschmelzen sie im Archiv zu einem Eintrag. ~~Eine vor dem Neustart geladene Seite trifft beim Abschliessen keine Zeile mehr und bekommt den Satz für die veraltete Seite.~~ Überholt im Review vom 26.10.2026: `stelleLesen` fasst den Ort aus dem versteckten Feld mit `ortFassen`, eine alte Seite mit `42` trifft die Zeilen unter `Beet 42`.
  - Vermiedener Zustand: eine Regel in zwei Sprachen, die auseinanderläuft; `Beet 03` neben `Beet 3`.
- **2026-10-26 (R3):** Die Spec liegt mit rund 1140 Wörtern (`wc -w`) über dem Zielband. Sie trägt ein einziges Ziel (eine Regel, ihre zwei Leser, die Umschreibung); Grösse als Annahme abgenommen unter der Übertragung vom 26.10.2026. `baseline_commit` auf den Stand nach Teil 1 gesetzt — der Entwurf trug noch den von Teil 1.
- **2026-10-26, beim Bau — Formen ausserhalb der Matrix (Ask First, unter der Übertragung entschieden):**
  - `Beet42` (Präfix ohne Lücke) wird `Beet 42`. Grund: es ist dieselbe reine Nummer mit dem Präfix, und `src/lib/wellness.ts` nannte genau `Beet 7`/`Beet7` als den Preis der Zeichen-für-Zeichen-Gleichheit. Vermiedener Zustand: zwei Beete aus einer fehlenden Lücke.
  - Mehr als ein Schrägstrich (`1/2/3`) ist kein Doppelbeet und bleibt unverändert; `TU` mit Zusatz (`TU 2`) bleibt ebenfalls unverändert. Grund: beides steht in keiner Zeile der Matrix, und die Spec erlaubt nur `TU` als Umschreibung ohne Nummer. Vermiedener Zustand: eine Regel, die mehr umschreibt, als entschieden ist.
  - `0` und `00` werden `Beet 0` (Nullen gekürzt, die letzte Ziffer bleibt).
- **2026-10-26, beim Bau — Startschritt:** `orteVereinheitlichen(handle)` steht in `src/lib/server/db/index.ts`, gerufen nach `migrate()`; ein Fehler wird eine benannte Meldung wie bei der Migration, und die Transaktion lässt dann jeden Ort unverändert. Die Funktion ist exportiert, damit die Probe den zweiten Lauf zählen kann. Hingenommen: ein Ort, der vereinheitlicht über 60 Zeichen wächst (eine Ziffernfolge mit mehr als 55 Stellen), wird beim Start trotzdem geschrieben — der Startschritt prüft keine Länge, weil er nichts abweisen kann.
- **2026-10-26, beim Bau — Prüfung:** das Abnahmekriterium `b 2` → `Beet 2` ist an der action von /wellness (Eintragen und Ändern) gemessen. /ernte ruft dieselbe `ortPruefen` (`src/routes/ernte/+page.server.ts`), hat aber in `smoke-zugang.ts` keine Attrappe; dort ist nur die geteilte Funktion gemessen. Beim Vorführen gefunden: der zweite Lauf der Umschreibung stand in der Probe zuerst **vor** dem Lesen und holte die Arbeit des Starts nach — ohne den Aufruf in `datenschichtStarten` blieben Ernte- und Wellness-Probe grün. Er steht jetzt zuletzt; die Mutation macht vier Proben rot.
- **2026-10-26, Review (Befunde des Koordinators, unter der Übertragung von Manuel):**
  - Neuer Entscheid: eine Nummer mit **einem** Buchstaben dahinter gilt als Nummer, der Buchstabe wird klein gesetzt (`2a`, `B2a`, `beet 2A` → `Beet 2a`; je Teil eines Doppelbeets, `16a/17` → `Beet 16a/17`). Grund: Teilbeete heissen so, und `Beet 2A` neben `Beet 2a` wären zwei Beete. Vermiedener Zustand: dieselbe Fläche unter zwei Schreibweisen.
  - Neuer Entscheid: steht am Anfang das Wort `TU` oder `Tunnel` (beliebige Gross- und Kleinschreibung, gefolgt von nichts oder einem Leerzeichen), wird es `Tunnel`, der Rest bleibt (`tunnel` → `Tunnel`, `TUNNEL 2` und `TU 2` → `Tunnel 2`). `Tunnelbeet` und `TU2` sind kein solches Wort und bleiben. Damit ist der frühere Satz „`TU 2` bleibt unverändert" überholt. Grund: `Tunnel 2` und `TU 2` meinen dasselbe. Vermiedener Zustand: zwei Tunnel aus einer Abkürzung.
  - `beet`, `BEET` allein (auch mit Leerraum) gelten wie die Vorgabe als leer → null. Vermiedener Zustand: eine Zeile mit dem Ort `beet`, die nichts sagt.
  - Eine Fassung für drei Leser: `ortFassen` (src/lib/ernte.ts) faltet, vereinheitlicht und macht leer oder `Beet` allein zu null; `ortPruefen` prüft danach die Länge, `stelleLesen` auf /wellness und der Startschritt rufen `ortFassen` direkt. Vermiedener Zustand: ein Startschritt, der ungefaltete alte Werte (` 42`, `Beet  42`) und `Beet` allein stehen lässt, und eine zweite Kopie der Schritte.
  - Startschritt: Transaktion mit `behavior: 'immediate'` (sonst SQLITE_BUSY_SNAPSHOT unter WAL, wenn ein zweiter Prozess zwischen Lesen und Schreiben schreibt); die Tabellen mit `ort` sind aus dem Schema abgeleitet (`tabellenMitOrt`), eine Schleife statt zwei; geprüft in `smoke-zugang` gegen `PRAGMA table_info` der migrierten Datei. Kein eindeutiger Index enthält `ort` (Schema gelesen, in `smoke-zugang` über `PRAGMA index_list` geprüft). Die Zeilenzahl ohne Messweg ist aus dem Kommentar gestrichen. Grenze, nicht abgesichert: dass `IMMEDIATE` das Wettrennen schliesst, ist begründet und am Quelltext von drizzle belegt (`nativeTx[config.behavior]`), aber in keinem Lauf vorgeführt — die Lücke zwischen Lesen und Schreiben lässt sich von aussen nicht treffen.
  - Die Meldung eines gescheiterten Starts nennt jetzt auch die Ursache (`cause`); drizzle legt den Grund eines SQLite-Fehlers dorthin, und ohne ihn sagte die Meldung nur, welche Abfrage scheiterte.
  - Benannte Folge: ein Ort, der beim Start über 60 Zeichen wächst, steht gespeichert, wird aber beim Ändern einer Behandlung mit `ORT_ZU_LANG` abgewiesen.
  - README, Abschnitt _Wenn etwas nicht startet_, Punkt _Ein Update einspielen_: vor diesem Update `sh scripts/backup.sh`. Der Auftrag nahm an, die Sicherung laufe dort schon vor dem Update; das stimmte nicht (dort stand nur `git pull && docker compose up -d --build`, die Sicherung läuft nächtlich per Cron). Darum steht dort jetzt ein Schritt und nicht nur ein Grund.
  - Zähler: `ERWARTETE_BEHAUPTUNGEN` 778 → 798 (erster Bau) → 810. Messweg: das Skript zählt jede abgelegte Behauptung und vergleicht am Ende mit der Konstante; grün heisst, genau so viele sind gelaufen. Der erste Bau legte 20 ab: 11 Matrixzeilen, 2 action-Proben, 1 Saat-Exit, 4 Startproben, dazu 2, die `starten()` selbst für jeden Unterprozess ablegt („Unterprozess … ist gelaufen") — die zählt, wer nur die `pruefen`-Aufrufe im Block liest, nicht mit (18). Dazu kommen jetzt 12: 3 Matrixzeilen, Eintragen auf /ernte, alte Seite mit `42`, Exit des Neustarts, Abgleich der Tabellen, eindeutiger Index, 2 Zeilen zum Fehlerpfad und 2 weitere `starten()`.

## Verification

**Commands:**
- `npm run build && npm run lint` -- grün, Zähler nachgeführt.
- `npm run check` -- 0 Fehler, 0 Warnungen.
