---
title: 'Sich selbst in eine Tränkewoche eintragen und wieder austragen'
type: 'feature'
created: '2026-09-11'
status: 'in-review'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Eingetragen wird ausschliesslich durch die Verwaltung — `besetzen` beginnt mit `adminOderWeg`
(`traenkeplan/+page.server.ts:148`). Wer eine Woche zugeteilt bekommt und nicht kann, hat **keinen Weg zurück**:
es gibt keine Handlung, die eine Woche wieder frei macht, und ein Mitglied kann sich auch nicht selbst
eintragen. Die Folge ist der schlechtere von zwei Zuständen — ein Name steht im Plan, und niemand giesst.

**Approach:** Eine `austragen`-action, die **nur die eigene** Woche freigibt. Die Berechtigung steht in der
`where`-Klausel des DELETE und nicht in der Route — dieselbe Bauform wie bei `aufgabeAbhaken`. Bestätigt wird
zweistufig am Server, wie beim Übernehmen: die Handlung ist verbindlich, und sie ist **nicht selbst
umkehrbar**, weil Eintragen der Verwaltung gehört.

## Boundaries & Constraints

**Always:**
- **Nur die eigene Woche.** `member_id` steht in der `where`-Klausel des DELETE; ein gebauter POST auf eine
  fremde Woche löscht nichts und fällt auf denselben Satz wie eine unbekannte Woche.
- Dasselbe Fenster wie `besetzen`: nur Wochen, die die Seite auch zeigt. Rückwirkendes Austragen fällt durch
  dieselbe Schranke, weil das Fenster mit der laufenden Woche beginnt.
- **Zweistufig bestätigt, am Server.** Ein POST ohne `bestaetigt` ändert nichts und fragt; erst der zweite
  schreibt. Ohne JavaScript bedienbar — die Handlung gehört jedem Mitglied, nicht der Verwaltung.
- Die Bestätigung nennt die Kalenderwoche aus der **Datenbank**, nicht aus dem abgeschickten Formular.
- Jede Abweisung geht durch `abweisen`; fehlende, unlesbare, fremde und unbekannte Woche fallen auf **einen**
  Satz.
- Die laufende Woche darf man verlassen. Eine ehrliche Lücke ist besser als ein stiller Ausfall — und die
  Startseite warnt seit heute genau davor.

**Ask First:**
- Ein **Austragen durch die Verwaltung** (eine fremde Woche leeren). Sie kann heute neu besetzen, aber nicht
  leeren. Das ist eine eigene Handlung mit eigener Berechtigung und nicht Teil dieser.
- Eine **Benachrichtigung** der Verwaltung, dass jemand ausgetreten ist. Es gibt in diesem System keinen Kanal
  dafür.

**Never:**
- Kein Selbst-Eintragen. Wer sich austrägt, kommt nur über die Verwaltung zurück — das ist der Grund für die
  Bestätigung, nicht ein Versehen.
- Keine Migration, keine neue Spalte. Unbesetzt ist das Fehlen der Zeile, nicht ein Wert darin.
- Kein Knopf an einer fremden Zeile, auch nicht deaktiviert — er stünde im ausgelieferten HTML.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Eigene Woche, Schritt 1 | POST ohne `bestaetigt` | Frage an der Zeile, nichts geändert | N/A |
| Eigene Woche, Schritt 2 | POST mit `bestaetigt` | Zeile gelöscht, Woche steht als `— unbesetzt —` | N/A |
| Fremde Woche | gebauter POST mit fremdem Wochenschlüssel | nichts gelöscht, ein Satz | `WOCHE_NICHT_ANSPRECHBAR` |
| Woche ausserhalb des Fensters | `jahr` 2043 | nichts gelöscht, derselbe Satz | derselbe Satz |
| Schon unbesetzt | zweimal abgeschickt | nichts gelöscht, derselbe Satz | derselbe Satz |
| Ohne JavaScript | kein `use:enhance` | erster POST liefert die Frage als Dokument, zweiter schreibt | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/server/db/queries/duty-weeks.ts:147` -- `dienstwocheBesetzen` als Bauform: Vorbedingung im
  Schreibvorgang statt als Select davor. `dienstwocheAustragen` entsteht daneben.
- `src/routes/traenkeplan/+page.server.ts:124-190` -- `besetzen`; Fensterprüfung, `zahlLesen`,
  `wochenSchluessel` und die Form der Abweisung werden übernommen.
- `src/routes/traenkeplan/+page.server.ts:83-106` -- die `load`; sie braucht die **eigene Id**, damit das
  Markup die eigene Zeile erkennt. `mitgliedId` steht ohnehin schon je Woche im Rückgabewert.
- `src/routes/traenkeplan/+page.svelte:237` -- die Namenszeile; der Knopf gehört daneben.
- `src/routes/+page.server.ts` -- `uebernehmen` als Bauform der **zweistufigen** Bestätigung am Server.
- `scripts/gate.mjs:58,94,102` -- Regel 11 (literales `action="?/austragen"`), 16 (`abweisen` importiert),
  17 (`use:enhance`-Rückruf fängt `result.type === 'error'`).

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/server/db/queries/duty-weeks.ts` -- `dienstwocheAustragen(woche, mitgliedId)` -- die
  Berechtigung gehört in die `where`-Klausel, nicht in die Route.
