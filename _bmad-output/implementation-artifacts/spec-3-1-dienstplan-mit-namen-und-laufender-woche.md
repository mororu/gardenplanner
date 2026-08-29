---
title: 'Story 3.1: Dienstplan mit Namen und laufender Woche'
type: 'feature'
created: '2026-08-29'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done
review_loop_iteration: 2
baseline_commit: '9770d9ced605694de00f6fa3489245284cb32756'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Der Tränkedienst wird heute im Gruppenchat ausgehandelt. Niemand sieht verbindlich, wer wann kommt, und wer diese Woche dran ist, erfährt es nur, wenn jemand fragt. Der Aufgaben-Pool aus Epic 1 kann das nicht leisten: er ist absichtlich namenlos.

**Approach:** Eine Tabelle `duty_weeks` mit genau **einer** zuständigen Person je ISO-Kalenderwoche, eine Seite `/dienstplan` mit den Wochen der nächsten drei Monate, und auf `/` ein Block über allem, wenn ich selbst diese Woche Dienst habe. Besetzen und Neubesetzen ist **ein** Vorgang: der Name einer Woche wird ersetzt, nicht verhandelt.

## Boundaries & Constraints

**Always:**

- **Genau eine Person je Woche.** `duty_weeks` ist eindeutig über (Dienstart, ISO-Jahr, ISO-Woche); die Mitgliedsspalte ist **nicht nullbar**. Ein Tausch ist ein UPDATE derselben Zeile — kein zweiter Datensatz, keine Anfrage, die jemand annehmen müsste.
- **Die ISO-Wochenrechnung steht in `src/lib/zeit.ts`**, dort, wo Zone und Schwelle schon wohnen. Keine zweite Wochenrechnung in einer Route oder Komponente. Das Modul hängt weiterhin von nichts ab und bleibt über nacktes Node ladbar.
- **Der Diensthinweis auf `/` fehlt ganz, wenn ich keinen Dienst habe** — er ist nicht leer, sondern nicht vorhanden. Nicht abhakbar, nicht wegklickbar: ein Dienst ist keine Aufgabe.
- **`— unbesetzt —` trägt das Wort**, die Farbe (`var(--warn)`, schon deklariert) kommt dazu. Beides zusammen, nie die Farbe allein.
- **Der Datenzugriff bleibt in der Repository-Schicht:** ein neues Modul `queries/duty-weeks.ts` mit benannten, **synchronen** Funktionen. Kein Drizzle-Aufruf in einer Routendatei (Gate-Regel 9). Zeitspalten gibt es hier keine — Jahr und Woche sind Integer.
- **Besetzen ist eine form action auf `/dienstplan`** mit literalem `action="?/besetzen"` und `use:enhance` (AD-9), inline je Wochenzeile, ohne modalen Dialog — Bauform wie das Umbenennen aus Story 3.0.1. Sie beginnt mit `adminOderWeg` und jede Abweisung geht durch `abweisen`.
- **Die Schemaerweiterung läuft über die Migrationskette** (`npm run db:generate`). Migrationsdateien werden nie von Hand geändert.
- **Die Startseite bekommt ihre Blockreihenfolge:** Diensthinweis, dann (später) freie Einzelaufgaben, dann der Aufgaben-Pool. Diese Story legt sie an; Story 3.2 ordnet sich ein.

**Ask First:**

- Ein zweiter Dienstplan neben dem Tränken (die Spalte trägt die Art, eine Oberfläche dafür gibt es nicht).
- Wochen **rückwirkend** besetzen oder eine Historie vergangener Wochen zeigen.
- Eine Erinnerung, ein Push oder eine Benachrichtigung zum Dienst.

**Never:**

