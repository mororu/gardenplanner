---
title: 'Übernehmen neben den Text, und ein Aufklapper, der die Sackgasse schliesst'
type: 'feature'
created: '2026-09-11'
status: 'in-review'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Drei Dinge, gemessen und nicht vermutet.

1. **Eine Sackgasse.** Der Link `Alle Einzelaufgaben` steht **innerhalb** von
   `{#if data.einzelaufgaben.length > 0}` (`+page.svelte:771`). Ist nichts ausgeschrieben, fällt Block 2 ganz
   weg — und mit ihm der einzige Weg von `/` nach `/einzelaufgaben`.
2. **Ein begrabener Einstieg.** `Einzelaufgabe ausschreiben` ist nur über `/mehr` erreichbar
   (`mehr/+page.svelte:46`) — zwei Tipper von der Startseite für eine der drei Handlungen, mit denen Arbeit
   entsteht.
3. **Ein zu schwerer Knopf.** `Übernehmen` nimmt die volle Spaltenbreite für eine Handlung an **einer** Zeile.
   Auf dem Telefon — dem Hauptgerät dieser Anwendung — frisst das Höhe, die die Liste braucht.

**Approach:** Der Knopf wandert **neben den Titel**, kompakt, mit einem Zeichen vor dem Wort. Die zwei
Handlungen ziehen in einen Aufklapper `Einzelaufgaben` unter der Liste, der **ausserhalb** der Bedingung steht
und darum auch dann da ist, wenn nichts frei ist. Die freien Einzelaufgaben bleiben sichtbar wie heute.

## Boundaries & Constraints

**Always:**
- **Die freien Einzelaufgaben bleiben sichtbar.** Kein Aufklapper darüber. AD-14 ist genau gegen diesen Ausgang
  geschrieben: „trotzdem sieht niemand beim Öffnen, dass Setzlinge abzuholen sind."
- Der Aufklapper steht **ausserhalb** von `{#if data.einzelaufgaben.length > 0}` — sonst ist die Sackgasse
  nicht geschlossen, sondern nur verschoben.
- Das Zeichen steht **neben** dem Wort, nicht an seiner Stelle: ein Icon allein trüge den Namen nur im
  `aria-label`. `aria-hidden="true"` am Zeichen, damit es nicht doppelt vorgelesen wird.
- Trefferfeld bleibt `var(--touch)` (44px), auch wenn das Zeichen 18px misst — dieselbe Trennung von sichtbarer
  Grösse und Trefferfeld wie beim Kästchen der Aufgabenzeile.
- Der Aufklapper ist ein `<details>` nach der Bauform `.zeilenform` und läuft **ohne JavaScript**.
- Der Bestätigungsdialog beim Übernehmen bleibt unangetastet — er ist das Gegengewicht zur Verbindlichkeit.
- Die Kante des kompakten Knopfs bleibt auf `--ink-secondary` (NFR9, Entscheid (a)).

**Ask First:**
- Ein **zweites** Icon irgendwo in der Anwendung. Dieses ist das erste; eine Bildsprache entsteht erst, wenn ein
  zweites dazukommt, und dann gehört sie in DESIGN.md geregelt (Strichstärke, Grösse, Zustände).

**Never:**
- Kein Emoji. Auf dem Telefon rendert es farbig und gerastert und bricht die zurückhaltende Palette.
- Kein Icon ohne Wort.
- Keine Änderung an `freieEinzelaufgabenLesen`, an der load oder an der `uebernehmen`-action.
- Kein zweiter `.button-primary` auf der Seite.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Freie vorhanden | 2 freie Einzelaufgaben | Liste wie heute, Knopf kompakt neben dem Titel; Aufklapper darunter | N/A |
| Nichts frei | 0 freie | Liste und Marke fehlen, **Aufklapper steht trotzdem** mit beiden Zielen | N/A |
| Langer Titel bei 375px | Titel über 60 Zeichen | Titel bricht um, Knopf bleibt vollständig und behält 44px | kein waagrechtes Scrollen |
| Frage offen an einer Zeile | `form.art === 'fragen'` | Knopf dieser Zeile fort, Frage steht da — unverändert zu heute | N/A |
| Ohne JavaScript | kein `use:enhance` | Aufklapper öffnet über `<details>`, POST geht durch, Server antwortet mit der Frage | N/A |

</frozen-after-approval>

## Code Map

