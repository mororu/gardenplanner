---
title: 'Story 2.2 — Überfällige Aufgaben erkennen'
type: 'feature'
created: '2026-08-28'
status: 'done'
review_loop_iteration: 0
baseline_commit: '7b1d9b92eadf81c8872fcb78dd7b28d5b3efe3da'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `due_at` und `created_at` liegen seit Story 2.1 in den Seitendaten von `/`, aber gerechnet wird nichts: eine Aufgabe, die vier Wochen liegt, sieht aus wie eine von heute. Liegengebliebenes fällt damit nur auf, wenn jemand im Gruppenchat mahnt — genau das, was die Anwendung ersetzen soll. Das Token `--overdue` ist bis heute unbenutzt.

**Approach:** Die Repository-Abfrage der offenen Aufgaben liefert je Zeile eine abgeleitete Wochenzahl, die Liste rendert darunter eine zweite Textzeile `seit N Wochen offen` in Lehmbraun. Keine Spalte, kein Job, keine Migration, keine Umsortierung, kein Abzeichen.

## Boundaries & Constraints

**Always:**

- **AD-8 wörtlich:** überfällig heisst `completed_at IS NULL AND (COALESCE(due_at, created_at) < jetzt − 21 Tage)`, berechnet zur Anzeigezeit. Der Vergleich ist **strikt** — genau an der Schwelle ist eine Aufgabe noch nicht überfällig.
- **Die Schwelle steht als benannte Konstante an genau einer Stelle** (`src/lib/zeit.ts`), gelesen von der Rechnung und von nichts sonst. Keine zweite 21 irgendwo.
- **Der Bezugszeitpunkt entsteht serverseitig in `load`** als `Math.floor(Date.now() / 1000)`, niemals im Browser: ein `Date.now()` in der Komponente erzeugt einen Hydrierungsunterschied. Muster steht in `monatsplan/+page.server.ts:103-105`.
- **Die Wochenzahl ist `Math.floor(verstrichen / 604800)`**, ohne Obergrenze und ohne Kappung. An der Schwelle ergibt das `3`; ein Singular kann nicht auftreten, also braucht es keine Beugungsregel.
- **Der Text ist Pflicht, `--overdue` trägt nie allein** (UX-DR8, `DESIGN.md:248`). Zweite Zeile in der `meta`-Rolle, Abstand `var(--space-1)` als `gap`.
- **Die Zeile bleibt eine ganz normale Aufgabenzeile:** gleiche Position, gleiche Sortierung, Trefferfeld weiter ≥ 44px, der Text weiter nicht antippbar.
- **Die zweite Zeile ist ein Geschwister** des per `aria-labelledby` referenzierten `#aufgabe-{id}`, verknüpft über `aria-describedby`. Der Name des Kästchens bleibt `<Aufgabentext>, erledigen` — die Zusage aus `README.md:1285-1288` darf nicht kippen.
- **Wird eine Zeile in dieser Sitzung abgehakt, verschwindet ihre Überfälligkeitszeile.** Das ist der erste Konjunkt von AD-8 in der Oberfläche: `seit 4 Wochen offen` unter einer erledigten Aufgabe wäre eine Falschaussage.

**Ask First:**

- Sortieren oder Filtern nach Überfälligkeit, ein Abzeichen, eine Kappung des Satzes, eine Eingabeschranke an `Fällig bis`. Alle vier sind bewusst ausgeschlossen; wer eines davon für nötig hält, HALT und fragen.

**Never:**

- Eine `is_overdue`-Spalte, ein Cron, ein Hintergrundjob, ein Timer, der die Zahl nachzieht. Keine Migration, kein `npm run db:generate` — das Schema ändert sich nicht.
- Ändern von `sichtbareSpalten`, `SichtbareAufgabe` oder dem `orderBy` in `offeneAufgabenAuflisten`.
- `drizzle-orm`, `sql` oder ein DB-Handle unter `src/routes/` (Gate-Regel 9).
- Planungsartefakte anfassen — jede Änderung dort macht `epic-2-context.md` ungültig. Der Fehlverweis `{colors.warn}` in `EXPERIENCE.md:79,101` (das Token heisst `overdue`) wird nur in `deferred-work.md` notiert.
- Rot, Abzeichen, Pillen-Radius, Eskalation, Erinnerung, Zählung überfälliger Aufgaben.

