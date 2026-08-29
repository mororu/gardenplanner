---
title: 'Story 3.0.1: Einen Mitgliedsnamen korrigieren'
type: 'feature'
created: '2026-08-29'
status: 'in-review' # draft | ready-for-dev | in-progress | in-review | done
review_loop_iteration: 2
baseline_commit: '237ba1873ef36e133a26544c9a0c0abbd60daf03'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ein vertippter Mitgliedsname lässt sich nur beheben, indem der Zugang beendet und die Person neu aufgenommen wird. Ab Story 3.1 steht der Name im Dienstplan vor allen, drei Monate im Voraus — der Umweg nähme ihr zugleich alle künftigen Dienstwochen. Zweitens prüft `scripts/create-admin.ts` den Namen anders als die Oberfläche: ohne Nullbreiten-Sieb, ohne Längengrenze.

**Approach:** Eine `umbenennen`-action auf `/verwaltung`, inline je Mitgliedszeile. Die Namensregel zieht in ein geteiltes Modul `src/lib/mitgliedsname.ts` — Bauform wie `src/lib/aufgabentext.ts` — und hat danach drei Leser statt einer Kopie.

## Boundaries & Constraints

**Always:**

- Die Namensregel steht danach an **einer** Stelle. Beide Sätze und `NAME_HOECHSTLAENGE = 80` bleiben wortgleich — Auslagerung, keine Neufassung.
- Umbenennen ist kein Zugangsvorgang: Id, `invite_token_hash`, `is_admin`, `is_active`, `created_at` unberührt. UPDATE derselben Zeile.
- Nur aktive Mitglieder; `is_active = 1` steht in der Query, nicht in der Route — wie bei `mitgliedDeaktivieren`.
- Die **eigene** Zeile darf umbenannt werden, anders als bei Neuausstellen und Widerrufen: ein Name ist kein Zugang, und es gibt genau eine Adminperson.
- Inline, **kein** modaler Dialog. Ohne JavaScript bedienbar: form action mit literalem `action="?/umbenennen"`, `use:enhance` obendrauf (AD-9).
- Jede Abweisung geht durch `abweisen` aus `src/lib/server/abweisen.ts`; fehlende, unbekannte und beendete Zeile fallen auf **einen** Satz. Die action beginnt mit `adminOderWeg`.

**Ask First:**

- Eine Eindeutigkeitsbedingung auf `name` — zwei Mitglieder dürfen heute gleich heissen.
- Eine Historie der alten Namen oder ein Undo.

**Never:**

- Kein Reaktivieren, kein Löschen, kein Umbenennen beendeter Zugänge.
- Keine Migration, keine neue Spalte.
- Keine Verhaltensänderung an `aufnehmen`, `neuAusstellen`, `widerrufen` — sie fassen nur den Import an.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Gelingt | Admin, aktive Zeile, `Anna Meier` | Neuer Name, Zeile steht neu einsortiert (Liste sortiert nach Namen), Rückmeldung in der Live-Region | — |
| Eigene Zeile | Admin benennt sich selbst um | Dasselbe, kein `EIGENER_ZUGANG_GESCHUETZT` | — |
| Unverändert | Neuer Name gleicht dem alten | Erfolg, nicht Abweisung | — |
| Leerer Name | `"   "` oder nur Nullbreiten | 400, `NAME_FEHLT` am Feld dieser Zeile, Datenbank unverändert | `abweisen(…, 'neuerName', eingabe)` |
| Zu lang | 81 Codepoints | 400, `NAME_ZU_LANG`, dasselbe Feld | dito |
| Nicht ansprechbar | `mitgliedId` fehlt, nicht numerisch, unbekannt oder beendet | 400, `MITGLIED_NICHT_ANSPRECHBAR` in der oberen Live-Region | `abweisen(…)` ohne Feld |
| Nicht-Admin | POST ohne Adminrechte | 303 auf `/`, nichts geändert | `adminOderWeg` |
| Admin-Skript | `create-admin -- <Nullbreiten oder 81 Zeichen>` | Benannte Meldung, Abbruch **vor** `datenschichtStarten` | Exit 1, keine Datenbank angelegt |

</frozen-after-approval>

## Code Map