- Keine Tauschverhandlung, keine Anfrage zwischen Mitgliedern, kein Annehmen/Ablehnen.
- Keine Zuständigkeitsspalte an `tasks`. Der Pool bleibt namenlos (AD-2).
- Kein Löschen einer Dienstwoche über die Oberfläche und kein Reaktivieren eines Mitglieds.
- Kein `async`/`await` in der Datenschicht, kein JSON-Endpunkt, kein Polling.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Plan lesen | Mitglied ohne Adminrechte, `/dienstplan` | 200, die Wochen der nächsten drei Monate mit je einem Namen, Ziffern in Tabellenstellung, **kein** Besetzen-Formular | — |
| Woche ohne Zeile | Für (Art, Jahr, Woche) existiert kein Datensatz | `— unbesetzt —` in `var(--warn)` | — |
| Zuständige beendet | Zeile zeigt auf ein Mitglied mit `is_active = 0` | Dieselbe Darstellung `— unbesetzt —`; der Datensatz bleibt stehen | — |
| Eigener Dienst | Ich bin in der laufenden ISO-Woche zuständig, `/` | Über allem ein Block `Diese Woche bist du am Tränken` mit Wochendatum, verlinkt auf `/dienstplan` | — |
| Kein eigener Dienst | Ich bin diese Woche nicht zuständig | Der Block fehlt **ganz** — kein leerer Rahmen, kein Platzhalter | — |
| Besetzen gelingt | Admin wählt ein aktives Mitglied für eine Woche | Woche neu besetzt (Einfügen **oder** Ersetzen derselben Zeile), Rückmeldung in der Live-Region | — |
| Unverändert | Gewähltes Mitglied ist schon zuständig | Erfolg, nicht Abweisung | — |
| Woche nicht ansprechbar | Jahr/Woche fehlt, nicht numerisch oder ausserhalb des angezeigten Fensters | 400, **ein** Satz in der oberen Live-Region | `abweisen(…)` ohne Feld |
| Mitglied nicht ansprechbar | `mitgliedId` fehlt, unbekannt oder beendet | 400, `MITGLIED_NICHT_ANSPRECHBAR` an der Zeile dieser Woche | `abweisen(…, 'mitgliedId', '', zeile)` |
| Nicht-Admin | POST auf `?/besetzen` ohne Adminrechte | 303 auf `/`, nichts geändert | `adminOderWeg` |

</frozen-after-approval>

## Code Map

- `src/lib/zeit.ts:196` — hier enden Zone, `WOCHE_SEKUNDEN` und die Überfälligkeitsrechnung. Die ISO-Wochenfunktionen kommen **darunter**; `teileInZone` (`:69`) ist der vorhandene Baustein und bleibt privat.
- `src/lib/server/db/schema.ts:96` — der Docblock sagt wörtlich „`duty_weeks` und `signup_tasks` kommen mit Epic 3". `members` (`:18`) ist das Fremdschlüsselziel; `tasks` (`:110`) wird **nicht** angefasst. `ohneTokenHash` (`:76`) zeigt die Bauform einer Projektion.
- `src/lib/server/db/queries/members.ts:126,196,226` — Vorlage: `Intl.Collator('de-CH')` für die Namensliste, `aktivesMitgliedLesen` als Vorprüfung, `update … where(and(…)).returning(…).get()` mit `null` als einzigem Fehlschlag.
- `src/lib/server/db/queries/tasks.ts:20` — die Bauform eines Repository-Moduls: Spaltenauswahl als Konstante mit `satisfies Record<keyof …, unknown>`, alles synchron.
- `src/routes/verwaltung/+page.server.ts:106,261` — `idLesen` (dritte, bewusste Kopie) und die action `umbenennen` als **direkte Vorlage** für `besetzen`: Ansprechbarkeit vor Wert, `abweisen` mit viertem Argument `zeile`.
- `src/routes/verwaltung/+page.svelte:461,477` — keyed `{#each}`, `<details open={fehlerHier}>`, Live-Region je Zeile, Fokus über `document.getElementById`. Dieselbe Bauform, andere Zeilenart.
- `src/lib/server/abweisen.ts:57` — `abweisen(meldung, feld, eingabe, zeile)`. `zeile: number | null` trägt hier den **Wochenschlüssel**, nicht eine Id — siehe Design Notes.
- `src/routes/+page.server.ts:120` — die `load`, die heute **nur** `url` liest. **Diese Story bricht das bewusst** (siehe unten).
- `scripts/smoke-zugang.ts:2388-2405` — die ausgeführte Behauptung „die load von / liest aus dem Ereignis nur die Adresse — weder locals noch Cookies". Sie wird rot und **muss verhandelt, nicht gelöscht** werden.
- `src/routes/+page.svelte:246` — `<div class="seite">` mit `<h1>`; der Diensthinweis ist der erste Block darin, vor `<h2 class="marke">Offen</h2>` (`:288`).
- `src/app.html:73,213` — `--warn` (`#a05300` / `#ffa857`, Ringelblume) und `--border-marker` (`:178`, 3px) sind deklariert und **unbenutzt**; `npm run gate` meldet beide heute als Hinweis. Diese Story nimmt beide in Gebrauch, die Hinweise verschwinden.
- `src/lib/components/NavBar.svelte:8` — der Kommentar sagt „unbebaut sind noch /dienstplan und /wissen". Nach dieser Story stimmt nur noch `/wissen`.
- `src/lib/styles/bedienelemente.css:191` — `.seite`, `.seitentitel`, `.fehler`, `.live:empty` liegen schon geteilt. `/dienstplan` benutzt sie und legt **keine** Kopie an (Retro-Posten D1).