## I/O & Edge-Case Matrix

`bezug` = `dueAt ?? createdAt`. Alle Zeilen offen, ausser der letzten.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Genau an der Schwelle | `bezug = jetzt − 21 Tage` | `wochenOffen === null`, keine zweite Zeile | N/A |
| Eine Sekunde darüber | `bezug = jetzt − 21 Tage − 1 s` | `3`, Zeile `seit 3 Wochen offen` | N/A |
| Volle vierte Woche | `bezug = jetzt − 28 Tage` | `4` | N/A |
| Ad-hoc ohne Frist | `dueAt = null`, `createdAt = jetzt − 30 Tage` | `4` — Ersatzbezug `created_at` | N/A |
| Monatsplan vor Fälligkeit | `createdAt = jetzt − 30 Tage`, `dueAt` in der Zukunft | `null` — negative Differenz fällt durch, ohne Sonderfall | N/A |
| Monatsplan nach Fälligkeit | `createdAt = jetzt − 60 Tage`, `dueAt = jetzt − 25 Tage` | `3`, nicht `8` — `due_at` gewinnt über `created_at` | N/A |
| In dieser Sitzung abgehakt | Id in `erledigt`, `wochenOffen = 4` | Zeile durchgestrichen **ohne** zweite Zeile, `aria-describedby` entfällt | N/A |
| In derselben Sitzung wieder geöffnet | Id verlässt `erledigt` | zweite Zeile kommt zurück, unveränderte Zahl | N/A |
| Vertipptes Jahr | `dueAt` im Jahr 1990 | `seit ~1900 Wochen offen`, ungekappt | Kein Fehlerfall: die absurde Zahl **ist** das Diagnosesignal |
| Erledigte Aufgabe | `completedAt` gesetzt | steht gar nicht in der Liste | N/A |

</frozen-after-approval>

## Code Map

Am Stand `7b1d9b9` sondiert und belegt — nicht neu herleiten:

