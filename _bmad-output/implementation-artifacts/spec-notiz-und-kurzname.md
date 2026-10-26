---
title: 'Notiz an der Erntezeile und Kurzname je Person'
type: 'feature'
created: '2026-10-26'
status: 'in-review'
baseline_commit: '97ad1f76088b37eba9b096f55ddd620163bb9876'
review_loop_iteration: 0
context: ['spec-ernte-nach-beet.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** (a) Was jemand zur Ernte weiss, hat keinen Platz: „frühe Sorte, sehr gross, pflücken und evtl. kurz einfrieren", „wenig", „zuerst" (Liste vom 26.10.2026). (b) Auf der Erntekarte soll stehen, wer eingetragen hat; im Garten gibt es zwei Personen mit gleichem Vornamen und gleichem Anfangsbuchstaben des Nachnamens. `members.name` ist ein einziges Feld, ein Nachname lässt sich daraus nicht verlässlich lesen.

**Approach:** (a) Eine freiwillige Notiz an der Erntezeile. (b) Ein freiwilliger Kurzname je Person, gepflegt in der Verwaltung (Entscheid Manuel, 26.10.2026: Kurzname statt automatischer Ableitung).

## Boundaries & Constraints

**Always:**
- `harvests.notiz`: nullbar, leer = null, Längengrenze in TypeScript neben `ERNTE_HOECHSTLAENGE`. Im Eintragen-Formular ein freiwilliges Feld; auf der Karte klein unter der Kultur. **Später änderbar** an der Karte (eigene action, jedes aktive Mitglied darf, wie Umstufen; leeren entfernt die Notiz) — Entscheid Manuel, 26.10.2026.
- `members.kurzname`: nullbar. Leer gilt das erste Wort von `name`. In der Verwaltung beim Aufnehmen und Umbenennen setzbar.
- Die Verwaltung **warnt**, wenn zwei aktive Personen denselben angezeigten Kurznamen haben; sie weist nicht ab.
- Beide Spalten per Migration, vor dem Ausrollen Sicherung.
- Der Kurzname ersetzt den Namen **überall**, wo die Oberfläche eine Person nennt (Entscheid Manuel, 26.10.2026). Die Fundstellen werden vor dem Bau aus dem Baum gesucht, nicht von Hand aufgezählt (R2); die Verwaltung selbst zeigt weiter den vollen Namen.

**Ask First:** Eine Fundstelle, an der der volle Name nötig scheint (z. B. Rückfragen, Archiv).

**Never:** Den Nachnamen aus `name` ableiten.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output |
|----------|--------------|-----------------|
| Kein Kurzname | `Manuel Agner` | `Manuel` |
| Kurzname gesetzt | `Nici Müller`, Kurzname `Nici Mü` | `Nici Mü` |
| Doppelt | zwei aktive `Nici` ohne Kurzname | Warnung in der Verwaltung |
| Notiz leer | `` | keine Notizzeile |

</frozen-after-approval>

## Offene Fragen

1. ~~**Notiz ändern**~~ — geklärt am 26.10.2026: ja, später änderbar.
2. ~~**Kurzname überall?**~~ — geklärt am 26.10.2026: ja, überall.

## Code Map

- `drizzle/` -- letzte Migration `0013_acoustic_centennial.sql`; neue über `npm run db:generate` (0014), Drift-Prüfung `npm run db:check` läuft in `lint`.
- `src/lib/server/db/schema.ts` -- `members` :31–57 (`name` :33), `ohneTokenHash` :87–96 von Hand ausgeschrieben (Gegenstück `ohneHashSpalte` in `queries/members.ts:76–101` mit `satisfies`); `harvests` :533–595.
- `src/lib/mitgliedsname.ts` -- `namePruefen` :84–91, `NAME_HOECHSTLAENGE` :48. Ort für `anzeigename(name, kurzname)` und `kurznamePruefen` (rein, über nacktes Node ladbar).
- `src/lib/server/abweisen.ts` :39–46, :82–90 -- **zwei Textslots, ausdrücklich kein dritter**. /ernte Eintragen belegt beide (Kultur, Ort).
- /ernte: `+page.server.ts` `eintragen` :128–170, `umstufen` :185 als Muster für eine neue action; `queries/harvests.ts` `anzeigeSpalten` :43–51 (`name: members.name`), `alsErntezeile` :107, `ernteEintragen` :141 (gibt `mitglied.name` zurück), `ernteUmstufen` :170; `src/lib/ernte.ts` `ortPruefen` :330 als Vorbild für eine freiwillige Notiz; `+page.svelte` Formular :402–530, Karte `.ernte__text` :610–618.
- Vorbild Ändern an Ort und Stelle: `src/routes/sitzungen/+page.svelte:352–380` (`details.aendern`, `summary.aendern__griff` mit `ZeichenStift` + `nur-vorgelesen`, `form.aendern__formulare action="?/aendern"`), Server `sitzungen/+page.server.ts:206–224`, Stile `bedienelemente.css:148–178`.
- Namen in der Oberfläche (alle umzustellen): `harvests.ts:49/:156` → `ernte/+page.svelte:617`; `treatments.ts:72/:301` (+ `wellness/+page.server.ts:293/:365`) → `wellness/+page.svelte:911`; `meetings.ts:98/:168/:229` → `sitzungen/+page.svelte:335/:462/:496`; `duty-weeks.ts:76/98/189/209/230/250` → `traenkeplan/+page.svelte:247`, Meldung `:43` (`traenkeplan/+page.server.ts:208/:340`); `signup-tasks.ts:81/:181/:318/:406` (+ `+page.server.ts:747`) → `einzelaufgaben/+page.svelte:91`, `archiv/+page.svelte:98/:435`; `mehr/+page.server.ts:30` → `mehr/+page.svelte:164`.
- Bleiben beim vollen Namen: /verwaltung; Admin-Auswahl im Tränkeplan `queries/members.ts:177–186` → `traenkeplan/+page.svelte:389`; Traktandenliste als Datei `src/lib/sitzung.ts:204` (siehe Change Log).
- /verwaltung: `aufnehmen` :155–170, `umbenennen` :292–341 (optimistisch über `bekannterName`), `queries/members.ts` `mitgliedAnlegen` :47, `mitgliedUmbenennen` :315; Markup Aufnehmen :438–455, Umbenennen :560–613 — Kurzname als zweites Feld passt in `zweiteEingabe`. `scripts/create-admin.ts` bleibt ohne Kurzname.
- Prüfkette: `pruefserver.ts:251/:253` („Vera Verwaltung", „Manu Mitglied"); smoke-http prüft volle Namen positiv :1039 (Admin-Auswahl, bleibt), :1852, :1927 und negativ :983, :1474, :1824, smoke-sicht :1418 — auf den Anzeigenamen umstellen, sonst werden die negativen still bedeutungslos; smoke-zugang Verwaltung :1932–2552, `Object.keys`-Proben :1421, :3519, :4468, :8337, :9775. Gate-Regel 11 (literales `action="?/…"`), 16 (`abweisen` aus dem geteilten Modul), 17 (`VERSAND_FEHLGESCHLAGEN` je Rückruf).

## Tasks & Acceptance

**Execution:**
- [x] `schema.ts`, `drizzle/0014_*` -- `harvests.notiz`, `members.kurzname` (beide nullbar) -- eine Migration.
- [x] `src/lib/mitgliedsname.ts` -- `anzeigename`, `kurznamePruefen` (gefaltet, leer → null, Länge) -- eine Stelle der Regel; kein SQL-Ausdruck für „erstes Wort".
- [x] `src/lib/ernte.ts` -- `notizPruefen` (freiwillig, Länge) nach dem Muster `ortPruefen`.
- [x] /ernte -- Notizfeld im Eintragen-Formular; Notiz klein unter der Kultur; Ändern an der Karte nach dem Vorbild /sitzungen (neue action, leeren entfernt) -- Gate-Regeln 11/16/17.
- [x] Abfragen und Seiten aus der Code Map -- Anzeigename statt `name`; `AngemeldetesMitglied`/`ohneTokenHash`/`ohneHashSpalte` mit `kurzname`.
- [x] /verwaltung -- Kurzname beim Aufnehmen und Umbenennen; Warnung bei gleichem Anzeigenamen zweier aktiver Personen.
- [x] Prüfkette -- Proben je Matrixzeile, Notiz eintragen/ändern/leeren, Warnung, Anzeigename auf jeder umgestellten Seite (die negativen Namensproben auf den Anzeigenamen) -- jede neue Wache einmal rot.

**Acceptance Criteria:**
- Given „Nici Müller" mit Kurzname „Nici Mü", when sie eine Ernte einträgt, then steht „Nici Mü" auf der Karte, im Tränkeplan, bei übernommenen Terminen und im Archiv.
- Given eine Erntezeile mit Notiz, when jemand die Notiz leert, then fällt die Notizzeile weg.
- Given `npm run build && npm run lint && npm run check`, then grün.

## Spec Change Log

- **2026-10-26, vor dem Bau — Entscheide unter Manuels Übertragung („melde dich bei Problemen und wenn fertig"):**
  - **Notiz im Eintragen-Formular ohne dritten Rückweg.** `abweisen` trägt bewusst nur zwei Textslots (Kultur, Ort). Die Notiz bekommt `maxlength` gleich der Servergrenze, eine Längenabweisung entsteht also nur über einen gebauten POST. Hingenommen: wird ohne JavaScript Kultur oder Ort abgewiesen, ist die getippte Notiz fort (mit JavaScript bleibt sie im Feld). Vermiedener Zustand: ein dritter Slot gegen eine ausgeschriebene Entscheidung in `abweisen.ts`.
  - **Notiz bis 200 Zeichen**, Kurzname bis 20 Zeichen (gefaltet, Codepoints gezählt wie `namePruefen`).
  - **Ask-First-Fundstellen mit vollem Namen:** die Admin-Auswahl im Tränkeplan (wer jemanden einträgt, muss zwei Personen mit gleichem Kurznamen unterscheiden können — dieselbe Lage wie /verwaltung) und die Traktandenliste als abgelegte Datei (ein Dokument ausserhalb der App, das in Jahren noch lesbar sein soll). Überall sonst der Anzeigename.
  - **Zwei Ziele in einer Spec** (Notiz, Kurzname): so am 26.10.2026 als Teil 3 geschnitten und abgenommen; über dem Zielband (R3), Grösse als Annahme abgenommen.

- **2026-10-26, beim Bau — der Stift statt `details.aendern`.** Die Code Map nannte /sitzungen als Vorbild (ein `<details>` mit Stift unter der Zeile). Gebaut ist ein dritter kleiner Knopf (Stift) neben `Sofort` und dem X, und die action `notizAendern` arbeitet in zwei Schritten wie `abernten`: ein POST ohne Feld `notiz` antwortet mit `notizFragen` und dem Feld an der Zeile (an der Stelle der Rückfrage), erst ein POST mit dem Feld schreibt — auch leer, und leer entfernt. Grund: die Karte ist seit spec-ernte-nach-beet.md einzeilig, und ein Griff unter der Zeile kostete jede Karte eine Zeile mehr (Rückmeldung Manuel vom 26.10.2026: „die Kacheln sind grösser als im interaktiven Bild"). Vermiedener Zustand: zwanzig Karten mit je einer Zeile, auf der allein ein Stift steht. Ohne JavaScript trägt es wie die Rückfrage. **Sichtbar zu prüfen:** drei Knöpfe rechts lassen der Kultur bei 375px rund 150px (gemessen im Sichtlauf: Sofort 58px, Stift und X je 32px).
- **2026-10-26, beim Bau — Abstand zwischen den Kartenknöpfen + `--space-1`.** Mit dem Stift stehen zwei 32px-Knöpfe nebeneinander; ihre 44px-Trefferfelder stiessen genau aneinander, und `smoke:sicht` traf an der Stelle 21,9px neben der Stiftmitte das X (der Browser trifft auf ganze Pixel, das spätere Feld gewinnt). Jetzt liegt zwischen den Feldern ein Streifen von `--space-1`. Vermiedener Zustand: ein Tipp auf den Rand des Stifts, der aberntet.
- **2026-10-26, beim Bau — Warnung ohne Gross und Klein.** `gleicheAnzeigenamen` vergleicht `toLocaleLowerCase('de-CH')`: `nici` und `Nici` sind an einer Erntezeile dieselbe Auskunft. Beendete Zugänge zählen nicht. Die Warnung steht als Satz über der Mitgliederliste, je Gruppe einer, mit allen vollen Namen; jede aktive Zeile trägt dazu `Angezeigt als {Anzeigename}`.
- **2026-10-26, beim Bau — der Kurzname unter derselben Klammer wie der Name.** Umbenennen schickt neben `bekannterName` auch `bekannterKurzname` mit (leer = keiner), und `mitgliedUmbenennen` schreibt nur, wenn beide noch stimmen. Vermiedener Zustand: ein veralteter Tab, der einen neueren Kurznamen still zurückdreht. Ein fehlendes Feld gilt als „keiner" — so laufen die bestehenden Proben ohne das Feld weiter.
- **2026-10-26, beim Bau — `mitgliedAnlegen` mit freiwilligem `kurzname`.** Optional statt Pflicht, weil `scripts/create-admin.ts` ohne Kurznamen bleibt und zwanzig Saatstellen der Prüfkette sonst ein `kurzname: null` tragen müssten.
- **2026-10-26, beim Bau — /mehr und die Archivsuche.** `Angemeldet als` auf /mehr nennt den Anzeigenamen (in der Code Map so verlangt). Folge, benannt: die Suche auf /archiv durchsucht `uebernehmer`, und das ist jetzt der Anzeigename — wer nach einem Nachnamen sucht, findet einen Termin nicht mehr, dessen Person keinen Nachnamen im Kurznamen trägt.
- **2026-10-26, beim Bau — eine Wache, die die neue Funktion mitzählte.** `smoke-zugang` zählte die Aufrufe von `namePruefen(` auf /verwaltung über `/namePruefen\(/g` und fand damit auch `kurznamePruefen(`. Auf `\bnamePruefen\(` umgestellt (R2: kein weiteres Muster dieser Art auf `namePruefen` gefunden, gesucht mit `grep -n "namePruefen" scripts/`).
- **2026-10-26, beim Bau — die Saat der Prüfserver trägt die Matrix.** `pruefserver.ts` exportiert `ADMINPERSON` (`Vera Verwaltung`, kein Kurzname → `Vera`) und `MITGLIED` (`Manu Mitglied`, Kurzname `Manu M.`); der Anzeigename wird über `anzeigename` gerechnet. smoke-http und smoke-sicht prüfen positiv den Anzeigenamen und negativ beide Fassungen; die Admin-Auswahl im Tränkeplan weiter positiv den vollen Namen. Kohlrabi trägt in der Saat die Notiz `frühe Sorte, sehr gross`, damit der Sichtlauf und der Kontrast-Sweep eine Notizzeile sehen.
- **2026-10-26, beim Bau — nicht gemacht: die Sicherung vor dem Ausrollen.** Sie gehört zum Ausrollen auf dem VPS (`scripts/backup.sh`, siehe README „Betrieb und Runbook") und nicht zu diesem Bau; die Migration `0014_natural_imperial_guard.sql` fügt nur zwei nullbare Spalten an.

## Verification

**Commands:**
- `npm run build && npm run lint` -- grün, Zähler nachgeführt.
- `npm run check` -- 0 Fehler, 0 Warnungen.
