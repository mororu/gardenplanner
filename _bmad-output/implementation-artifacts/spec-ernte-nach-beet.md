---
title: 'Ernte nach Beet, innerhalb des Beets nach Dringlichkeit'
type: 'feature'
created: '2026-10-26'
status: 'done'
baseline_commit: 'ccaafde26302b093187b9f1314e5ec40bfe34d6d'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/ernte` ordnet nach Dringlichkeit über den ganzen Garten. Wer im Garten steht, steht in einem Beet und muss die Liste nach seinem Ort absuchen. Bei einem realen Stand von 24 Orten und rund 40 Kulturen (Liste Manuel, 26.10.2026) ist das unübersichtlich; ausserdem sind die Karten zu gross und tragen zu viel Text.

**Approach:** Die Liste wird nach Beet gegliedert, wie das Wellness-Tagebuch: Beet (aufklappbar) > Stufe als Zwischentitel > kompakte Karte. Die Ansicht nach Dringlichkeit entfällt ganz. Gleichzeitig wechselt das Farbkonzept der Stufen: Sofort ernten gelb, Langsam ernten grün, Rot nur noch für Abgeerntet (Entscheide Manuel, 26.10.2026, am lokalen Entwurf `beispiel.html`).

## Boundaries & Constraints

**Always:**
- Ein Beet je Ort, Zeichen für Zeichen wie heute (die Zusammenführung von `42` und `Beet 42` ist Spec `spec-beet-schreibweise.md`, nicht diese). Reihenfolge natürlich wie `nachBeet` auf `/wellness` (`Beet 3` vor `Beet 12`), ohne Ort `Ohne Beet` zuunterst. Die natürliche Sortierung wird aus `src/lib/wellness.ts` in ein geteiltes Modul gezogen, nicht kopiert.
- Beet ist ein `details.abschnitt` mit `ZeichenWinkel`. **Alle Beete anfangs zugeklappt.** Ausnahme wie auf `/wellness`: das Beet einer Abweisung oder einer Abernten-Rückfrage ist vom Server her offen (auch ohne JavaScript); mit JavaScript führt der Browser den Zustand.
- Kopf eines Beets: Name und Zähler `{n} sofort · {m} langsam` (nur die vorhandenen Teile), gewöhnlicher Nebentext, nicht fett, ohne Farbpunkt.
- Im Beet: Zwischentitel `Sofort ernten`, dann `Langsam ernten` (die Kurzwörter `ERNTETEXT[…].kurz`), je nur wenn Zeilen da sind. Der Zwischentitel trägt das **Wort** der Stufe neben der Kante — darauf stützt sich die bestehende Ausnahme für das kräftige Gelb.
- Karte einzeilig: Kultur, bei `laufend` das Zeichen `ZeichenKreis` (Wort `Laufend ernten` vorgelesen). Darunter klein `{Name} · {datumKurz}`, **das Datum immer**. Der Satz `Alle zwei bis drei Tage durchgehen.` steht nicht mehr an der Karte.
- Rechts: an einer Karte `Langsam ernten` der Knopf `Sofort` mit gewöhnlichem Umriss und gelber Kante links (wie die Karten, als Zustandsmarke `data-stufe`); an jeder Karte ein Knopf nur mit Zeichen X in `--danger`, vorgelesen `Abgeerntet {Kultur}, {Ort}`. Die Rückfrage vor dem Löschen bleibt unverändert.
- Knöpfe sehen kleiner aus (etwa 32px), die **Trefferfläche bleibt 44px** (unsichtbar erweitert).
- Farben: `--reif-sofort` gelb, `--reif-stehen` grün, `--reif-wachsen` entfällt. Kontrasttabelle in DESIGN.md und `kontrast:selftest` werden nachgezogen. Die Startseite trägt seit dem 17.09.2026 keine Stufenfarbe und bleibt so; ihre Zahl `Zum Ernten` zählt künftig **alle** Zeilen, auch alte auf `wachsen`.
- `Noch wachsen lassen` verschwindet aus Legende und Oberfläche (Entscheid 6).
- Die Legende `So liest du die Liste` erklärt Gelb, Grün, das Kreiszeichen und das X.

**Ask First:** Was mit vorhandenen Zeilen auf `wachsen` geschieht (siehe offene Fragen); jede Änderung an Datenbank oder actions.

**Never:** Rot für eine Erntestufe; eine Stufe nur über Farbe; Trefferflächen unter 44px; eine zweite Ansicht nach Dringlichkeit neben der neuen.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Gemischtes Beet | Beet 42: Weisskabis sofort, Kohlrabi langsam | Kopf `Beet 42 — 1 sofort · 1 langsam`; aufgeklappt zwei Zwischentitel | N/A |
| Ohne Ort | Schnittlauch ohne Ort | Beet `Ohne Beet` zuunterst | N/A |
| Natürliche Ordnung | Orte `12`, `3`, `16/17` | 3, 12, 16/17 | N/A |
| Umstufen | `Sofort` an Salat in Beet 3 | Salat wandert im selben Beet unter `Sofort ernten`, Beet bleibt offen | Fehlersatz wie heute |
| Abernten | X an Bohnen | Rückfrage an der Zeile, Beet offen, auch ohne JS | wie heute |
| Leer | keine Zeile | `Es gibt nichts zu ernten.` | N/A |

</frozen-after-approval>

## Code Map

- `src/routes/ernte/+page.svelte` -- die Seite. Liste heute `details.abschnitt open` (:519–697) mit `h3#stufe-{stufe}` je Stufe; Karte :566–691 (`#ernte-{id}` als Name der Knöpfe, Rückfrage :618–643, Umstufen :656–671, Abernten :672–688). Legende :298–339 aus `legendenStufen` (:60). `andereStufen` :95, `frage` :122, `fokusNach` :190, `versand` :212. Styles `.stufe--* .karte` :730–740, `.stufenwahl__zeile.stufe--*` :746–752.
- `src/routes/wellness/+page.svelte` -- Vorbild, nur lesen: `anfangszustand`/`aufklappzustand`/`istOffen`/`merken` :295–309 (mit `untrack`), `aufklappen` :404, `versand` öffnet nach Abweisung/Rückfrage :457–481, Markup `section.tagebuch` > `details.abschnitt` je Beet :776–790.
- `src/lib/wellness.ts` -- `leerZuletzt` :344, `natuerlich` :366 (privat). Ziehen in ein geteiltes Modul `src/lib/beet.ts`; wellness importiert sie von dort. Der Modulkopf behauptet eine Abhängigkeit von ./ernte.ts, die es nicht gibt — mit richtigstellen.
- `src/lib/ernte.ts` -- `ERNTESTATUS` :41, `SICHTBARE_ERNTESTATUS` :61, `ERNTETEXT` :78 (`kurz`: `Sofort ernten`, `Langsam ernten`), `DAUERERNTE_*` :113/116. Neu hier: Gliederung nach Beet für Erntezeilen (Ort-Schlüssel Zeichen für Zeichen, natürliche Ordnung, `wachsen` unter `stehen`). Muss über nacktes Node ladbar bleiben (relative Importe mit `.ts`).
- `src/lib/server/db/queries/harvests.ts` -- `Erntezeile` :33 (`id, kultur, ort, status, laufend, name, createdAt`), Ordnung :87 (Rang, createdAt absteigend). Unverändert.
- `src/routes/+page.server.ts` -- Zahl `reif` :385–396 filtert auf `SICHTBARE_ERNTESTATUS`; künftig alle Zeilen.
- `src/lib/components/` -- kein X-Zeichen vorhanden; neu `ZeichenKreuz.svelte` nach dem Muster von `ZeichenKreis.svelte` (SVG, `aria-hidden`, `currentColor`).
- `src/lib/styles/bedienelemente.css` -- `.button-quiet` :59, `--zerstoerend` :212, `--kompakt` :783, Knopf nur mit Zeichen `.aendern__griff` :148–171 (44px über negativen Rand), `.abschnitt*` :1012–1074, `.nur-vorgelesen` :1156.
- `src/app.html` -- Tokens :200–202, Begründung der Gelb-Ausnahme :164–199.
- `_bmad-output/planning-artifacts/ux-designs/ux-Gartenplaner-2026-08-26/DESIGN.md` -- Farben :21–23, Tabelle :210–222, `harvest-legend` :339.
- `scripts/kontrast.ts` -- DOKUMENTIERT :286–291, HELL :321–323, `ERWARTETE_BEHAUPTUNGEN = 23` :348.
- `scripts/smoke-zugang.ts` -- Quelltext-Wachen zu /ernte :7998–8147 (`stufenTeile`, `legendeTeile`, `listenTeile`); `ERWARTETE_BEHAUPTUNGEN = 772` :280. Umstellen, nicht abschalten.
- `scripts/smoke-sicht.ts` -- TOKENS :510–526 (mit `--reif-wachsen` und dem verwaisten `--warn`), Sweep :2776 öffnet keine Aufklapper, Marken-Behauptung :2950; `ERWARTETE_BEHAUPTUNGEN = 105` :71.
- `scripts/pruefserver.ts` -- Ernte-Saat :304–325 (drei Beete, je eine Zeile, eine auf `wachsen`); um ein gemischtes Beet ergänzen.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/beet.ts` (neu), `src/lib/wellness.ts` -- natürliche Ordnung und `leerZuletzt` umziehen, Kommentare mitnehmen -- eine Stelle für „Beet 3 vor Beet 12".
- [x] `src/lib/ernte.ts` -- Gliederung nach Beet mit Zählern; `wachsen` erscheint als `stehen` -- reine Funktion, über smoke-zugang testbar.
- [x] `src/lib/components/ZeichenKreuz.svelte` -- X-Zeichen -- Abernten als Zeichen.
- [x] `src/routes/ernte/+page.svelte` -- Liste als `section` mit h2, Beete `details.abschnitt` (h3) mit Zähler, Zwischentitel h4, kompakte Karte, Knöpfe, Aufklappzustand wie /wellness, Legende neu -- der Kern.
- [x] `src/app.html`, DESIGN.md, `scripts/kontrast.ts` -- Tokens und Tabelle -- Gelb = sofort, Grün = langsam.
- [x] `src/routes/+page.server.ts` -- `reif` zählt alle Zeilen.
- [x] `scripts/smoke-zugang.ts`, `scripts/smoke-sicht.ts`, `scripts/pruefserver.ts` -- Wachen auf die neue Gestalt umstellen, Sweep klappt die Beete vorher auf, Proben für die Gliederung (I/O-Matrix) -- jede neue Behauptung einmal absichtlich rot.

**Acceptance Criteria:**
- Given eine Zeile auf `wachsen`, when /ernte lädt, then steht sie grün unter `Langsam ernten` und trägt den Knopf `Sofort`; und `/` zählt sie mit.
- Given ein Beet mit einer Rückfrage zum Abernten, when die Seite ohne JavaScript lädt, then ist genau dieses Beet offen und die Frage steht an der Zeile.
- Given Kopf eines Beets, then steht dort `{n} sofort · {m} langsam` als gewöhnlicher Nebentext.
- Given ein Knopf auf einer Karte, then ist seine Trefferfläche mindestens 44px hoch und breit, und das X wird `Abgeerntet {Kultur}, {Ort}` vorgelesen.
- Given `npm run build && npm run lint && npm run check`, then grün.

## Spec Change Log

- **2026-10-26, vor dem Bau (Investigation):** Die Spec behauptete, die Startseite übernehme die Erntefarben. Das stimmt seit dem 17.09.2026 nicht mehr (`src/routes/+page.svelte` :1026–1063, und `smoke-zugang.ts` verbietet dort ausdrücklich jede Stufe). Geändert: die Startseite bleibt ohne Farbe; ihre Zahl zählt alte `wachsen`-Zeilen mit, damit `/` und /ernte dieselbe Menge meinen. Vermiedener Zustand: eine Zeile, die /ernte zeigt und `/` verschweigt. Manuel hat die Entscheide am 26.10.2026 übertragen („du meldest dich, wenn es Probleme gibt").
- **2026-10-26, vor dem Bau:** Der Knopf `Sofort` bekommt keinen gelben Umriss, sondern den gewöhnlichen Umriss plus gelbe Kante links. Grund: NFR9 verlangt 3:1 für den Umriss eines Bedienelements, Gelb auf der Karte misst 1.57:1. Vermiedener Zustand: ein Knopf, dessen Grenze man nicht sieht, und eine Ausnahme in `smoke-sicht`, die erst am 11.09.2026 entfernt wurde.
- **2026-10-26, vor dem Bau:** Zwischentitel aus `ERNTETEXT[…].kurz` (`Langsam ernten`), nicht `.titel` (`Langsam anfangen zu ernten`) — so stand es im abgenommenen Entwurf; Legende und Formular behalten `.titel`.
- **2026-10-26, vor dem Bau (R3):** Die Spec liegt über dem Zielband (rund 1450 Wörter, gezählt mit `wc -w`). Sie ist bereits der erste von drei Schnitten; ein weiterer Schnitt trennte Farben und Gliederung, die nur zusammen den abgenommenen Entwurf ergeben. Grösse als Annahme abgenommen unter der Übertragung vom 26.10.2026.
- **2026-10-26, vor dem Bau:** Alle Beete zugeklappt weicht von AD-14 ab („ein Vorrat an Arbeit wird offen ausgeliefert"), das die Liste bisher offen hielt. Entscheid Manuel vom 26.10.2026 (Punkt 7); der Zähler im Kopf jedes Beets trägt, was AD-14 schützt: man sieht ohne Aufklappen, wo etwas sofort zu ernten ist. Die Wache dazu in `smoke-zugang.ts` wird umgestellt, nicht gestrichen.
- **2026-10-26, beim Bau:** Auch ein geglücktes **Umstufen** öffnet sein Beet vom Server her, nicht nur Abweisung und Rückfrage. Grund: die I/O-Matrix verlangt „Beet bleibt offen", und ohne JavaScript ist die Antwort ein neues Dokument, in dem sonst alle Beete zu wären. Vermiedener Zustand: ein Beet, das sich unter der Hand schliesst, in dem eben gehandelt wurde. Mit JavaScript liest das Markup den Wert nur beim Entstehen eines Beets (Muster `istOffen` von /wellness).
- **2026-10-26, beim Bau:** Die Legende zeigt nur noch die zwei angebotenen Stufen (SICHTBARE_ERNTESTATUS); der Zusatz „jede Stufe mit Zeilen" ist entfallen, weil `wachsen` nicht mehr als eigene Stufe erscheint. Dazu eine Zeile für das X mit dem Wort `Abgeerntet` (Konstante `ABERNTEN_WORT`, die auch den vorgelesenen Namen des X und den Knopf der Rückfrage trägt). Der Knopf heisst sichtbar `Sofort` (`SOFORT_KNOPF`) und wird `Sofort ernten {Kultur}, {Ort}` vorgelesen — der sichtbare Text steht vorn im Namen (WCAG 2.5.3).
- **2026-10-26, beim Bau:** `.titelzeile` aus dem geteilten Stilblatt entfernt — die Karte auf /ernte war ihr letzter Leser, Gate-Regel 14 (c) meldete die tote Rolle. Die Kultur und das Kreiszeichen stehen jetzt in einem `.zeichenwort`.
- **2026-10-26, beim Bau:** Die Liste steht in `section.beetliste` mit eigenem Regelkörper (`display: flex; column; gap --space-3`) in der Komponente. Der Versuch, ihn mit `.tagebuch` von /wellness ins geteilte Blatt zu ziehen, scheiterte an Gate-Regel 14: derselbe Körper steht in sechs Komponentenregeln. Die Zusammenlegung ist ein eigener Posten; vermiedener Zustand: ein halber Umzug, der vier weitere Komponenten anfasst.
- **2026-10-26, beim Bau:** `smoke-sicht` klappt im Kontrast-Sweep jetzt jedes `details.abschnitt` auf (nicht nur auf /ernte); damit sind auch die zugeklappten Beete auf /wellness und die Legende gemessen. `details.zeilenform` und `details.eintraege` bleiben zu — die Grenze steht am Sweep. Aus `TOKENS` sind `--reif-wachsen` und das seit dem 2026-09-17 verwaiste `--warn` entfallen.
- **2026-10-26, beim Bau:** Das neue Token `--knopf-klein` (2rem) trägt die sichtbare Grösse der zwei Kartenknöpfe; das Trefferfeld entsteht über ein `::before` mit negativem `inset`, gerechnet aus `--knopf-klein`, `--touch` und `--border-hairline`. Geprüft wird es in `smoke:sicht` mit `elementFromPoint` an vier Punkten je 21px von der Mitte.
- **2026-10-26, beim Bau — Zeilen auf `wachsen`:** Die Spec verweist bei _Ask First_ auf „offene Fragen", die es in dieser Datei nicht gibt. Behandelt wie folgt, ohne Änderung an Datenbank oder actions: eine Zeile auf `wachsen` **erscheint** unter `Langsam ernten` (grün, mit Knopf `Sofort`; `anzeigestufe` in `src/lib/ernte.ts`), die Spalte bleibt `wachsen`, und `/` zählt sie mit. Grund: Entscheid 6 nimmt `Noch wachsen lassen` aus der Oberfläche, und das Abnahmekriterium beschreibt genau diese Anzeige; eine Migration der Zeilen wäre eine Änderung an der Datenbank und damit _Ask First_. Vermiedener Zustand: Zeilen, die in der Datenbank stehen und auf /ernte nirgends erscheinen — oder unter einer Stufe, die die Legende nicht mehr erklärt. Offen bleibt: die actions nehmen `wachsen` über `istErntestatus` weiterhin an (ein Hand-POST kann es setzen); das zu schliessen ist eine Änderung an den actions und nicht gemacht.
- **2026-10-26, Review:** Auch ein geglücktes **Eintragen** öffnet das Beet der neuen Zeile — vom Server her über `zielZeile`, mit JavaScript über `aufklappen` im Versand, das jetzt für jede Antwort mit Zeile das Beet dieser Zeile öffnet (wie /wellness). Vermiedener Zustand: eine neu eingetragene Zeile, unsichtbar in einem zugeklappten Beet. Weitere Review-Punkte eingebaut: Trefferfeld an acht Punkten je 21,9px statt vier je 21px, Umstufen ohne JS eigens geprüft, Tag-Leser mit Klammern in `smoke-zugang`, Rot in der Legende nur am X, langer Beetname bricht statt den Zähler zu quetschen, AD-14 im ARCHITECTURE-SPINE ergänzt.

## Verification

**Commands:**
- `npm run build && npm run lint` -- grün, mit nachgeführten `ERWARTETE_BEHAUPTUNGEN`.
- `npm run check` -- 0 Fehler, 0 Warnungen.

**Manual checks:**
- /ernte bei 375px: Beete zugeklappt, Zähler lesbar, Karte einzeilig, X und `Sofort` treffbar.

## Suggested Review Order

**Gliederung nach Beet**

- Einstieg: reine Funktion, Beet je Ort, Stufen sofort vor langsam, `wachsen` als `stehen`.
  [`ernte.ts:377`](../../src/lib/ernte.ts#L377)

- Eine Stelle für die Anzeige-Stufe; davon hängen Zähler, Zwischentitel und Knopf ab.
  [`ernte.ts:322`](../../src/lib/ernte.ts#L322)

- Natürliche Ordnung aus /wellness umgezogen statt kopiert.
  [`beet.ts:52`](../../src/lib/beet.ts#L52)

**Seite /ernte**

- Liste als `section`, jedes Beet ein `details.abschnitt` mit Zähler im Kopf.
  [`+page.svelte:561`](../../src/routes/ernte/+page.svelte#L561)

- Welches Beet der Server offen ausliefert: die Zeile der letzten Antwort.
  [`+page.svelte:99`](../../src/routes/ernte/+page.svelte#L99)

- Aufklappzustand wie /wellness: Anfang vom Server, danach vom Browser.
  [`+page.svelte:124`](../../src/routes/ernte/+page.svelte#L124)

- Mit JavaScript öffnet `versand` das Beet der betroffenen Zeile.
  [`+page.svelte:231`](../../src/routes/ernte/+page.svelte#L231)

- X statt Wort; Name `Abgeerntet {Kultur}, {Ort}` über aria-labelledby.
  [`+page.svelte:661`](../../src/routes/ernte/+page.svelte#L661)

- Kleiner Knopf, Trefferfeld 44px über `::before`.
  [`+page.svelte:879`](../../src/routes/ernte/+page.svelte#L879)

**Farben und Zahl**

- Gelb = sofort, Grün = langsam, `--reif-wachsen` entfällt; neues `--knopf-klein`.
  [`app.html:210`](../../src/app.html#L210)

- Startseite zählt jede Zeile der Liste, auch alte `wachsen`.
  [`+page.server.ts:442`](../../src/routes/+page.server.ts#L442)

- Kontrastrechnung auf die neue Zuordnung.
  [`kontrast.ts:295`](../../scripts/kontrast.ts#L295)

**Dokumente**

- AD-14-Ausnahme für /ernte, Entscheid vom 26.10.2026.
  [`ARCHITECTURE-SPINE.md:149`](../planning-artifacts/architecture/architecture-Gartenplaner-2026-08-26/ARCHITECTURE-SPINE.md#L149)

- Komponente `harvest-list` beschrieben.
  [`DESIGN.md:341`](../planning-artifacts/ux-designs/ux-Gartenplaner-2026-08-26/DESIGN.md#L341)

**Prüfkette**

- Proben der I/O-Matrix an `nachBeetGliedern`.
  [`smoke-zugang.ts:11111`](../../scripts/smoke-zugang.ts#L11111)

- Umstufen ohne JavaScript öffnet genau sein Beet.
  [`smoke-sicht.ts:2602`](../../scripts/smoke-sicht.ts#L2602)

- Saat mit gemischtem Beet für den Sichtlauf.
  [`pruefserver.ts:317`](../../scripts/pruefserver.ts#L317)
