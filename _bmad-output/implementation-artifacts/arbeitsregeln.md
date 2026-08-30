# Arbeitsregeln

**Entwurf vom 2026-08-30, zur Abnahme durch Manuel.** Bis dahin sind es
Vorschläge und keine Regeln.

Acht Aktionspunkte aus drei Retrospektiven verlangen dasselbe: *„daraus eine
Regel machen"*. Sie standen offen, weil es keine Datei gab, in der eine Regel
hätte stehen können — kein `AGENTS.md`, kein `CLAUDE.md`, keine Prozessdoku.
Der Vorschlag steht hier gesammelt, damit über acht Regeln in einem Zug
entschieden werden kann statt über jede einzeln.

**Was diesem Dokument noch fehlt, um zu wirken:** ein Ort, an dem es gelesen
wird. Eine Regel in einer Datei, die kein Ablauf öffnet, ist genau der Zustand,
den die Punkte 12, 13 und 14 seit Epic 1 beschreiben. Zwei Wege stehen offen —
ein `AGENTS.md` im Wurzelbaum, das jede Sitzung mitliest, oder eine
Anpassung der `bmad-build`-Skills über `bmad-customize`. Das ist die
eigentliche Entscheidung; die Formulierungen darunter sind der leichtere Teil.

---

## R1 · Jede Story schliesst mit einem Spec-Abgleich

*Aus: Retro Epic 1, Punkt 12 · verschärft durch Retro Epic 2, Punkt 27*

Bevor eine Story auf `done` geht, wird ihre Spezifikation gegen das gehalten,
was gebaut wurde: stimmen die Abnahmekriterien noch mit der Wirklichkeit, und
widerspricht keines einem anderen.

**Warum:** Story 3.2 hat zwei Kriterien in Spannung stehen lassen — AC 3 sagte
„nach dem Bestätigen steht mein Name daneben", AC 4 liess dieselbe Aufgabe von
`/` verschwinden. Beide standen ein halbes Epic lang nebeneinander. Aufgelöst
wurde das erst am 2026-08-30, aus einer Retrospektive heraus.

**Auslöser:** der Übergang einer Story von `review` auf `done`.

> **Punkt 27 nennt die Bedingung, unter der R1 überhaupt ausführbar ist:**
> zwischen zwei Epics gehört ein Abgleichschritt, weil ein Abgleich am Ende
> jeder einzelnen Story nur sieht, was diese Story angefasst hat. Beides
> zusammen oder keines von beiden.

## R2 · Eine entdeckte Gefahr löst die Prüfung ihrer früheren Fundstellen aus

*Aus: Retro Epic 1, Punkt 13*

Wer beim Bauen eine Fehlerklasse findet, sucht sie im übrigen Baum, bevor die
Story schliesst — nicht nur an der Stelle, an der sie auffiel.

**Warum:** am 2026-08-30 wurde der `.fehler`-Zwilling im geteilten Stilblatt
aufgelöst; dieselbe Messung fand `.meldung` als identischen Fall, den keine
Retrospektive genannt hatte. Ohne den zweiten Blick wäre die Hälfte des Befunds
stehen geblieben. Umgekehrt hat Story 4.1 zwei Wissen-Seiten gebaut und
übersehen, dass sie damit Teil zweier geteilter Behauptungslisten geworden war
— der Review fand es, die Story nicht.

**Auslöser:** jeder Befund, der eine Klasse benennt statt eines Einzelfalls.

## R3 · Stories über der Token-Empfehlung werden geteilt oder ausdrücklich abgenommen

*Aus: Retro Epic 1, Punkt 14*

Liegt eine Spezifikation über dem Zielband, wird sie vor dem Bau geteilt — oder
die Grösse wird als bewusste Annahme abgenommen und die Begründung steht in der
Spec.

**Warum:** Story 1.1 lag bei rund 3180 Tokens (Zielband 900–1300, Warnschwelle
1600) und wurde erst im Nachhinein geteilt; die Teilung von 1.1 in Werkzeugkette
und Gestaltungsrahmen wurde freigegeben und dann fallen gelassen, mit Kosten auf
beiden Seiten.

**Auslöser:** die fertige Spezifikation, vor dem ersten Commit.

## R4 · Der Spec Change Log ist Pflicht, nicht Praxis

*Aus: Retro Epic 3, Punkt 43 · löst Punkt 30 aus Epic 2 ab*

Jede Abweichung vom Spec — im Bau wie im Review — bekommt einen Eintrag im
*Spec Change Log* der Story: was abwich, warum, und welchen bekannt-schlechten
Zustand es vermeidet. Das ersetzt die nie geführten Sitzungsprotokolle: der
Change Log trägt die Wendungen ohnehin, und er steht dort, wo man sie sucht.