- **Keine Schemaänderung.** `dueAt` (`schema.ts:154`) und `createdAt` (`:159`) liegen beide in `sichtbareSpalten` (`queries/tasks.ts:36-41`) und damit in den Seitendaten. `smoke-zugang.ts:3054-3067` behauptet das ausdrücklich („due_at steht ab jetzt in den Seitendaten — Story 2.2 rechnet darauf") und bricht, wenn `dueAt` umgeformt wird.
- **Warum die Ableitung nicht in SQL entsteht:** `sichtbareSpalten` ist **eine** Projektion für **alle fünf** Repository-Funktionen. Ein Überfälligkeits-Ausdruck darin landete auch im `returning()` von `aufgabeAnlegen:95`, `aufgabenStapelAnlegen:157`, `aufgabeAbhaken:211` und `aufgabeWiederOeffnen:238`, wo er sinnlos ist. Zudem weist `satisfies Record<keyof SichtbareAufgabe, unknown>` (`:41`) jede Zusatzspalte ab, solange `SichtbareAufgabe` (`schema.ts:191`, reines `Omit<Task,…>`) sie nicht kennt — der SQL-Weg verlangte, den Zeilentyp der Tabelle um ein abgeleitetes Feld zu erweitern oder eine zweite Projektion danebenzustellen.
- **`offeneAufgabenAuflisten()`** (`queries/tasks.ts:182-189`) nimmt heute **keine** Parameter. Genau **ein** Aufrufer: `+page.server.ts:114`. `NurSichtbar` (`:62`) ist **nicht** exportiert — der neue Listentyp muss selbst exportiert werden.
- **Die Sortierung ist verminter Boden.** `orderBy(asc(createdAt), asc(id))` (`:188`) hängt an vier ausgeführten Behauptungen mit exakten Id-Ketten: `smoke-zugang.ts:2200-2220`, `:2127`, `:2214/2219`, `:2347-2354`. „Überfällige zuerst" macht sie rot — was richtig ist, denn die Story darf nicht umsortieren.
- **`nenntErledigt`** (`smoke-zugang.ts:716`) prüft `/completed/i` über `JSON.stringify` der Seitendaten. Das neue Feld darf „completed" nicht im Namen tragen; ein deutscher Name erfüllt das von selbst.
- **`load` liest nur die Adresse**, weder `locals` noch `cookies` — Docblock `+page.server.ts:75-109`, erzwungen von `smoke-zugang.ts:2024-2028`, dessen Ereignis beim Zugriff wirft. `Date.now()` bricht diese Zusage nicht, ein Umweg über das Ereignis schon.
- **Importe in `+page.server.ts`** sind relativ mit `.ts`-Endung und Typen aus `@sveltejs/kit` (`:11-30`), weil `smoke-zugang.ts` das Modul mit nacktem Node lädt. `src/lib/zeit.ts` erfüllt das (`zeit.ts:1-17`, bereits so von `monatsplan/+page.server.ts:5` geladen); `src/lib/client/utils/date.ts` **nicht**.
- **Das Markup zwingt eine strukturelle Änderung.** `.zeile` ist `display: flex` in Zeilenrichtung (`+page.svelte:438-445`), `.zeile__form` ist `flex: none` (`:452`). Ein `<p>` nach `.zeile__text` (`:319`) landet **neben** dem Text. Nötig ist ein Spaltencontainer um `:319` plus neue Zeile.
- **Einhängepunkte in `+page.svelte`:** `{@const istErledigt}` `:260` (Ort für ein zweites `{@const}`), `li.zeile` `:261`, die beiden Kästchen mit `aria-labelledby="aufgabe-{id} verb-{id}"` `:291` (wiederOeffnen) und `:311` (abhaken), `span.zeile__text#aufgabe-{id}` `:319`. Der Sitzungszustand ist `erledigt` (`:33`), gepflegt in `zustandUebernehmen:128-139`; `versandFuer` fährt mit `invalidateAll: false` (`:169-194`), die Zahl bleibt also über die Sitzung stabil.
- **Stilanker:** `.zeile__text` `:528-534`, danach gehört die neue Regel; `.zeile--erledigt .zeile__text` `:541-544`; die einzige Animation `:577-583` unter `prefers-reduced-motion: no-preference` — die neue Zeile gehört **nicht** hinein, sie wird entfernt und nicht überblendet. Optisches Vorbild derselben Rolle: `verwaltung/+page.svelte:591-598` (`.zeile__meta`, meta-Rolle, „Beendet steht im **Text**, nicht in einer Farbe").
- **Tokens vollständig vorhanden:** `--overdue` `app.html:73` (hell `#9a5a12`) und `:206` (dunkel `#d99b4e`), meta-Rolle `:116-120`, `--space-1`. Kein neues Token. `--overdue` ist heute nirgends benutzt: Gate-Regel 8 (`gate.mjs:1319-1328`) gibt dafür einen **Hinweis**, heute sind es 2 (`--overdue`, `--border-marker`), danach 1.
- **`src/lib/zeit.ts`** ist das einzige Zeitmodul ohne Abhängigkeiten, von beiden Seiten und von nacktem Node ladbar (`:1-17`). `ZEITZONE:30`, `monatsendeAlsFeldwert:102-106` zeigt das Muster „jetzt kommt als Parameter". Vorbild für eine geteilte Grenze: `aufgabentext.ts:80` / `:100`.
- **Nachzuziehende Kommentare im Futur:** `schema.ts:11-13`, `:95-99`, `:142-145`, `:147-152` sagen alle „Story 2.2 rechnet …". Nach dieser Story rechnet sie.
- **smoke-Anschluss steht bereit:** `aufgabeSaen(text, createdAt, dueAt?)` `:688` kennt `dueAt` schon und begründet es mit dieser Story. Muster für eine reine Zeitrechnung an festen Zeitpunkten: der `zeit.ts`-Block `:2878-2955`. Quelltext-Behauptungen über `startseitenCode` `:2249-2272`. `ERWARTETE_BEHAUPTUNGEN = 349` `:101`, einzige Verwendung `:3787-3790`.
- **`gate.mjs` und `db-check.ts` nicht anfassen.** Regel 1 (keine Farb-/Massliterale), Regel 3 (jedes `var()` in `app.html` deklariert) und Regel 9 greifen automatisch. `db:check` muss „No schema changes" melden **ohne** neue Migration.

## Tasks & Acceptance

**Execution:**

- [x] `src/lib/zeit.ts` -- `UEBERFAELLIG_SEKUNDEN = 21 * 24 * 60 * 60` und `WOCHE_SEKUNDEN`; reine Funktion `wochenOffenSeit(bezugSekunden: number, jetztSekunden: number): number | null` — `null`, solange die Differenz die Schwelle nicht **strikt** überschreitet, sonst `Math.floor(differenz / WOCHE_SEKUNDEN)`. Kommentar dazu: warum hier **keine** Zonenrechnung nötig ist, obwohl 2.1 eine braucht (verglichen werden Zeitpunkte, keine Kalendertage; die Zeitumstellung verschiebt eine 21-Tage-Spanne um eine Stunde und ist auf Wochenauflösung unsichtbar), und warum der kleinste Rückgabewert `3` ist
- [x] `src/lib/server/db/queries/tasks.ts` -- `offeneAufgabenAuflisten(jetztSekunden: number)` gibt einen neuen **exportierten** Typ (`NurSichtbar & { wochenOffen: number | null }`) und setzt das Feld über `wochenOffenSeit(zeile.dueAt ?? zeile.createdAt, jetztSekunden)`. `sichtbareSpalten` und `orderBy` bleiben **unverändert**. Im Docblock festhalten: warum die Ableitung in TypeScript und nicht als SQL-`COALESCE` entsteht (die geteilte Projektion), dass `??` dieselbe Regel ist, und dass die Sortierung bewusst nicht auf Überfälligkeit reagiert
- [x] `src/routes/+page.server.ts` -- `load` berechnet `Math.floor(Date.now() / 1000)` und gibt es an `offeneAufgabenAuflisten` weiter. Den Docblock um den Grund ergänzen, warum der Zeitpunkt hier und nicht im Browser entsteht; die Zusage „liest nur die Adresse" bleibt wörtlich wahr
- [x] `src/routes/+page.svelte` -- Spaltencontainer um `:319` (`display: flex`, `flex-direction: column`, `gap: var(--space-1)`, `min-width: 0`); darin nach dem Aufgabentext ein `<p class="zeile__frist" id="frist-{id}">seit {N} Wochen offen</p>`, gerendert nur bei `!istErledigt && aufgabe.wochenOffen !== null`; `aria-describedby` am **abhaken**-Kästchen (`:311`) unter derselben Bedingung, sonst `undefined`. Lokale Stilregel direkt nach `.zeile__text`: meta-Rolle plus `color: var(--overdue)`, `margin: 0`. **Nicht** in die Übergangsliste `:577-583` aufnehmen. Kommentar an der Bedingung: warum die Zeile beim Abhaken verschwindet und warum sie nicht Teil der Kästchen-Beschriftung ist
- [x] `src/lib/server/db/schema.ts` -- die vier Kommentarstellen `:11-13`, `:95-99`, `:142-145`, `:147-152` von „Story 2.2 rechnet" auf den gebauten Zustand umschreiben, inklusive des Hinweises, dass die Rechnung in `src/lib/zeit.ts` steht. Keine Spaltenänderung
- [x] `scripts/smoke-zugang.ts` -- ein 2.2-Block mit **jeder** Zeile der Matrix ausgeführt: die zehn Fälle über `aufgabeSaen` an festen Zeitpunkten gesät und gegen die `load` von `/` nachgemessen, dazu `wochenOffenSeit` direkt an der Schwelle, eine Sekunde darüber und mit negativer Differenz. Ausserdem: die Id-Ketten der bestehenden Sortierbehauptungen bleiben unverändert grün; `nenntErledigt` läuft über die neuen Seitendaten; textuell auf `startseitenCode`, dass die zweite Zeile an `!istErledigt` hängt, `var(--overdue)` benutzt, `Wochen offen` wörtlich trägt, ein `<p>` und kein Abzeichen ist und **nicht** in `#aufgabe-{id}` verschachtelt liegt; textuell, dass `UEBERFAELLIG_SEKUNDEN` genau einmal deklariert ist und weder `src/` noch `drizzle/` ein `is_overdue` kennt. `ERWARTETE_BEHAUPTUNGEN` exakt nachziehen
- [x] `README.md` -- neuer H2 `## Überfällige Aufgaben erkennen` unmittelbar **vor** `## Mitglieder aufnehmen und Zugang beenden` (heute `:1477`), 35 bis 55 Zeilen im Stil der Nachbarn: Vorlauf plus Aufzählung fetter Entscheidungen mit Grund **und** Preis. Nachziehen: `:7` und `:9` (Stand-Satz), `:12-13` (die Schleife auf `/`), `:1272-1274` und `:1285-1288` (Zustände der Zeile, `aria-labelledby`-Zusage), `:1025` (smoke), `:1179-1180` (Mutationstabelle), `:1424-1430` (der `Fällig bis`-Absatz bekommt einen Querverweis statt der Konditionalform), und `:1666-1669` fällt weg — alle drei Teilaussagen dort kippen. Bei `:1670-1672` ergänzen, dass eine über `/aufgabe` erfasste Aufgabe 21 Tage nach der Erfassung überfällig wird, ohne dass jemand eine Frist gesetzt hat
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- zwei Einträge anhängen: der Fehlverweis `{colors.warn}` in `EXPERIENCE.md:79,101` (das Token heisst `overdue`; hier nicht korrigiert, weil eine Änderung an den Planungsartefakten den Epic-Kontext ungültig macht), und dass die zweite Textzeile die Zeilenhöhe verändert, während die Svelte-Schicht von `/` weiterhin von keiner ausgeführten Prüfung gedeckt ist (`deferred-work.md:50-52`)

**Acceptance Criteria:**

- Given `npm run lint` und `npm run check`, when sie laufen, then enden beide mit 0 — `gate`, `gate:selftest`, `db:check`, `db:check:selftest` und `smoke` eingeschlossen
- Given `npm run db:check`, when es läuft, then meldet es „No schema changes" **ohne** eine neue Migrationsdatei — das Schema ist unverändert
- Given `npm run gate`, when es läuft, then ist die Hinweiszahl von 2 auf 1 gefallen, weil `--overdue` jetzt benutzt wird
- Given der Quelltext, when nach der Schwelle gesucht wird, then ist sie an genau einer Stelle deklariert, und weder `src/` noch `drizzle/` enthalten `is_overdue`, `setInterval` oder einen Hintergrundjob
- Given eine überfällige Aufgabe, when sie in der Liste erscheint, then steht sie an ihrem nach `created_at` sortierten Platz, verschwindet nicht und trägt kein Abzeichen
- Given `/` bei 375px in Hell **und** Dunkel, when eine überfällige Zeile geprüft wird, then bleibt das Trefferfeld ≥ 44px, das Kästchen bleibt am Anfang der ersten Textzeile, und die zweite Zeile ist in beiden Modi lesbar
- Given ein Screenreader, when er die überfällige Zeile erreicht, then heisst das Kästchen `<Aufgabentext>, erledigen` und `seit N Wochen offen` kommt als **Beschreibung**, nicht als Teil des Namens
- Given ein Gerät mit ausgeschalteter Farbdarstellung, when die Liste gelesen wird, then ist Überfälligkeit am Text erkennbar

## Spec Change Log

## Design Notes

**Warum die Ableitung in TypeScript entsteht, obwohl AD-8 `COALESCE` schreibt.** `dueAt ?? createdAt` ist dieselbe Regel. Verboten sind laut AD-8 eine `is_overdue`-Spalte, ein Cron und ein Job — eine Ableitung im Repository ist keines davon, und „berechnet zur Anzeigezeit" ist erfüllt. Der SQL-Weg scheitert dagegen an der Bauform aus Story 1.4: `sichtbareSpalten` ist eine Projektion für fünf Funktionen, und ein Ausdruck darin wäre im `returning()` von vier Mutationen mit dabei, wo er nichts bedeutet. Der Preis dieser Entscheidung ist benannt: die Wochenzahl entsteht in JavaScript, also gibt es keinen Weg, überfällige Aufgaben in SQL zu filtern, falls das je gebraucht wird.

**Warum die Zeile beim Abhaken verschwindet.** AD-8 hat zwei Konjunkte, und der erste ist `completed_at IS NULL`. In der Datenbank fällt er mit dem Abhaken weg; in der Oberfläche nicht, weil die Zeile mit `invalidateAll: false` an ihrem Platz stehen bleibt und `data` unverändert bleibt. Bliebe die zweite Zeile stehen, behauptete sie „offen" über eine Aufgabe, die gerade erledigt wurde. Also hängt sie an `!istErledigt` — und kommt beim Wiederöffnen in derselben Sitzung von selbst zurück.

**Warum hier keine Zonenrechnung steht, obwohl Story 2.1 eine braucht.** 2.1 rechnet einen Kalendertag in einen Zeitpunkt um, und dafür ist die Zone konstitutiv. 2.2 vergleicht zwei Zeitpunkte. Die Schweizer Zeitumstellung macht eine 21-Kalendertage-Spanne einmal im Jahr um eine Stunde kürzer oder länger; auf Wochenauflösung ist das unsichtbar. Wer hier `teileInZone` hereinzieht, macht die Rechnung komplizierter, ohne ein Ergebnis zu ändern.

**Warum aus einer Zahl ein Satz in der Komponente wird und nicht in `date.ts`.** AD-6 reserviert `src/lib/client/utils/date.ts` für die Formatierung von **Zeitstempeln**. Hier wird kein Zeitstempel formatiert — aus der Zahl `4` wird `seit 4 Wochen offen`. Ein Utility dafür wäre eine Indirektion um eine Zeichenkette. Zudem darf `+page.server.ts` dieses Modul nicht laden (nacktes Node), die Rechnung liegt also ohnehin in `zeit.ts`.

**Warum der Satz nicht gekappt wird.** `Fällig bis` nimmt heute jedes formgültige Datum an (`deferred-work.md:98-100`). Ein vertipptes Jahr erzeugt `seit 1900 Wochen offen` — und genau diese absurde Zahl ist das Diagnosesignal. Eine Obergrenze wie `seit über einem Jahr offen` liesse den Stapel von 1990 aussehen wie einen, der 14 Monate liegt. Der Schaden entsteht ohnehin beim Ablegen und nicht beim Anzeigen; die Eingabeschranke bleibt eine eigene Produktentscheidung.

## Verification

**Commands:**

- `npm run check` -- expected: Exit 0 mit `--fail-on-warnings`; belegt zugleich, dass der neue Listentyp bis in die Komponente durchtypt ist
- `npm run db:check` -- expected: Exit 0, „No schema changes", **keine** neue Datei unter `drizzle/`
- `npm run gate` -- expected: Exit 0 mit **1** Hinweis statt 2
- `npm run smoke` -- expected: Exit 0, jede Zeile der Matrix ausgeführt belegt, `ERWARTETE_BEHAUPTUNGEN` stimmt
- `npm run lint` -- expected: Exit 0 über die ganze siebengliedrige Kette
- `env -u DATABASE_PATH -u SESSION_SECRET -u ORIGIN npm run build` -- expected: Exit 0

**Manual checks (if no CLI):**

- `/` bei 375px in Hell **und** Dunkel mit einer überfälligen und einer frischen Aufgabe: die zweite Zeile steht unter dem Text, nicht daneben; das Kästchen bleibt am Anfang der ersten Textzeile; der Fokusring ist unverändert
- Eine überfällige Zeile abhaken: die zweite Zeile verschwindet, die Durchstreichung erscheint, die Zeile bleibt an ihrem Platz
- Bei ausgeschalteter Farbdarstellung: `seit N Wochen offen` bleibt lesbar
- Mit VoiceOver: das Kästchen heisst `<Aufgabentext>, erledigen`, die Überfälligkeit kommt als Beschreibung
- Eine Aufgabe mit `due_at` am Monatsende, angelegt vor 30 Tagen: **keine** zweite Zeile

## Suggested Review Order

**Die Rechnung — eine Schwelle, eine Wochenzahl**

- Einstieg: die ganze Regel in vier Zeilen, strikter Vergleich, kein Sonderfall.
  [`zeit.ts:282`](../../src/lib/zeit.ts#L282)

- Die Schwelle als `3 * WOCHE_SEKUNDEN` — die Kopplung ist strukturell statt behauptet.
  [`zeit.ts:220`](../../src/lib/zeit.ts#L220)

- Zählbeginn und Bezugszeitpunkt: zwei Begriffe, die nicht vermischt werden.
  [`zeit.ts:233`](../../src/lib/zeit.ts#L233)

- Warum hier keine Zonenrechnung steht, obwohl der Rest des Moduls eine braucht.
  [`zeit.ts:262`](../../src/lib/zeit.ts#L262)

**Die Ableitung je Zeile und die eine Uhr**

- `dueAt ?? createdAt` — AD-8s COALESCE als eine Zeile im Repository.
  [`tasks.ts:251`](../../src/lib/server/db/queries/tasks.ts#L251)

- Der Docblock trägt die Entscheidung: TypeScript statt SQL, samt genanntem Preis.
  [`tasks.ts:242`](../../src/lib/server/db/queries/tasks.ts#L242)

- Der exportierte Listentyp; `sichtbareSpalten` und `SichtbareAufgabe` bleiben unberührt.
  [`tasks.ts:83`](../../src/lib/server/db/queries/tasks.ts#L83)

- Eine Uhr für die ganze Liste, serverseitig — sonst weicht die Hydrierung ab.
  [`+page.server.ts:129`](../../src/routes/+page.server.ts#L129)

**Die zweite Zeile in der Liste**

- Beide Konjunkte von AD-8 an einer Stelle, der erste in dieser Sitzung.
  [`+page.svelte:304`](../../src/routes/+page.svelte#L304)

- Der Höhensprung beim Abhaken — als Preis benannt, nicht verschwiegen.
  [`+page.svelte:283`](../../src/routes/+page.svelte#L283)

- Beschreibung statt Namensteil: das Kästchen heisst weiter `<Text>, erledigen`.
  [`+page.svelte:356`](../../src/routes/+page.svelte#L356)

- Der Spaltencontainer ist die einzige Stelle, an der die Zeile darunter landet.
  [`+page.svelte:387`](../../src/routes/+page.svelte#L387)

- Lehmbraun, meta-Rolle, kein Abzeichen — und bewusst nicht in der Übergangsliste.
  [`+page.svelte:653`](../../src/routes/+page.svelte#L653)

**Was die Prüfung deckt — und wo ihre Grenze benannt ist**

- Zwei Helfer schneiden Bereiche zu; Regexe über die ganze Datei trugen nicht.
  [`smoke-zugang.ts:4022`](../../scripts/smoke-zugang.ts#L4022)

- Das Attribut sitzt am abhaken-Kästchen und nirgends sonst — vorgeführte Lücke, geschlossen.
  [`smoke-zugang.ts:4091`](../../scripts/smoke-zugang.ts#L4091)

- Die Reihenfolge der zwei Textzeilen — die zweite vorgeführte Lücke.
  [`smoke-zugang.ts:4123`](../../scripts/smoke-zugang.ts#L4123)

- Die eine benannte Toleranz gegen die echte Uhr, so schmal wie möglich.
  [`smoke-zugang.ts:3991`](../../scripts/smoke-zugang.ts#L3991)

- Keine Überfälligkeitsspalte — die Behauptung sagt, wie weit sie reicht.
  [`smoke-zugang.ts:4249`](../../scripts/smoke-zugang.ts#L4249)

**Peripherie**

- Das Schema ist unverändert, und der Kommentar sagt es jetzt im Präsens.
  [`schema.ts:99`](../../src/lib/server/db/schema.ts#L99)

- Der neue Abschnitt, samt der Doppeldeutigkeit von `seit N Wochen offen`.
  [`README.md:1535`](../../README.md#L1535)
