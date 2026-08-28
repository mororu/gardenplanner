---
title: 'Story 3.0: Das ausgelieferte HTML gegen einen echten Server prüfen'
type: 'chore'
created: '2026-08-28'
status: 'done'
review_loop_iteration: 0
baseline_commit: '8cf6158b828cd184ecb6df7a8810d727b4dd80cd'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `scripts/smoke-zugang.ts` stellt SvelteKit mit Attrappen nach. Jede nachgestellte Grenze erzeugt Behauptungen, die sich selbst bestätigen — `respond.js`, die aus `src/error.html` gebaute Hülle, der 303-Pfad, die Kopfzeilen und das ausgelieferte HTML sind darum ungeprüft. Drei Fehler der Klasse A kamen so durch die volle Prüfkette und drei Review-Schichten bis zur Benutzung.

**Approach:** Ein zweites Skript `scripts/smoke-http.ts` startet den **gebauten** Baum als Unterprozess auf einem freien Port gegen eine Wegwerf-Datenbank und misst die echten Antworten über HTTP. Die Prüfhelfer ziehen aus `smoke-zugang.ts` in ein geteiltes Modul; kopiert wird nichts.

## Boundaries & Constraints

**Always:**

- Reines Node und die schon vorhandenen Abhängigkeiten. **Keine neue Abhängigkeit**, kein Testframework, kein Browser.
- `pruefen`, `pruefenGleich`, `wegwerfVerzeichnis` und `aufraeumen` liegen nach dieser Story an **einer** Stelle und werden von beiden Skripten importiert. `smoke-zugang.ts` behält Wortlaut und Zahl seiner Ausgabe unverändert (`ERWARTETE_BEHAUPTUNGEN` bleibt 373).
- Unterprozess und Wegwerfverzeichnis werden in `finally` beendet — auch wenn eine Behauptung rot ist, etwas Unerwartetes wirft oder der Start scheitert. Ein Wurf ist ein **benannter Befund**, kein Absturz; Exit 1 wie bei `smoke`.
- Das Skript zählt seine Behauptungen gegen eine Konstante, genau wie `smoke`.
- Jede Anfrage, die HTML erwartet, trägt einen browserartigen `Accept`-Kopf. Ohne ihn antwortet SvelteKit auf dem Fatal-Pfad mit `application/json` — gemessen, nicht vermutet.
- Die Umgebung des Unterprozesses wird vollständig gesetzt (`DATABASE_PATH`, `SESSION_SECRET`, `ORIGIN`, `HOST`, `PORT`). `.env` und `data/` werden nie berührt.
- Gesät wird über die **echte** Datenschicht (`datenschichtStarten`, `queries/members.ts`, `token.ts`), nicht über SQL von Hand.

**Ask First:**

- Widerlegt eine Messung eine Zusage im Produktcode, ist das ein **Befund**: melden und den Kommentar richtigstellen. Verhalten in `src/` ändert diese Story nicht.
- Fällt eine Behauptung nur wegen eines veralteten oder fehlenden Baus aus, wird sie nicht abgeschwächt.

**Never:**