## Tasks & Acceptance

**Execution:**

- [x] `src/lib/zeit.ts` — ISO-Woche eines Zeitpunkts, das Wochenfenster der nächsten drei Monate und das Wochendatum als Text ergänzen — die Wochenrechnung darf nur an einer Stelle stehen.
- [x] `src/lib/server/db/schema.ts` — `duty_weeks` anlegen: Art, ISO-Jahr, ISO-Woche, nicht nullbare `member_id`, eindeutig über die ersten drei — das Schema soll die Verbindlichkeit zeigen.
- [x] `drizzle/` — Migration über `npm run db:generate` erzeugen, nicht von Hand schreiben.
- [x] `src/lib/server/db/queries/duty-weeks.ts` — `dienstwochenLesen` (Fenster, mit Namen und Aktiv-Zustand) und `dienstwocheBesetzen` (Einfügen oder Ersetzen), synchron.
- [x] `src/routes/dienstplan/+page.server.ts` — `load` mit dem Wochenfenster und der Mitgliederauswahl für Admins; action `besetzen` hinter `adminOderWeg`.
- [x] `src/routes/dienstplan/+page.svelte` — die Wochenliste in Tabellenstellung, `— unbesetzt —` mit Wort und Farbe, das Besetzen-Formular je Zeile nur für Admins.
- [x] `src/routes/+page.server.ts` — den eigenen Dienst der laufenden Woche mitliefern; der Bezugszeitpunkt entsteht wie bisher **einmal** in der `load`.
- [x] `src/routes/+page.svelte` — den Diensthinweis als ersten Block einfügen, mit 3px Akzentkante; ohne eigenen Dienst gar nicht.
- [x] `src/lib/texte.ts` — den Satz für die nicht ansprechbare Woche aufnehmen, falls er zwei Wurfstellen bekommt.
- [x] `scripts/smoke-zugang.ts` — die Behauptung über die `load` von `/` **verhandeln** (siehe Design Notes) und die neuen Wege belegen: Wochenrechnung, Besetzen, Beenden macht unbesetzt, Adminschranke.
- [x] `scripts/smoke-http.ts` — `/dienstplan` am gebauten Server: 200 für alle, das Besetzen-Formular nur im HTML der Adminperson.
- [x] `README.md` — die Mutationstabelle um die neuen Zusagen ergänzen; keine Zusage ohne Behauptung in der Kette.

**Acceptance Criteria:**

- Given ein Mitglied ohne Adminrechte, when es `/dienstplan` öffnet, then sieht es den vollen Plan und **kein** Besetzen-Formular — auch nicht im ausgelieferten HTML.
- Given eine besetzte künftige Woche, when der Zugang der zuständigen Person beendet wird, then steht diese Woche als `— unbesetzt —`, ohne dass ein Datensatz verschwindet.
- Given `npm run gate`, when die Story fertig ist, then meldet es `--warn` und `--border-marker` **nicht** mehr als unbenutzt.
- Given die laufende Woche, when zwei verschiedene Mitglieder `/` laden, then ist ihre Aufgabenliste identisch und nur der Diensthinweis verschieden.