- `src/routes/+page.svelte:638-714` -- Block 2: Karte, `.zeile__spalte`, das Formular mit `.button-quiet`.
  Hier entsteht die Zeile aus Titelspalte **und** Knopf.
- `src/routes/+page.svelte:771` -- `.einzel__mehr`, der Link **innerhalb** der Bedingung. Fällt weg; seine
  CSS-Regel (`:1358`) muss mit, sonst schlägt Gate-Regel 14 auf eine verwaiste Klasse an.
- `src/routes/mehr/+page.svelte:46` -- `Einzelaufgabe ausschreiben`; der Eintrag bleibt dort **und** kommt in
  den Aufklapper. Zwei Wege zum selben Ziel sind kein Widerspruch — `/mehr` ist das Inhaltsverzeichnis.
- `src/routes/mehr/+page.svelte` (`<style>`) -- `.eintrag` ist heute seitenlokal. Mit einem zweiten Leser zieht
  die Regel nach `bedienelemente.css`; eine Kopie liesse Gate-Regel 14 auf zwei gleiche Regelkörper anschlagen.
- `src/lib/styles/bedienelemente.css:698` -- `.zeilenform`, die Bauform des Aufklappers ohne JavaScript.
- `src/lib/styles/bedienelemente.css:58-108` -- `.button-quiet`; der kompakte Knopf ist ein **Modifikator**
  daran, keine zweite Knopfregel.
- `src/app.html` -- die Masse. Für die sichtbare Grösse des Zeichens kommt ein Token dazu; ein Farbtoken
  **nicht** — das Zeichen nimmt `currentColor`.
- `scripts/gate.mjs:18` -- Regel 1: kein Längen- oder Farbliteral. Das SVG wird über CSS und Token bemessen,
  nicht über `width`/`height` in Zahlen.

## Tasks & Acceptance

**Execution:**
- [ ] `src/app.html` -- Token für die sichtbare Grösse des Zeichens; kein Farbtoken -- ein Mass, keine Farbe.
- [ ] `src/lib/styles/bedienelemente.css` -- `.eintrag` aus `/mehr` hierher ziehen (zweiter Leser), Modifikator
  für den kompakten Knopf, Regel für das Zeichen -- geteilte Rollen gehören ins geteilte Blatt.
- [ ] `src/routes/mehr/+page.svelte` -- die lokale `.eintrag`-Regel entfernen -- sonst zwei gleiche Regelkörper.
- [ ] `src/routes/+page.svelte` -- Karte als Reihe aus Titelspalte und kompaktem Knopf; `.einzel__mehr` samt
  Regel entfernen; `<details>`-Aufklapper **nach** dem `{/if}` -- das ist der Kern der Sackgasse.
- [ ] `scripts/smoke-zugang.ts` -- der Aufklapper steht ausserhalb der Bedingung; das Zeichen trägt
  `aria-hidden`; der Knopf trägt weiterhin sein Wort -- Behauptungen über diese eine Seite.
- [ ] `scripts/smoke-http.ts` -- **ohne jede freie Einzelaufgabe** liefert `/` beide Ziele aus -- die Sackgasse,
  am ausgelieferten Dokument gemessen.
- [ ] `scripts/smoke-sicht.ts` -- der kompakte Knopf hält 44x44px bei 375px, und die Seite scrollt nicht
  waagrecht -- die Zusage, die „kleiner" nicht brechen darf.

**Acceptance Criteria:**
- Given keine freie Einzelaufgabe, when `/` geladen wird, then stehen `Einzelaufgabe ausschreiben` und
  `Alle Einzelaufgaben` trotzdem im Dokument.
- Given zwei freie Einzelaufgaben, when `/` bei 375px gerendert wird, then steht der Knopf neben dem Titel, misst
  mindestens 44x44px und die Seite scrollt nicht waagrecht.
- Given das Zeichen, when ein Screenreader die Zeile liest, then hört man `Übernehmen` und den Titel — das
  Zeichen selbst nicht.
- Given `npm run build && npm run lint`, when die Kette läuft, then ist sie grün und jede neue Wache wurde
  vorgeführt rot.

## Design Notes

**Warum ein Mensch als Zeichen.** Die Unterscheidung dieses Systems ist **namenlos** (Pool, AD-2) gegen
**trägt einen Namen** (Einzelaufgabe, Tränkewoche, AD-4). Übernehmen heisst genau: diese Sache bekommt einen
Namen. Ein Kopf mit Schultern sagt das; ein Häkchen sagte `erledigt` und wäre dasselbe Zeichen, das im Kästchen
der Aufgabenzeile schon etwas anderes bedeutet; ein `+` sagte `anlegen` und steht schon am primären Knopf.