- `src/routes/verwaltung/+page.server.ts:38,48,51,68,77` — `NAME_FEHLT`, `NAME_HOECHSTLAENGE`, `NAME_ZU_LANG`, `NULLBREITE`, `namePruefen`: Quelle der Auslagerung. `:106` `idLesen` bleibt lokal (Docblock begründet). `:144` actions, neue reiht sich hinter `widerrufen:233`.
- `src/lib/aufgabentext.ts:1–26` — die zu spiegelnde Bauform, mit derselben Begründung („drei Leser derselben Regel").
- `src/lib/server/db/queries/members.ts:165,187` — Vorlage: `update … where(and(eq(id), eq(isActive,true))).returning(ohneHashSpalte).get()`, `null` als einziger Fehlschlag. `:126` sortiert über `Intl.Collator('de-CH')` — darum verschiebt ein Umbenennen die Zeile.
- `src/routes/verwaltung/+page.svelte:408–440` — die Liste. `:427` `{:else if mitglied.id !== data.ichId}` ist zu öffnen: die eigene Zeile bekommt das Umbenennen, aber weiterhin keine anderen Knöpfe. `:124` `fokusNach`, `:142` `versand` (liest die `mitgliedId` aus `formData`), `:68–90` die abgeleiteten Fehlersätze.
- `src/lib/server/abweisen.ts` — `(meldung, feld?, eingabe?)`; `feld` generisch, `'neuerName'` bleibt enger Literaltyp.
- `scripts/create-admin.ts:43` — die auseinandergelaufene Kopie; Aufruf liegt **vor** `datenschichtStarten:56` und muss dort bleiben.
- `scripts/smoke-zugang.ts:1715` — Abschnitt „Widerrufen"; die neuen Behauptungen hängen dahinter. `:135` `ERWARTETE_BEHAUPTUNGEN`.

## Tasks & Acceptance

**Execution:**

- [x] `src/lib/mitgliedsname.ts` — neu: Grenzen, Sätze, `NULLBREITE`, `namePruefen`, wortgleich übernommen.
- [x] `src/lib/server/db/queries/members.ts` — `mitgliedUmbenennen(id, name)` nach dem Vorbild von `mitgliedDeaktivieren`.
- [x] `src/routes/verwaltung/+page.server.ts` — Deklarationen durch den Import ersetzen, action `umbenennen` ergänzen.
- [x] `src/routes/verwaltung/+page.svelte` — je aktiver Zeile ein aufklappbares Formular mit Feld, Fehlersatz und Knopf; Verzweigung um die eigene Zeile öffnen.
- [x] `scripts/create-admin.ts` — auf das geteilte Modul umstellen; schliesst Aktionspunkt 3/19.
- [x] `scripts/smoke-zugang.ts` — Behauptungen je Matrixzeile, plus eine über die **eine** Wurfstelle; `ERWARTETE_BEHAUPTUNGEN` nachziehen.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` — Zeile `3-0-1-…` aufnehmen, Aktionspunkte 3 und 19 schliessen.
- [x] `README.md` — Prüfgegenstand und Mutationszeilen eintragen.

**Acceptance Criteria:**

- Given eine Adminperson und ein aktives Mitglied, when `umbenennen` mit gültigem Namen läuft, then trägt die Zeile den neuen Namen, während Id, `invite_token_hash`, `is_admin`, `is_active` und `created_at` unverändert sind — ausgeführt belegt.
- Given eine Mutation an der Namensregel, when `smoke` läuft, then wird sie für alle drei Wurfstellen zugleich rot.
- Given `npm run lint`, when die Kette läuft, then ist sie grün und `smoke` meldet seine erhöhte Zahl.
- Given ausgeschaltetes JavaScript, when jemand ein Umbenennen abschickt, then wirkt es.

## Spec Change Log

**2026-08-29 — Review-Durchgang 1.** Auslöser: die Verification-Gap-Schicht hat vorgeführt, dass sechs Mutationen am neuen Client-Zustand die Kette grün passieren, und dass der als „ausgeführt gemessen" ausgewiesene Pfad ohne JavaScript von keiner Behauptung berührt wird. Wurzel war die Design Note „Die betroffene Zeile kommt nicht vom Server zurück" — sie band die Zeilenzuordnung an JavaScript, während der eingefrorene Block sie unbedingt verlangt.

Geändert: Design Notes (die Zeile kommt über ein viertes, optionales Argument von `abweisen` zurück; Fokusregel für den Abweisungsfall ergänzt) und Verification (sechs Pflichtmutationen benannt, `smoke:http` muss den No-JS-Pfad am ausgelieferten HTML messen).

Vermiedener Zustand: eine Oberfläche, die ohne JavaScript die Eingabe verwirft und den Fokus in eine leere Region schickt, während README und Spec das Gegenteil zusagen.

**Abweichung vom Workflow, auf Weisung des Users:** Dieser Befund ist ein `bad_spec` und hätte einen Rückwurf mit Neuableitung ausgelöst. Der User hat entschieden, statt dessen den bestehenden Code zu patchen. Der Umbau erfolgt also nachträglich an gewachsenem Code, nicht aus der korrigierten Spec heraus — für die Retrospektive festgehalten.

**KEEP:** Was die erste Ableitung gut gemacht hat und überleben muss — die wortgleiche Auslagerung nach `mitgliedsname.ts` ohne Neufassung; `mitgliedUmbenennen` mit `is_active = 1` in der Query; der Abdruck der ganzen Zeile ausser der Namensspalte als Beleg für „nichts sonst geändert"; die Behauptung, dass ein unveränderter Name ein Erfolg ist; die vier getrennten Behauptungen zur nicht ansprechbaren Zeile; und die Angleichung von `create-admin.ts` samt Nachweis, dass sie **vor** dem Start der Datenschicht greift.

**2026-08-29 — Review-Durchgang 2.** Auslöser: eine Review nach der Umsetzung hat zwei Mutationen eingespielt, die grün durch `check`, `smoke` **und** `smoke:http` liefen. `open={fehlerHier}` vom `<details>` entfernt — die Textprüfung schnitt erst am `<form>`, das Attribut steht davor — und der Satz zur Zeile auf `{fehlerAmNeuenNamen}` ohne Zeilenbezug, weil die Live-Region-Behauptung den Tag las und nicht den Rumpf. Damit hing ausgerechnet die Zusage aus Durchgang 1 an nichts: ohne `open` liefert der Server nach einer Abweisung ein zugeklapptes Formular, und ohne JavaScript klappt es nichts mehr auf.

Geändert: kein Verhalten, nur die Deckung. Der Schnitt der Formular-Behauptung beginnt jetzt am `<details>`; die Live-Region-Behauptung liest zusätzlich ihren Rumpf; und `smoke:http` schickt einen echten POST mit untauglichem Namen ab und misst das zurückkommende Dokument — die **einzige** POST-Behauptung des Skripts, mit Begründung an seinem Kopf. Dazu drei Textkorrekturen: der Kommentar über der Live-Region beschrieb noch die verworfene erste Fassung und nannte ein `zeileImVersand`, das es nicht gibt; das `mitgliedId`-Muster in `smoke:http` schrieb die Attributreihenfolge fest, die zwei Absätze darüber ausdrücklich freigegeben ist; und die zwei zurückgestellten Posten dieser Story standen unter der Überschrift „Erledigt".

Vermiedener Zustand: eine No-JS-Zusage in `README.md`, die eine einzige gelöschte Zeile im Markup lautlos zur Unwahrheit macht.

## Design Notes

**Warum ein Modul und keine dritte Kopie.** Der Beweis liegt schon vor: `create-admin.ts` **ist** die auseinandergelaufene Kopie und lässt einen Namen aus Nullbreiten-Zeichen durch, den die Oberfläche seit Story 1.3 abweist.

**Welches Feld die Meldung trägt.** `feld: 'neuerName'`, nicht `'name'` — das gehört dem Aufnahmeformular, und zwei Felder unter einer Marke wären die Zweideutigkeit, gegen die die Marke da ist.

**Und welche Zeile.** Die abgewiesene Zeile kommt **vom Server** zurück: `abweisen` bekommt ein viertes, optionales Argument `zeile`. Die erste Fassung dieser Notiz hat das Gegenteil verlangt — der `use:enhance`-Rückruf sollte die `mitgliedId` aus dem `formData` lesen — und band damit die Zuordnung an JavaScript. Ohne JS zeigte das Feld wieder den alten Namen, das Formular war zu, `aria-invalid` fehlte, und der Fokus sprang in eine leere Region. Der eingefrorene Block verlangt beides zugleich: ohne JavaScript bedienbar **und** den Satz am Feld dieser Zeile. Nur eine Antwort, die die Zeile nennt, erfüllt beides — und sie macht den Client-Zustand `zeileImVersand` überflüssig statt ihn zu brauchen.

**Der Fokus nach einem geglückten Umbenennen geht auf die Rückmeldung, nicht auf die Zeile.** Es verschiebt die Zeile an ihre neue alphabetische Stelle; wer den Fokus ihr hinterherspringen lässt, landet nach dem Rendern auf einer anderen. **Nach einer Abweisung ist es umgekehrt:** dort steht die Zeile still, der Satz gehört an ihr Feld, und der Fokus muss dorthin — die obere Region ist in diesem Fall leer und über `.live:empty` aus dem Fluss genommen.

## Verification

**Commands:**

- `npm run check` — Exit 0 in beiden Typprüf-Programmen.
- `npm run smoke` — Exit 0, Schlusszählung stimmt mit der erhöhten Konstante.
- `npm run build && npm run lint` — Exit 0 über die ganze Kette.
- `npm run create-admin -- "  "` gegen eine Wegwerf-Datenbank — benannte Meldung, Exit 1, keine Datei angelegt.

**Jede dieser Mutationen muss rot werden** — jede war einmal grün und ist damit belegt, dass sie fehlte:

- der Satz zur Zeile hinter ein `{#if}` gestellt; die `value`-Bindung des Feldes entfernt; `nameEingabe` ohne die Marke `feld === 'name'`; der Zweig `art === 'umbenannt'` in `rueckmeldung` entfernt; `method="POST"` am Formular entfernt; in der action Namensprüfung vor Id-Prüfung gezogen.
- **Aus Durchgang 2 nachgezogen**, beide zuerst grün durch die ganze Kette: `open={fehlerHier}` vom `<details>` entfernt, und der Satz zur Zeile auf `{fehlerAmNeuenNamen}` ohne Zeilenbezug.

**Der Pfad ohne JavaScript wird gemessen, nicht behauptet:** `smoke:http` prüft am ausgelieferten `/verwaltung`-HTML, dass das Formular samt `action="?/umbenennen"`, `name="neuerName"` und verstecktem `mitgliedId` darin steht. Ohne eine Behauptung in der Kette darf die README keinen Nachweis behaupten.

**Manual checks:**

- Je Behauptungsgruppe eine Mutation einspielen, den roten Lauf sehen, zurücknehmen.
- Bei 375px in Hell und Dunkel: das aufgeklappte Formular sprengt die Zeile nicht, das Feld trägt 16px, der Trefferbereich misst 44px.

## Suggested Review Order

**Die eine Namensregel**

- Der Einstieg: die Regel, die vorher an zwei Stellen verschieden war.
  [`mitgliedsname.ts:87`](../../src/lib/mitgliedsname.ts#L87)
- Die auseinandergelaufene Kopie, jetzt angeglichen — Prüfung vor dem Start der Datenschicht.
  [`create-admin.ts:55`](../../scripts/create-admin.ts#L55)

**Die Zeile kommt vom Server, nicht aus dem Browser**

- Das vierte Argument. Ohne es hängt die Zuordnung an JavaScript.
  [`abweisen.ts:57`](../../src/lib/server/abweisen.ts#L57)
- Die action: Ansprechbarkeit **vor** dem Namen, sonst zeigt der Satz auf eine Zeile, die es nicht gibt.
  [`+page.server.ts:261`](../../src/routes/verwaltung/+page.server.ts#L261)
- Der Fehlerbezug ohne Client-Zustand — wirkt darum auch ohne JavaScript.
  [`+page.svelte:481`](../../src/routes/verwaltung/+page.svelte#L481)
- `<details>` bringt Auf und Zu ohne JavaScript mit; `open` hängt am Fehlschlag.
  [`+page.svelte:507`](../../src/routes/verwaltung/+page.svelte#L507)
- Der Fokus geht an das Feld der Zeile — die obere Region ist in diesem Fall leer.
  [`+page.svelte:157`](../../src/routes/verwaltung/+page.svelte#L157)

**Die Datenschicht, zwei Schichten Schutz**

- Vorprüfung: trennt „gibt es nicht" von „Name taugt nicht", ohne die Zeilen aufzuzählen.
  [`members.ts:196`](../../src/lib/server/db/queries/members.ts#L196)
- Und die Bedingung bleibt trotzdem im UPDATE — beide Schichten sind einzeln belegt.
  [`members.ts:226`](../../src/lib/server/db/queries/members.ts#L226)

**Was die Prüfkette dazugelernt hat**

- Eigene Adminperson für das Selbstumbenennen, plus die Klammer „Attrappe = Datenbank".
  [`smoke-zugang.ts:1905`](../../scripts/smoke-zugang.ts#L1905)
- Der No-JS-Pfad wird am ausgelieferten HTML gemessen, je Formular einzeln.
  [`smoke-http.ts:822`](../../scripts/smoke-http.ts#L822)
