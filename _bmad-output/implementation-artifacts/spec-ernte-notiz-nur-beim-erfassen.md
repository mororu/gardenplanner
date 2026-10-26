---
title: 'Ernte: Notiz nur beim Erfassen, Datum ohne Jahr'
type: 'feature'
created: '2026-10-26'
status: 'in-review'
baseline_commit: '9bf60d637394b786382f7785dc2dc7aed7314394'
review_loop_iteration: 0
context: ['spec-notiz-und-kurzname.md', 'spec-ernte-nach-beet.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nach Ansicht von Teil 3 (Manuel, 26.10.2026): Die Erntekarte trägt mit dem Stift einen dritten Knopf, und das ist zu viel — der Kultur bleiben bei 375px nur 123px. Und das Datum unter der Kultur trägt ein Jahr, das bei einer Ernte nichts sagt.

**Approach:** Die Notiz wird nur beim Erfassen gesetzt und ist danach nicht mehr änderbar (der Entscheid „später änderbar" vom 26.10.2026 ist zurückgenommen). Das Datum an der Erntekarte zeigt nur Tag und Monat.

## Boundaries & Constraints

**Always:**
- Das Notizfeld im Eintragen-Formular, `notizPruefen`, die Spalte `harvests.notiz` und die Anzeige der Notiz unter der Kultur bleiben.
- Weg sind: der Stift-Knopf an der Karte, die action `notizAendern` mit ihren zwei Schritten (`notizFragen`, `notizGesetzt`), der Abdruck `bekannteNotiz`, die Abfrage `ernteNotizSetzen` und alles in Seite, Stilen, DESIGN.md und Prüfkette, was nur ihnen diente. Live-Regionen und Zähler entsprechend nachziehen.
- Datum an der Erntekarte: `{Name} · {Tag}. {Monat}` (z. B. `Vera · 26. Okt.`), aus einer Funktion in `src/lib/client/utils/date.ts` neben `datumKasten`, dieselbe Zeitzone. Andere Seiten behalten `datumKurz` mit Jahr.

**Ask First:** Jede Änderung an der Migration oder an der Spalte `notiz`.

**Never:** Eine Migration, die `notiz` entfernt; das Jahr an anderen Seiten wegnehmen.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Notiz beim Erfassen | Eintragen mit Notiz | Notiz klein unter der Kultur | Länge wie heute |
| Kein Ändern | gebauter POST `?/notizAendern` | keine action dieses Namens (SvelteKit-Antwort 404/400), Zeile unverändert | N/A |
| Datum | Eintrag vom 26.10.2026 | `26. Okt.` ohne `2026` | N/A |

</frozen-after-approval>

## Code Map

- `src/routes/ernte/+page.svelte` -- Stift-Knopf (`ZeichenStift` :25, :777), Formular `action="?/notizAendern"` :769, Zustände `notizFragen`/`notizGesetzt`, Datum :727 (`datumKurz`).
- `src/routes/ernte/+page.server.ts` -- action `notizAendern` :255 (10 Fundstellen der Notiz-Änderung).
- `src/lib/server/db/queries/harvests.ts` -- `ernteNotizSetzen` :225.
- `src/lib/client/utils/date.ts` -- `datumKurz` :87 (mit Jahr), `KURZES_DATUM`/`datumKasten` :102 (Tag und Monat) — die neue Funktion gehört daneben.
- `scripts/smoke-zugang.ts` (15 Fundstellen), `scripts/smoke-sicht.ts` (9) -- Proben zur Notiz-Änderung entfernen, Zähler nachziehen; Proben zur Notiz beim Erfassen bleiben.
- DESIGN.md (`_bmad-output/planning-artifacts/ux-designs/ux-Gartenplaner-2026-08-26/DESIGN.md`) -- Stift an der Erntekarte, falls beschrieben.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/client/utils/date.ts` -- Funktion für Tag und Monat als Zeichenkette.
- [x] `src/routes/ernte/+page.svelte`, `+page.server.ts`, `queries/harvests.ts` -- Notiz-Änderung entfernen, Datum ohne Jahr; Kommentare nachziehen (drei Zeilen-Aktionen werden wieder zwei).
- [x] DESIGN.md, Spec-Change-Log von `spec-notiz-und-kurzname.md` (Verweis hierher) -- nichts behaupten, was nicht mehr gilt.
- [x] Prüfkette -- Proben zur Änderung weg, neue Probe für das Datum ohne Jahr und dafür, dass kein Stift mehr an der Karte steht -- jede neue Wache einmal rot.

**Acceptance Criteria:**
- Given eine Karte auf /ernte, then trägt sie höchstens zwei Knöpfe (`Sofort`, X).
- Given eine Erntezeile vom 26.10.2026, then steht an ihrer Karte `{Name} · 26. Okt.` — Tag und Monat, ohne Jahr; die anderen Seiten zeigen das Datum weiter mit Jahr.
- Given ein gebauter POST auf `?/notizAendern`, then antwortet SvelteKit, dass es keine solche action gibt (gemessen: 404), und die Notiz der Zeile ist unverändert.
- Given das Eintragen mit einer Notiz, then steht sie klein unter der Kultur an der neuen Karte — das Feld im Eintragen-Formular, `notizPruefen` und die Spalte `harvests.notiz` bleiben.
- Given `npm run build && npm run lint && npm run check`, then grün.

## Spec Change Log

- **2026-10-26:** Entstanden aus Manuels Rückmeldung zu Teil 3; nimmt den Entscheid „Notiz später änderbar" aus `spec-notiz-und-kurzname.md` zurück. Vermiedener Zustand: drei Knöpfe auf einer einzeiligen Karte.

- **2026-10-26, beim Bau:**
  - **`datumOhneJahr`** in `src/lib/client/utils/date.ts`, über denselben Formatierer `KURZES_DATUM` wie `datumKasten` (Zone Europe/Zurich), liefert `26. Okt.` (gemessen mit Node 25.8, `de-CH`). Nur /ernte ruft sie; die Karte ruft `datumKurz` nicht mehr.
  - **Der Zuschlag `--space-1` zwischen den Kartenknöpfen ist wieder weg.** Er kam mit dem Stift (Spec Change Log von spec-notiz-und-kurzname.md: dessen Feldgrenze lag 22px neben seiner Mitte) und diente nur ihm. Ohne ihn stossen die Trefferfelder von `Sofort` und X wieder aneinander wie vor dem Stift; die Trefferprobe in `smoke:sicht` (acht Punkte je 21,9px) ist damit grün. Gegenprobe: mit dem Stift zurück und ohne Zuschlag traf sie an `Notiz ändern Kohlrabi` bei 21.9/0 das X — die Begründung des Zuschlags stimmte also, und sie steht jetzt am Abstand in der Komponente. Vermiedener Zustand: ein Abstand, dessen Kommentar einen Knopf nennt, den es nicht mehr gibt. Die Breite von `.ernte__text` ist danach **nicht** neu gemessen.
  - **`kulturWert`/`ortWert` ohne die Bedingung `formularOffen`.** Sie kam im Review von spec-notiz-und-kurzname.md, weil eine abgewiesene Notiz an der Karte über `eingabe` ins Kulturfeld wanderte. Ohne `aendernNotiz` tragen nur noch die Abweisungen des Eintragen-Formulars Text in `eingabe` (Umstufen und Abernten schicken `''`, gesehen an den zehn `abweisen(`-Aufrufen in `+page.server.ts`); der Ausdruck ist wieder der von vor dem Stift.
  - **Wo die Wachen stehen.** Matrix „Kein Ändern": `smoke:sicht` schickt am laufenden Server einen gebauten POST auf `?/notizAendern` (mit Kennung, Abdruck und neuer Notiz an Kohlrabi) — Antwort 404 von SvelteKit, die Notiz steht danach unverändert; `smoke` hält die Menge der actions (`abernten, eintragen, umstufen`). Matrix „Datum": `smoke` an `datumOhneJahr` selbst (auch 00:30 in Zürich) und am Quelltext der Karte, `smoke:sicht` an der gerenderten Namenszeile jeder Karte. „Höchstens zwei Knöpfe": `smoke:sicht` je Karte, samt der Gegenprobe, dass kein Formular mehr auf `?/notizAendern` zeigt. **Nicht gedeckt:** dass die übrigen Seiten `datumKurz` mit Jahr behalten — eine Regel über den ganzen Baum gehörte nach `gate.mjs` und ist nicht gebaut; heute rufen `/`, /sitzungen, /archiv, /wellness und /einzelaufgaben `datumKurz` (gesucht mit `grep -rn "datumKurz(" src/routes`).
  - **Zähler:** smoke 835 → 830 (−7 Proben zur Notiz-Änderung, +1 Menge der actions, +1 Datum); smoke:sicht 120 → 118 (−5 Notiz-Proben ohne und mit JavaScript, +1 höchstens zwei Knöpfe, +1 Datum ohne Jahr, +1 gebauter POST); smoke:http unverändert; unterbrechende Live-Regionen 38 → 37 (die Feldmeldung am Notizfeld der Karte).
  - **Vorgeführte Mutationen, je rot gesehen und zurückgenommen:**
    1. Stift samt Formular `?/notizAendern` wieder an die Karte → smoke:sicht „höchstens zwei Knöpfe" (`Kohlrabi: 3`, `Salat: 3`, `Kürbis: 3`), dazu die Namensliste und die Trefferprobe.
    2. An der Karte wieder `datumKurz` → smoke:sicht „ohne Jahr" (`Manu M. · 26. Okt. 2026`) und smoke Matrix „Datum".
    3. `+page.server.ts` und `queries/harvests.ts` aus `9bf60d6` (alte action samt `ernteNotizSetzen`) → smoke „genau die actions …" und smoke:sicht „gebauter POST" (Status 200, Notiz `überschrieben`).
    4. `KURZES_DATUM` mit `timeZone: 'UTC'` → smoke Matrix „Datum", Teil „um 00:30". Ohne `timeZone` bliebe die Probe auf dieser Maschine (Europe/Zurich) grün.
  - **DESIGN.md** (`harvest-list`): Datum ohne Jahr, Notiz nur beim Eintragen, höchstens zwei Knöpfe. **deferred-work.md:** die R5-Zeile zu spec-notiz-und-kurzname.md nennt die Karte mit drei Knöpfen nicht mehr als offen; die Warnung in der Verwaltung bleibt offen.
  - **Gefunden, nicht angefasst:** der Kommentar über `datumKurz` nennt `17. Sep 2026`; `Intl` liefert mit Node 25.8 `17. Sept. 2026`. Vor dieser Spec entstanden.

- **2026-10-26, Folge des Entscheids:** Eine falsche oder veraltete Notiz lässt sich nur noch berichtigen, indem die Zeile abgeerntet und neu eingetragen wird — mit neuem Datum und dem Namen der Person, die neu einträgt. In Kauf genommen mit Manuels Entscheid vom 26.10.2026 (Intent dieser Spec); vermiedener Zustand: drei Knöpfe auf einer einzeiligen Karte.
- **2026-10-26, Abwägung zum Abstand zwischen `Sofort` und X:** Die zwei 44px-Trefferfelder **berühren sich** (Abstand `--touch` − `--knopf-klein`), ohne Streifen dazwischen. An der gemeinsamen Grenze trifft der Browser auf ganze Pixel, und das spätere Feld gewinnt — das X. Ein Tipp genau auf die Grenze erntet damit ab statt umzustufen; das X fragt aber zurück, bevor es löscht, und `Sofort` ist breit genug, dass seine eigene Mitte weit von der Grenze liegt (die Trefferprobe in `smoke:sicht` an acht Punkten je 21,9px ist grün). Der Zuschlag `--space-1` kostete dem Text der Karte 4px und schützte nur den 32px breiten Stift; mit ihm ist er weg. Kommt ein dritter Knopf dazu, ist die Grenze neu zu messen (steht so am Abstand in der Komponente).
- **2026-10-26, Review — eingebaut:**
  - **Rückweg der Eingaben wieder geschützt, allgemein:** `kulturWert`/`ortWert` lesen `eintragen`-Abweisungen nur, wenn `feld` in `EINTRAGEN_FELDER` steht (`kultur`, `ort`, `status`, **und `notiz`** — deren Abweisung trägt Kultur und Ort ebenso zurück und muss sie ins Formular bringen). Die Liste ist eine Konstante in der Komponente, aus der auch der Typ von `fehlerAm` kommt. Wache in smoke: `kulturWert`/`ortWert` lesen `eintragenAbgewiesen`, und `EINTRAGEN_FELDER` ist genau die Menge der Marken, die `+page.server.ts` an `abweisen(` vergibt. Damit ist der Eintrag „ohne die Bedingung `formularOffen`" oben überholt.
  - **smoke:** die Quelltextprobe der Karte (`{eintrag.name …} · {datumOhneJahr…}`, kein `datumKurz`) gestrichen — sie hing an Umbruch und Kommentaren, das Verhalten misst smoke:sicht. Die Datumsprobe prüft `datumOhneJahr` strukturell (`/^26\. \p{L}+\.?$/u`, keine vierstellige Zahl) statt gegen `26. Okt.`, weil das Monatskürzel an der ICU-Fassung der Laufzeit hängt.
  - **smoke:sicht:** „höchstens zwei Knöpfe" verlangt genau vier Karten (die Saat) und wirft nicht mehr an einer Karte ohne `.zeile__text`; die Datumsprobe verlangt ebenfalls vier Zeilen; der gebaute POST verlangt genau 404 (gemessen mit @sveltejs/kit 2.70.3; die Matrix lässt 400 zu, die Probe misst, was gemessen ist). Das Wissen, welche Karten für den Kontrast-Sweep eine Notizzeile tragen (Kohlrabi aus der Saat, Mangold aus der Eintragen-Probe), steht wieder ausgeschrieben; die Proben nach dem entfallenen `browser.besuchen(…/ernte)` lesen nur Kennungen an Knöpfen und das HTML ihres eigenen POST und brauchen keinen frisch geladenen Zustand — die nächste, die einen braucht (`Mit JavaScript: Umstufen`), lädt selbst.
  - **`datumOhneJahr`:** der Kommentar behauptet nicht mehr „nur dort"; die fehlende Wache für „die anderen Seiten behalten das Jahr" und die R2-Suche nach Datumsliteralen in Kommentaren, die `Intl` so nicht liefert (`17. Sep 2026` statt `17. Sept. 2026`, sechs Fundstellen), stehen als Einträge am Ende von deferred-work.md.
  - **Breite neu gemessen** (Chromium über `scripts/kopfbrowser.ts`, Fenster 375px, alle Beete offen, `getBoundingClientRect().width` von `.ernte__text`, einmalig ausgegeben): 174.9px mit zwei Knöpfen, 245.0px mit einem. In DESIGN.md und deferred-work.md eingetragen; die 197px aus spec-notiz-und-kurzname.md liessen sich nicht nachstellen.
  - **Geprüft ohne Änderung:** `ZeichenStift.svelte` hat weiter zwei Aufrufer (`src/routes/+page.svelte`, `src/routes/sitzungen/+page.svelte`); `.ernte__frage` trägt die Rückfrage, `.knopf-klein--zeichen` das X, `.ernte__notiz` die Anzeige — keine Regel diente nur dem Notizfeld an der Karte. Das geteilte Stilblatt hatte der Stift nicht angefasst.
  - **spec-notiz-und-kurzname.md:** die ungültigen Stellen ausserhalb des eingefrorenen Blocks (Tasks, zweites Abnahmekriterium, Change-Log-Einträge, Mutationen 1, 8, 9, 15, Lesereihenfolge) tragen den Vermerk „Zurückgenommen am 2026-10-26" mit Verweis hierher.
  - **Zähler:** smoke 830 → 831 (+1 Rückweg der Eingaben; die gestrichenen Quelltextteile waren Teile der Datumsbehauptung); smoke:sicht unverändert 118; smoke:http unverändert.
  - **Vorgeführte Mutationen des Reviews, je rot gesehen und zurückgenommen:**
    5. `&& eintragenAbgewiesen` aus `kulturWert` gestrichen → smoke „abgewiesene Eingaben reisen nur aus dem Eintragen-Formular …", Teil `kulturWert und ortWert lesen eintragenAbgewiesen`.
    6. `'notiz'` aus `EINTRAGEN_FELDER` gestrichen → dieselbe Behauptung, Teil Mengenabgleich (`kultur, ort, status` gegen `kultur, notiz, ort, status`).
    7. `year: 'numeric'` an `KURZES_DATUM` → smoke Matrix „Datum", alle drei Teile zu `datumOhneJahr`; `timeZone: 'UTC'` → Teil „um 00:30" (wie Mutation 4).
    8. Ein Formular auf `?/notizAendern` über der Liste, ausserhalb jeder Karte → smoke:sicht „höchstens zwei Knöpfe …" allein an `stiftFormulare: 1` (dazu der Farbsweep am ungestylten Knopf).
    9. Klasse `karte` an der Karte gestrichen → smoke:sicht „höchstens zwei Knöpfe …" an `karten: 0` und „ohne Jahr" an der leeren Liste.
    Nicht eigens vorgeführt: die Schärfung auf genau 404 — Mutation 3 (Status 200) war schon rot; einen 400 erzeugt nur ein anderes SvelteKit.

## Verification

**Commands:**
- `npm run build && npm run lint` -- grün, Zähler nachgeführt.
- `npm run check` -- 0 Fehler, 0 Warnungen.
