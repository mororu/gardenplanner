---
title: 'Story 4.1: Referenz-Sheets lesen und schreiben'
type: 'feature'
created: '2026-08-30'
status: 'done'
baseline_commit: '90626516927ee7eec2d031c6a7c68fd4cad38672'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nachschlagewissen — gute Nachbarn, Starkzehrer — liegt in zwei bis drei erfahrenen Köpfen; wer neu ist, muss fragen, und wer erfahren ist, erklärt dasselbe zwanzig Mal. `/wissen` ist seit Story 1.1 das vierte Navigationsziel und führt bis heute auf `Diese Seite gibt es nicht.`

**Approach:** Eine Tabelle `sheets(id, titel, text, created_at)` ohne Autoren-, Versions- und Verlaufsspalte, ein Repository `queries/sheets.ts`, und zwei Routen: `/wissen` mit der Titelliste und einem aufklappbaren Formular zum Anlegen, `/wissen/[id]` mit dem Blatt und einem aufklappbaren Formular zum Ändern. Beide Formulare benutzen das geteilte `.zeilenform` aus Epic 3.

## Boundaries & Constraints

**Always:**
- Ein Blatt ist **Titel plus Freitext**, sonst nichts. Wer ändert, ändert für alle.
- **Absätze und Zeilenumbrüche bleiben beim Anzeigen erhalten** — die einzige Formatierungszusage.
- Repository-Schicht (AD-1): benannte, **synchrone** Funktionen, kein Drizzle in einer Route. Mutationen als form actions mit literalem `action="?/name"` und `use:enhance` (AD-9). Zeit in Unix-Sekunden (AD-6).
- Schema über `npm run db:generate`; Migrationsdateien nie von Hand ändern.
- Abweisen über `abweisen()`; Sätze mit einer Wurfstelle bleiben lokal in der Route.
- Alle aktiven Mitglieder dürfen lesen, anlegen und ändern — **keine** zweite Zugangsstufe; der Wächter in `hooks.server.ts` schützt den Pfad schon.
- Ohne JavaScript bedienbar: `<details open={…}>` vom Server, verworfene Eingabe reist über `abweisen` zurück.
- Kein Hex-Wert im Komponenten-`<style>`, Grössen aus der Rampe, Abstände aus der 4px-Skala, Trefferfelder ≥ 44px, geprüft bei 375px in **beiden** Modi.

**Ask First:**
- Wenn die Umsetzung eine **Löschen**-Aktion für ein Blatt nötig erscheinen lässt — sie ist nicht Teil der Abnahmekriterien und wäre die einzige zerstörende Aktion ausserhalb der Verwaltung.
- Wenn `titel` eindeutig sein soll (Unique-Index) — die Kriterien fordern es nicht.

**Never:** Rich-Text-Editor oder Werkzeugleiste; Autorenspalte, Versionen, Verlauf, `updated_at`; Kommentare; Suche, Kategorien, Verschlagwortung; Verknüpfung zu Beeten oder Pflanzen; Bilder oder Anhänge; ein Block auf `/` — Wissen ist keine Aufgabenart; ein modaler Dialog; ein fünftes Navigationsziel; `innerHTML`/`{@html}` für den Freitext.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Liste mit Blättern | `sheets` nicht leer | `/wissen` zeigt die Titel als Liste, jeder ein Link auf `/wissen/<id>` | N/A |
| Liste leer | `sheets` leer | `.leer`-Satz `Noch nichts aufgeschrieben.` über dem Anlegen-Formular | N/A |
| Blatt anlegen | Titel + Text gültig | Zeile entsteht, `redirect(303, '/wissen/<id>?angelegt')`, Satz `Angelegt.` | N/A |
| Titel leer / nur Leerraum / nur unsichtbare Zeichen | `titel` faltet auf `''` | nichts entsteht | `abweisen(TITEL_FEHLT, 'titel', …)`, Formular bleibt offen |
| Titel zu lang | > `AUFGABE_HOECHSTLAENGE` Codepoints | nichts entsteht | `abweisen(TITEL_ZU_LANG, 'titel', …)` |
| Text leer | `text` faltet auf `''` | nichts entsteht | `abweisen(TEXT_FEHLT, 'text', …)` |
| Text zu lang | > `BLATT_HOECHSTLAENGE` Codepoints | nichts entsteht | `abweisen(TEXT_ZU_LANG, 'text', …)` |
| Blatt ändern | gültige Id, Titel + Text gültig | Zeile aktualisiert, `redirect(303, '/wissen/<id>?geaendert')`, Satz `Geändert.` | N/A |
| Blatt lesen, Id unbekannt | `/wissen/999` | keine Seite | `error(404, { message: NICHT_GEFUNDEN })` |
| Blatt ändern, Zeile inzwischen fort | UPDATE trifft keine Zeile | keine Änderung | `abweisen(BLATT_NICHT_ANSPRECHBAR, null, …)` |
| Id keine Zahl | `/wissen/abc` | keine Seite | `error(404, { message: NICHT_GEFUNDEN })` |
| Freitext mit `<script>` | Text enthält Markup | erscheint als **Text**, nicht als Markup | Sveltes Escaping; kein `{@html}` |

