# Arbeitsanweisungen für dieses Repositorium

Geprüft am 2026-09-02 gegen `21f75c1`. Die Begründung zu jeder Regel — mit dem
Vorfall, aus dem sie stammt — steht in
`_bmad-output/implementation-artifacts/arbeitsregeln.md`. Hier steht nur, was zu
tun ist.

## Wo die Arbeit steht

- **Alle Aktionspunkte sind geschlossen** (`_bmad-output/implementation-artifacts/sprint-status.yaml`,
  57 Stück, jeder mit `vermerk`). Das Backlog aus `epics.md` ist vollständig
  gebaut: vier Epics, zwölf Stories.
- **Die offene Arbeit steht als R5-Liste** in
  `_bmad-output/implementation-artifacts/deferred-work.md` unter _Was ungeprüft
  abgenommen werden soll_ — neun Zeilen, jede mit dem, was sie heute trägt und
  was sie decken würde. Vier sind noch offen: die Zeilen 1, 2 und 6 warten auf
  ein Gerät oder einen Menschen und damit auf eine Abnahme durch Manuel, nicht
  auf Code; **Zeile 7 (Kontrastverhältnisse) ist die einzige, die noch an Code
  hängt**. Der jüngste Abschnitt der Datei nennt den Stand jeder Zeile. **Dort
  nachsehen, bevor neue Arbeit angefangen wird**, und nicht in dieser Datei: sie
  trägt Regeln, keinen Stand.

## Prüfkette

- **Vor `npm run lint` immer `npm run build`.** `smoke:http` und `smoke:sicht`
  messen den gebauten Baum und weigern sich bei veraltetem Bau — der Lauf wird
  rot, ohne dass am Code etwas falsch ist.
- **`smoke:sicht` braucht einen Chrome auf der Maschine.** Fehlt er, scheitert
  der Lauf mit Ansage; `CHROME_PFAD=/pfad/zu/chromium` überschreibt die Suche.
  Kein Browser wird als Abhängigkeit installiert — NFR13.
- **Neue Wache ohne vorgeführte Mutation ist unfertig.** Jede neue Behauptung
  und jede neue Gate-Regel wird einmal absichtlich rot gemacht, und wie, gehört
  in die Commit-Nachricht. Grün ohne diesen Schritt beweist nichts.
- **Von Hand geführte Zahlen mitziehen.** `ERWARTETE_BEHAUPTUNGEN` in den vier
  Prüfskripten, `erwartet` je Fehlerprobe in `gate.mjs` und das
  ausgeschriebene Zahlwort der Regelzahl („siebzehn Regeln") brechen bei jeder
  Ergänzung. Das ist Absicht.
- **Eine Regel über den ganzen Baum gehört nach `gate.mjs`**, nummeriert und mit
  Fehlerprobe. Eine Behauptung über **eine bestimmte** Seite bleibt in
  `smoke-zugang.ts` — im Tor wäre sie eine Liste von Hand, und die ist der
  Fehler eine Zeile weiter oben. Verhalten bleibt in den `smoke`-Skripten.
  (Entscheid A3, Retrospektive Epic 3; die Grenze aus dem Abschluss von
  Aktionspunkt 57.)
- **Keine von Hand geführte Dateiliste in einer Wache.** Was geprüft wird, aus
  dem Verzeichnisbaum ableiten. Belegt: Story 4.1 baute zwei Seiten mit
  Formular, trug sie nicht in `seitenServer`/`seitenKomponenten` ein, und beide
  fielen aus zwei geteilten Prüfungen heraus.

## Was ein Kommentar nicht darf

- **Nicht mehr behaupten, als der Code tut.** Die häufigste Fehlerklasse
  dieses Projekts. Belegt: ein Kommentar sagte „über alle Seitenkomponenten"
  und las drei verdrahtete Pfade; `bedienelemente.css` begründete eine
  Entscheidung mit einer Behauptung, die drei von dreizehn Regionen prüfte;
  und ein Kommentar zu einer frisch gebauten Gate-Regel behauptete eine
  Grenze, die sie nicht hat. Vor dem Schreiben messen, und die Grenze der
  Wache ausschreiben statt sie zu verschweigen.
- **Keine Zahl übernehmen, ohne sie zu messen.** Zähler in Prosa waren
  zweimal falsch (`request.formData()` 7 statt 13; `.liste` „sieben Namen"
  statt fünf). Wer eine Zahl nennt, nennt ihren Messweg daneben.
- **Wissen, das eine zweite Kopie trug, mit umziehen.** Beim Zusammenlegen
  zweier gleicher Regeln geht die Warnung verloren, die beide trugen — nicht
  die Zeilen sind der Preis, sondern die Begründung.

## Arbeitsablauf

- **R1 — Story-Abschluss:** vor `done` die Spec gegen das Gebaute halten. Kein
  Abnahmekriterium darf einem anderen widersprechen.
- **R2 — ein Befund, der eine Klasse benennt**, löst die Suche nach ihren
  übrigen Fundstellen aus, bevor die Arbeit schliesst.
- **R3 — Spec über dem Token-Zielband** wird vor dem Bau geteilt oder die
  Grösse ausdrücklich als Annahme abgenommen.
- **R4 — jede Abweichung vom Spec** bekommt im Moment der Entscheidung einen
  Eintrag im _Spec Change Log_ der Story: was, warum, und welchen
  bekannt-schlechten Zustand es vermeidet.
- **R5 — eine Handprüfung endet datiert und mit der Angabe, was lief** — oder
  ausdrücklich als _ungeprüft abgenommen_, mit Namen. „Sieht gut aus" ist
  keines von beiden. Barrierefreiheit fällt hierunter.
- **R6 — ein Nachlauf, der Aktionspunkte schliesst**, wird vor dem Abschluss
  gereviewt wie eine Story. Belegt: fünf ungereviewte Commits erzeugten drei
  Befunde der nächsten Retrospektive, einer davon eine ausgelieferte
  Regression.
- **R7 — ein Aktionspunkt, der anders geschlossen wird als sein Wortlaut**,
  trägt die Begründung im Register (`sprint-status.yaml`, Felder
  `abgeschlossen` und `vermerk`) — nicht nur in der Commit-Nachricht.

## Sprache

Oberfläche und Dokumente Deutsch in Schweizer Rechtschreibung, **ohne Eszett**,
Du-Form. Domänenspalten der Datenbank deutsch, Infrastrukturspalten englisch.