### Review Findings

**Durchgang 2 — 2026-08-29, abgearbeitet.** Alle 22 Patches sind angewendet, `npm run build && npm run lint` läuft mit Exit 0 (`smoke` 476, `smoke:http` 103 Behauptungen, `gate` 0 Hinweise). Vier Befunde sind zurückgestellt, vier als Rauschen verworfen.

**Durchgang 2 — 2026-08-29.** Vier Layer (Blind Hunter, Edge Case Hunter,
Verification Gap, Acceptance Auditor), keiner ausgefallen. Kein
Akzeptanzkriterium ist verletzt und keine Zeile der I/O-Matrix verhält sich
anders als zugesagt; die Befunde betreffen **die Kette, nicht das Verhalten** —
mit zwei Ausnahmen (RF-P1, RF-P2), die ausgeliefert sind.

- [x] [Review][Patch] Die Wochennummer trägt das ISO-Jahr — entschieden am 2026-08-29 am laufenden Dev-System: `KW 53 / 28. Dezember bis 3. Januar` gefolgt von `KW 1 / 4. Januar bis 10. Januar` nennt über vier Monate Spannweite nirgends ein Jahr. Das Jahr kommt an die KW-Zeile; die Begründung an `wochendatum` in `zeit.ts`, die sich auf „die Zeile daneben" beruft, wird damit wahr statt falsch [src/routes/dienstplan/+page.svelte:178; src/lib/zeit.ts:wochendatum]
- [x] [Review][Patch] Die Erfolgsrückmeldung nennt die Woche — entschieden am 2026-08-29: `besetzen` gibt `zeile` mit zurück, der Satz lautet `Besetzt. <Name> ist für KW <N> eingetragen.` Der Fehlerweg trug den Wochenschlüssel schon, der Erfolgsweg nicht [src/routes/dienstplan/+page.server.ts:actions.besetzen; src/routes/dienstplan/+page.svelte:rueckmeldung]
- [x] [Review][Decision] Die manuellen Prüfungen sind am 2026-08-29 am laufenden Dev-System durchgegangen (375px in Hell und Dunkel, 44px-Trefferfelder, 3px-Kante an Diensthinweis und laufender Woche) — im Verification-Abschnitt nachgetragen, erledigt
- [x] [Review][Patch] `/dienstplan` wird ohne `<title>` ausgeliefert, und die Seitenschleife, die das gemerkt hätte, kennt die Seite nicht [src/routes/dienstplan/+page.svelte:1; scripts/smoke-http.ts:765]
- [x] [Review][Patch] `auch der beendeten Person selbst — unbesetzt ist niemandes Dienst` ist eine leere Behauptung: `gehende` ist 35 Zeilen vorher deaktiviert, das Besetzen davor ist ein No-op, und die Zeile bliebe grün, wenn `eigeneDienstwoche` `is_active` ignorierte [scripts/smoke-zugang.ts:4765]
- [x] [Review][Patch] Der abgewiesene POST auf `/dienstplan` wird nie als Dokument geprüft — nur Regexe über den Quelltext der Komponente und der Rückgabewert der action; `/verwaltung?/umbenennen` hat genau diese Prüfung samt Begründung [scripts/smoke-http.ts:905; scripts/smoke-zugang.ts:5729]
- [x] [Review][Patch] Der Diensthinweis auf `/` wird nie im ausgelieferten HTML gesehen — `smoke-http` enthält kein Vorkommen von „Tränken", und alle drei `holen(port, '/')` stehen vor dem besetzenden POST [scripts/smoke-http.ts:668,682,716,1142]
- [x] [Review][Patch] Die laufende Woche hat einen geprüften Erzeuger und einen ungeprüften Verbraucher — `laufendeWoche` kommt in beiden Skripten genau einmal vor, als Wert der `load`; `woche--laufend` und `diese Woche` werden nie behauptet [scripts/smoke-zugang.ts:4828; src/routes/dienstplan/+page.svelte:168]
- [x] [Review][Patch] Die Faltung `jahr * 100 + woche` steht vier Mal in `duty-weeks.ts`, `wochenSchluessel` ist dort nicht importiert — die Komponente ist per Behauptung gegen genau diese zweite Faltung geschützt, die Abfrageschicht nicht [src/lib/server/db/queries/duty-weeks.ts:67,83,90,93]
- [x] [Review][Patch] `is_active` wird in der Routendatei gefiltert statt in der Abfrageschicht — `mitgliederAuflisten().filter(…isActive)`; derselbe Diff schreibt die Gegenregel zwei Mal auf, und Gate-Regel 9 greift hier nicht [src/routes/dienstplan/+page.server.ts:98]
- [x] [Review][Patch] Das Nicht-Admin-Dokument **nach** dem Besetzen wird nicht auf die Namensliste geprüft — `!planOhneRechteHtml.includes('Vera Verwaltung')` läuft auf dem leeren Plan; `nachBesetzenHtml` existiert, wird aber nur für die `— unbesetzt —`-Zählung benutzt [scripts/smoke-http.ts:1057,1147]
- [x] [Review][Patch] Die README-Mutationstabelle hat keine Zeile für „die Eindeutigkeitsbedingung aus `duty_weeks` entfernt", obwohl der Verification-Abschnitt sie als erste nennt — sie wird rot, aber über `scripts/db-check.ts`, nicht über `smoke` [README.md:Mutationstabelle]
- [x] [Review][Patch] Die README-Belegzeile für „der Diensthinweis auch ohne eigenen Dienst gerendert" nennt `wer keinen hat, bekommt null` — das misst den Rückgabewert der `load` und bliebe grün, wenn das `{#if}` in der Komponente fiele [README.md:Mutationstabelle]
- [x] [Review][Patch] Die Mitgliederliste geht unprojiziert ins Admin-HTML — `AngemeldetesMitglied[]` trägt `isAdmin`, `isActive` und `createdAt`, das `<select>` liest `id` und `name` [src/routes/dienstplan/+page.server.ts:98]
- [x] [Review][Patch] Die README-Belegzeile für „das ISO-Jahr aus dem Montag statt dem Donnerstag gelesen" nennt die falsche Zeile — bei `1.1.2027` liegen Montag und Donnerstag im selben Kalenderjahr, die Mutation bleibt dort grün; rot wird `30.12.2019 gehört schon zur Woche 1 von 2020` [README.md:Mutationstabelle]
- [x] [Review][Patch] Die Hash-/Klartext-Token-Prüfung des Dienstplans läuft nur auf `planAlsAdminHtml`, nicht auf dem Nicht-Admin-Dokument [scripts/smoke-http.ts:1122]
- [x] [Review][Patch] `wochenfenster` ist gegen die benannte Mutation gemessen, gegen eine Nachbarin nicht — hängen `start` **und** `grenze` an heute statt am Montag, bleiben alle fünf `fensterTeile` grün. Eine Gegenprobe „Montag und Sonntag derselben Woche geben dasselbe Fenster" schliesst das [scripts/smoke-zugang.ts:fensterTeile]
- [x] [Review][Patch] Der `.marke`-Docblock auf `/` steht seit diesem Diff über `.dienst` statt über `.marke` — der neue Block wurde zwischen Kommentar und Regel eingefügt [src/routes/+page.svelte:479]
- [x] [Review][Patch] `texte.ts` beschreibt seine eigenen Wurfstellen falsch — „**Eine** Wurfstelle heute" bei zwei `abweisen(WOCHE_NICHT_ANSPRECHBAR)` in derselben action [src/lib/texte.ts:WOCHE_NICHT_ANSPRECHBAR]
- [x] [Review][Patch] Kommentar und Behauptung widersprechen sich: „drei Monate sind je nach Startpunkt 12 bis 14 Wochen" über `fenster.length >= 13 && <= 14`; `zeit.ts` und README sagen 13 oder 14 [scripts/smoke-zugang.ts:fensterTeile]
- [x] [Review][Patch] Zwei widersprüchliche Begründungen zur Datumsformatierung — `/+page.server.ts` formatiert serverseitig gegen einen Hydrierungsunterschied, `/dienstplan` formatiert dieselbe Funktion in der Komponente. `wochendatum` ist rein; die Begründung auf `/` trägt nicht [src/routes/+page.server.ts:load]
- [x] [Review][Patch] `.woche__name` hat weder `min-width: 0` noch `overflow-wrap` — ein langer Name ohne Trennstelle weitet die Zeile bei 375px, genau die manuelle Prüfung „die Wochenliste bricht nicht" [src/routes/dienstplan/+page.svelte:.woche__name]
- [x] [Review][Patch] `fokusNach` behandelt `result.type === 'redirect'` wie einen Erfolg und setzt den Fokus in die Erfolgsregion [src/routes/dienstplan/+page.svelte:88]
- [x] [Review][Defer] 13–14 gleichlautende zugängliche Namen ohne Wochenbezug — `Besetzen`, `Zuständig`, `Eintragen` je Zeile; die KW steht in einem nicht verknüpften Geschwister-`<p>` [src/routes/dienstplan/+page.svelte:207,224,244] — deferred, derselbe Posten wie aus Story 3.0.1: der Entscheid dort lautet, alle Zeilen-Aktionen in einem Zug zu lösen; der Dienstplan ist die vierte Zeilenart daran
- [x] [Review][Defer] Die Dienstart ist unmessbar — kein Prüfweg schreibt je eine Zeile mit einer anderen `art`, `eq(dutyWeeks.art, DIENSTART_TRAENKEN)` liesse sich löschen und alles bliebe grün [src/lib/server/db/queries/duty-weeks.ts:76] — deferred, ein zweiter Dienstplan ist Ask-First und ausserhalb dieser Story
- [x] [Review][Defer] `.hinweis` ist die zweite Kopie derselben Nebentext-Regel [src/routes/dienstplan/+page.svelte:277; src/routes/monatsplan/+page.svelte:594] — deferred, Retro-Posten D1, der Fix ist eine geteilte Klasse und grösser als diese Story
- [x] [Review][Defer] `select.feld { appearance: auto }` trägt keine Behauptung [src/lib/styles/bedienelemente.css:141] — deferred, Darstellung ist von keinem der beiden Skripte messbar und steht auf der manuellen Liste

