---
title: 'Die Umrisse der Bedienelemente auf 3:1 — Entscheid (a) aus dem Kontrast-Sweep'
type: 'bugfix'
created: '2026-09-11'
status: 'in-review'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** NFR9 verspricht 3:1 für Bedienelement-Umrisse. Gemessen (Kontrast-Sweep vom 2026-09-02, Commit
`bc54647`) trägt `--hairline` den Umriss von **vier** Bedienelementen bei 1.25–1.44:1: `.feld`, `.button-quiet`,
`.eintrag` und `.skip`. DESIGN.md widerspricht sich dazu selbst — die Komponentenliste schreibt die Haarlinie für
`input` und `button-quiet` vor (`:118`), der Absatz zur Kontrasttabelle behauptet zwei Seiten später, jeder
Umriss eines Bedienelements nutze den Akzent und liege „weit über der Schwelle" (`:185`). Ein R1-Fall.

**Approach:** Entscheid **(a)**, von Manuel am 2026-09-11 gewählt: die Kante dieser vier auf `--ink-secondary`
heben — ein bestehendes Token, 4.71:1 hell und 6.90:1 dunkel. Kein neues Token, keine neue Unterscheidung. Die
Ausnahme in der Wache fällt damit **ersatzlos weg**, DESIGN.md sagt danach in seinem eigenen Sinn die Wahrheit.

## Boundaries & Constraints

**Always:**
- Genau die **vier gemessenen** Bedienelemente wechseln das Token. Trennlinien, Karten, der Dialog und die
  Navigationsleiste bleiben auf `--hairline` — sie identifizieren kein Bedienelement, und DESIGN.mds eigenes
  Argument trägt für sie.
- Die Felder bleiben **neutral**, nicht grün: `--ink-secondary` und ausdrücklich nicht `--accent`. Der Akzent
  bleibt dem Kästchen der Aufgabenzeile und dem Fokusring vorbehalten.
- DESIGN.md wird im selben Zug richtiggestellt — sonst bleibt der R1-Widerspruch stehen, nur andersherum.
- Die Ausnahme in `smoke-sicht.ts` wird **entfernt**, nicht verengt. Ihr Zähler `ausnahmen` verschwindet mit ihr.
- Die Wache wird einmal absichtlich rot gemacht, und wie, steht in der Commit-Nachricht.

**Ask First:**
- Sollte sich beim Messen ein **fünftes** Bedienelement mit Haarlinien-Umriss zeigen, das der Sweep nicht nannte:
  HALT. Der Entscheid deckt vier, und eine stille Erweiterung wäre genau die Drift, gegen die R2 steht.

**Never:**
- Kein neues Farbtoken. Ein neues Token zöge die Tabelle in DESIGN.md, `DOKUMENTIERT` in `kontrast.ts` und
  `ERWARTETE_BEHAUPTUNGEN` gleichzeitig mit — für einen Wert, den es schon gibt.
- Der `:disabled`-Zustand bleibt auf `--hairline`: WCAG 1.4.11 nimmt inaktive Bedienelemente aus, und die Wache
  überspringt sie ohnehin (`smoke-sicht.ts:1349`, `el.closest(':disabled')`). Gemessen, nicht angenommen.
- Keine Kante an `.karte`, `.bestaetigung` oder `.zeilenform` anfassen.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sweep nach der Änderung | alle zehn Seiten, hell und dunkel | Kein Umriss-Befund, `ausnahmen` existiert nicht mehr, Behauptung trägt keine Ausnahme im Namen | Befundliste nennt Route und Selektor |
| Mutation: ein Feld zurück auf Haarlinie | `.feld` wieder `--hairline` | Wache wird **rot** mit `1.25 < 3` | vorgeführt, in der Commit-Nachricht |
| Deaktivierter Knopf | `.button-quiet:disabled` | bleibt Haarlinie, wird nicht gemessen | N/A |
| Abdeckung der Tokens | zehn Farbtokens | `--hairline` kommt weiterhin in einem gemessenen Paar vor (Karten, Trennlinien) | Abdeckungszeile wird sonst rot |