- Stufe B (Interaktionslogik in reine Funktionen ziehen) und Stufe C (kopfloser Browser, Playwright). Kein jsdom.
- Keine neue Route, keine Tabelle, keine Migration, keine Änderung an einer Oberfläche.
- Keine POST-Behauptung: `ORIGIN` und der freie Port fallen auseinander, und CSRF ist nicht Gegenstand dieser Story. Form actions bleiben bei `smoke`.
- Kein eigener Bau aus dem Skript heraus — ein fehlender Bau ist eine benannte Meldung, keine stille Reparatur.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bau fehlt oder ist veraltet | `build/index.js` fehlt, oder ist älter als die neueste Datei unter `src/` | Benannte deutsche Meldung mit dem Hinweis auf `npm run build` | Exit 1, keine weitere Behauptung |
| Start | Freier Port, Wegwerf-Datenbank, zwei gesäte Mitglieder (Admin, Nicht-Admin) | Der Unterprozess meldet `Listening on http://127.0.0.1:<Port>` mit **genau** dem angeforderten Port | Zeitschranke → rot, Prozess wird beendet |
| Einlösen | `GET /i/<gültiges Token>`, `redirect: 'manual'` | 303, `Location: /`, `set-cookie` **an der Antwort des Servers** mit den vorgeschriebenen Attributen | — |
| Angemeldet | `GET /` mit dem erhaltenen Cookie | 200, `content-type: text/html` | — |
| Abweisung, Browser | `GET /` ohne Cookie, `Accept: text/html` | 403, `content-type: text/html; charset=utf-8`, Rumpf **byteweise** die aus `src/error.html` gebaute Hülle mit ersetzten Platzhaltern (Satz im `<title>` und im `<h1>`, `Fehler 403`), **keine** `Referrer-Policy` | — |
| Abweisung, kein HTML-Accept | `GET /` ohne Cookie, `Accept: */*` | 403 `application/json` mit demselben Satz im Feld `message` | — |
| Unbekanntes Token | `GET /i/unbekannt`, `Accept: text/html` | 403, dieselbe Hülle, **mit** `referrer-policy: no-referrer` — anders als die 403 des Wächters | — |
| Ausgeliefertes HTML | `/`, `/verwaltung`, `/mehr` mit gültigem Cookie | Kein `%sveltekit.…%`, ausgeglichene Kommentarmarken, kein Fragment des Bestätigungstexts, kein Token-Hash | — |
| Adminweiche | `GET /verwaltung` als Nicht-Admin / als Admin | 303 auf `/` / 200 | — |
| `/mehr` ohne Adminrechte | `GET /mehr` als Nicht-Admin | 200, kein Verwaltungs-Eintrag im ausgelieferten HTML | — |
| Abbruch | Wurf mitten in der Prüfliste | Befund benannt, Unterprozess und Verzeichnis weg | Exit 1 |

</frozen-after-approval>

## Code Map