## Spec Change Log

**Durchgang 1 — die Vorbelegung war behauptet, nicht gemessen.** Die erste
Fassung belegte die Vorbelegung der Auswahl nur an einer Textprüfung im
Komponenten-Quelltext (`selected={mitglied.id === eintrag.mitgliedId}`). Ob
Svelte daraus im **ausgelieferten** HTML ein `selected` am richtigen `<option>`
macht, sagt das nicht — und ohne JavaScript ist genau dieses Attribut das
Einzige, was die Zusage einlöst. Gemessen: das `selected` entfernt liess `smoke`
grün. Nachgezogen sind drei Behauptungen in `smoke:http` (vorhanden, an der
eingetragenen Person, genau eines) und eine vierte, dass `Bitte wählen` aus einer
besetzten Zeile verschwindet — sonst stünde `required` gegen die Vorbelegung.

**KEEP, was bei einer Neuableitung nicht verlorengehen darf:**

- Die zwei Kalender-Fälle — Jahreswechsel und Zonengrenze — auf **festen**
  Zeitpunkten statt auf `Date.now()`. Der interessante Fall tritt an vier Tagen
  im Jahr ein; eine Prüfliste, die ihn nur dann sieht, sieht ihn nie.
- Das Wochenfenster am **Montag** verankert statt an heute. Gemessen: an einem
  Sonntag gab die erste Fassung fünfzehn Wochen statt dreizehn, weil die Grenze
  am Wochentag des Aufrufs hing.