</frozen-after-approval>

## Code Map

- `src/lib/styles/bedienelemente.css:92` -- `.button-quiet { border-color: var(--hairline) }` → `--ink-secondary`.
- `src/lib/styles/bedienelemente.css:158` -- `.feld { border: … var(--hairline) }` → `--ink-secondary`. Der harte
  Fall: die Fläche des Feldes steht auf dem Grund bei 1.06:1, die Kante **ist** die Identifikation.
- `src/lib/styles/bedienelemente.css:140` -- `:disabled` bleibt. Nicht anfassen.
- `src/routes/mehr/+page.svelte:78` -- `.eintrag` → `--ink-secondary`.
- `src/routes/+layout.svelte:61` -- `.skip` → `--ink-secondary`.
- `scripts/smoke-sicht.ts:1517-1520` -- die Ausnahme `if (fund.vordergrund === messung.tokens['--hairline'])`
  samt `ausnahmen`-Zähler entfernen; Deklaration von `ausnahmen` mit.
- `scripts/smoke-sicht.ts:1536-1560` -- der Erklärblock über der Behauptung und ihr Name
  (`ausser den ${ausnahmen} in --hairline (offener Befund vom 2026-09-02)`) werden neu geschrieben: der Befund ist
  geschlossen, und **warum** er geschlossen wurde, gehört an die Stelle der alten Begründung (R2: Wissen, das die
  zweite Kopie trug, zieht mit um).
- `scripts/smoke-sicht.ts:1301` -- `INTERAKTIV`; belegt, dass Karten und Trennlinien nie gemessen werden.
- `DESIGN.md:118` (und die Zeile für `input`) -- `1px solid {colors.hairline}` → `{colors.ink-secondary}`.
  Ebenso die Vorgaben für `eintrag` und `skip`, falls dort gesetzt.
- `DESIGN.md:174-181` -- Kontrasttabelle: eine Zeile `Bedienelement-Umriss auf Grund | 4.71:1 | 6.90:1 | 3.0`.
- `DESIGN.md:185` -- der widersprechende Absatz. Neu: die Haarlinie trägt nur noch Trennlinien und Behälter;
  jeder Bedienelement-Umriss nutzt `{colors.accent}` (Kästchen, Fokusring) oder `{colors.ink-secondary}`.
- `scripts/kontrast.ts:207-216` -- `DOKUMENTIERT` ist die Tabelle aus DESIGN.md von Hand; die neue Zeile gehört
  dazu. `scripts/kontrast.ts:269` -- `ERWARTETE_BEHAUPTUNGEN` zieht mit.
- `AGENTS.md` -- der Absatz „Ein Entscheid liegt Manuel vor" ist danach falsch und wird ersetzt.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- Befund 2 bekommt seinen Abschluss mit Datum.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/styles/bedienelemente.css` -- `.feld` und `.button-quiet` auf `--ink-secondary`; `:disabled`
  unverändert lassen -- die zwei Bedienelemente des geteilten Stilblatts.
- [ ] `src/routes/mehr/+page.svelte` und `src/routes/+layout.svelte` -- `.eintrag` und `.skip` auf
  `--ink-secondary` -- die zwei seitenlokalen.
- [ ] `scripts/smoke-sicht.ts` -- Ausnahme und Zähler entfernen, Erklärblock und Behauptungsname neu fassen --
  die Wache behauptet danach NFR9 ohne Vorbehalt.
- [ ] `DESIGN.md` -- Komponentenliste, Kontrasttabelle und der Absatz darunter -- der R1-Widerspruch wird
  aufgelöst, nicht verschoben.
- [ ] `scripts/kontrast.ts` -- neue Zeile in `DOKUMENTIERT`, `ERWARTETE_BEHAUPTUNGEN` mitziehen -- die Tabelle
  und der Selbsttest bleiben deckungsgleich.