- [ ] `src/routes/traenkeplan/+page.server.ts` -- `eigeneId` in der `load`, `austragen`-action zweistufig --
  ohne die eigene Id kann das Markup die eigene Zeile nicht erkennen.
- [ ] `src/routes/traenkeplan/+page.svelte` -- Knopf und Frage an der eigenen Zeile -- an fremden Zeilen
  entsteht kein Markup.
- [ ] `scripts/smoke-zugang.ts` -- die Berechtigung steht in der Abfrage; ein fremder POST löscht nichts --
  die Zusage, die das Ganze trägt.
- [ ] `scripts/smoke-http.ts` -- beide Schritte ohne JavaScript am echten Server.

**Acceptance Criteria:**
- Given eine Woche mit meinem Namen, when ich zweimal absende, then steht die Woche als `— unbesetzt —`.
- Given eine Woche mit fremdem Namen, when ein gebauter POST sie austragen will, then bleibt sie besetzt und
  die Antwort ist derselbe Satz wie bei einer unbekannten Woche.
- Given ein Mitglied ohne eigene Woche, when die Seite ausgeliefert wird, then steht im HTML kein
  Austragen-Knopf.
- Given `npm run build && npm run lint`, then grün, und jede neue Wache wurde vorgeführt rot.

## Verification

**Commands:**
- `npm run build && npm run lint` -- erwartet: grün.

## Spec Change Log

- **Nachtrag im selben Zug: Eintragen für alle.** Der Spec deckte nur das Austragen; Manuel hat während des
  Baus ergänzt, dass sich **jede** Person selbst eintragen soll, nicht nur die Verwaltung. Dazu kam
  `dienstwocheEintragen` mit `onConflictDoNothing`: die Woche muss **frei** sein, sonst könnte jede Person jede
  andere aus dem Plan werfen. `besetzen` bleibt daneben bestehen und ist weiter Adminsache — es **überschreibt**
  und ist damit eine andere Handlung.

- **Eine Begründung im Spec ist dadurch falsch geworden und wurde ersetzt.** Sie lautete: austragen sei nicht
  selbst umkehrbar, weil Eintragen der Verwaltung gehört — das war der Grund für die Bestätigung. Mit
  `eintragen` kommt man aus eigener Kraft zurück. Die Bestätigung bleibt, aber mit dem richtigen Vorbehalt:
  wer sich austrägt, gibt die Woche frei, und die nächste Person darf sie nehmen. Rückgängig ist die Handlung
  darum nicht durch Wiederholen, sondern nur, wenn niemand zugegriffen hat.

- **Sieben ausgeführte Behauptungen statt der geplanten Textprüfungen.** Die zwei Schranken stehen in der
  Datenschicht — `member_id` in der where-Klausel des DELETE, die Eindeutigkeit beim INSERT —, und eine
  Textprüfung über eine where-Klausel ist genau die schwache Schicht, gegen die `smoke-zugang` gebaut wurde.
  Gemessen wird an der Zeilenzahl in der Datenbank, nicht am Rückgabewert: eine action, die abweist und
  trotzdem schriebe, käme sonst durch. Zähler: 636 → 643.