- `scripts/smoke-zugang.ts:137–177` — `wegwerfverzeichnisse`, `wegwerfVerzeichnis`, `aufraeumen`, `gescheitert`/`gelaufen`, `pruefen`, `pruefenGleich`. **Quelle der Auslagerung.** Der Zähler ist Modulzustand; die Schlusszählung `:4362–4369` liest ihn direkt und muss auf einen Zugriff über das neue Modul umgestellt werden. `:4357` ruft `aufraeumen()` im `finally`.
- `scripts/smoke-zugang.ts:1–52` — der Kopfkommentar benennt die Attrappen-Bauform **und** ihre Grenze („Nicht abgedeckt bleibt respond.js"). Er bekommt einen Verweis auf das neue Skript.
- `src/hooks.server.ts:109–137` — `mitKopfzeilen` setzt `Referrer-Policy`. **Der Kommentar darüber ist falsch:** er behauptet, die Kopfzeile erreiche *beide* 403 nicht. Gemessen am gebauten Server erreicht sie die 403 der Einlöseroute sehr wohl (deren Wurf liegt in `resolve`), nur die des Wächters nicht. Genau die als „unangenehmere" bezeichnete, tokentragende Antwort ist gedeckt.
- `src/error.html` — die Hülle. Zwei Platzhalter: `%sveltekit.error.message%` (in `<title>` und `<h1>`) und `%sveltekit.status%`. Trägt `<meta name="referrer" content="no-referrer">` und keinen externen Verweis.
- `src/lib/texte.ts` — `KEIN_ZUGANG` als Wert importieren, nie abschreiben.
- `src/routes/verwaltung/+page.svelte:405–452` — der Dialoginhalt liegt hinter `{#if zuWiderrufen !== null}`. Das früher geleakte Fragment ist `, aufgenommen am` samt `name="mitgliedId" value=""` — genau darauf zielt die Behauptung.
- `src/lib/server/db/index.ts` (`datenschichtStarten`), `src/lib/server/db/queries/members.ts` (`mitgliedAnlegen`), `src/lib/server/token.ts` (`tokenErzeugen`, `tokenHashen`) — das Saatgut. `migrationsFolder` ist arbeitsverzeichnisrelativ, also `process.chdir(wurzel)` wie in `smoke-zugang.ts:128`.
- `build/index.js:26–27,87–88` — adapter-node liest `HOST`/`PORT` und meldet die **tatsächlich** gebundene Adresse auf stdout; `:142` beendet auf `SIGTERM`.
- `package.json:12–23` — Skriptblock und `lint`-Kette. `tsconfig.scripts.json` erfasst `scripts/**/*.ts` bereits; `eslint.config.js` und `.prettierignore` brauchen keine Ergänzung.
- `README.md:736–737` (Skripttabelle), `:902` (Abschnitt „Was `npm run smoke` prüft"), `:1209+` (Mutationstabelle) — die drei Stellen, die nachzuziehen sind.

## Tasks & Acceptance

**Execution:**

- [x] `scripts/pruefhelfer.ts` -- neu: `pruefen`, `pruefenGleich`, `zaehlerstand()`, `wegwerfVerzeichnis`, `aufraeumen` wortgleich aus `smoke-zugang.ts` übernehmen -- eine Stelle statt zweier Kopien, wie im Akzeptanzkriterium gefordert.
- [x] `scripts/smoke-zugang.ts` -- die fünf Definitionen durch den Import ersetzen, Schlusszählung auf `zaehlerstand()` umstellen, Kopfkommentar um den Verweis ergänzen -- reine Umschichtung: Ausgabe und Zahl 373 bleiben unverändert.
- [x] `scripts/smoke-http.ts` -- neu: Bauprüfung, freier Port, Saat, Start, Prüfliste der Matrix, Abbau in `finally`, Schlusszählung gegen eine eigene Konstante -- der Kern der Story.
- [x] `package.json` -- `smoke:http` aufnehmen und in die `lint`-Kette **hinter** `smoke` hängen -- ohne die Kette prüft es niemand.
- [x] `src/hooks.server.ts` -- den Kommentar zu `mitKopfzeilen` auf die Messung richtigstellen -- eine Zusage, die dem gemessenen Verhalten widerspricht, ist schlimmer als keine.
- [x] `scripts/pruefhelfer-selftest.ts` -- neu, aus der Review: beweist an Unterprozessen, dass der geteilte Prüfkern beisst -- ohne ihn entwaffnet eine Zeile 449 Behauptungen, und `lint` bleibt grün.
- [x] `README.md` -- Skripttabelle, ein eigener Abschnitt „Was `npm run smoke:http` prüft" und die neuen Mutationszeilen -- die Prüfkette ist dort beschrieben, nicht nur ausgeführt.

**Acceptance Criteria:**

- Given einen gebauten Baum, when `npm run smoke:http` läuft, then endet es mit 0, meldet die Zahl seiner Behauptungen und hinterlässt weder Unterprozess noch Wegwerfverzeichnis.
- Given eine mutwillig geänderte Zusage im Produktcode, when das Skript läuft, then wird sie rot — jede Behauptungsgruppe ist einzeln durch Mutation belegt und in `README.md` eingetragen.
- Given `npm run lint`, when die Kette läuft, then läuft `smoke:http` hinter `smoke` mit und beide sind grün.
- Given `npm run check`, when beide Typprüf-Programme laufen, then ist das neue Skript fehlerfrei erfasst.

## Design Notes

**Freier Port ohne Wettlauf.** Eine Sonde bindet auf Port 0, liest die Nummer und gibt sie wieder frei; `PORT` und `ORIGIN` werden daraus gesetzt. Der Wettlauf wird nicht ignoriert, sondern **gemessen**: das Skript liest die `Listening on …`-Zeile des Unterprozesses und behauptet, dass der Port darin genau der angeforderte ist. Ist er belegt, startet der Server gar nicht — auch das ein Befund mit Meldung.

**Warum der `Accept`-Kopf zur Zusage gehört.** Gemessen am gebauten Server:

```
curl /                          → 403 application/json  {"message":"Dieser Link gilt …"}
curl / -H 'Accept: text/html'   → 403 text/html; charset=utf-8, die volle Hülle
```

Die Hülle ist also nur auf dem Browser-Pfad zu sehen. Beide Fassungen stehen darum in der Matrix; wer nur die eine misst, prüft die falsche Zusage.

**Byteweise gegen die Vorlage.** Der Rumpf der 403 wird gegen `src/error.html` mit ersetzten Platzhaltern verglichen — nicht gegen eine im Skript nachgebaute Grenze. Das ist der Unterschied zu `smoke`, der diese Story trägt.

**Nachtrag aus dem Mutationsnachweis (2026-08-28).** 16 Mutationen eingespielt,
gebaut, gemessen, zurückgenommen; 15 werden rot. Die eine, die **grün bleibt**,
ist ein Befund und kein Loch: den Satz `KEIN_ZUGANG` in `src/lib/texte.ts`
umzuformulieren bricht nichts, weil das Skript die Konstante importiert statt den
Satz abzuschreiben — beide Seiten wandern zusammen. Die Zusage lautet nicht
„dieser Wortlaut", sondern „was der Code als den einen Satz führt, liefert der
Server aus", und die bricht sofort, sobald die Wurfstelle sich von der Konstante
löst (`error(403, 'Kein Zugang.')` im Wächter → fünf rote Behauptungen, darunter
die Byte-Gleichheit und die Ununterscheidbarkeit der zwei 403). Dasselbe gilt für
die Byte-Gleichheit gegen `src/error.html`: eine Änderung **an der Vorlage**
wandert auf beide Seiten, eine Änderung **an der Wiedergabe** nicht — und genau
die soll sie fangen. Belegt mit `error(403, …)` → `error(401, …)`.

**Zwei Ausgänge sind nicht durch Mutation, sondern durch Ausführung belegt:**
`build/` beiseitegeschoben ergibt beide Bau-Behauptungen rot plus die benannte
Meldung und Exit 1; ein probeweiser Wurf mitten in der Prüfliste ergibt den
benannten Befund, 16 statt 55 gelaufene Behauptungen, keinen verwaisten
Node-Prozess und kein liegengebliebenes Wegwerfverzeichnis.

**Nachtrag aus der Review (2026-08-28).** Drei Schichten gelaufen (blind,
Edge-Case, Verification-Gap). Der schwerste Befund kam von der dritten und war
demonstriert: der ausgelagerte Prüfkern war der einzige ungeprüfte Code der
ganzen Prüfkette, und sein Ausfall sähe wie ein grüner Lauf aus. Antwort ist
`scripts/pruefhelfer-selftest.ts` in der lint-Kette; die Gegenprobe hat dabei
gleich einen Fehler in ihm selbst gezeigt — er meldete zuerst über den Prüfling
und behauptete mit entwaffnetem Kern, der Kern beisse. Zähler und Ausgabe stehen
darum eigenständig.

Weiter behoben: verwaister Serverprozess bei Startfehlschlag und Zeitschranke,
fehlender `error`-Lauscher an `spawn`, `fetch` ohne Zeitschranke,
`readFileSync` der Fehlervorlage ausserhalb des Rahmens, Bau-Aktualität nur
gegen `src/` statt gegen alle Bau-Eingaben, fehlende Signalbehandlung, `new URL`
statt `URL.canParse`, ungeschütztes `JSON.parse`, fehlende Maskierung in der
nachgebauten Hülle, und die sachlich falsche Begründung für den Verzicht auf
POST (ORIGIN und Port decken sich sehr wohl — gemessen). Dazu vier neue
Behauptungen (stille Fehlerausgabe des Servers, Einlösen des Mitglieds, kein
Klartext-Token im Cookie und in keiner Seite) und zwei weitere Seiten in der
Liste; 55 Behauptungen sind damit 76 geworden.

Zurückgestellt in `deferred-work.md`: die abgeschriebene Jahreslaufzeit, die
veraltete Regelzahl in der Skripttabelle, vier über HTTP ungemessene
Fehlerklassen der Zugangsschicht und das doppelte Prüfgeheimnis.

## Verification

**Commands:**

- `npm run build` -- erwartet: Exit 0, `build/index.js` neuer als jede Datei unter `src/`.
- `npm run smoke:http` -- erwartet: Exit 0, alle Behauptungen grün, Schlusszählung stimmt.
- `npm run lint` -- erwartet: Exit 0 über die ganze Kette, `smoke:http` sichtbar hinter `smoke`.
- `npm run check` -- erwartet: Exit 0 in beiden Typprüf-Programmen.
- `npm run smoke` -- erwartet: unverändert 373 Behauptungen, Exit 0 — der Beleg, dass die Auslagerung nichts verschoben hat.

**Manual checks:**

- Je Behauptungsgruppe eine Mutation im Produktcode einspielen, den roten Lauf sehen, zurücknehmen. Ohne diesen Nachweis gilt eine Behauptung als unbelegt.
- Einen Lauf mit `pkill` mitten in der Prüfliste abbrechen und danach `ps` und `ls $TMPDIR` prüfen: kein verwaister Node-Prozess, kein liegengebliebenes `gartenplaner-smoke-http-*`.

## Suggested Review Order

**Der Kern: messen statt nachstellen**

- Einstieg. Der Kopfkommentar sagt, was die Attrappe nicht kann und was hier bewusst fehlt.
  [`smoke-http.ts:1`](../../scripts/smoke-http.ts#L1)
- Die Prüfliste selbst — 76 Behauptungen an echten Antworten, in der Reihenfolge der Matrix.
  [`smoke-http.ts:565`](../../scripts/smoke-http.ts#L565)
- Die Zahl, die ein stilles Ausfallen einer Behauptung auffallen lässt.
  [`smoke-http.ts:78`](../../scripts/smoke-http.ts#L78)

**Der geteilte Prüfkern und sein Nachweis**

- Die Auslagerung: eine Stelle für Behauptung, Zähler, Abbruch und Wegwerfverzeichnis.
  [`pruefhelfer.ts:55`](../../scripts/pruefhelfer.ts#L55)
- Der schwerste Review-Befund: ohne diese Probe entwaffnet eine Zeile 449 Behauptungen.
  [`pruefhelfer-selftest.ts:126`](../../scripts/pruefhelfer-selftest.ts#L126)
- Warum der Selbsttest eigene Zähler führt — der erste Entwurf log über den Prüfling.
  [`pruefhelfer-selftest.ts:47`](../../scripts/pruefhelfer-selftest.ts#L47)
- Die Proben laufen als Unterprozess, damit der Exit-Code beobachtet ist.
  [`pruefhelfer-selftest.ts:82`](../../scripts/pruefhelfer-selftest.ts#L82)

**Was der echte Server widerlegt hat**

- Der korrigierte Kommentar: nur die 403 des Wächters verliert die Referrer-Policy.
  [`hooks.server.ts:119`](../../src/hooks.server.ts#L119)
- Die nachgebaute Hülle, maskiert wie SvelteKit — sonst ein falsches Rot beim ersten `&`.
  [`smoke-http.ts:479`](../../scripts/smoke-http.ts#L479)

**Der Prüfgegenstand und sein Abbau**

- Ein veralteter Bau misst Bytes, die niemand mehr schreibt — darum alle Bau-Eingaben.
  [`smoke-http.ts:166`](../../scripts/smoke-http.ts#L166)
- Startfehlschlag und Zeitschranke beenden das Kind selbst, sonst bleibt es verwaist.
  [`smoke-http.ts:319`](../../scripts/smoke-http.ts#L319)
- Der Abbau löst sich in jedem Fall auf, auch wenn SIGTERM nichts bewirkt.
  [`smoke-http.ts:414`](../../scripts/smoke-http.ts#L414)
- Ein Abbruch von aussen läuft nicht durch das finally — darum diese zwei Zeilen.
  [`smoke-http.ts:556`](../../scripts/smoke-http.ts#L556)
- Das Portrennen wird gemessen statt weggeredet, auf zwei Wegen.
  [`smoke-http.ts:214`](../../scripts/smoke-http.ts#L214)

**Peripherie**

- Die Kette: `smoke:selftest` und `smoke:http` hinter `smoke`.
  [`package.json:26`](../../package.json#L26)
- Die Umschichtung in `smoke` — reine Verlagerung, unverändert 373 Behauptungen.
  [`smoke-zugang.ts:73`](../../scripts/smoke-zugang.ts#L73)
- Ergebnis statt Quelle: die aufgebrochene Kommentarmarke am ausgelieferten HTML.
  [`smoke-http.ts:505`](../../scripts/smoke-http.ts#L505)