**Warum:** Durchgang 2 von Story 3.2 hat zwei Abweichungen eingetragen, den
Posten dabei ausdrücklich zitiert — und die dritte Abweichung desselben
Vormittags vergessen. Eine Praxis, die man beim dritten Fall am selben Tag
vergisst, ist keine Regel.

**Auslöser:** jede Abweichung, in dem Moment, in dem sie entschieden wird.

## R5 · Handprüfungen sind durchgeführt und datiert — oder ausdrücklich als ungeprüft abgenommen

*Aus: Retro Epic 3, Punkt 44 · Retro Epic 2, Punkt 29*

Eine manuelle Prüfung hat genau zwei zulässige Endzustände: **durchgeführt**,
mit Datum und mit der Angabe, welche der vorgeschlagenen Einzelprüfungen
wirklich liefen — oder **ausdrücklich als ungeprüft abgenommen**, mit dem
Namen dessen, der das Risiko trägt. Ein „sieht gut aus" ohne Angabe ist keines
von beidem.

**Warum:** die Abnahmen zu 1.1, 1.2 und 1.3 erfolgten alle ohne Angabe, welche
Prüfungen ausgeführt wurden. Bei 1.3 fand dieselbe Prüfung **drei** Fehler, die
die vollständige Prüfkette und drei Review-Schichten passiert hatten — der Wert
ist also belegt, die Buchführung darüber nicht.

**Barrierefreiheit fällt ausdrücklich hierunter** (Punkt 29): sie ist bis heute
mitgenickt und nicht abgenommen. Belegt ist die Struktur im ausgelieferten
Dokument; das Erlebnis mit einem Screenreader hat niemand geprüft. Solange das
so bleibt, gehört es als *ungeprüft abgenommen* hingeschrieben und nicht
stillschweigend mitgeführt.

**Auslöser:** der Abschluss jeder Story mit einer Oberfläche.

## R6 · Aktionspunkt-Nachläufe bekommen einen Review wie Stories

*Aus: Retro Epic 3, Punkt 54*

Ein Nachlauf, der Aktionspunkte abarbeitet, wird vor dem Abschluss genauso
adversarial gelesen wie eine Story.

**Warum:** fünf Commits über neunzehn Dateien und sieben Komponenten gingen ohne
Review ins Produkt; die Befunde R1, R2 und R3 der zweiten Retrospektive zu
Epic 3 stammen alle daraus, und R1 war eine **ausgelieferte Regression**.

**Belegt, dass es trägt:** der Nachlauf vom 2026-08-30 hat sich selbst
gereviewt und dabei drei eigene Befunde gefunden — eine weiche Untergrenze, wo
die Prosa „alle" sagte, und zwei Kommentaraussagen über eine frisch gebaute
Gate-Regel, von denen eine schlicht falsch war.

**Auslöser:** jeder Nachlauf, der mehr als einen Aktionspunkt schliesst.

## R7 · Abweichend geschlossene Aktionen tragen ihre Begründung im Register

*Aus: Retro Epic 3, Punkt 55*

Wird ein Aktionspunkt anders geschlossen, als sein Wortlaut verlangt, steht die
Begründung in `sprint-status.yaml` beim Punkt selbst — nicht nur in der
Commit-Nachricht.

**Warum:** die Punkte 39 und 40 stehen auf `done`; ein Leser des Registers
schliesst daraus auf eine geteilte Komponente. Gebaut wurde CSS. Für Punkt 40
gibt es einen tragenden Grund — Gate-Regel 11 leitet die Route aus dem
Verzeichnis ab, eine Komponente hätte keins —, und genau den muss jemand kennen,
bevor er die Komponente doch baut. Er lebte allein in der Commit-Nachricht von
`4af054f`.

**Umsetzung:** die Felder `abgeschlossen` und `vermerk` am Aktionspunkt,
erstmals angewandt am 2026-08-30.

**Auslöser:** jedes Setzen eines Aktionspunkts auf `done`, dessen Umsetzung vom
Wortlaut abweicht.

---

## Was hier bewusst nicht steht

- **Sitzungsprotokolle** (Punkt 30 aus Epic 2). R4 ersetzt sie: der Spec Change
  Log trägt die Wendungen, und ein zweites Protokoll daneben wäre eine zweite
  Wahrheit. Punkt 30 gilt mit R4 als beantwortet, nicht als ausgeführt.
- **Der Stufe-C-Entscheid** (Punkt 56). Ein kopfloser Browser ist eine
  Stack-Entscheidung und keine Arbeitsregel; die Auslösebedingung ist
  eingetreten, der Preis ist eine fremde Abhängigkeit, und die Wahl gehört
  Manuel. Steht als eigener Punkt im Register.
- **Der Umzug der Quelltext-Regeln nach `gate.mjs`** (Punkt 57). Das ist Arbeit
  am Werkzeug und keine Regel über die Arbeit.