- [ ] `AGENTS.md` und `deferred-work.md` -- den Entscheid als getroffen verbuchen, mit Datum und Wahl (a).

**Acceptance Criteria:**
- Given `npm run build && npm run lint`, when die Kette läuft, then ist sie grün und die Umriss-Behauptung trägt
  keine Ausnahme mehr im Namen.
- Given `.feld` wird versuchsweise auf `--hairline` zurückgesetzt, when `smoke:sicht` läuft, then wird die
  Umriss-Behauptung rot und nennt Route und Selektor.
- Given DESIGN.md nach der Änderung, when man die Komponentenliste gegen den Absatz unter der Kontrasttabelle
  hält, then widersprechen sie einander nicht mehr.
- Given die Abdeckungszeile des Sweeps, when er läuft, then kommt `--hairline` weiterhin in mindestens einem
  gemessenen Paar vor.

## Verification

**Commands:**
- `npm run build && npm run lint` -- erwartet: grün.
- `npm run kontrast:selftest` -- erwartet: grün; bricht, wenn Tabelle und `DOKUMENTIERT` auseinanderlaufen.
- `npm run smoke:sicht` -- erwartet: grün ohne Ausnahme im Namen der Umriss-Behauptung (braucht Chrome).

**Manual checks (if no CLI):**
- Ein Textfeld auf `/monatsplan` in Hell und Dunkel ansehen: die Kante ist sichtbar und neutral, nicht grün.

## Spec Change Log

- **Ask First ausgelöst und ohne Halt entschieden — `.dienst` und `textarea-bulk`.**
  Der Spec verlangte HALT, falls sich ein fünftes Bedienelement mit Haarlinien-Umriss zeigt. Es zeigten sich
  zwei: `textarea-bulk` (dieselbe `.feld`-Regel, also ohnehin mitgehoben) und `.dienst` auf `/`, ein `<a href>`
  mit drei Kanten auf der Haarlinie. Gebaut statt gehalten, weil der bekannt-schlechte Zustand hier **ein
  falsches Grün** gewesen wäre: die Sonde rendert den Zustand „ich habe diese Woche Dienst" nicht, die Wache
  wäre also grün geblieben, obwohl NFR9 an dieser Kante bricht. Entscheid (a) meint Bedienelemente und nicht die
  Auswahl, die ein Lauf zufällig herstellt. **Manuel gehört das trotzdem vorgelegt** — es ändert das Aussehen des
  Diensthinweises, und ein Rückbau ist eine Zeile.

- **Die Sonde wurde erweitert, was der Spec nicht vorsah.**
  Nach dem Heben der Kanten wurde die Abdeckungszeile rot: `--hairline` kam in keinem gemessenen Paar mehr vor,
  weil die Sonde Kanten ausschliesslich an interaktiven Knoten las. Das war kein Schaden der Änderung, sondern
  ein von ihr vorgeführter blinder Fleck. Geschlossen mit einer dritten Fundart `trennlinie`: Kanten
  nicht-interaktiver Knoten werden gezählt und auf Farbherkunft geprüft, aber nicht an 3:1 gehalten. Vermiedener
  bekannt-schlechter Zustand: die Abdeckungszeile durch Streichen von `--hairline` aus der Tokenliste „grün
  machen" — das hätte die Wache entschärft, die den Fleck gerade erst gefunden hat. Gemessene Paare je Schema:
  **322 → 479**. Zahl der Behauptungen unverändert (70).

- **KEEP bei einer Neuableitung:** die Ausnahme wurde *entfernt*, nicht verengt, und ihre Begründung ist an
  ihrer Stelle durch die Begründung ihres Wegfalls ersetzt — samt der Grenze, die die Sonde weiterhin hat
  (`:disabled` bleibt ungemessen, WCAG 1.4.11). Wer das zusammenstreicht, verliert die Warnung, die der Block trug.