- Die verhandelte Zusage über die `load` von `/` — **verengt, nicht gestrichen**.
  Die Begründung steht in den Design Notes.

## Design Notes

**Die eine Zusage, die diese Story bricht — und wie.** `src/routes/+page.server.ts` liest heute aus dem Ereignis ausschliesslich `url`, und `scripts/smoke-zugang.ts:2388` belegt das **ausgeführt**: das Ereignis wirft, sobald jemand `locals` anfasst. Der Diensthinweis ist personenbezogen; die `load` **muss** `locals.mitglied` lesen. Die Behauptung ist damit nicht mehr haltbar — ihr Grund aber schon: der Pool ist namenlos (AD-2), und das soll er bleiben. Die Behauptung wird darum **enger gefasst statt gelöscht**, und die neue Fassung ist die schärfere:

1. Die `load` fasst weiterhin **`cookies` nicht an** — das Ereignis wirft nur noch dort.
2. Zwei `load`-Aufrufe mit **verschiedenen** `locals.mitglied` liefern eine **wortgleiche** Aufgabenliste; verschieden ist allein der Dienstblock.

Wer die Zeile bloss streicht, verliert AD-2 als gemessene Eigenschaft und behält nur den Kommentar.

**`— unbesetzt —` hat zwei Ursachen und eine Darstellung.** Keine Zeile für die Woche und eine Zeile, die auf ein beendetes Mitglied zeigt, sehen gleich aus. Für die lesende Person ist beides dasselbe: niemand ist zuständig. Eine Unterscheidung im Text („noch nicht zugeteilt") wäre ein Zustand mehr, den die Oberfläche erklären müsste, ohne dass jemand anders handelte.

**Der Wochenschlüssel im vierten Argument von `abweisen`.** `zeile` ist als `number | null` getippt und trägt auf `/verwaltung` eine Mitglieds-Id. Eine Woche braucht **zwei** Zahlen. Statt den geteilten Typ aufzuweiten, reist der Schlüssel als **eine** Zahl `jahr * 100 + woche` (`202636`) — monoton, eindeutig, und die Komponente vergleicht sie gegen denselben Ausdruck je Zeile. Der Typ von `abweisen` bleibt unberührt; die Umrechnung steht an **einer** Stelle in `zeit.ts` neben der Wochenrechnung.

**Warum die Woche und nicht ein Datum in der Datenbank steht.** Ein Dienst gilt für eine Kalenderwoche, nicht für einen Tag. Ein gespeicherter Montag müsste bei jeder Anzeige zurück in eine Woche gerechnet werden, und über den Jahreswechsel — ISO-Woche 1 beginnt im Dezember — liefen die zwei Rechnungen auseinander. Jahr und Woche als Integer sind der Schlüssel, den die Eindeutigkeitsbedingung ohnehin braucht.

## Verification

**Commands:**

- `npm run check` — Exit 0 in beiden Typprüf-Programmen.
- `npm run build && npm run lint` — Exit 0 über die ganze Kette. **In dieser Reihenfolge:** `smoke:http` misst den gebauten Baum und baut ihn nicht selbst.
- `npm run gate` — keine Hinweise mehr zu `--warn` und `--border-marker`.

**Jede dieser Mutationen muss rot werden:**

- die Eindeutigkeitsbedingung aus `duty_weeks` entfernt; `is_active` aus der Anzeigeabfrage genommen; `adminOderWeg` aus `besetzen` entfernt; das Besetzen-Formular auch ohne Adminrechte gerendert; der Diensthinweis auch ohne eigenen Dienst gerendert; die ISO-Wochenrechnung um eine Woche verschoben (Jahreswechsel-Zeile).

**Manual checks** — durchgegangen am 2026-08-29 am laufenden Dev-Server, in beiden Modi:

- Bei 375px in Hell **und** Dunkel: die Wochenliste bricht nicht, Ziffern stehen untereinander, das aufgeklappte Besetzen sprengt die Zeile nicht, Trefferfelder messen 44px.
- Der Diensthinweis trägt eine 3px-Kante links in Akzentfarbe und ist als Ganzes ein Link.