**Warum kein Emoji.** Es rendert je nach Gerät farbig und gerastert, nimmt `currentColor` nicht an und stünde
damit als einziges Element ausserhalb der Palette.

## Verification

**Commands:**
- `npm run build && npm run lint` -- erwartet: grün.
- `npm run smoke:sicht` -- erwartet: die Geometriezusage des kompakten Knopfs grün (braucht Chrome).

**Manual checks (if no CLI):**
- Auf dem Telefon: Titel mit über 60 Zeichen, Knopf bleibt vollständig und der Daumen trifft ihn.

## Spec Change Log

- **Zwei bestehende Wachen mussten umgestellt werden, und eine davon wurde dabei schärfer.**
  Die Struktur-Behauptung in `smoke-zugang.ts` belegte den Fusslink **innerhalb** des bedingten Blocks — sie
  belegte damit die Sackgasse, statt sie zu verhindern. Die Bedingung ist umgedreht: der Block darf die zwei
  Ziele nicht mehr enthalten, die Seite muss sie enthalten, und der Aufklapper muss hinter dem Ende des Blocks
  stehen. Vermiedener bekannt-schlechter Zustand: eine grüne Wache über einen Aufbau, den es nicht mehr gibt.
  Die zweite (`smoke-http`) erwartete `>Übernehmen<` am Stück und bricht am Zeichen davor; sie verlangt jetzt
  das **Wort** im Knopf und zusätzlich `aria-hidden` am Zeichen.

- **Zwei Behauptungen mehr als geplant.** Der Spec nannte drei Aufgaben in der Prüfschicht; gebaut sind fünf
  Teilbehauptungen in `smoke-zugang`, zwei in `smoke-http` und zwei in `smoke-sicht`. Zähler:
  `smoke-http` 161 → 162, `smoke-sicht` 70 → 72, `smoke-zugang` unverändert 634 (Teile einer bestehenden Zeile).

- **KEEP bei einer Neuableitung:** der Aufklapper steht **ausserhalb** von
  `{#if data.einzelaufgaben.length > 0}`. Das ist nicht Kosmetik, sondern der ganze Zweck — und es ist die
  einzige Stelle, an der eine Neuableitung still in die alte Sackgasse zurückfallen kann.

- **Nachtrag vom 2026-09-11, nach Rückmeldung: Titel, Zuklappbarkeit, Ausrichtung.**
  Der Titel heisst `Einzelaufgaben zum Übernehmen` — er nennt die Sache und die Handlung, weil keines von beiden
  allein verständlich war. **Beide** Abschnitte (`Einzelaufgaben zum Übernehmen` und `Offen`) sind jetzt
  `<details open>`. Das `open` ist die eigentliche Zusage und trägt eine eigene Wache: ein zugeklappt
  ausgelieferter Abschnitt bricht AD-14, ohne eine andere Regel zu verletzen. Der Zustand wird nirgends
  gespeichert — jedes Laden stellt den offenen Zustand wieder her. Der primäre Knopf `+ Aufgabe` steht
  ausserhalb des Aufklappers und bleibt bei weggeklappter Liste erreichbar.

- **Eine Wache war grün und belegte nichts — gemessen, nicht vermutet.**
  Die Ausrichtungszeile prüfte den Knopf an einer Karte mit breitem Titel; dort füllt die Textspalte die Zeile
  von allein, und die Behauptung blieb grün, als `margin-inline-start: auto` versuchsweise entfernt wurde. Die
  Saat trägt darum jetzt zusätzlich eine Einzelaufgabe mit kurzem Titel (`Giessen`), und gemessen wird an ihr.
  Mit der Mutation: `Knopf endet bei 287, Karte innen bei 347`. Vermiedener bekannt-schlechter Zustand: eine
  Zeile, die eine Regel behauptet, die man folgenlos löschen kann.

- **Drei bestehende Wachen hingen an der Formatierung statt an der Struktur** und wurden beim Umbau rot, weil
  das Markup eine Ebene tiefer rutschte und Prettier umbrach. Sie lesen jetzt über Zeilenumbrüche hinweg
  beziehungsweise auf die Kennung `id="offen-marke"` statt auf das ganze `<h2>`-Tag — eine zweite Klasse an der
  Marke hätte sie sonst erneut rot gemacht, ohne dass sich die Reihenfolge geändert hätte.
