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

- **2026-10-26, beim Bau — der Stift statt `details.aendern`.** Die Code Map nannte /sitzungen als Vorbild (ein `<details>` mit Stift unter der Zeile). Gebaut ist ein dritter kleiner Knopf (Stift) neben `Sofort` und dem X, und die action `notizAendern` arbeitet in zwei Schritten wie `abernten`: ein POST ohne Feld `notiz` antwortet mit `notizFragen` und dem Feld an der Zeile (an der Stelle der Rückfrage), erst ein POST mit dem Feld schreibt — auch leer, und leer entfernt. Grund: die Karte ist seit spec-ernte-nach-beet.md einzeilig, und ein Griff unter der Zeile kostete jede Karte eine Zeile mehr (Rückmeldung Manuel vom 26.10.2026: „die Kacheln sind grösser als im interaktiven Bild"). Vermiedener Zustand: zwanzig Karten mit je einer Zeile, auf der allein ein Stift steht. Ohne JavaScript trägt es wie die Rückfrage. **Sichtbar zu prüfen:** bei 375px bleiben dem Text einer Karte mit drei Knöpfen (`Sofort`, Stift, X) 123px, einer mit zwei Knöpfen 197px — gemessen am 2026-10-26 im Sichtlauf (Chromium, Viewport 375×812) als `getBoundingClientRect().width` von `.ernte__text`, mit dem Abstand aus dem Eintrag darunter. Die Zahl „rund 150px" aus der ersten Fassung dieses Eintrags war gerechnet und nicht gemessen; sie ist hiermit ersetzt.
- **2026-10-26, beim Bau — Abstand zwischen den Kartenknöpfen + `--space-1`.** Mit dem Stift stehen zwei 32px-Knöpfe nebeneinander; ihre 44px-Trefferfelder stiessen genau aneinander, und `smoke:sicht` traf an der Stelle 21,9px neben der Stiftmitte das X (der Browser trifft auf ganze Pixel, das spätere Feld gewinnt). Jetzt liegt zwischen den Feldern ein Streifen von `--space-1`. Vermiedener Zustand: ein Tipp auf den Rand des Stifts, der aberntet.
- **2026-10-26, beim Bau — Warnung ohne Gross und Klein.** `gleicheAnzeigenamen` vergleicht `toLocaleLowerCase('de-CH')`: `nici` und `Nici` sind an einer Erntezeile dieselbe Auskunft. Beendete Zugänge zählen nicht. Die Warnung steht als Satz über der Mitgliederliste, je Gruppe einer, mit allen vollen Namen; jede aktive Zeile trägt dazu `Angezeigt als {Anzeigename}`.
- **2026-10-26, beim Bau — der Kurzname unter derselben Klammer wie der Name.** Umbenennen schickt neben `bekannterName` auch `bekannterKurzname` mit (leer = keiner), und `mitgliedUmbenennen` schreibt nur, wenn beide noch stimmen. Vermiedener Zustand: ein veralteter Tab, der einen neueren Kurznamen still zurückdreht. Ein fehlendes Feld gilt als „keiner" — so laufen die bestehenden Proben ohne das Feld weiter.
- **2026-10-26, beim Bau — `mitgliedAnlegen` mit freiwilligem `kurzname`.** Optional statt Pflicht, weil `scripts/create-admin.ts` ohne Kurznamen bleibt und zwanzig Saatstellen der Prüfkette sonst ein `kurzname: null` tragen müssten.
- **2026-10-26, beim Bau — /mehr und die Archivsuche.** `Angemeldet als` auf /mehr nennt den Anzeigenamen (in der Code Map so verlangt). Die Folge für die Archivsuche ist seit dem Review behoben (Eintrag unten).
- **2026-10-26, beim Bau — eine Wache, die die neue Funktion mitzählte.** `smoke-zugang` zählte die Aufrufe von `namePruefen(` auf /verwaltung über `/namePruefen\(/g` und fand damit auch `kurznamePruefen(`. Auf `\bnamePruefen\(` umgestellt (R2: kein weiteres Muster dieser Art auf `namePruefen` gefunden, gesucht mit `grep -n "namePruefen" scripts/`).
- **2026-10-26, beim Bau — die Saat der Prüfserver trägt die Matrix.** `pruefserver.ts` exportiert `ADMINPERSON` (`Vera Verwaltung`, kein Kurzname → `Vera`) und `MITGLIED` (`Manu Mitglied`, Kurzname `Manu M.`); der Anzeigename wird über `anzeigename` gerechnet. smoke-http und smoke-sicht prüfen positiv den Anzeigenamen und negativ beide Fassungen; die Admin-Auswahl im Tränkeplan weiter positiv den vollen Namen. Kohlrabi trägt in der Saat die Notiz `frühe Sorte, sehr gross`, damit der Sichtlauf und der Kontrast-Sweep eine Notizzeile sehen.
- **2026-10-26, beim Bau — nicht gemacht: die Sicherung vor dem Ausrollen.** Sie gehört zum Ausrollen auf dem VPS (`scripts/backup.sh`, siehe README „Betrieb und Runbook") und nicht zu diesem Bau; die Migration `0014_natural_imperial_guard.sql` fügt nur zwei nullbare Spalten an.

- **2026-10-26, Review — eingebaut (Entscheide unter Manuels Übertragung):**
  - **/ernte:** `kulturWert` und `ortWert` lesen eine Abweisung nur noch, wenn sie dem Eintragen-Formular gilt (`formularOffen`); eine abgewiesene Notiz an einer Karte (`feld: 'aendernNotiz'`) stand vorher im Feld `Was ist reif`. `fokusNach` fokussiert nach `notizFragen` die Meldung oben, wenn das Feld fehlt (Zeile inzwischen abgeerntet). Der Hinweis am Notizfeld des Formulars hängt immer über `aria-describedby` am Feld.
  - **/verwaltung:** eine Abweisung am Kurznamen der Aufnahme setzt den Fokus in dessen Feld. Beim Umbenennen hat das Kurznamenfeld einen eigenen Fehlersatz (`neuer-kurzname-fehler-{id}`, ausserhalb des `<details>` wie der Satz zum Namen); der Satz zum Namen trägt nur noch Abweisungen am Namen. Damit gibt es eine unterbrechende Live-Region mehr (37 → 38).
  - **Leerraum in der Spalte sperrt nicht mehr.** `mitgliedUmbenennen` trifft mit dem Abdruck „kein Kurzname" auch einen gespeicherten Kurznamen aus lauter Leerzeichen; die Route behandelt einen Abdruck aus Leerraum als „keiner". Vermiedener Zustand: eine Zeile, die nach einem Eingriff von Hand nie mehr umbenannt werden kann. Dasselbe für die Notiz.
  - **`anzeigename` mit leerem Namen** und ohne Kurzname liefert `unbekannt` (`ANZEIGENAME_UNBEKANNT`), nicht die leere Zeichenkette.
  - **Eine Faltung:** `nameFalten` in `src/lib/mitgliedsname.ts` trägt die drei Schritte für `namePruefen` und `kurznamePruefen`; `gleicheAnzeigenamen` normalisiert vor dem Vergleich auf NFC.
  - **Neuer Entscheid — Abdruck der Notiz.** Das Notizfeld an der Karte schickt `bekannteNotiz` mit (leer = keine), `ernteNotizSetzen` schreibt nur, wenn die Spalte noch so steht; sonst `ERNTEZEILE_NICHT_ANSPRECHBAR`, der Satz der veralteten Seite. Ein Versand ohne Abdruck gilt als „keine Notiz gesehen". Vermiedener Zustand: ein veralteter Tab, der eine neuere Notiz still überschreibt.
  - **Neuer Entscheid — Archivsuche über beide Namen.** `AbgeschlossenerTermin` und `Archivzeile` tragen `uebernehmerVoll` (null wie `uebernehmer`); die Suche auf /archiv liest ihn mit, angezeigt wird weiter der Anzeigename. Der volle Name reist damit in den Seitendaten von /archiv mit; er stand vor dieser Spec ohnehin an jeder Zeile.
  - **Texte:** „leer gilt der Vorname" heisst jetzt „leer gilt das erste Wort des Namens", der Hinweis bei der Aufnahme „So heisst die Person überall in der App ausser hier."; DESIGN.md ist nachgezogen (Abschnitt `member-name` mit Warnung `.namensgleich` und `Angezeigt als`, Notizfeld beim Eintragen). Veraltete Kommentare (Zahl der Zeilen-Aktionen, „Alle vier … Zielstufe", `mitgliedUmbenennen`) richtiggestellt.
  - **Code-Map-Stellen ohne Diff (geprüft):** `wellness/+page.server.ts:293/:365`, `traenkeplan/+page.server.ts:208/:340` und die Svelte-Seiten von /sitzungen, /einzelaufgaben, /archiv und /traenkeplan brauchen keine eigene Änderung. Die Seiten lesen `name` bzw. `uebernehmer` aus den Abfragen, und die liefern den Anzeigenamen. Die Schreibfunktionen (`behandlungEintragen`, `ernteEintragen`, `einzelaufgabeUebernehmen`) verlangen `kurzname` im Typ ihres Mitglieds-Arguments; ein von Hand gebautes `{ id, name }` ist damit ein Typfehler (so beim Bau in den Prüfskripten gemeldet, `tsc -p tsconfig.scripts.json`). `dienstwocheEintragen`/`dienstwocheBesetzen` lesen die Person selbst. Gesucht mit `grep -rn "behandlungEintragen(\|dienstwocheEintragen(\|dienstwocheBesetzen(\|einzelaufgabeUebernehmen(\|ernteEintragen(" src/routes`: alle Aufrufer reichen `locals.mitglied` oder eine Kennung.
  - **Prüfkette:** `alsWort` in smoke-http macht die Namensproben zu Wortproben (maskiert, Unicode-Wortgrenze; die Grenze der Probe steht am Kommentar). Die negativen Proben auf den Anzeigenamen der Adminperson suchen das Wort jetzt im ganzen Dokument statt nur `>Vera<`. Die Notizproben in smoke-sicht schicken den Abdruck, den das Dokument trägt, und räumen Zucchini wieder ab; danach tragen Kohlrabi (Saat) und Mangold (Eintragen-Probe) eine Notiz.
  - **Zähler:** smoke 831 → 835 (+1 `anzeigename` an den Rändern, aus der Gruppe von `kurznamePruefen` herausgelöst; +1 Abdruck der Notiz; +1 Notiz aus Leerraum; +1 Kurzname aus Leerraum. Faltung, NFC, Selbst-Eintragen, Protokoll und Archivsuche als Teile bestehender Behauptungen). smoke:http 190 → 194 (+1 Kurzname und Abdruck im Formular samt Umbenennen ohne JS; +1 gerenderte Warnung; +1 Abweisung am Kurznamen ohne JS; +1 `alsWort` selbst). smoke:sicht 119 → 120 (+1 abgewiesene Notiz nicht im Kulturfeld; die Notiz beim Eintragen über `#neu-notiz` ist Teil der Eintragen-Probe). Unterbrechende Live-Regionen 37 → 38.
  - **Vorgeführte Mutationen, je rot gesehen und zurückgenommen:**
    1. `kulturWert` ohne `formularOffen` → smoke:sicht „abgewiesene Notiz … nicht im Kulturfeld".
    2. Fokuszweig `feld === 'kurzname'` auf `if (false)` → smoke „fokusNach springt bei einer Abweisung am Kurznamen".
    3. Satz am Kurznamenfeld leer gelassen → smoke:http „ein zu langer Kurzname kommt mit dem Satz am Kurznamenfeld zurück".
    4. `mitgliedUmbenennen` ohne den Leerraum-Zweig → smoke „Kurzname aus lauter Leerzeichen … sperrt das Umbenennen nicht".
    5. `anzeigename` ohne `unbekannt` → smoke „anzeigename an den Rändern".
    6. `kurznamePruefen` mit eigener Faltung → smoke „Name und Kurzname falten über dieselbe Funktion".
    7. `normalize('NFC')` gestrichen → smoke „NFC-normalisiert verglichen".
    8. `ernteNotizSetzen` ohne Vergleich mit dem Abdruck → smoke „Notiz aus einer veralteten Seite schreibt nicht".
    9. `ernteNotizSetzen` ohne Leerraum-Zweig → smoke „Notiz aus lauter Leerzeichen … sperrt die Zeile nicht".
    10. `uebernehmerVoll` aus der Archivsuche gestrichen → smoke „Archivsuche findet weiter über den vollen Namen".
    11. `dienstwocheEintragen` mit vollem Namen → smoke „beim Selbst-Eintragen".
    12. `protokolleLesen` ohne Anzeigenamen → smoke „an einem abgelegten Protokoll".
    13. verstecktes `bekannterKurzname` gestrichen → smoke:http „Kurzname und Abdruck".
    14. Warnung nicht gerendert → smoke:http „warnt im Dokument".
    15. verstecktes `bekannteNotiz` gestrichen → smoke:sicht „eine gespeicherte Notiz steht an der Karte".
    16. `name="notiz"` am Eintragen-Feld umbenannt → smoke:sicht Eintragen-Probe „mit der Notiz aus dem Formular".
    17. `alsWort` als `includes` → smoke:http „alsWort zählt nur ganze Wörter".
  - **Nicht durch eine Wache gedeckt:** der Rückfall des Fokus auf die Meldung nach `notizFragen`, wenn die Zeile inzwischen fehlt (der Zustand lässt sich im Sichtlauf nur über ein Wettrennen herstellen).

## Verification

**Commands:**
- `npm run build && npm run lint` -- grün, Zähler nachgeführt.
- `npm run check` -- 0 Fehler, 0 Warnungen.