</frozen-after-approval>

## Code Map

- `src/lib/server/db/schema.ts` — vier Tabellen; `sheets` kommt dazu. Vorlage für Kommentardichte und `$defaultFn` beim `createdAt`: `signupTasks` (ab „Die ausgeschriebene Einzelaufgabe"). Der Modulkopf zählt die Tabellen auf und muss mitwachsen.
- `src/lib/server/db/queries/signup-tasks.ts` — **die Vorlage** für das neue Repository: `anzeigeSpalten`-Konstante, `ordnung`-Konstante, `satisfies NewSignupTask` auf dem Einfügeliteral, `.returning().get()`, `zeile === undefined ? null : …`.
- `src/routes/einzelaufgabe/+page.server.ts` — **die Vorlage** für die Prüfkette: `titelPruefen`, lokale Textkonstanten, relative Importe mit `.ts`-Endung, `load` gibt `titelGrenze` mit statt eines `maxlength`-Literals im Markup, `redirect(303, …)` mit Query-Parameter.
- `src/routes/einzelaufgaben/+page.svelte` — die Vorlage für die Liste: `.seite`, `.seitentitel`, `.marke` mit `aria-labelledby`, `.liste.liste--getrennt`, `.karte.karte--eng`, `.leer`. **Achtung:** trägt am Ende einen leeren `<style></style>`-Block (offener Retro-Punkt) — nicht kopieren.
- `src/routes/verwaltung/+page.svelte` und `src/routes/dienstplan/+page.svelte` — die zwei bestehenden Leser von `.zeilenform` / `.zeilenform__griff` / `.zeilenform__formular` samt `open={…}` vom Server und `use:enhance`-Rückruf mit `result.type === 'error'`.
- `src/lib/styles/bedienelemente.css:603-632` — `.zeilenform`-Familie. **`.textfeld` fehlt hier**: es steht lokal in `src/routes/monatsplan/+page.svelte:633` (`min-height: var(--textarea-bulk-min-height); resize: vertical;`). Eine zweite Kopie auf `/wissen` wäre genau die Drift, gegen die Gate-Regel 14 steht → hierher ziehen.
- `src/lib/aufgabentext.ts` — `aufgabentextFalten` (unsichtbare Zeichen weg, Leerraum zusammenziehen, trimmen) und `AUFGABE_HOECHSTLAENGE = 200`. Faltet **einzeilig** und frisst Zeilenumbrüche — für den Titel richtig, für den Freitext **nicht** benutzbar.
- `src/lib/unsichtbar.ts` — `unsichtbarEntfernen`, die geteilte Zeichenklasse; der Freitext-Falter baut darauf auf.
- `src/lib/texte.ts` — `NICHT_GEFUNDEN`; Muster für einen Satz mit mehr als einer Wurfstelle.
- `src/lib/components/NavBar.svelte:5-7,50` — Kommentar „Unbebaut ist noch /wissen" wird falsch; `gehoertDazu: []` bleibt, `/wissen/[id]` trifft über die Segmentgrenze.
- `scripts/smoke-zugang.ts` — lädt Routenmodule mit **nacktem Node**; darum relative `.ts`-Importe und Typen aus `@sveltejs/kit` statt `./$types` in jedem `+page.server.ts`.
- `scripts/db-check.ts`, `scripts/smoke-http.ts`, `scripts/gate.mjs` — hängen in `npm run lint`; die neue Tabelle und die zwei neuen Seiten gehören dort behauptet.
- `_bmad-output/planning-artifacts/architecture/architecture-Gartenplaner-2026-08-26/ARCHITECTURE-SPINE.md:246-252,302,283-285` — ERD `SHEETS { title, body, updated_at }` **widerspricht** dem Namensentscheid vom 2026-08-30 (`titel`, `text`, `created_at`); Quellbaum markiert `wissen/` und `queries/sheets.ts` als „noch nicht gebaut".

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/blatttext.ts` — neu: `BLATT_HOECHSTLAENGE` und `blatttextFalten` (unsichtbare Zeichen weg, `\r\n` → `\n`, Leerraum je Zeile hinten weg, mehr als zwei Umbrüche am Stück auf zwei, aussen trimmen). Begründen, warum `aufgabentextFalten` hier **nicht** trägt: es zieht `\s+` zusammen und fräst die Absätze weg, die diese Story zusagt. Hängt von nichts ab ausser `./unsichtbar.ts`, damit nacktes Node es lädt.
- [x] `src/lib/server/db/schema.ts` — `sheets(id, titel, text, created_at)` ergänzen, `Sheet`/`NewSheet` exportieren, `createdAt` über `$defaultFn`. Kommentar: keine Autoren-, Versions- und `updated_at`-Spalte, und **warum** das der Entscheid ist. Modulkopf auf fünf Tabellen ziehen.
- [x] `drizzle/` — `npm run db:generate` laufen lassen; erzeugte Migration nicht von Hand ändern.
- [x] `src/lib/server/db/queries/sheets.ts` — neu: `blaetterLesen()` (nur `id` und `titel`, geordnet nach `titel`), `blattLesen(id)` (`Blatt | null`), `blattAnlegen(titel, text)` (gibt die Id zurück), `blattAendern(id, titel, text)` (`boolean`, Vorbedingung in der `where`-Klausel des UPDATE). Alles synchron, `anzeigeSpalten`- und `ordnung`-Konstante wie in `signup-tasks.ts`.
- [x] `src/routes/wissen/+page.server.ts` — neu: `load` liest die Titelliste und `?angelegt`; action `anlegen` mit der Prüfkette (Titel, dann Text), `redirect(303, '/wissen/<id>?angelegt')`.
- [x] `src/routes/wissen/+page.svelte` — neu: Titelliste, leerer Zustand, `.zeilenform` „Neues Blatt", Meldungsregion wie auf `/`.
- [x] `src/routes/wissen/[id]/+page.server.ts` — neu: `load` prüft die Id auf eine positive Ganzzahl und wirft sonst `error(404, { message: NICHT_GEFUNDEN })`; action `aendern` mit derselben Prüfkette, `redirect(303, '/wissen/<id>?geaendert')`.
- [x] `src/routes/wissen/[id]/+page.svelte` — neu: Titel als `<h1>`, Freitext mit erhaltenen Umbrüchen (`white-space: pre-wrap` auf einer eigenen Rolle, **kein** `{@html}`), `.zeilenform` „Ändern" mit vorbelegten Feldern, Rückweg zur Liste.
- [x] `src/lib/styles/bedienelemente.css` — `.textfeld` aus `monatsplan/+page.svelte` hierher gezogen (dritte Wurfstelle); `monatsplan/+page.svelte` hat seine lokale Regel abgegeben. Die Rolle für den Blatt-Freitext (`.blatt__text`) bleibt dagegen **lokal**: sie hat genau einen Leser, und Gate-Regel 14 verlangt für jede Klasse im geteilten Blatt mindestens einen Benutzer — nicht umgekehrt.
- [x] `src/lib/components/NavBar.svelte` — Kommentar „Unbebaut ist noch /wissen" auf den gebauten Stand ziehen.
- [x] `scripts/db-check.ts` — **keine Änderung nötig, geprüft statt angenommen.** Das Skript führt drizzle-kit gegen `schema.ts` und `drizzle/` aus und liest „No schema changes“; es hält keine Tabellenliste, die veralten könnte. Die neue Tabelle ist damit vom ersten Tag an gedeckt.
- [x] `scripts/smoke-zugang.ts` — Behauptungen: Falter und Grenzen aus `blatttext.ts`; die zwei neuen `+page.server.ts` gegen echtes SQLite (anlegen, ändern, jede Abweisung der Matrix, unbekannte Id); `/wissen` und `/wissen/[id]` gehören zu genau einem Navigationsziel; `maxlength` beider Felder kommt aus den Konstanten.
- [x] `scripts/smoke-http.ts` — der gebaute Server liefert `/wissen` und ein angelegtes Blatt aus; der Freitext erscheint mit erhaltenen Umbrüchen und Markup als Text.
- [x] `ARCHITECTURE-SPINE.md` — ERD auf `SHEETS { id, titel, text, created_at }` ziehen (Nachgezogen-Block mit Datum und Grund, wie die bestehenden), `wissen/` und `queries/sheets.ts` im Quellbaum entmarkieren, den Absatz „einzige Ausnahme" auflösen, `src/lib/blatttext.ts` aufnehmen.

**Acceptance Criteria:**
- Given ein angelegtes Blatt, when ich `/wissen` öffne und den Titel antippe, then steht das Blatt mit seinem Freitext da, und Absätze und Zeilenumbrüche stehen wie getippt.
- Given ich bin angemeldet und kein Admin, when ich ein Blatt anlege oder ändere, then gelingt beides — es gibt keine zweite Zugangsstufe.
- Given ein geändertes Blatt, when eine andere Person es öffnet, then sieht sie die Änderung; nirgends steht ein Autor, eine Version oder ein Änderungszeitpunkt.
- Given `/wissen` und `/wissen/<id>`, when ich JavaScript abschalte, then tragen Anlegen und Ändern weiterhin, und eine abgewiesene Eingabe kommt im offenen Formular zurück.
- Given die Anwendung nach dieser Story, when ich nach Aufwand pro Beet oder pro Pflanze suche, then gibt es keinen: kein Feld, keine Spalte und keine Ansicht bezieht ein Blatt auf ein Beet.
- Given die Startseite, when ich sie nach dieser Story öffne, then trägt sie unverändert genau drei Blöcke.

## Spec Change Log

**2026-08-30 — vier Abweichungen aus dem Bau, keine aus einem Review.**

1. **`abweisen()` hat einen zweiten Rückweg bekommen** (`zweiteEingabe`). Der Spec sah ihn nicht vor. `/wissen` ist das erste Formular des Produkts mit **zwei freien Textfeldern**, die beide ohne JavaScript zurückreisen müssen; die geteilte Form trug einen Rückweg. Ein Blatt-Freitext kann achttausend Zeichen tragen, und ihn wegen eines leeren Titels zu verlieren wäre der teuerste Fehlschlag der Seite. Derselbe Anlass, aus dem Story 3.0.1 den Parameter `zeile` ergänzt hat. **Bekannt-schlechter Zustand, den das vermeidet:** das Feld kommt ohne JavaScript leer zurück, und die Person tippt zwei Absätze neu.

2. **Die Prüfkette liegt in `blatttext.ts`, nicht in den zwei Routen.** Der Spec plante nur `blatttextFalten` dort und die Deutung je Route. Beim Bau zeigte sich: die vier Sätze haben **zwei** Wurfstellen (`anlegen` und `aendern`), und zwei Routen, die je selbst deuteten, wären genau die Drift, gegen die `mitgliedsname.ts` steht. **KEEP:** der Titel teilt sich `aufgabentextFalten` und `AUFGABE_HOECHSTLAENGE` — vierte Wurfstelle derselben Zahl, keine neue Titelregel.

3. **Gate-Regel 1 hatte einen Fehlalarm, der erst durch diese Story auslösbar wurde.** Der Wort-Zerleger kennt den Bindestrich nicht und meldete `white-space` als CSS-Farbnamen `white`. Behoben mit einer Bindestrich-Wache plus Fehlerprobe `regel-1f-eigenschaftsname` (erwartet 0), deren Tragfähigkeit gemessen ist: ohne die Wache fallen dort vier Verstösse. Im selben Zug die Kopfzeile von `gate.mjs` von „dreizehn" auf „vierzehn Regeln" gezogen — sie war seit `9062651` falsch.

4. **Eine Behauptung in `smoke-zugang.ts` war zu scharf und ist es jetzt richtig.** Sie verlangte, dass **jede** gerenderte Route im `ziele`-Literal der Navigationsleiste **wörtlich** vorkommt. `/wissen/[id]` ist die erste Route, die **unter** dem Pfad ihres Ziels liegt; die Leiste markiert sie über die Segmentgrenze und braucht keinen Eintrag. Die Behauptung prüft jetzt, was die Komponente zusagt: gedeckt ist, wer unter einem Ziel liegt **oder** in `gehoertDazu` steht. Eine neue Formularroute in einem eigenen Zweig fällt weiter genauso hart auf.

**Ein Fund, der die Faltung bestätigt hat:** ein mehrzeiliges Formularfeld reist mit **CRLF**-Zeilenenden, unabhängig davon, was jemand tippt — gemessen an der Attrappe, die einen echten `FormData`-Rumpf baut und parst. Genau dafür gibt es Schritt 2 von `blatttextFalten`. Der erste Entwurf der Behauptung erwartete `\n` und war rot; korrigiert wurde die **Behauptung**, nicht der Code, und der Grund steht an Ort und Stelle.

**2026-08-30, Durchgang 2 — der adversariale Review, drei Lagen.** Kein Befund war `intent_gap` oder `bad_spec`: nichts musste neu abgeleitet werden. Was blieb, waren echte Lücken und Driften.

**Zwei Verhaltensfehler, behoben.**

5. **`Angelegt.` stand neben dem Fehlersatz.** Wer gerade ein Blatt angelegt hatte, stand auf `/wissen/<id>?angelegt`; klappte er dann `Ändern` auf und schickte ohne Titel ab, hielt `use:enhance` die Adresse fest, `data.angelegt` blieb wahr, und die Erfolgsmeldung eines abgeschlossenen Vorgangs stand über der Abweisung eines anderen. Die Rückmeldung schweigt jetzt, solange eine Abweisung ansteht. Nur mit JavaScript erreichbar.
6. **Ein führender Zeilenumbruch ging bei jeder Abweisung verloren.** Ein HTML-Parser verwirft den ersten Umbruch nach dem Textfeld-Starttag; der zurückgetragene Rohtext kam darum um eine Leerzeile gekürzt zurück. Zwei Reviewer fanden es unabhängig. Behoben mit einem zusätzlichen führenden Umbruch in beiden Feldern.

**Drei Verifikationslücken, geschlossen — und jede gemessen statt behauptet.**

7. **Die zwei neuen Seiten fehlten in den geteilten Invariantenlisten** von `smoke-zugang.ts` (`seitenServer`, `seitenKomponenten`). Sie fielen damit aus „keine Seite erklärt ein eigenes `abweisen`" und „jeder `use:enhance`-Rückruf fängt einen Wurf ab" heraus — die Story prüfte, was sie gebaut hatte, und übersah, wovon sie Teil geworden war. Jetzt acht Seiten statt sechs, zehn Rückrufe statt acht.
8. **Die Feldnamen waren nirgends gegen das gehalten, was die actions lesen.** `name="text"` in `name="freitext"` umzubenennen hätte jeden Versand abgewiesen und die ganze Prüfkette grün gelassen — beide Prüfskripte bauen ihre Formulardaten selbst, Gate-Regel 11 hält nur den Aktionsnamen. Die Behauptung gab es für `/aufgabe`, `/monatsplan` und `/verwaltung` schon. Nachgezogen samt Wertbindungen; **mutationsgeprüft**: `name="freitext"` und `zweiteEingabe` → `eingabe` machen sie je rot.
9. **Die `pre-wrap`-Behauptung konnte ihre eigene Regression nicht sehen.** Sie stand als `white-space: pre-wrap` im HTML **oder** Klasse am Absatz; die linke Hälfte ist tot, weil Komponenten-CSS als eigenes `<link>` hinausgeht. Sie holt jetzt die Stilblätter aus dem `<head>` und sucht die Deklaration darin. **Mutationsgeprüft**: ohne die Regel wird sie rot, mit ihr grün. Dazu die Abweisung beim **Ändern** ohne JavaScript, die bisher nur für das Anlegen gerendert war.

**Eine Zusage war zu weit gefasst.** `BLATT_NICHT_ANSPRECHBAR` versprach „ein Satz und kein 404, der Text bleibt". Ohne JavaScript hält das nicht: SvelteKit fährt nach `fail()` die `load` erneut, die wirft 404, und der Text ist fort — belegt am Quelltext von SvelteKit 2.70.3. Der Zweig bleibt als defensiver stehen (es gibt keine Löschen-Aktion), der Kommentar nennt jetzt die Grenze, und die Härtung steht in `deferred-work.md`.

**Vier Korrekturen an Regel und Ordnung.**

10. **`blatttextFalten` liess U+0085, U+2028 und U+2029 stehen** — Schritt 4 (`\n{3,}`) zählt nur `\n`, ein aus einem PDF eingefügter Text hätte beliebig viele Leerzeilen behalten. Jetzt mit normalisiert.
11. **Die Liste sortierte nach Bytes.** SQLite stellt **alle** Grossbuchstaben vor **alle** kleinen: `Zwiebeln` stand vor `anbau`. Ein einziges klein angefangenes Blatt genügte. Jetzt `COLLATE NOCASE`, mit einer Behauptung, die es belegt. Der Kommentar nannte vorher nur den seltenen Umlautfall — der bleibt benannt und hingenommen.
12. **Gate-Regel 1s Wache sah nur den Bindestrich**, nicht den Unterstrich; `--surface_white` wäre dieselbe Falle unter anderem Namen. Erweitert, und die Fehlerprobe trägt die Falle jetzt mit — fünf Verstösse ohne die Wache statt vier. Der Kommentar der Probe behauptete ausserdem, `highlight` in `-webkit-tap-highlight-color` sei „zufällig kein Farbname"; es **ist** eine Systemfarbe, und genau darum ging die Rechnung auf. Richtiggestellt.
13. **Die Waisen-Behauptung war überflüssig.** `zahl !== 1` fängt die Null schon mit; zwei Zeilen für dieselbe Aussage sind eine Wache, die man halb stehen lässt. Entfernt, die Begründung steht bei der verbliebenen.

**Zwei Entscheide, die im ersten Durchgang nur im Code standen.**

14. **Weitergeleitet wird auf das Blatt, nicht auf die Liste.** Das weicht von `epic-4-context.md` ab („Formularseiten leiten auf die Liste zurück"), und zwar bewusst: die Liste zeigt nur Titel, und wer zwei Absätze getippt hat, sähe dort eine Zeile mehr. Die Begründung stand in der Route, aber nicht hier.
15. ***Ask First* zur Löschen-Aktion: mit Nein beantwortet.** Sie erschien beim Bau nie nötig — es gibt kein Blatt, das man loswerden **muss**, weil jedes änderbar ist. Die Frage nach einer Obergrenze für die **Zahl** der Blätter war nicht Teil davon und steht in `deferred-work.md`.

Sechs weitere Befunde sind als zurückgestellte Arbeit festgehalten; drei wurden verworfen: das Kürzen des zurückgetragenen Texts (es zerstörte genau das, wofür der Rückweg da ist), eine Wache um `blattAnlegen`s `.get()` (die Nachbarmodule haben keine, und eine hier wäre die Inkonsistenz) und `AD-6` an der CAP-7-Zeile (die Tabelle hat eine Zeitspalte, die Bindung stimmt).

## Design Notes

**Warum `blatttextFalten` und nicht `aufgabentextFalten`.** Der bestehende Falter zieht `\s+` auf ein Leerzeichen zusammen — genau das, was ein Aufgabensatz braucht und was diese Story verbietet. Die Titel-Hälfte teilt sich dagegen die bestehende Kette samt `AUFGABE_HOECHSTLAENGE`: ein Blatt-Titel ist derselbe Gegenstand wie ein Einzelaufgaben-Titel, und das ist die **vierte** Wurfstelle derselben Zahl nach `/aufgabe`, `/monatsplan` und `/einzelaufgabe`, keine neue. (Der erste Entwurf zählte drei; der Review hat es gegen die drei bestehenden Prüfstellen nachgezählt.)

```ts
export function blatttextFalten(eingabe: string): string {
	return unsichtbarEntfernen(eingabe)
		.replace(/\r\n?/g, '\n')      // ein Umbruch, eine Schreibweise
		.replace(/[^\S\n]+$/gm, '')   // Leerraum am Zeilenende weg, Umbruch bleibt
		.replace(/\n{3,}/g, '\n\n')   // ein Absatz ist eine Leerzeile, nicht sieben
		.trim();
}
```

**Warum zwei Routen und kein `/wissen/neu`.** Anlegen und Ändern sind dieselbe Bewegung wie Nachschlagen; ein `<details>` in der Liste und eines am Blatt kosten keine dritte Seite und bringen das Auf und Zu ohne JavaScript mit. Beide benutzen `.zeilenform` — die dritte und vierte Wurfstelle der Form, die Epic 3 geteilt hat, und damit der Beleg, dass die Zusammenlegung getragen hat.

**`created_at` und nicht `updated_at`.** Der Namensentscheid nennt `created_at`. Ein `updated_at` wäre der Anfang eines Bearbeitungsverlaufs, den die Kriterien ausschliessen; die Ordnung der Liste ist darum der **Titel** und nicht die Zeit — eine Nachschlageliste sucht man alphabetisch ab, nicht chronologisch.

## Verification

**Commands:**
- `npm run build` — erwartet: ohne Fehler und ohne Warnungen.
- `npm run check` — erwartet: `svelte-check` und `tsc -p tsconfig.scripts.json` sauber.
- `npm run lint` — erwartet: Prettier, ESLint, `gate`, `gate:selftest`, `db:check`, `db:check:selftest`, `smoke`, `smoke:selftest`, `smoke:http` alle grün, inklusive der neuen Behauptungen.

**Manual checks:**

> **Nachgetragen am 2026-08-31.** Der maschinell erreichbare Teil dieser Liste
> ist jetzt in `npm run smoke:sicht` ausgeführt — Stufe C, kopfloser Browser:
> `/wissen` und ein Blatt bei 375px in **beiden** Erscheinungsbildern, kein
> waagerechtes Scrollen gegen die feste Breite, Trefferfelder ≥ 44px an Griff
> und Blattlink, das Dreieck des Griffs als **berechneter** Wert, das
> geschlossene Formular, erhaltene Absätze (gegen einen Klon ohne `pre-wrap`
> gemessen) und der Umbruch des 200-Zeichen-Worts. Sechs Mutationen einzeln rot
> gesehen, darunter `summary { display: flex }` ohne Klassennamen — der Fall,
> den Gate-Regel 15 als für sich unsichtbar benennt.
>
> **Nicht** maschinell gedeckt und darum weiter offen: die Geometrie eines
> **aufgeklappten** Formulars und einer abgewiesenen Eingabe bei 375px, und die
> Geometrie des leeren Zustands (dieser Lauf sät zwei Blätter). Der Weg ohne
> JavaScript ist von `smoke:http` gedeckt, die Farbwirkung des Dunkel-Blocks von
> `smoke:sicht` auf `/`. Zeile 8 der R5-Liste in `deferred-work.md` ist damit
> **überwiegend, nicht vollständig** geschlossen.

- `/wissen` und `/wissen/<id>` bei **375px** in hellem **und** dunklem Erscheinungsbild: Titelliste, leerer Zustand, beide Formulare offen und zu, eine abgewiesene Eingabe. Trefferfelder ≥ 44px, kein waagerechtes Scrollen, ein Blatt mit einem 200-Zeichen-Wort ohne Leerzeichen bricht um.
- Ein Blatt mit zwei Absätzen und einer Leerzeile dazwischen anlegen und wieder öffnen: die Absätze stehen wie getippt.
- Mit abgeschaltetem JavaScript anlegen, ändern und eine leere Eingabe abschicken.

## Suggested Review Order

**Die Regel: was ein Blatt ist**

- Der Einstieg. Warum der Freitext eine eigene Faltung braucht und der Titel nicht.
  [`blatttext.ts:118`](../../src/lib/blatttext.ts#L118)

- Die zwei Prüfungen mit ihren vier Sätzen — zwei Wurfstellen, darum geteilt.
  [`blatttext.ts:133`](../../src/lib/blatttext.ts#L133)

- Die Grenze und ihre Begründung, in Codepoints.
  [`blatttext.ts:71`](../../src/lib/blatttext.ts#L71)

**Das Schema: vier Spalten, und was bewusst fehlt**

- Kein Autor, keine Version, kein `updated_at` — jede Abwesenheit mit Grund.
  [`schema.ts:433`](../../src/lib/server/db/schema.ts#L433)

- Die Ordnung der Liste: Titel statt Zeit, und `COLLATE NOCASE` statt Bytes.
  [`sheets.ts:83`](../../src/lib/server/db/queries/sheets.ts#L83)

**Die zwei Routen**

- Anlegen, und warum es auf das Blatt weiterleitet statt auf die Liste.
  [`wissen/+page.server.ts:116`](../../src/routes/wissen/+page.server.ts#L116)

- Ändern; die Id kommt aus dem Pfad, nie aus einem versteckten Feld.
  [`wissen/[id]/+page.server.ts:141`](../../src/routes/wissen/%5Bid%5D/+page.server.ts#L141)

- Die eine Zusage, deren Grenze ohne JavaScript benannt ist.
  [`wissen/[id]/+page.server.ts:54`](../../src/routes/wissen/%5Bid%5D/+page.server.ts#L54)

- Der Freitext: `pre-wrap`, kein Zerlegen, keine rohe HTML-Direktive.
  [`wissen/[id]/+page.svelte:261`](../../src/routes/wissen/%5Bid%5D/+page.svelte#L261)

**Die geteilten Stücke, die diese Story angefasst hat**

- Der zweite Rückweg — der Anlass, und warum es keinen sechsten gibt.
  [`abweisen.ts:87`](../../src/lib/server/abweisen.ts#L87)

- `.textfeld` aus `/monatsplan` gezogen, samt Ordnungsbedingung.
  [`bedienelemente.css:184`](../../src/lib/styles/bedienelemente.css#L184)

**Das Prüfwerkzeug**

- Die Wache, die `white-space` nicht mehr für eine Farbe hält.
  [`gate.mjs:774`](../../scripts/gate.mjs#L774)

- Die Verdrahtung beider Formulare — mutationsgeprüft, zweimal rot gemacht.
  [`smoke-zugang.ts:8269`](../../scripts/smoke-zugang.ts#L8269)

- `pre-wrap` am ausgelieferten Stilblatt statt am Quelltext.
  [`smoke-http.ts:2199`](../../scripts/smoke-http.ts#L2199)
