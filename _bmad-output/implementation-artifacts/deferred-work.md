# Zurückgestellte Arbeit

Protokoll dessen, was jede Story zurückgestellt hat. Wird angehängt, nie umgeschrieben.

**Vor dem Start einer Story lesen:** `deferred-work-triage-2026-08-28.md` ordnet alle 41 Einträge
ein (geschlossen · vor Epic 3 fällig · Entscheid durch Manuel · bewusst getragen). Einträge tragen
mitunter eine eigene Fälligkeit — Eintrag 31 („gehört entschieden, bevor Story 2.2 rechnet") ist der
Beleg, dass sie ohne einen festen Lesepunkt verstreicht.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-geruest-und-gestaltungsrahmen.md`
  summary: Datenbankschicht — Fail-Fast-Umgebungsvariablen, leeres Drizzle-Schema, SQLite-Verbindung mit WAL und Migrationskette, drizzle.config.ts und die db:*-Skripte.
  evidence: In Story 1.1 ohne sichtbares Ergebnis — sie erzeugt eine leere Datenbank mit Migrationstabelle und sonst nichts. Erstmals gebraucht von Story 1.2, die `members` anlegt. Herausgelöst, weil die Spezifikation bei rund 3180 Tokens lag (Zielband 900–1300, Warnschwelle 1600) und der Schnitt beide Stories inhaltlich kohärenter macht.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-geruest-und-gestaltungsrahmen.md`
  summary: ERLEDIGT — die zweite Review-Runde für Story 1.1 ist nachgeholt und hat acht bad_spec-Befunde ergeben, alle in Iteration 3 behoben und belegt.
  evidence: Ursprünglich übersprungen, dann auf Wunsch nachgeholt. Sechs der acht Befunde lagen im Prüfskript und wurden im laufenden Baum demonstriert; der schwerste war Prettiers eigener Zeilenumbruch, der die Regeln 2 und 3 aushebelte. Der damals notierte Reihenfolge-Kandidat ist behoben: es gibt jetzt einen Sprunglink, und der Kommentar in `+layout.svelte` beschreibt beide Umbruchzustände wahrheitsgemäss. Verbleibend offen ist allein die visuelle Prüfung — vom User am 2026-08-26 mündlich abgenommen ("sieht schon mal gut aus"), ohne Prüfung der Installation zum Home-Bildschirm.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-geruest-und-gestaltungsrahmen.md`
  summary: Aufteilung von Story 1.1 in Werkzeugkette und Gestaltungsrahmen wurde verworfen.
  evidence: Freigegeben, dann fallen gelassen. Die Begründung für die Teilung war, dass der Gestaltungsrahmen im Schatten des Prüfskripts keine eigene Review bekommt. Runde 2 hat ihn geprüft und dort sechs Mängel gefunden (fehlendes h1, Reihenfolge, istAktiv mit nacktem startsWith, viewport-fit, color-scheme, orientation-Zwang), alle behoben. Der Nutzen der Teilung war damit realisiert, die Kosten — Umnummerierung von Epic 1 und schale Story-Nummern-Verweise — blieben.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-geruest-und-gestaltungsrahmen.md`
  summary: Installation zum Home-Bildschirm auf einem echten Gerät ist nie geprüft worden.
  evidence: Manifest, Icons in 192/512/512-maskable/192-maskable/180 und `favicon.ico` sind vorhanden und werden mit 200 ausgeliefert; `id`, `display: standalone` und das Fehlen eines `orientation`-Zwangs sind maschinell bestätigt. Ob die Installation auf einem iPhone oder Android tatsächlich das eigene Icon zeigt und ohne Browser-Leiste startet, hat niemand gesehen. Spätestens mit Story 1.7 (Betrieb) auf dem VPS nachzuholen.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-einladungslink-einloesen-und-angemeldet-bleiben.md`
  summary: `scripts/smoke-zugang.ts` stellt SvelteKit mit Attrappen nach, statt gegen einen echten Server zu laufen.
  evidence: Über drei Review-Runden hat jede nachgestellte Grenze Behauptungen erzeugt, die sich selbst bestätigten — die Byte-Gleichheit verglich zweimal die Ausgabe einer reinen Funktion über schon behauptete Werte, `set-cookie` und `content-type` wurden gegen ein selbstgebautes Objekt geprüft. Alle einzeln geflickt und durch Mutation belegt, aber `respond.js` bleibt ungeprüft, und der 303-Pfad wird von der Attrappe selbst entschieden statt gemessen. Ein Lauf gegen einen echten Server auf einem freien Port würde Byte-Gleichheit samt Kopfzeilen, `set-cookie` auf der 403, den 303-Pfad, `handleError` und `init` in einem Zug schliessen. Empfohlen, vom User am 2026-08-27 bewusst zurückgestellt zugunsten einzelner Flicken; die Bauform sollte bleiben, bis eine Story sie ohnehin anfasst.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-einladungslink-einloesen-und-angemeldet-bleiben.md`
  summary: Drei von Hand gepflegte Zahlen brechen bei jeder legitimen Ergänzung, bis sie nachgezogen werden.
  evidence: `ERWARTETE_BEHAUPTUNGEN` in `scripts/smoke-zugang.ts` (109 in Story 1.2, 158 nach der ersten Umsetzung von Story 1.3, 185 nach ihrer Review-Iteration, **213** nach Story 1.4 — genau die Reibung, die dieser Eintrag vorhergesagt hat), die `erwartet`-Zahl je Probe in `scripts/gate.mjs` (jetzt 25 Proben über zwölf Regeln) und die Probenliste in `scripts/db-check.ts`. Absicht ist, stilles Schrumpfen zu fangen — eine Behauptung, die unbemerkt übersprungen wird, fällt so auf. Preis ist Reibung bei jeder Erweiterung. Falls das lästig wird, wäre die Zahl aus den Proben ableitbar statt festgeschrieben.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-einladungslink-einloesen-und-angemeldet-bleiben.md`
  summary: ERLEDIGT — die visuelle Prüfung ist am 2026-08-27 erfolgt und mündlich abgenommen ("sieht gut aus").
  evidence: Struktur, fehlender Rahmen, ein `<h1>` mit dem vorgeschriebenen Satz, Abwesenheit von Rot und von Hex-Werten waren maschinell belegt — durch `smoke`, Gate-Regel 1 auf `.html` und Messungen am laufenden Server. Der Entwicklungsserver lief mit `--host`, zwei Einladungslinks waren gestellt, und der Ablauf war vorab durchgefahren (403 ohne Cookie, 303 beim Einlösen, 200 mit Rahmen danach, 404 mit eigener Meldung, 403 bei ungültigem Token). Die Abnahme erfolgte ohne Angabe, welche der sechs vorgeschlagenen Prüfungen im Einzelnen ausgeführt wurden; **nicht** mit abgenommen ist die Installation zum Home-Bildschirm, die als eigener Punkt aus Story 1.1 offen bleibt.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-einladungslink-einloesen-und-angemeldet-bleiben.md`
  summary: `scripts/gate.mjs`s textuelles Import-/Kommentar-Scanning hat latente blinde Flecken und Fehlalarm-Risiken.
  evidence: Code-Review (Gruppe B, 2026-08-27) fand: 400-Zeichen-Rückschau für `import type` kann bei langen, von Prettier umgebrochenen Typlisten fälschlich als Wert-Import werten; Import-Spezifizierer je Feld (`import { type A, type B }`) werden nicht erkannt; das `from '...'`-Muster ist nicht an ein echtes `import`/`export`-Statement gebunden; dynamische Imports über Template-Literale werden nicht gescannt; ein blankes `//` ausserhalb von CSS-Abschnitten könnte den Rest einer Zeile fälschlich als Kommentar ausblenden. Nichts davon löst auf dem aktuellen Baum aus (`npm run gate`/`gate:selftest` grün). Vom User am 2026-08-27 bewusst als bekannte Grenze stehen gelassen statt jetzt gehärtet — Aufwand für eine grössere Überarbeitung der Scan-Logik steht nicht im Verhältnis zum aktuellen Risiko. Bei einem künftigen Fund in dieser Klasse (`bad_spec`, wie in den drei vorherigen Iterationen) hier ansetzen. Praktisch bestätigt, ebenfalls am 2026-08-27: der Versuch, `systemfarben` um ältere CSS2.1-Systemfarben-Namen (`Window`, `Menu`, `Background`, …) zu ergänzen, brach sofort drei `gate:selftest`-Proben (9 statt 6, 7 statt 3, 4 statt 2 Treffer), weil diese Wörter ausserhalb echter Farbwert-Position matchen — Beleg, dass die Matching-Präzision und nicht nur die Namensliste das eigentliche Problem ist. **Story 1.4 hat dieselbe Klasse mit umgekehrtem Vorzeichen getroffen:** `white-space: nowrap` in einer Komponente fällt als „CSS-Farbname white", weil der Wortscanner an `-` abbricht. Der Fehlalarm ist echt und kostet die üblichste Fassung der sr-only-Klasse; umgangen wurde er in `src/routes/+page.svelte`, indem die Zeile entfällt (das Element ist ohnehin aus dem Fluss genommen und weggeschnitten), samt Kommentar an der Stelle. Ein Bindestrich-Rand am Wortscanner (`(?<![\w-])wort(?![\w-])`) wäre die kleine, gezielte Verbesserung — nicht angefasst, weil sie in dieselbe Scan-Logik greift, die dieser Eintrag ausdrücklich stehen lässt.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-mitglieder-aufnehmen-und-zugang-beenden.md`
  summary: Die Svelte-Schicht von `/verwaltung` und `/mehr` ist von keiner Prüfung gedeckt — es gibt kein Komponenten-Testwerkzeug im Projekt.
  evidence: `npm run smoke` ruft die Routenmodule (`load` und die drei actions) direkt und belegt die Serverseite mit 185 Behauptungen. Alles darüber ist ungeprüft: dass der Einmal-Link den Fehlschlag einer anderen action überlebt, dass die Sperre gegen Doppelversand greift, dass `showModal()` den Fokus auf `Abbrechen` legt und ein Enter nichts widerruft, dass die Live-Regionen angesagt werden, dass `::backdrop` das Token erbt. Das Projekt hat bewusst kein Testframework (Epic-1-Kontext, Qualitätstor), und ein Komponenten-Testwerkzeug wäre eine Stack-Entscheidung, nicht eine Story-Entscheidung. Bis dahin trägt diese Klasse allein die manuelle Prüfung am 375px-Viewport. Gate-Regel 11 schliesst wenigstens die eine Klasse, in der eine tote Verbindung zwischen Markup und Server entsteht.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-mitglieder-aufnehmen-und-zugang-beenden.md`
  summary: Der Einmal-Link überlebt einen Fehlschlag nur **mit** JavaScript. Ohne JavaScript ist das nicht behebbar, ohne den eingefrorenen Block zu brechen.
  evidence: Mit `use:enhance` bleibt die Komponente bestehen, und der Link liegt in lokalem Zustand, den nur ein Neuladen löscht — der Fund der Review ist damit auf dem normalen Weg behoben. Ohne JavaScript ist **jede** Antwort ein neues Dokument: die POST-Antwort einer anderen action kennt den Link nicht, und es gibt keinen Ort, an dem er zwischen zwei Dokumenten liegen könnte. Der eingefrorene Block verbietet dafür jeden Träger — kein Speichern, kein Cookie, keine URL —, und ein verstecktes Formularfeld hiesse, den Klartext wieder zum Server zu schicken, gegen „verlässt den Server genau einmal". Bewusst so gelassen: der Weg ohne JavaScript verliert den Link, der Weg mit JavaScript nicht.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-mitglieder-aufnehmen-und-zugang-beenden.md`
  summary: Kein Umbenennen, kein Reaktivieren, kein Undo-Fenster.
  evidence: Bewusst nicht gebaut und im eingefrorenen Block als `Ask First` festgehalten. Die Folgen sind in README.md unter den benannt akzeptierten Risiken aufgeschrieben: ein Tippfehler im Namen bleibt stehen, ein Widerruf ist ohne Datenbankeingriff unumkehrbar, und eine Korrektur kostet einen neuen Link. Serverseitig abgewehrt sind nur die Eingaben, aus denen gar kein lesbarer Name entstünde (leer, Nullbreiten-Zeichen, über 80 Zeichen) — die 80 und das Aussieben sind eine Auslegung von „ein Mitglied hat einen lesbaren Namen" und dem User beim Abschluss vorzulegen.
  status: dem User vorzulegen
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-mitglieder-aufnehmen-und-zugang-beenden.md`
  summary: Das Gate rechnet keinen Kontrast nach. Die Werte von `--danger` stehen als gemessen im Kommentar und werden von nichts geprüft.
  evidence: Regel 4 erzwingt, dass jedes Farb-Token einen Wert in **beiden** Blöcken hat — durch Mutation belegt. Ob `#a32e22` auf `--surface-raised` tatsächlich 7.07:1 erreicht, prüft nichts: die Zahl steht im Kommentar von `src/app.html` und in den Design Notes der Spezifikation, beide von Hand eingetragen und beide nachgerechnet, aber nicht maschinell. Eine Regel 12, die jedes Vordergrund-/Hintergrund-Paar aus dem Token-Block gegen 4.5:1 hält, wäre machbar, bräuchte aber eine Aussage darüber, welche Paare überhaupt zusammen vorkommen — und die steht heute nirgends in maschinenlesbarer Form.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-mitglieder-aufnehmen-und-zugang-beenden.md`
  summary: `sitzungLoeschen` in `src/lib/server/auth.ts` hat weiter keinen Aufrufer.
  evidence: In Story 1.2 für Story 1.3 bereitgehalten, dort nicht gebraucht: das Verbot des Selbstwiderrufs sorgt dafür, dass ein Widerruf immer ein fremdes Cookie trifft, das in der Antwort der action nicht vorkommt und das der Wächter beim nächsten Aufruf ohnehin abweist. Der Kommentar an der Funktion sagt das jetzt so. Die Funktion bleibt stehen, weil das Löschen des einzigen Zugangsmittels an einer Stelle definiert gehört und ihre Attribute von `smoke` geprüft werden (vier Behauptungen). Erster echter Aufrufer wäre ein Abmelden-Knopf — den gibt es bewusst nicht.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-mitglieder-aufnehmen-und-zugang-beenden.md`
  summary: Gate-Regel 11 deutet nur die Form `action="?/name"`, nicht `action="/pfad?/name"`.
  evidence: Die Route wird aus dem Verzeichnis der Komponente abgeleitet; steht ein Pfad vor dem `?`, zeigt die Aktion auf eine andere Route und die Zuordnung wäre geraten. Die Form kommt im Baum nicht vor, und eine geratene Zuordnung wäre schlechter als eine benannte Grenze. Die Gegenprobe `regel-11-aktion-aufgeloest` hält ausdrücklich fest, was nicht fallen darf: ein Formular ohne `action` (die Standard-action) und ein `action` mit fremder Adresse.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-mitglieder-aufnehmen-und-zugang-beenden.md`
  summary: Abdeckung der Svelte-Schicht — vierstufiger Vorschlag mit Reihenfolge und Auslösebedingung, nichts davon umgesetzt.
  evidence: Drei Fehler in Story 1.3 kamen durch die vollständige Prüfkette **und** durch drei Review-Schichten und wurden erst bei der Benutzung durch den User gefunden: ein `%sveltekit.head%` in einem HTML-Kommentar, dessen Ersetzung den Kommentar aufbrach und die halbe Erklärung sichtbar über die Titelleiste stellte; der Bestätigungsdialog, der seinen Text mit leeren Platzhaltern in jeden ausgelieferten Quelltext schrieb; und derselbe Dialog, der nach dem Widerruf offen stehen blieb, weil `use:enhance` per fetch abschickt und keine Navigation ihn schloss — bei einem modalen Dialog war `Abbrechen` damit der einzige Ausweg, während die Rückmeldung dahinter lag. Die drei zerfallen in zwei Klassen, und das ist der Kern des Vorschlags. **Klasse A** (die ersten zwei) ist eine Eigenschaft des ausgelieferten HTML und braucht keinen Browser, nur einen echten Server. **Klasse B** (der dritte) ist Verhalten im Browser. Vorschlag, aufsteigend nach Kosten. **Stufe 0, sofort und ohne Story:** die „visuelle Prüfung" als numerierte Prüfliste mit erwartetem Ergebnis und Abhaken statt als Absatz Prosa — alle drei Fehler lagen im Blickfeld einer sorgfältigen Durchsicht, und Story 1.1 und 1.2 gingen mit „sieht gut aus" durch. **Stufe A, empfohlen als eigene Story vor Epic 2:** ein zweites Prüfskript in der bestehenden Bauform, das die gebaute App auf einem freien Port gegen eine Wegwerf-Datenbank startet, zwei Links einlöst und auf dem ausgelieferten HTML behauptet — reines Node, keine neue Abhängigkeit, `pruefen`/`pruefenGleich` und `wegwerfVerzeichnis` wiederverwendbar. Es schliesst drei Posten dieser Datei auf einmal: Klasse A, die Attrappen-Bauform von `scripts/smoke-zugang.ts`, die sich über drei Review-Runden selbst bestätigte, und die ungeprüfte `Referrer-Policy` auf dem Fatal-Pfad; der 303-Pfad würde gemessen statt von der Attrappe entschieden. Vor Epic 2, weil Epic 2 `queries/tasks.ts` und die Listenansicht ohnehin wieder anfasst. **Stufe B, klein, beim nächsten Anfassen von `/verwaltung`:** Interaktionslogik aus der Komponente in reine Funktionen ziehen. Fehler 3 sass in einem Rückruf von drei Zeilen; läge `versand` als reine Funktion in einem `.ts`-Modul und bekäme das Schliessen übergeben, könnte das bestehende Skript ihn aufrufen und behaupten, dass vor dem Fokussieren geschlossen wurde. Architektur- statt Werkzeugentscheidung, passt zu „bewusst kein Testframework" statt dagegen. **Stufe C, zurückgestellt:** ein kopfloser Browser (Playwright) ist das Einzige, was `showModal()`-Fokus, den Enter-Fall, die Sperre gegen Doppelversand und die Ansage der Live-Regionen wirklich deckt. Auslösebedingung ausdrücklich benannt: die zweite Bestätigung mit Sicherheitszusage, also Story 3.2 („Einzelaufgabe übernehmen", laut EXPERIENCE.md die andere erlaubte Bestätigung). Ab zwei solchen Dialogen ist Playwright billiger als die Handprüfung, vorher nicht — und es widerspricht einer ausdrücklichen Stack-Entscheidung, die dem User gehört. **Ausdrücklich nicht empfohlen: jsdom** (vitest, testing-library). Es implementiert `<dialog>` und Fokusfang nicht verlässlich, hätte Fehler 3 gefangen und bei genau den sicherheitsrelevanten Zusagen falsche Sicherheit gegeben; halbe Abdeckung mit vollem Vertrauen ist schlechter als keine. Gegenargument gegen ein sofortiges Stufe C, das der Vorschlag mitträgt: die Statik ist der billigste Ort, und Gate-Regel 10, 11 und 12 sind alle aus dieser Story entstanden und kosten pro Lauf nichts.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-mitglieder-aufnehmen-und-zugang-beenden.md`
  summary: ERLEDIGT — die visuelle Prüfung von Story 1.3 ist am 2026-08-27 erfolgt und mündlich abgenommen ("sieht gut aus").
  evidence: Anders als bei Story 1.1 und 1.2 war diese Prüfung nicht bloss eine Bestätigung: sie hat **drei** Fehler gefunden, die die vollständige Prüfkette und drei Review-Schichten passiert hatten — die aufgebrochene Kommentarmarke in `src/app.html`, den Dialog mit leeren Platzhaltern im ausgelieferten Quelltext und den Dialog, der nach dem Widerruf offen stehen blieb. Alle drei sind behoben und einzeln committet (`aa4fdc5`, `6a64b5c`, `3493d1d`), der erste zusätzlich durch Gate-Regel 12 gegen Rückfall gesichert. Der Entwicklungsserver lief mit `--host` gegen eine Wegwerf-Datenbank, zwei Einladungslinks waren gestellt (eine Adminperson, ein Mitglied ohne Adminrechte), und der Ablauf war vorab maschinell durchgefahren: 403 ohne Cookie, 303 beim Einlösen, 200 auf `/verwaltung` als Admin, 303 auf `/` als Nicht-Admin, und `/mehr` ohne den Verwaltungs-Eintrag. Maschinell belegt waren ausserdem genau ein `<h1>`, genau ein `button-primary` im Markup, `var(--danger)` in genau einer Regel und null von vier Token-Hashes im ausgelieferten Quelltext. Die Abnahme erfolgte wie bei den Vorgängerstories **ohne Angabe, welche der vorgeschlagenen Einzelprüfungen ausgeführt wurden**; insbesondere ist nicht ausdrücklich bestätigt, dass der dunkle Modus und die Fokusreihenfolge im Dialog geprüft wurden. **Nicht** mit abgenommen ist die Installation zum Home-Bildschirm, die als eigener Punkt aus Story 1.1 offen bleibt.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-offene-aufgaben-sehen-und-abhaken.md`
  summary: Die Svelte-Schicht von `/` ist von keiner **ausgeführten** Prüfung gedeckt; zwei Zusagen hängen an einer Textprüfung.
  evidence: `npm run smoke` ruft `load` und beide actions von `src/routes/+page.server.ts` direkt und belegt die Serverseite. Alles darüber ist ungeprüft: dass die abgehakte Zeile wirklich an ihrem Platz stehen bleibt, dass der Übergang bei `prefers-reduced-motion` entfällt, dass das Trefferfeld 44px erreicht ohne die Zeilenhöhe aufzublähen, dass ein Antippen des Texts nichts tut, dass die Live-Region angesagt wird, dass das Kästchen nach einem abgewiesenen Versand auf den Zustand zurückgezogen wird. Zwei dieser Zusagen hängen an genau einer Textstelle und sind darum als **Textprüfung** in `smoke` gehalten: `update({ reset: false, invalidateAll: false })` und die Abwesenheit von `<label>`. Beide beissen (durch Mutation belegt), beide prüfen aber Text und nicht Verhalten. Das ist derselbe Posten wie bei Story 1.3, jetzt mit einer zweiten Route: der vierstufige Vorschlag (Stufe A: ein zweites Prüfskript gegen einen echten Server auf einem freien Port) deckt Klasse A weiter ab, Stufe C (kopfloser Browser) bleibt das Einzige, was das Verhalten im Browser wirklich deckt.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-offene-aufgaben-sehen-und-abhaken.md`
  summary: ERLEDIGT — die visuelle Prüfung von Story 1.4 ist am 2026-08-27 erfolgt und mündlich abgenommen ("es sieht soweit alles gut aus").
  evidence: Maschinell belegt waren vorher: `npm run lint` und `npm run check` mit Exit 0, `npm run build` ohne gesetzte Umgebungsvariablen, und am **laufenden Bau** auf Port 4173 mit einer Wegwerf-Datenbank: `GET /` mit Cookie liefert 200, `grep -c completed` im ausgelieferten Quelltext ergibt 0, der Name der abhakenden Person kommt darin nicht vor, die vier Aufgaben stehen in der Ordnung nach `created_at`, `?/abhaken` antwortet mit `success`/`abgehakt`, ein zweites `?/abhaken` auf dieselbe Zeile mit `failure`/400 und dem einen Satz, `?/wiederOeffnen` mit `success` und ein zweites Mal mit `failure`/400, und bei leerer Liste steht `Nichts offen.` ohne `button-primary`. Für die visuelle Prüfung lief der Entwicklungsserver mit `--host` gegen eine Wegwerf-Datenbank mit vier gesäten Aufgaben, ein Admin-Einladungslink war gestellt, und dem User wurde eine neunpunktige Prüfliste vorgelegt: 375px in Hell und Dunkel, 22px sichtbares Kästchen bei mindestens 44px Trefferfeld, unveränderte Zeilenhöhe, ein Antippen des Aufgabentexts ohne Wirkung, der 140ms-Übergang mit Haken im gefüllten Kästchen und Verbleib an Ort und Stelle, das erneute Öffnen per zweitem Antippen, das Verschwinden erst nach Neuladen, das Entfallen des Übergangs bei „Bewegung reduzieren" und die Screenreader-Ansage über VoiceOver. Anders als bei Story 1.3 hat diese Prüfung **keinen** Fehler gefunden. Die Abnahme erfolgte wie bei den Vorgängerstories **ohne Angabe, welche der neun Einzelprüfungen im Detail ausgeführt wurden** — insbesondere ist nicht ausdrücklich bestätigt, dass Fokusring, dunkler Modus und die VoiceOver-Ansage einzeln geprüft wurden.

## Deferred from: code review of spec-1-4-offene-aufgaben-sehen-und-abhaken (2026-08-27)

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-offene-aufgaben-sehen-und-abhaken.md`
  summary: Gate-Regel 1s neue Zeitregex ist case-sensitiv — ein rohes `140MS` würde nicht erkannt.
  evidence: Deckungsgleich mit der bestehenden px/rem-Regel in derselben Funktion, die dieselbe Lücke schon vor dieser Story hatte. Kein aktueller Treffer im Baum; handgeschriebenes, von Prettier formatiertes CSS schreibt Einheiten praktisch nie gross. Ort: `scripts/gate.mjs:802`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-offene-aufgaben-sehen-und-abhaken.md`
  summary: Gate-Regel 1s neue Zeitregex könnte bei einer Custom Property wie `--transition-duration: …` falsch anschlagen.
  evidence: Der Eigenschaftsname wird nur über `\b(transition|animation)…` erkannt, ein `-` davor ist eine Wortgrenze — eine Custom Property mit demselben Suffix würde mitgelesen. Dieselbe Klasse latenter Grenzen wie das bereits dokumentierte Wortscanning-Problem bei `white-space`. Kein aktueller Treffer, keine solche Custom Property im Baum. Ort: `scripts/gate.mjs:797`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-offene-aufgaben-sehen-und-abhaken.md`
  summary: `request.formData()` läuft in beiden neuen actions ohne try/catch — ein fehlerhafter Body ergäbe 500 statt der beabsichtigten 400.
  evidence: Wortgleiches Muster wie in `src/routes/verwaltung/+page.server.ts`, also vorbestehend und nicht durch diese Story eingeführt. Über `use:enhance` sendet der Browser immer wohlgeformte Daten; erreichbar nur über einen direkten POST ausserhalb der Oberfläche. Ort: `src/routes/+page.server.ts:94` und `:125`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-offene-aufgaben-sehen-und-abhaken.md`
  summary: Numerische Randfälle von `idLesen` (`'0'`, `'1.5'`, eine Zahl über `Number.MAX_SAFE_INTEGER`) sind nur durch Lesen des Codes, nicht durch `smoke` geprüft.
  evidence: Die Logik ist korrekt (Regex lässt keine Dezimalpunkte zu, `id > 0` schliesst Null aus, `Number.isSafeInteger` schliesst zu grosse Werte aus), aber ungetestet — eine künftige Änderung an `idLesen` könnte einen dieser Fälle stillschweigend brechen. Ort: `src/routes/+page.server.ts:49`.

## Deferred from: review of spec-1-5-aufgabe-vor-ort-erfassen (2026-08-27)

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-aufgabe-vor-ort-erfassen.md`
  summary: `NULLBREITE` entfernt U+200D bedingungslos und zerlegt damit jede Emoji-ZWJ-Folge in ihre Einzelzeichen.
  evidence: Zweite Fundstelle derselben Regex, die seit Story 1.3 in `verwaltung/+page.server.ts` steht und dort wortgleich als bewusste Verdopplung begründet ist. `👨‍🌾` wird zu zwei Glyphen, `👨👾`-artig auseinandergezogen. Folgenlos für die Aufgabe selbst (der Text bleibt lesbar), aber die Zusage „unsichtbare Zeichen weg" trifft hier ein sichtbares. Eine Regex mit negativem Lookahead (`‍(?!\p{Extended_Pictographic})`) wäre die kleine Fassung; sie gehört an beide Stellen zugleich, und `/verwaltung` steht im eingefrorenen Block dieser Story ausdrücklich als unangetastet. Ort: `src/routes/aufgabe/+page.server.ts` und `src/routes/verwaltung/+page.server.ts`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-aufgabe-vor-ort-erfassen.md`
  summary: Ausser den fünf Nullbreiten-Zeichen wird kein weiteres unsichtbares Zeichen ausgesiebt.
  evidence: U+00AD (weiches Trennzeichen), U+2800 (Braille-Leerzeichen, das `trim()` nicht als Leerraum sieht), U+3164 (Hangul-Füller) und die Bidi-Steuerzeichen U+202A–U+202E kommen alle durch. Ein Text aus lauter U+2800 legt eine sichtbar leere Aufgabenzeile mit Kästchen an, und es gibt keine Bearbeiten- und keine Löschen-Aktion, die sie richtigstellte — Abhaken ist das Einzige, was bleibt. Praktisch nur durch Einfügen aus einer fremden Quelle erreichbar, nicht durch Tippen. Dieselbe Lücke hat die Namensprüfung aus Story 1.3, und sie gehört an beide Stellen zugleich.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-aufgabe-vor-ort-erfassen.md`
  summary: `request.formData()` läuft auch in `ablegen` ohne try/catch — dritte Fundstelle derselben Klasse.
  evidence: Wortgleich mit den zwei actions aus Story 1.4 und der aus Story 1.3, für die dieser Posten am 2026-08-27 schon einmal zurückgestellt wurde. Ein nicht auswertbarer Rumpf ergibt 500 statt der beabsichtigten 400. Über `use:enhance` sendet der Browser immer wohlgeformte Daten; erreichbar nur über einen direkten POST ausserhalb der Oberfläche. Wenn es angefasst wird, dann an allen vier Stellen zugleich. Ort: `src/routes/aufgabe/+page.server.ts`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-aufgabe-vor-ort-erfassen.md`
  summary: `redirect(303, '/?abgelegt')` schreibt den Pfad hart, während die Oberfläche für interne Ziele `resolve()` benutzt.
  evidence: Heute wirkungslos: `svelte.config.js` konfiguriert kein `paths.base`, und die drei schon vorhandenen Redirects (`adminschranke.ts:38`, `mehr/+page.server.ts:25`, `i/[token]/+server.ts:47`) haben dieselbe Form. Erst ein konfiguriertes `base` machte daraus einen Sprung aus der Anwendung heraus. Die Asymmetrie zur `resolve()`-Pflicht in `.svelte` ist echt, aber sie gehört an alle vier Stellen zugleich und ist keine Frage dieser Story.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-aufgabe-vor-ort-erfassen.md`
  summary: `.fehler` liegt jetzt in drei Komponenten wortgleich, obwohl der Kopf von `bedienelemente.css` Story 1.5 als Grund für „global statt Komponente" nennt.
  evidence: Der Fehlersatz ist ein Bedienelement-Beiwerk und keine Seitenform — anders als `.seite`/`.seitentitel`, deren Verdopplung ausdrücklich begründet ist. Die Zusammenlegung nach `src/lib/styles/bedienelemente.css` wäre die richtige Fassung, verlangt aber einen Eingriff in `src/routes/verwaltung/+page.svelte`, und der eingefrorene Block dieser Story hält `/verwaltung` ausdrücklich als unangetastet fest. Beim nächsten Anfassen von `/verwaltung` mitzunehmen.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-aufgabe-vor-ort-erfassen.md`
  summary: Auf `/aufgabe` ist kein Eintrag der Navigationsleiste aktiv — die ganze Erfassung läuft ohne markiertes Ziel.
  evidence: `istAktiv` in `src/lib/components/NavBar.svelte` trifft bei `pfad === href` oder einem `${href}/`-Präfix, und `'/'` ist von der Präfixregel ausgenommen. `/aufgabe` ist die erste Unterroute überhaupt, die zu einem Navigationsziel gehört, ohne unter dessen Pfad zu liegen — die Frage stellt sich hier zum ersten Mal. Kein Zustand hängt allein daran, und die Seite trägt einen eigenen `<h1>`; die Entscheidung, ob eine Formularseite als „in" ihrem Abschnitt gilt, ist aber eine Gestaltungsfrage und keine Reparatur. Betrifft künftig jede weitere Formularroute (Monatsplan, Ausschreiben).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-aufgabe-vor-ort-erfassen.md`
  summary: Dass der Fokusgriff der Live-Region SvelteKits eigenes `reset_focus` überlebt, ist von keiner ausgeführten Prüfung gedeckt.
  evidence: Der Code ist nach Bauart im Recht: `navigate()` in `node_modules/@sveltejs/kit/src/runtime/client/client.js:2017-2029` berechnet `changed_focus` und überspringt `reset_focus` ausdrücklich, „if any manual focus management didn't override it". Ob der `$effect` früh genug läuft, um das auszulösen, entscheidet die Reihenfolge zwischen Sveltes Effekt-Abarbeitung und dem Ende der Navigation — und das prüft weder `smoke` (rendert nie eine Komponente) noch `gate`. Es trägt allein die manuelle VoiceOver-Prüfung. Derselbe Posten wie die Abdeckung der Svelte-Schicht aus Story 1.3 und 1.4; Stufe C des dortigen Vorschlags (kopfloser Browser) ist das Einzige, was diese Klasse wirklich deckt.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-aufgabe-vor-ort-erfassen.md`
  summary: ERLEDIGT — die visuelle Prüfung von Story 1.5 ist am 2026-08-27 erfolgt und mündlich abgenommen ("sieht gut aus").
  evidence: Maschinell belegt waren vorher `npm run lint` und `npm run check` mit Exit 0 über 261 ausgeführte Behauptungen, und am laufenden Entwicklungsserver gegen eine Wegwerf-Datenbank mit vier gesäten Aufgaben: 403 ohne Cookie auf `/` **und** auf `/aufgabe`, 303 beim Einlösen, genau ein `<input>` und genau ein `button-primary` auf `/aufgabe`, kein `placeholder`, kein Mitgliedsname im ausgelieferten Quelltext, ein gültiger Versand mit 303 auf `/?abgelegt`, der gefaltete Text in der Liste, ein leerer Versand mit 400 samt `aria-invalid="true"` und dem Satz, und eine leere Meldungsregion ohne den Parameter. **Der ganze Ablauf wurde ausdrücklich ohne JavaScript durchgefahren** — als reine `curl`-Kette über die form action —, was diese Story von 1.4 unterscheidet, wo das Abhaken ohne JavaScript benannt nicht funktioniert. Für die visuelle Prüfung lief der Server mit `--host` und mit `ORIGIN` auf der Netzwerkadresse, damit ein Versand vom Handy nicht am CSRF-Schutz scheitert; dem User wurde eine neunpunktige Prüfliste vorgelegt (375px in Hell und Dunkel, Beschriftung statt Platzhalter, Trefferfelder ab 44px, Fokusring auf Feld und Knopf, der Weg vom Ablegen zurück auf die Liste, die breitere statt rote Feldkante, `Nichts offen.` mit `+ Aufgabe` darunter, die Überlängen-Abweisung, und zwei VoiceOver-Punkte). Wie bei allen Vorgängerstories erfolgte die Abnahme **ohne Angabe, welche der neun Einzelprüfungen im Detail ausgeführt wurden**. Ausdrücklich **nicht** bestätigt ist damit Punkt 8, der als einziger eine echte Unsicherheit trug: ob der Fokusgriff der Live-Region SvelteKits eigenem `reset_focus` zuvorkommt — der eigene Posten dazu bleibt offen. **Nicht** mit abgenommen ist weiterhin die Installation zum Home-Bildschirm aus Story 1.1.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-monatsplan-in-einem-zug-ablegen.md`
  summary: `Fällig bis` nimmt jedes formgültige Datum an, auch eines weit in der Vergangenheit — es gibt keine Plausibilitätsschranke und kein `min` am Feld.
  evidence: Ausgeführt nachgemessen: `tagesendeInUnixSekunden('1990-01-01')` gibt `1990-01-01T22:59:59Z` zurück, und die action nimmt den Wert an. Ein vertipptes Jahr legt damit einen ganzen Stapel von 20 bis 40 Aufgaben an, den Story 2.2 sofort als seit Jahrzehnten überfällig kennzeichnen wird — und es gibt **keine** Löschen-Aktion, die ihn wieder aufräumte; abhaken ist das Einzige, was bleibt. Das ist genau der teure Fall, gegen den `PLAN_HOECHSTZAHL` eingeführt wurde, nur von der anderen Seite. Ausdrücklich **nicht** in dieser Story entschieden, weil die richtige Regel eine Produktfrage ist und mehr als eine vertretbare Lesart hat: Vergangenheit hart abweisen (bricht den legitimen Fall, dass jemand einen Plan für den laufenden Monat nachträgt, der schon halb vorbei ist), nur warnen, oder eine Obergrenze nach vorn setzen. Gehört entschieden, **bevor** Story 2.2 die Überfälligkeit rechnet. Ort: `src/routes/monatsplan/+page.server.ts` (Prüfkette der action) und das Datumsfeld in `src/routes/monatsplan/+page.svelte`.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-monatsplan-in-einem-zug-ablegen.md`
  summary: Ein Wurf in der action `ablegen` ersetzt die Seite durch die Fehlerseite, und der ganze getippte Monatsplan ist fort.
  evidence: Der `use:enhance`-Rückruf ruft `update()`, und das ist der Rückfall-Rückruf: bei `result.type === 'error'` reicht er an `applyAction` weiter, das die Fehlergrenze rendert. Auf `/aufgabe` kostet das einen Satz, hier vierzig Zeilen, die jemand gerade aus einer Notiz übertragen und in Schritt 2 von Hand durchgesehen hat — der Verlust wiegt genau so viel schwerer, wie die Story Zeit sparen soll. Erreichbar nur über einen Wurf in `aufgabenStapelAnlegen`, also über einen Datenbankfehler; unter normalem Betrieb nicht. Die Behebung ist keine Reparatur, sondern eine Entscheidung über das Fehlerverhalten der Seite (`result.type === 'error'` abfangen und einen Satz zeigen, statt zu navigieren) und betrifft dann auch `/aufgabe`, `/` und `/verwaltung` — wenn es angefasst wird, dann an allen Stellen zugleich. Ort: `src/routes/monatsplan/+page.svelte`, der Rückruf `versand`.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-monatsplan-in-einem-zug-ablegen.md`
  summary: Zwei der neuen Textprüfungen in `scripts/smoke-zugang.ts` sind brüchiger, als ihr Titel sagt.
  evidence: Erstens teilt `schrittGrenze = planCode.indexOf('{:else}')` die Datei am **ersten** `{:else}`; jeder künftige `{:else}`-Zweig innerhalb von Schritt 1 — ein leerer Zustand am Zähler wäre der naheliegende — verschiebt die Grenze still, und **alle** schrittbezogenen Behauptungen prüfen danach die falschen Hälften, ohne rot zu werden. Ein Ankerkommentar wäre die haltbarere Grenze. Zweitens trifft die Identitätsprüfung `/\b(locals|mitglied|zustaendig|zuständig)/i` den rohen Dateitext und damit auch harmlose deutsche Prosa: eine künftige Beschriftung mit dem Wort „Mitglieder" macht eine Behauptung rot, deren erklärtes Thema Datenzugriff ist. Dieselbe Klasse wie der schon zurückgestellte Posten zu `gate.mjs`s textuellem Scannen. Beide sind Falsch-Rot-Risiken, keine übersehenen Fehler — darum zurückgestellt und nicht in dieser Story geflickt.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-monatsplan-in-einem-zug-ablegen.md`
  summary: ERLEDIGT — die visuelle Prüfung von Story 2.1 ist am 2026-08-28 erfolgt und mündlich abgenommen ("Sieht gut aus").
  evidence: Maschinell belegt waren vorher `npm run lint`, `npm run check`, `npm run db:check` und `npm run build` mit Exit 0 über 349 ausgeführte Behauptungen, dazu jede neue Zusage durch eine Mutationsprobe rot belegt. Am laufenden Entwicklungsserver gegen `data/dev.sqlite` gemessen: 403 ohne Cookie auf `/` **und** auf `/monatsplan`, 303 beim Einlösen, `Fällig bis` mit `2026-08-31` vorbelegt (Monatsende in der Zone), `Keine Aufgabe erkannt` und gesperrtes `Weiter` im leeren Zustand, genau **ein** `button-primary` im ausgelieferten Markup, das `<noscript>` ausgeliefert, und auf `/mehr` `Monatsplan ablegen` vor `Verwaltung`. Für die Prüfung lief der Server mit `--host` und mit `ORIGIN` auf der Netzwerkadresse, damit ein Versand vom Handy nicht am CSRF-Schutz scheitert; Veras Einladungslink wurde dafür neu ausgestellt, weil der Klartext des alten nirgends gespeichert ist. Dem User wurde eine neunpunktige Prüfliste vorgelegt (375px in Hell und Dunkel, Trefferfelder und Fokusring, die 24 aus 27 Zeilen, der Weg über `Weiter` bis `22 Aufgaben abgelegt.`, `Zurück zum Text`, der leere Prüfschritt, das geleerte Datumsfeld, über 100 Zeilen, zwei VoiceOver-Punkte, der Lauf ohne JavaScript). Wie bei allen Vorgängerstories erfolgte die Abnahme **ohne Angabe, welche der neun Einzelprüfungen im Detail ausgeführt wurden** — dasselbe Muster, das die Retrospektive zu Epic 1 schon als Schwäche benannt hat. Ausdrücklich **nicht** einzeln bestätigt sind damit die zwei Punkte, die die echte Unsicherheit tragen: **Punkt 8** (VoiceOver — ob der Schrittwechsel über die fokussierte Überschrift wirklich angesagt wird und ob das `×` als `<Zeilentext>, entfernen` gelesen wird; die Svelte-Schicht deckt in diesem Projekt kein ausgeführtes Werkzeug, dort hängt alles an Textprüfungen) und **NFR3** — ob das Übertragen eines realen Plans von 20 bis 40 Aufgaben tatsächlich weniger Aufwand ist als die Papier- oder Chat-Variante. NFR3 ist die eigentliche Abnahmebedingung dieser Story; ob dafür ein echter Monatsplan eingefügt wurde, ist nicht mitgeteilt worden. **Nicht** mit abgenommen ist weiterhin die Installation zum Home-Bildschirm aus Story 1.1.

## Deferred from: spec-2-2-ueberfaellige-aufgaben-erkennen (2026-08-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-ueberfaellige-aufgaben-erkennen.md`
  summary: `EXPERIENCE.md:79` und `:101` verweisen auf ein Token `{colors.warn}`, das es nicht gibt — das Token heisst `overdue`.
  evidence: Nachgesehen im Baum: `src/app.html` deklariert `--overdue` (hell `#9a5a12`, dunkel `#d99b4e`) und kein `--warn`; `DESIGN.md:248` schreibt für dieselbe Zeile richtig `{colors.overdue}`, und die Farbwerte in `epic-2-context.md` stimmen mit `--overdue` überein. Es sind zwei Stellen in `EXPERIENCE.md`: der Aufzählungspunkt zur überfälligen Aufgabenzeile (`:79`) und die Zeile `Überfällig` in der Zustandstabelle (`:101`); dieselbe Datei benutzt `{colors.warn}` daneben noch für „Dienstwoche unbesetzt" (`:102`), was Epic 3 betrifft und darum mitentschieden werden muss. **Hier nicht korrigiert**, und zwar nicht aus Bequemlichkeit: `epic-2-context.md` ist aus den Planungsartefakten kompiliert und trägt oben den Hinweis, dass es bei einer Änderung dort neu erzeugt werden muss — eine Korrektur in `EXPERIENCE.md` machte den Epic-Kontext, gegen den diese Story gebaut wurde, ungültig. Kein Zustand hängt daran: die gebaute Zeile benutzt `var(--overdue)`, und `gate` Regel 3 wies ein `var(--warn)` sofort ab. Ort: `_bmad-output/planning-artifacts/ux-designs/ux-Gartenplaner-2026-08-26/EXPERIENCE.md:79,101` (und `:102` für Epic 3).
- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-ueberfaellige-aufgaben-erkennen.md`
  summary: Die zweite Textzeile verändert die Zeilenhöhe auf `/`, und die Svelte-Schicht dieser Seite ist weiterhin von keiner ausgeführten Prüfung gedeckt.
  evidence: Derselbe Posten wie aus Story 1.4 (`deferred-work.md:50-52`), jetzt mit einem neuen Gegenstand. `npm run smoke` fährt `load`, beide actions und `offeneAufgabenAuflisten` mit fester Uhr aus und belegt jede Zeile der Überfälligkeitsmatrix; alles darüber ist ungeprüft. Neu dazugekommen ist eine Eigenschaft, die es vorher nicht gab: eine überfällige Zeile ist **höher** als eine frische, weil `.zeile__spalte` zwei Kinder mit `gap: var(--space-1)` trägt. Die Zusagen „Trefferfeld ≥ 44px ohne die Zeilenhöhe aufzublähen" (die negativen Aussenabstände an `.treffer`) und „das Kästchen bleibt am Anfang der **ersten** Textzeile" (`align-items: flex-start` an `.zeile`) hängen damit an einer Konstellation, die keine ausgeführte Prüfung sieht — sie tragen allein die manuelle Prüfung bei 375px in Hell und Dunkel. Fünf Zusagen der Story sind als **Textprüfung** in `smoke` gehalten: die Bedingung an `!istErledigt`, das `aria-describedby` im Formular mit `action="?/abhaken"` (und seine Abwesenheit im wiederOeffnen-Formular), die Reihenfolge im Spaltencontainer, der Rumpf von `.zeile__spalte` und der von `.zeile__frist`. Alle fünf beissen durch Mutation belegt — die letzten drei erst, nachdem zwei vorgeführte Mutationen (`aria-describedby` aufs falsche Kästchen, `{#if}`-Block über den Aufgabentext) grün durch die ganze Kette gelaufen waren; behoben, indem die Prüfungen über geschnittene Bereiche statt über die ganze Datei greifen. Sie prüfen aber weiter Text und nicht Verhalten. Stufe A des vierstufigen Vorschlags (ein zweites Prüfskript gegen einen echten Server) deckte die zwei HTML-Eigenschaften ab, Stufe C (kopfloser Browser) als Einziges die Zeilenhöhe und die VoiceOver-Ansage der Beschreibung.

## Deferred from: Review zu spec-2-2-ueberfaellige-aufgaben-erkennen (2026-08-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-ueberfaellige-aufgaben-erkennen.md`
  summary: Der Spaltencontainer ändert die Geometrie **jeder** Aufgabenzeile auf `/`, nicht nur der überfälligen — und die Geometrie selbst sieht kein ausgeführtes Werkzeug.
  evidence: `.zeile__text` ist seit dieser Story kein direktes Flexkind von `.zeile` mehr, sondern liegt in `.zeile__spalte`. Das gilt für alle Zeilen, auch für die ohne Frist. Zwei ältere Zusagen hängen daran: „Trefferfeld 44px, ohne die Zeilenhöhe aufzublähen" (die negativen Aussenabstände an `.treffer`) und „das Kästchen beginnt am Anfang der ersten Textzeile" (`align-items: flex-start` an `.zeile`). Der Review hat gemessen, dass ein Entfernen von `flex-direction: column` oder `min-width: 0` vor den Patches grün durchlief; seit Patch 3 beisst der Regelrumpf (nachgemessen: „fehlt: in Spaltenrichtung"). Was damit weiterhin **nicht** gedeckt ist, ist die gerenderte Geometrie — Höhe, Trefferfeld, die Lage des Kästchens bei zwei Textzeilen. Das trägt allein die manuelle Prüfung bei 375px in Hell und Dunkel. Stufe A (Prüfskript gegen einen echten Server) deckte die HTML-Struktur, erst Stufe C (kopfloser Browser) die Geometrie.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-ueberfaellige-aufgaben-erkennen.md`
  summary: Im ganzen Baum gibt es keine Umbruchregel — ein Aufgabentext aus einem einzigen langen Token läuft bei 375px seitlich hinaus.
  evidence: Vorbestehend und von dieser Story nicht verursacht, aber hier zum ersten Mal benannt. Eine Suche über `src/` nach `overflow-wrap`, `word-break` und `hyphens` findet nichts, und `AUFGABE_HOECHSTLAENGE = 200` erlaubt 200 Codepoints ohne ein einziges Leerzeichen. Vor dieser Story weitete ein solches Wort die Zeile (`min-width: auto` an `.zeile__text` als Flexkind), seit dieser Story läuft es aus dem Spaltencontainer (`min-width: 0`) — beides ist kaputt, nur anders. Der Kommentar an `min-width: 0` sagt seit Patch 14 ausdrücklich, dass ohne `overflow-wrap` nichts umbricht und dass hier bewusst keine Regel ergänzt wurde. Betrifft auch die Prüfliste auf `/monatsplan`, die dieselben Texte zeigt. Ort: eine geteilte Regel, vermutlich in `src/lib/styles/bedienelemente.css`, damit sie nicht pro Seite dupliziert wird.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-ueberfaellige-aufgaben-erkennen.md`
  summary: `seit N Wochen offen` zählt bei einer Planaufgabe die Wochen seit der **Fälligkeit**, nicht die, die die Aufgabe offen liegt — der Satz sagt etwas anderes, als er behauptet.
  evidence: Eine vor 60 Tagen angelegte Aufgabe mit Fälligkeit vor 25 Tagen zeigt `seit 3 Wochen offen`, obwohl sie seit 8,5 Wochen offen ist; die Matrixzeile der Spezifikation schreibt `3, nicht 8` sogar als richtig fest. Weil `due_at` in der Praxis immer nach `created_at` liegt, untertreibt der Satz systematisch — er übertreibt nie. **Nicht in dieser Story entschieden**, und zwar nicht aus Bequemlichkeit: der Wortlaut ist doppelt gebunden. Die Akzeptanzkriterien des Epics (`epics.md:412`) und `DESIGN.md:199` sowie `:248` schreiben `seit N Wochen offen` wörtlich vor, und die Zahl schreibt AD-8 mit `COALESCE(due_at, created_at)` wörtlich vor. Beide zu erfüllen heisst, die Doppeldeutigkeit zu erben. Die Umsetzung hält sie seit Patch 16 in Komponente und README ausdrücklich fest. Zu entscheiden ist eine Produktfrage: entweder der Satz heisst `seit N Wochen überfällig` (dann ändern sich Epic-AC, DESIGN.md und EXPERIENCE.md), oder die Untertreibung wird als gewollt abgenommen. Ort: `_bmad-output/planning-artifacts/ux-designs/ux-Gartenplaner-2026-08-26/DESIGN.md:199,248` und `EXPERIENCE.md:79,101`, dazu `epics.md:412`.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-ueberfaellige-aufgaben-erkennen.md`
  summary: Der 2.2-Prüfblock muss am Ende von `scripts/smoke-zugang.ts` stehen, und diese Bedingung hängt an einem Kommentar statt an einer Zusicherung.
  evidence: Der Block sät Zeilen mit `created_at` bis zu 60 Tage in der Vergangenheit. Weil `offeneAufgabenAuflisten` nach `created_at` aufsteigend sortiert, stellen sich diese Zeilen **vor** alles, was früher gesät wurde, und machen die vier Behauptungen mit exakten Id-Ketten rot (`smoke-zugang.ts` bei den Sortier- und Reihenfolgeprüfungen der Stories 1.4 und 1.5). Heute stimmt es, weil der Block der letzte ist; wer die nächste Story anhängt, tappt in dieselbe Falle, und die Fehlermeldung zeigt dann auf eine fremde Story. Zwei Auswege: die gesäten Zeilen am Blockende wieder löschen, oder die älteren Reihenfolgebehauptungen so fassen, dass sie nur ihre eigenen Ids vergleichen — der 2.2-Block tut Letzteres schon (`gesäteIds`). Ort: `scripts/smoke-zugang.ts`, der Story-2.2-Block und die Reihenfolgebehauptungen der Stories 1.4 und 1.5.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-ueberfaellige-aufgaben-erkennen.md`
  summary: ERLEDIGT — die visuelle Prüfung von Story 2.2 ist am 2026-08-28 erfolgt und abgenommen ("Ok, das passt, habs jetzt gesehen wie es funktioniert").
  evidence: Maschinell belegt waren vorher `npm run lint`, `npm run check`, `npm run db:check` und `npm run build` mit Exit 0 über 374 ausgeführte Behauptungen; jede neue Zusage ist durch eine Mutationsprobe rot belegt, darunter die zwei Prüflücken, die der Review vorgeführt hatte (`aria-describedby` am falschen Kästchen, zweite Textzeile über dem Aufgabentext) — beide vom Koordinator eigenhändig nachgemessen. Am laufenden Entwicklungsserver gegen `data/dev.sqlite` gemessen: neun gesäte Zeilen deckten die Schwelle (21 Tage exakt ohne Zeile, eine Stunde darüber mit `seit 3 Wochen offen`), den Vorrang von `due_at` über `created_at` (25 Tage Frist bei 60 Tagen Alter ergibt 3 und nicht 8), die Monatsplan-Ausnahme, den ungekappten Extremwert (`seit 42 Wochen offen`) und einen langen Text über mehrere Zeilen. Der User hat zusätzlich über `/monatsplan` selbst eine Planaufgabe mit Fälligkeit 2026-07-01 angelegt und `seit 8 Wochen offen` in der Liste gesehen. **Aus der Prüfung entstand eine Produktfrage, die er entschieden hat:** eine Planaufgabe mit Frist in der jüngeren Vergangenheit trägt bewusst keinen Hinweis, weil die Schwelle drei Wochen ist und nicht das Fälligkeitsdatum — nachgewiesen an 5, 19 und 25 Tagen Überschreitung. Er hat das so abgenommen, die Schwelle bleibt unverändert. Der ursprüngliche Verdacht kam von zwei Testzeilen mit der Vorbelegung 31.08.2026, die drei Tage in der Zukunft liegt. **Ausdrücklich NICHT einzeln bestätigt** sind die Punkte der sechsteiligen Prüfliste, die die Barrierefreiheit tragen: der dunkle Modus bei 375px, das Trefferfeld von 44px bei der jetzt zweizeiligen Zeile, die Beurteilung des Höhensprungs beim Abhaken, **VoiceOver** (ob das Kästchen weiterhin `<Aufgabentext>, erledigen` heisst und `seit N Wochen offen` als Beschreibung und nicht als Namensteil kommt) und die Lesbarkeit bei ausgeschalteter Farbdarstellung. VoiceOver trägt davon die echte Unsicherheit, weil die Svelte-Schicht in diesem Projekt von keinem ausgeführten Werkzeug gedeckt ist und dort alles an fünf Textprüfungen hängt. Der Handy-Test wurde ausdrücklich verschoben ("Handy test lassen wir aktuell"). Damit wiederholt sich das Muster, das die Retrospektive zu Epic 1 und der Abnahmeeintrag zu Story 2.1 schon benannt haben: abgenommen wird die sichtbare Funktion, nicht die Barrierefreiheit.

## Entschieden am 2026-08-28 (Triage vor Epic 3)

Fünf Entscheide, die die Triage als „kann niemand durch Lesen von Code auflösen" ausgewiesen
hatte, sind gefallen. Anderes Format als die Einträge oben, weil es ein anderer Gegenstand ist:
dort steht, was zurückgestellt wurde, hier, was entschieden ist. Die Einträge oben bleiben als
Protokoll unverändert stehen.

- entscheid: `Fällig bis` bekommt ein **Fenster von einem Jahr in jede Richtung**, hart abgewiesen.
  betrifft: Eintrag 31 (Zeile 107)
  begruendung: „Nur warnen" ist die schlechteste Fassung — eine wegklickbare Warnung auf der
    einzigen Handlung ohne Rückgängig. „Vergangenheit hart abweisen" bricht das Nachtragen eines
    laufenden Monats. Das Fenster tut beides nicht und fängt trotzdem jeden plausiblen Vertipper
    (`1990`, `2016`, `2062` liegen alle draussen). Symmetrisch, obwohl der Schaden es nicht ist —
    eine Frist ein Jahr zurück legt bis zu 100 sofort überfällige, unentfernbare Aufgaben an, eine
    ein Jahr vor ist bloss sinnlos; zwei Grenzen mit zwei Sätzen wären der teurere Weg zum selben
    Ergebnis, und die Asymmetrie gehört in den Kommentar.
  umsetzung: Konstante nach `src/lib/zeit.ts` neben `UEBERFAELLIG_SEKUNDEN` — auch das ist eine
    Produktentscheidung, die dort schon steht. Prüfung direkt hinter die bestehende
    `faelligAm === null`-Prüfung in `src/routes/monatsplan/+page.server.ts`: gleiches Feld, gleicher
    Platz in der Kette, ein zusätzlicher Satz. `min`/`max` am Feld ist die Bequemlichkeit, die
    action bleibt die Instanz — dasselbe Verhältnis wie `maxlength` zu `AUFGABE_HOECHSTLAENGE`.
  status: entschieden, Umsetzung offen

- entscheid: Der Satz heisst **`seit N Wochen überfällig`**, nicht `seit N Wochen offen`.
  betrifft: Eintrag 39 (Zeile 137)
  begruendung: Entscheidet sich an der Wahrheit, nicht am Geschmack. `offen` ist bei einer
    Planaufgabe falsch — die vor 60 Tagen angelegte Aufgabe mit Frist vor 25 Tagen ist seit 8,5
    Wochen offen, nicht seit 3. `überfällig` ist in **beiden** Fällen wahr: bei der Planaufgabe
    seit der Fälligkeit, bei der Ad-hoc-Aufgabe seit der Anlage, die laut AD-8 die Ersatzfrist
    **ist**. Der Einwand, `überfällig` klinge anklagender, trägt nicht: den Ton tragen das
    Lehmbraun, das fehlende Abzeichen, die unveränderte Sortierung und die fehlende Eskalation.
    Und das System nennt die Sache ohnehin überall so — AD-8, der Story-Titel, das Token
    `--overdue`; nur in dem einen Satz, den eine Gärtnerin liest, hiess sie anders. Zweitbeste
    Fassung wäre `seit N Wochen fällig` gewesen — ebenfalls in beiden Fällen wahr und ruhiger;
    `überfällig` gewinnt, weil Code und Oberfläche dieselbe Sache gleich nennen sollen.
  umsetzung: Plandokumente sind **nachgezogen** (`epics.md:81,412`, `DESIGN.md:199,248`,
    `EXPERIENCE.md:64,79,101,154`, `mockups/startseite.html`). Der Code hinkt bewusst hinterher und
    ist als Aktionspunkt geführt: eine gerenderte Zeichenkette (`+page.svelte:391`), eine Prüfung
    (`smoke-zugang.ts:4165`) und rund 20 Prosastellen in `zeit.ts`, `+page.svelte`, `README.md` und
    `smoke`, die über das Wort **argumentieren** und darum mitgeschrieben und nicht ersetzt werden.
  status: entschieden, Plandokumente nachgezogen, Code offen

- entscheid: **Stufe A wird gebaut**, als eigene Story vor Epic 3. **Stufe C nicht** — und ihre
    Auslösebedingung wird neu gefasst.
  betrifft: Eintrag 15 (Zeile 53), und über ihn die Einträge 5, 9, 17, 29, 36, 37
  begruendung: Stufe A verletzt NFR13 nicht — dieselbe Bauform wie die bestehenden Skripte, reines
    Node, keine neue Abhängigkeit, `pruefen`/`pruefenGleich`/`wegwerfVerzeichnis` wiederverwendbar.
    Sie schliesst vier Posten auf einmal und **misst** den 303-Pfad, statt ihn von der Attrappe
    entscheiden zu lassen. Sie war vor Epic 2 empfohlen, und die Belege seither machen den Fall
    stärker: in Story 2.2 liefen zwei Prüflücken grün durch die ganze Kette, bis der Review sie
    vorführte. Die schwache Schicht dieses Projekts sind Textprüfungen über Quelltext, und genau
    die ersetzt Stufe A für eine ganze Klasse durch Messung.
    Stufe C widerspricht einer ausdrücklichen Stack-Entscheidung und kostet einen Sprung statt
    eines Schritts. Ihre bisherige Bedingung („ab zwei Bestätigungsdialogen") stimmt zudem nicht
    mehr: die tatsächlich ungedeckte Klasse ist seit Story 2.2 die **Geometrie** — Zeilenhöhe,
    44px-Trefferfeld bei zweizeiliger Zeile, Lage des Kästchens —, und das ist kein Dialogproblem.
    Stufe A deckt sie ebenfalls nicht.
  neue_ausloesebedingung: Stufe C kommt, wenn eine Geometrie- oder Fokuszusage im Betrieb bricht,
    oder wenn Barrierefreiheit **abgenommen** statt mitgenickt werden soll. Bis dahin tragen diese
    Zusagen die manuelle Prüfung — und die gehört dann einzeln benannt (Retro-Punkt 15).
  umsetzung: Stufe B braucht keinen eigenen Entscheid: sie war „beim nächsten Anfassen von
    `/verwaltung`" fällig, und Retro-Punkt 1 fasst `/verwaltung` an. Sie reitet mit.
  status: entschieden, Stufe A als Story offen

- entscheid: Die **80 Zeichen und das Aussieben** sind abgenommen. **Kein Reaktivieren, kein Undo**
    ist abgenommen. **Kein Umbenennen** ist ab Story 3.1 nicht mehr tragbar.
  betrifft: Eintrag 11 (Zeile 40), der seit Story 1.3 `status: dem User vorzulegen` trug
  begruendung: Die 80 und das Aussieben sind das Minimum, das eine unlesbare Mitgliedszeile
    verhindert, spiegeln die Regel für Aufgabentexte und liegen weit über jedem realen Namen. Die
    Unumkehrbarkeit des Widerrufs ist der Grund, warum „Zugang beenden" etwas bedeutet, und der
    Korrekturweg kostet eine Nachricht in der Gartengruppe.
    Beim Umbenennen ändert Epic 3 die Rechnung, und nur dieser Teil erzwingt eine Antwort: heute
    steht ein vertippter Name in der Mitgliederliste, die nur Adminpersonen sehen; ab Story 3.1
    steht er im Dienstplan vor allen, jede Woche, drei Monate im Voraus (`epics.md:434-436`). Der
    Korrekturweg „beenden und neu aufnehmen" nähme der Person zugleich ihre künftigen
    Dienstwochen, die dann auf `— unbesetzt —` fallen.
  umsetzung: In `epics.md` bei den Implementierungshinweisen zu Epic 3 als Vorbedingung
    festgehalten. Eine kleine `umbenennen`-action auf `/verwaltung`, vor oder mit Story 3.1 — neue
    Arbeit und kein freier Handgriff. Mit ihr bekommt die Namensprüfung eine dritte Wurfstelle,
    und Epic-1-Punkt 3 (`scripts/create-admin.ts`) gehört im selben Zug erledigt.
  status: entschieden, Plandokument nachgezogen, Umsetzung offen

- entscheid: Ein Wurf in einer action wird **abgefangen** — einheitlich auf allen vier Seiten, mit
    einem generischen Satz in der bestehenden Live-Region. Der Wurf erreicht `handleError` weiter.
  betrifft: Eintrag 32 (Zeile 110)
  begruendung: Nachgemessen am Stand `aac97e1`: **kein einziger** der vier `use:enhance`-Rückrufe
    behandelt `result.type === 'error'` (`+page.svelte:187`, `aufgabe:58`, `verwaltung:161`,
    `monatsplan:324` rufen alle nur `update()`), und die Live-Region samt Fehlersatz steht auf
    allen vier Seiten schon. Es fehlt nicht der Mechanismus, sondern die Führung des einen Falls.
    „Nur unter einem Datenbankfehler erreichbar" ist zu beruhigend: `SQLITE_BUSY` unter WAL mit
    zwanzig Leuten und eine volle Platte auf einem kleinen VPS sind die klassischen zwei.
    Der Schaden ist pro Seite verschieden — auf `/` ein Klick, auf `/monatsplan` vierzig gerade
    übertragene Zeilen —, der Mechanismus ist es nicht. Darum **eine** Regel für alle vier: vier
    Seiten mit drei Fassungen wären genau die `abweisen`-Drift, die die Retrospektive als D2 führt.
  umsetzung: Der Satz muss generisch sein — ein Datenbankfehler hat für die lesende Person keine
    Bedeutung — und darf den Wurf nicht schlucken. Die Fehlergrenze behält ihre Aufgabe für alles,
    was keine Formularübermittlung ist. Es sind auf jeder Seite dieselben fünf Zeilen; damit ist es
    derselbe Durchgang, in dem die vier `abweisen`-Signaturen zusammengehen (Retro-Punkt 3).
  status: **erledigt am 2026-08-29.** `VERSAND_FEHLGESCHLAGEN` in `src/lib/texte.ts`, abgefangen in
    allen vier `use:enhance`-Rückrufen; der Satz landet in der Live-Region, die auf jeder der vier
    Seiten schon stand. Der Satz sagt ausdrücklich **nicht**, dass nichts entstanden sei — auf
    `/verwaltung` wäre das falsch, wenn `aufnehmen` nach `mitgliedAnlegen` abbricht —, sondern
    schickt zum Nachsehen. Belegt: `smoke` behauptet alle vier Rückrufe zugleich, und die Gegenprobe
    (`if (false)` statt der Bedingung auf `/monatsplan`) macht sie rot. Zusammen mit den vier
    `abweisen`-Signaturen umgesetzt, wie hier vorgesehen.

**Nebenbei geschlossen:** `EXPERIENCE.md:79` und `:101` verwiesen auf ein Token `{colors.warn}`,
das es nicht gibt (Eintrag 35, Zeile 122). Beide Zeilen wurden für den Wortlaut ohnehin angefasst
und tragen jetzt `{colors.overdue}` — es war dort nie eine Frage, `DESIGN.md:248` schreibt es seit
je richtig. **Offen bleibt allein `:102`** („Dienstwoche unbesetzt" in `{colors.warn}`): ob
„unbesetzt" dasselbe Token trägt wie „überfällig" oder Epic 3 ein eigenes `--warn` bekommt, ist
eine Gestaltungsfrage und muss vor Story 3.1 beantwortet werden.

## Entschieden am 2026-08-28 (Nachtrag): das Token für „Dienstwoche unbesetzt"

- entscheid: **Fassung B — ein eigenes Token `--warn` in einem Orangeton.** Name: **Ringelblume**,
    `#A05300` hell / `#FFA857` dunkel. Damit ist Eintrag 35 vollständig geschlossen.
  betrifft: Eintrag 35 (Zeile 122), letzter offener Teil `EXPERIENCE.md:102`
  begruendung: Zwei Quellen widersprachen sich über eine Farbe für einen Zustand — die
    Akzeptanzkriterien schrieben Lehmbraun, die Erlebnisbeschreibung ein `{colors.warn}`, das es
    nirgends gab. Entschieden ist damit, dass „unbesetzt" **nicht** dieselbe Farbe trägt wie
    „überfällig": es sind zwei verschiedene Aussagen. Überfällig heisst, dass etwas liegt;
    unbesetzt heisst, dass eine Lücke da ist, die jemand schliessen muss. Rot bleibt dem
    Zerstörenden vorbehalten, also kein `--danger`.
  gemessen: Die Trennschärfe ist **im Hellen schwach, und das ist nachgerechnet und hingenommen.**
    `#A05300` und `#9A5A12` liegen bei 1.07:1 zueinander — nahezu ununterscheidbar. Das ist keine
    schlechte Wahl, sondern Physik: jedes Orange, das auf Weiss 4.5:1 erreicht, muss dunkel sein,
    und dunkles Orange **ist** Lehmbraun. Der ganze Unterschied ist die Sättigung (100% gegen 79%).
    Im Dunkeln trennen sie sich besser: 1.26:1, spürbar heller und satter.
    Es trägt trotzdem, aus zwei Gründen, die beide im Baum stehen: die zwei Zustände kommen **nie
    auf derselben Seite** vor — Überfälligkeit auf `/`, Unbesetztheit auf `/dienstplan` —, und wie
    überall in diesem Produkt trägt das **Wort** die Aussage: `— unbesetzt —` steht auch ohne jede
    Farbe da.
    Kontrast: hell 5.63:1 auf `--surface-raised` und 5.11:1 auf `--surface-base`; dunkel 8.70:1
    und 9.58:1. Beide Modi über 4.5:1, beide mit Reserve.
  umsetzung: Vollständig nachgezogen. `DESIGN.md` trägt `warn`/`warn-dark` im Token-Block, den
    Ringelblume-Absatz in der Farbprosa und zwei neue Zeilen in der Kontrasttabelle;
    `epics.md` sagt in der Story-3.1-Akzeptanz jetzt Ringelblume statt Lehmbraun;
    `EXPERIENCE.md:102` war schon richtig und stimmt ab jetzt auch. `src/app.html` deklariert
    `--warn` in **beiden** Blöcken mit den gemessenen Werten im Kommentar — nach demselben Muster,
    nach dem `--overdue` seit Story 1.1 dort stand, bevor Story 2.2 es benutzte.
  folge: `npm run gate` gibt jetzt **2 Hinweise statt 1** (`--warn` und `--border-marker` sind
    deklariert und unbenutzt). Das ist genau der Zweck von Regel 8 — „für eine spätere Story
    reserviert" — und fällt mit Story 3.1 wieder auf 1. Das Akzeptanzkriterium aus Story 2.2, das
    den Fall von 2 auf 1 verlangte, ist davon unberührt; es galt für seinen eigenen Stand.
  status: entschieden und umgesetzt

## Erledigt am 2026-08-28 (Nachtrag): B1 — die Reihenfolgefalle in `smoke-zugang.ts`

- betrifft: Eintrag 40 (Zeile 141), Bucket B1 der Triage
  fassung: Die **zweite** der beiden im Eintrag genannten Auswege — die älteren
    Reihenfolgebehauptungen vergleichen nur noch ihre eigenen Ids, so wie der 2.2-Block es über
    `gesaeteIds` schon tat. Nicht der erste (gesäte Zeilen am Blockende löschen): der hätte die
    Zusicherung an ein Aufräumen gehängt, das jeder neue Block wieder vergessen kann.
  umsetzung: `offeneReihenfolge` nimmt einen zweiten, optionalen Parameter `nurIds` und schneidet
    die Antwort darauf zu. Die Ids stehen als `dreiGesaete` (Story 1.4) und `fuenfGesaete`
    (dieselben plus die zwei Zwillinge) je direkt bei ihrem Säen; die Kette aus Story 1.5 hängt
    die neu abgelegte Aufgabe an. Sechs Behauptungen umgestellt, keine hinzugefügt und keine
    entfernt — `ERWARTETE_BEHAUPTUNGEN` bleibt bei 373.
  belegt: Nicht behauptet, sondern zweimal ausgeführt. Eine Probezeile mit `created_at` 60 Tage in
    der Vergangenheit, mitten in den 1.4-Block gesät: **vor** der Umstellung fünf rote
    Behauptungen (`war "4 | 2 | 3 | 1", erwartet "2 | 3 | 1"` und vier weitere derselben Art),
    **nach** der Umstellung alle grün. Die Probezeile ist danach wieder entfernt; sie war das
    Beweismittel, nicht der Zustand.
  folge: Die Endposition des 2.2-Blocks trägt nichts mehr. Sein Kopfkommentar sagt das jetzt
    ausdrücklich, statt eine Bedingung zu behaupten, die es nicht mehr gibt: **wer in Epic 3 einen
    Block anhängt oder dazwischenschiebt, tappt nicht mehr hinein.** Was die Ketten weiterhin rot
    macht, ist eine eigene Zeile an falscher Stelle oder eine fehlende — also genau das, was sie
    zusagen. Dass eine fremde Zeile dazwischensteht, ist keine gebrochene Zusage mehr.
  status: erledigt

## Aufgesetzt am 2026-08-28: Stufe A ist jetzt Story 3.0

- betrifft: Eintrag 15 (Zeile 53, Stufe A), und über sie Eintrag 5 sowie die Klasse A aus den
    Einträgen 9 und 17
  fassung: Der Vorschlag stand seit Story 1.3 als Prosa in diesem Protokoll und war „als eigene
    Story vor Epic 2" empfohlen — Epic 2 ist durch, die Empfehlung war verstrichen. Er steht jetzt
    als **Story 3.0** in `epics.md` mit sieben Given/When/Then-Blöcken: freier Port, Wegwerf-
    Datenbank, Aufräumen auch im roten Fall, keine neue Abhängigkeit, geteilte Prüfhelfer, der 303
    und das `Set-Cookie` an der echten Antwort, die 403 byte-gleich mit `src/error.html` samt
    `Referrer-Policy`, das ausgelieferte HTML von drei Seiten ohne aufgebrochenen Kommentar,
    unersetzten Platzhalter oder Token-Hash, die Adminweiche über HTTP, jede Behauptung durch
    Mutation belegt und ein Platz in der `lint`-Kette hinter `smoke`.
  abgrenzung: Stufe B und Stufe C sind ausdrücklich **nicht** enthalten. Stufe C bleibt an ihre
    eigene Auslösebedingung gebunden (zweite Bestätigung mit Sicherheitszusage, Story 3.2) und ist
    eine Stack-Entscheidung, die dem User gehört.
  status: aufgesetzt, Umsetzung offen
- source_spec: `_bmad-output/implementation-artifacts/spec-3-0-das-ausgelieferte-html-gegen-einen-echten-server-pruefen.md`
  summary: `LAUFZEIT_SEKUNDEN` aus `src/lib/server/auth.ts` exportieren, damit die zwei Prüfskripte die Jahreslaufzeit nicht abschreiben müssen.
  evidence: `scripts/smoke-zugang.ts` führt ein eigenes `EIN_JAHR`, `scripts/smoke-http.ts` ein eigenes `LAUFZEIT_SEKUNDEN` — beide mit dem Wert `60 * 60 * 24 * 365`, beide als Kommentar an `auth.ts` gebunden und von nichts geprüft. Dasselbe Argument, mit dem `KEIN_ZUGANG` bewusst importiert statt abgeschrieben wird, gilt hier gegen den eigenen Code: wer die Laufzeit in `auth.ts` ändert, bekommt zwei rote Behauptungen, die nichts über die Anwendung sagen. Die Konstante ist dort modulprivat; sie zu exportieren ist eine Zeile, gehört aber an **beide** Prüfskripte zugleich. Aufgefallen in der Blind-Hunter-Schicht der Review zu Story 3.0.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-0-das-ausgelieferte-html-gegen-einen-echten-server-pruefen.md`
  summary: Die Skripttabelle in `README.md` sagt „neun Regeln" für `gate` und `gate:selftest`, das Tor führt inzwischen dreizehn.
  evidence: `npm run gate:selftest` meldet selbst „27 Fehlerproben gegen die dreizehn Regeln"; die Regeln 10, 11 und 12 sind in Story 1.3 und 1.4 dazugekommen, die Tabellenzeilen wurden nie nachgezogen. Vorbestehend und nicht von Story 3.0 verursacht — dort aufgefallen, weil dieselbe Tabelle um `smoke:http` und `smoke:selftest` ergänzt wurde. Zwei Wörter, aber die Zahl gehört gegen die tatsächliche Regelliste geprüft und nicht geraten.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-0-das-ausgelieferte-html-gegen-einen-echten-server-pruefen.md`
  summary: Vier Fehlerklassen der Zugangsschicht sind über HTTP weiterhin ungemessen — verfälschtes Cookie, widerrufenes Mitglied, zweites Einlösen desselben Tokens, `/verwaltung` ganz ohne Cookie.
  evidence: `smoke:http` misst den gültigen Weg und die zwei 403-Wurfstellen. Nicht gemessen sind: ein manipuliertes oder abgelaufenes Sitzungscookie (die JWT-Signaturprüfung wird über HTTP nie berührt), ein Mitglied, das nach dem Einlösen deaktiviert wird (der Wächter schlägt bei jedem Aufruf frisch nach — die Zusage „ein Widerruf wirkt sofort" ist nur an der Attrappe belegt), das zweite Einlösen desselben Tokens auf einem weiteren Gerät, und die Reihenfolge von Wächter und Adminweiche auf `/verwaltung` ohne Cookie. Alle vier sind in `scripts/smoke-zugang.ts` direkt an den Modulen belegt und darum nicht ungedeckt, aber nicht am ausgelieferten Server. Je eine Anfrage; die Akzeptanzkriterien von Story 3.0 fragen sie nicht. Aufgefallen in der Blind-Hunter-Schicht.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-0-das-ausgelieferte-html-gegen-einen-echten-server-pruefen.md`
  summary: `GUTES_GEHEIMNIS` steht in `smoke-zugang.ts` und `smoke-http.ts` getrennt, obwohl `pruefhelfer.ts` gerade gegen solche Doppel angelegt wurde.
  evidence: Zwei verschiedene Zeichenketten mit demselben Zweck — ein Wert, der `sitzungsgeheimnisPruefen()` besteht. Die Verdopplung ist harmlos (die Werte müssen sich nicht decken, und ein Prüfgeheimnis ist kein Gestaltungswert), fällt aber auf, seit die anderen geteilten Stücke an einem Ort liegen. Wenn es angefasst wird, dann zusammen mit der Frage, ob `pruefhelfer.ts` überhaupt Projektwissen tragen darf — heute ist es ausdrücklich frei von Projektimporten, und genau das macht es von nacktem Node ladbar.

## Erledigt am 2026-08-29: die vier Posten „jetzt beheben" aus der Retrospektive zu Epic 2

Ein Durchgang, vier Posten, weil sie dieselben Dateien anfassen — D1 und D2 waren in der
Retrospektive ausdrücklich als **ein** Durchgang disponiert, und der Entscheid zu Eintrag 32 hängt
sich mit derselben Begründung an. Betroffen sind die Retro-Punkte 2, 4, 9, 10 (Epic 1) und 15, 16,
17, 18, 35 (Epic 2).

- betrifft: Einträge 27 und 38 (Zeilen 95, 134), Bucket B3 der Triage, sowie Retro-Befund D1
  fassung: Die Seitenform — `.seite`, `.seitentitel`, `.fehler`, `.live:empty` — liegt jetzt in
    `src/lib/styles/bedienelemente.css` und in **keiner** Komponente mehr. Sechs Kopien von
    `.seitentitel`, fünf von `.seite` und je vier der anderen zwei sind auf je eine geschmolzen.
    Der Gap-Drift ist zugunsten von `--space-4` aufgelöst; `/verwaltung` stand als einzige Seite
    auf `--space-5`, ohne dass irgendwo ein Grund dafür stand.
  mitgenommen: Eintrag 38 — die fehlende Umbruchregel. `overflow-wrap: anywhere` an `.zeile__text`
    steht im selben Stilblatt, weil derselbe Aufgabentext auf `/` und in der Prüfliste von
    `/monatsplan` erscheint und beide ihn gleich brechen müssen. Der Kommentar an `min-width: 0`
    in `+page.svelte` sagt jetzt, dass die zwei zusammengehören, statt dass eine Regel fehlt.
  belegt: `smoke` behauptet je Selektor „genau einmal, im geteilten Stilblatt" und nennt im roten
    Fall die Fundstellen. Gegenprobe ausgeführt: eine wiedereingesetzte `.seite`-Regel in
    `/mehr` macht die Behauptung rot und zeigt beide Pfade.
  status: erledigt

- betrifft: Retro-Befund D2, Epic-1-Punkt 10 und Epic-2-Punkt 17
  fassung: `abweisen` steht in `src/lib/server/abweisen.ts` und hat eine Signatur
    `(meldung, feld?, eingabe?)`. Vorlage war `/monatsplan`, um den Rückweg der Eingabe erweitert,
    den `/aufgabe` und `/verwaltung` brauchen. `feld` ist generisch, damit die ActionData jeder
    Seite weiterhin genau ihre eigenen Feldnamen trägt und ein Tippfehler im Markup ein Typfehler
    bleibt. `nameEingabe` heisst überall `eingabe`.
  preis: Zwei Seiten lassen zwei der drei Angaben leer — `/` hat kein Feld und keine Eingabe,
    `/monatsplan` hält seinen Text im `$state`. Das ist benannt und abgenommen: eine leere Angabe
    kostet ein Feld in der Nutzlast, eine eigene Signatur kostet die nächste Drift.
  belegt: `smoke` behauptet die drei Hälften zusammen (Modul, keine eigene Form je Seite, alle vier
    ziehen aus dem Modul). Gegenprobe ausgeführt: eine wieder lokal erklärte `abweisen`-Form in
    `/monatsplan` macht sie rot.
  status: erledigt

- betrifft: Retro-Befund M2, Epic-1-Punkt 2 und Epic-2-Punkt 15
  fassung: Der Satz am Namensfeld auf `/verwaltung` steht **immer** im Markup, mit `role="alert"`
    und `aria-live="assertive"` — dieselbe Bauform wie der Fehlersatz auf `/monatsplan`, der in
    Epic 2 als Muster festgehalten wurde. Das `aria-describedby` am Feld bleibt bedingt: eine
    Beschreibung, die auf ein leeres Element zeigt, sagt nichts.
  belegt: `smoke` behauptet es wortgleich zur bestehenden Behauptung über `/monatsplan`.
    Gegenprobe ausgeführt: zurück hinter ein `{#if}` und ohne `aria-live` macht sie rot.
  status: erledigt

- betrifft: Retro-Befund S4, Epic-1-Punkt 4 und Epic-2-Punkt 18
  fassung: Die zehn Zeilen Entwicklerprosa in `src/app.html` sind fort. Gate-Regel 12 hat eine
    zweite Hälfte bekommen: **kein interner Pfad in einem Kommentar der ausgelieferten Hülle**, in
    HTML- wie in CSS-Kommentaren. Der Pfad ist das Merkmal, das eine Erklärung für Entwickelnde von
    einer Notiz am Markup unterscheidet, und er ist mechanisch fassbar — die Begründung an
    `viewport-fit=cover` darf bleiben. Vier weitere Fundstellen fielen dabei auf und sind
    mitgenommen (drei in `app.html`, eine in `error.html`).
  wohin damit: Der Sachverhalt jenes Kommentars — warum in `app.html` kein `title`-Element steht
    und warum jede Seite ihren Titel selbst setzt — steht jetzt im Regelkopf von `scripts/gate.mjs`
    und in `README.md`, also dort, wo ihn liest, wer ihn braucht.
  belegt: Zwei neue Proben im `gate:selftest`, `regel-12b-pfad-im-kommentar` (2 von 2) und die
    Gegenprobe `regel-12b-pfad-ausserhalb` (0 von 0, mit einem Pfad im Attributwert und einem im
    sichtbaren Text). 29 Fehlerproben statt 27.
  nebenbei: Die Skripttabelle in `README.md` sagte „neun Regeln" für `gate` und `gate:selftest` und
    sagt jetzt dreizehn — der letzte Eintrag dieser Datei, im selben Zug geschlossen.
  status: erledigt

**Nicht mitgenommen, obwohl die Dateien offen waren:** die CSS-Kommentare im Token-Block von
`src/app.html` gehen mit rund 5 100 Zeichen ebenfalls an jeden Besucher. Sie tragen die Begründung
zu jedem Token unmittelbar am Wert, und sie zu verlagern ist ein Abwägen zwischen ausgelieferten
Bytes und dem Ort des Gestaltungsprotokolls — eine Entscheidung, keine Nacharbeit. Hier nur
gemessen festgehalten. Die neue Regelhälfte fasst sie nicht, weil sie keine internen Pfade mehr
nennen.

## Erledigt am 2026-08-29 — Story 3.0.1

- betrifft: Eintrag 11 (Zeile 41, „Kein Umbenennen, kein Reaktivieren, kein Undo-Fenster") und
    seinen Entscheid vom 2026-08-28, dazu Epic-1-Punkt 3 und Epic-2-Punkt 19
    (`scripts/create-admin.ts`)
  fassung: `/verwaltung` hat eine `umbenennen`-action, inline je aktiver Mitgliedszeile und ohne
    modalen Dialog. Sie ist **kein** Zugangsvorgang: Id, `invite_token_hash`, `is_admin`,
    `is_active` und `created_at` bleiben unberührt, es ist ein `UPDATE` derselben Zeile. Die
    **eigene** Zeile darf umbenannt werden, anders als bei Neuausstellen und Widerrufen — ein Name
    ist kein Zugang. Die Namensregel ist nach `src/lib/mitgliedsname.ts` gezogen, wortgleich und
    ohne Neufassung, und hat jetzt drei Leser statt einer Kopie: `aufnehmen`, `umbenennen` und
    `scripts/create-admin.ts`. Damit ist auch die auseinandergelaufene Kopie im Admin-Skript
    geschlossen, die einen Namen aus reinen Nullbreiten-Zeichen durchliess.
  bleibt offen und ist Absicht: **kein Reaktivieren** eines beendeten Zugangs, **kein Undo** eines
    Umbenennens und **keine Historie** der alten Namen. Die Unumkehrbarkeit des Widerrufs ist der
    Grund, warum „Zugang beenden" etwas bedeutet; die zwei anderen stehen weiterhin unter
    `Ask First` und sind in `README.md` unter den benannt akzeptierten Risiken beschrieben. Ebenso
    unverändert: **keine Eindeutigkeitsbedingung** auf `name`, zwei Mitglieder dürfen gleich
    heissen.
  belegt: `smoke` (418 Behauptungen) und `smoke:http` (79). Ausgeführt sind Gelingen samt dem
    Abdruck der ganzen Zeile ausser der Namensspalte, die eigene Zeile, der unveränderte Name als
    Erfolg, die drei untauglichen Namen je mit Marke, Eingabe und **Zeilennummer** in der Antwort,
    die vier nicht ansprechbaren Zustände über alle drei Zeilen-actions, die Adminschranke und der
    Abbruch von `create-admin` **vor** `datenschichtStarten`. Der Pfad ohne JavaScript ist am
    gebauten Server gemessen, in beide Richtungen: `smoke:http` schneidet jedes ausgelieferte
    Umbenennen-Formular einzeln aus und prüft `method="POST"`, die literale `action`, das Feld, die
    versteckte Zeilen-Id und den Absendeknopf — und schickt einen echten POST mit untauglichem Namen
    ab, dessen Antwort mit `400`, genau **einem** aufgeklappten `<details>`, der verworfenen
    Eingabe, `aria-invalid` und dem Satz in der Live-Region **dieser** Zeile gemessen wird.
    Einundzwanzig Mutationen sind eingespielt und rot gesehen; sie stehen in der Tabelle in
    `README.md`. Die zwei letzten stammen aus der Review nach der Umsetzung — `open={fehlerHier}`
    entfernt und der Zeilenbezug am Satz entfernt liefen beide grün durch die ganze Kette, und
    ausgerechnet die stärkste Zusage der Story hing damit an nichts.
  status: erledigt

## Zurückgestellt aus Story 3.0.1

- source_spec: `_bmad-output/implementation-artifacts/spec-3-0-1-umbenennen-auf-verwaltung.md`
  summary: Verlorene Änderung — ein veralteter Tab kann eine neuere Umbenennung unbemerkt zurückdrehen.
  evidence: Die action schreibt den Namen aus dem abgeschickten Formular, ohne zu prüfen, welchen Stand die Seite gesehen hat. Wer `/verwaltung` in einem zweiten Tab offen hat, dort das Formular aufklappt und nach einer Umbenennung im ersten Tab abschickt, überschreibt den neueren Namen mit dem älteren — ohne Hinweis, weil das `UPDATE` gelingt. Zwei gleichzeitige Adminpersonen gibt es heute nicht (Adminrechte vergibt allein `scripts/create-admin.ts`, und nur für das erste Mitglied), der eigene veraltete Tab sehr wohl. Ein Mittel wäre ein mitgeschicktes `created_at` oder der alte Name als Bedingung im `UPDATE`, mit dem Satz über das nicht ansprechbare Mitglied als Ausgang — dieselbe Bauform, mit der `abhaken` in Story 1.4 das Wettrennen zweier Abhakender in der `where`-Klausel entscheidet. Zurückgestellt, weil der Schaden eines zurückgedrehten Namens klein und die Korrektur seit dieser Story ein Handgriff ist.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-0-1-umbenennen-auf-verwaltung.md`
  summary: Screenreader — jede Mitgliedszeile trägt wortgleich „Umbenennen" und „Neuer Name" ohne Bezug zur Zeile.
  evidence: Der Aufklapp-Griff und die Feldbeschriftung wiederholen sich je aktiver Zeile identisch. Wer die Seite mit einer Elementliste durchgeht, liest zwanzigmal „Umbenennen" und zwanzigmal „Neuer Name", ohne zu erfahren, wessen Name gemeint ist; sichtbar trägt der Zeilenname darüber die Auskunft, für die Liste ist sie fort. Dasselbe gilt schon für `Link neu ausstellen` und `Einladung widerrufen` seit Story 1.3 — mit dem Umbenennen wächst es von den fremden Zeilen auf **jede** aktive. Ein Mittel wäre ein `aria-label` mit dem Namen der Zeile an Griff, Feld und Knopf, oder ein `aria-labelledby`, das auf den Zeilennamen zeigt. Nicht in dieser Story gebaut: es betrifft alle drei Zeilen-Aktionen und gehört in einem Zug gelöst, nicht an einer.

## Zurückgestellt aus: code review of spec-3-1-dienstplan-mit-namen-und-laufender-woche (2026-08-29)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-dienstplan-mit-namen-und-laufender-woche.md`
  summary: Screenreader — der Dienstplan ist die vierte Zeilenart mit wortgleichen, zeilenlosen Namen.
  evidence: Je Wochenzeile stehen `Besetzen`/`Neu besetzen` als `<summary>`, `Zuständig` als `<label>` und `Eintragen` als Knopf — dreizehn- bis vierzehnmal identisch. Die Kalenderwoche steht in einem `<p class="woche__nummer">`, das mit keinem der drei verknüpft ist. Das ist derselbe Posten, der schon aus Story 3.0.1 zurückgestellt ist, und der Entscheid dort trägt unverändert: es betrifft inzwischen `Link neu ausstellen`, `Einladung widerrufen`, `Umbenennen` und `Besetzen` und gehört in einem Zug gelöst, nicht an einer Stelle. Ein Mittel wäre ein `aria-labelledby`, das auf die Kennung der Zeile zeigt — auf `/verwaltung` der Name, auf `/dienstplan` die KW.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-dienstplan-mit-namen-und-laufender-woche.md`
  summary: Die Dienstart ist unmessbar — kein Prüfweg schreibt je eine Zeile mit einer anderen `art`.
  evidence: `dienstwochenLesen` filtert über `eq(dutyWeeks.art, DIENSTART_TRAENKEN)`, und der Docblock begründet das ausführlich: „sonst fände ein zweiter Dienstplan seine Wochen im Tränkeplan". Gemessen ist das nicht — `DIENSTART_TRAENKEN` kommt in `scripts/smoke-zugang.ts` genau einmal vor, als Lesevergleich (`zeile.art === DIENSTART_TRAENKEN`), nie als geschriebener zweiter Wert. Die Bedingung liesse sich aus Abfrage und Einfügung streichen, und die ganze Kette bliebe grün. Die Spalte ist ausserdem ein unbeschränktes `text('art').notNull()` ohne `$type<>` und ohne CHECK. Zurückgestellt, weil ein zweiter Dienstplan in der Story ausdrücklich unter „Ask First" steht: die Behauptung gehört in die Story, die die zweite Art einführt — dort ist sie eine Zusage, hier wäre sie eine Vorwegnahme.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-dienstplan-mit-namen-und-laufender-woche.md`
  summary: `.hinweis` ist die zweite Kopie derselben Nebentext-Regel.
  evidence: `src/routes/dienstplan/+page.svelte:277` und `src/routes/monatsplan/+page.svelte:594` deklarieren beide `.hinweis` mit denselben fünf Meta-Eigenschaften, unterschieden nur im `margin`. Die strenge Hälfte des Code-Map-Auftrags ist eingelöst — `.seite`, `.seitentitel`, `.fehler` und `.live:empty` werden benutzt und nicht neu deklariert, und die `SEITENFORM`-Behauptung erzwingt das —, aber das Wachstum der Seitenstile, vor dem Retro-Posten D1 warnt, geht weiter und ist an dieser Stelle von nichts bewacht. Zurückgestellt, weil der Fix eine geteilte Klasse in `bedienelemente.css` ist und alle Seiten mit Nebentext betrifft, nicht nur diese.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-dienstplan-mit-namen-und-laufender-woche.md`
  summary: `select.feld { appearance: auto }` trägt keine Behauptung.
  evidence: Die neue Regel in `src/lib/styles/bedienelemente.css` nimmt `appearance: none` für `<select>` zurück, damit die Auswahl ihren Pfeil behält — die einzige Anzeige, dass sich hier etwas aufklappt. Weder `smoke` noch `smoke:http` misst sie; sie steht allein auf der manuellen Prüfliste. Zurückgestellt, weil gerechnete Darstellung von keinem der beiden Skripte erreichbar ist: das wäre Stufe C (kopfloser Browser), die ausdrücklich an eine eigene Auslösebedingung gebunden bleibt.

## Erledigt am 2026-08-29: sieben Posten aus der Triage vor Epic 3

Ein Durchgang durch die offene Arbeit dieser Datei, in der Reihenfolge, die
`deferred-work-triage-2026-08-28.md` unter „Empfohlene Reihenfolge" festgelegt
hat. Punkt 1 bis 3 jener Liste waren schon erledigt (das Token `--warn`, die
Reihenfolgefalle in `smoke-zugang.ts`, Stufe A als Story 3.0), Punkt 7
ebenfalls (die `umbenennen`-action aus Story 3.0.1). Erledigt sind jetzt die
Punkte 4, 5 und 6 samt der Posten, die im Review zu den Stories 3.0.1 und 3.1
dazugekommen waren.

Gemeinsam für alle sieben: `npm run lint` und `npm run check` mit Exit 0,
`smoke` bei 537 Behauptungen (vorher 476), `smoke:http` bei 122 (vorher 103).
Jede neue Zusage ist durch **mindestens eine ausgeführte Mutationsprobe** rot
belegt; die Proben stehen einzeln in der Tabelle in `README.md`.

- betrifft: Eintrag 31 (Zeile 107), Entscheid vom 2026-08-28, Retro-Punkt 31
  fassung: `FRIST_FENSTER_TAGE = 365` steht in `src/lib/zeit.ts` neben ZEITZONE
    und UEBERFAELLIG_SEKUNDEN und hat zwei Leser: `fristfenster` macht daraus die
    zwei Feldwerte für `min`/`max` am Datumsfeld, `istImFristfenster` die Prüfung
    in der action. Das Feld ist die Bequemlichkeit, die action die Instanz —
    dasselbe Verhältnis wie `maxlength` zu AUFGABE_HOECHSTLAENGE. Die Komponente
    sperrt zusätzlich `Weiter`; der vierte Sperrgrund neben den drei bestehenden.
  gerechnet wird auf Kalendertagen in der Zone: eine Sekundendifferenz liesse die
    Grenze im Lauf des Tages um Stunden wandern, weil `faelligAm` das Tagesende
    ist und `jetzt` irgendwann davor liegt.
  mitgenommen: Die zwei Sätze über das Datum stehen jetzt in `src/lib/texte.ts`.
    Der neue Satz wäre sonst das **zweite** Paar wortgleicher Literale zwischen
    Route und Komponente gewesen — genau das Muster, aus dem Drift entsteht.
  belegt: `smoke` misst die Grenzen an **fester** Uhr, weil eine Grenzprobe an
    der laufenden einmal im Jahr rot wäre; eine zweite Uhr über einem Schalttag
    belegt, dass in Tagen und nicht in Jahren gezählt wird. `smoke:http` misst die
    ausgelieferten `min`/`max` am gebauten Server und dass die Vorbelegung
    zwischen den eigenen Grenzen liegt. Vier Gegenproben rot gesehen.
  status: erledigt

- betrifft: Eintrag 39 (Zeile 137), Entscheid vom 2026-08-28, Retro-Punkt 32
  fassung: Die gerenderte Zeichenkette heisst `seit N Wochen überfällig`. Die
    rund zwanzig Prosastellen in `zeit.ts`, `+page.svelte`, `smoke-zugang.ts` und
    `README.md` sind **mitgeschrieben und nicht ersetzt** — mehrere von ihnen
    argumentierten für die alte Fassung und tun es jetzt für die neue, mit dem
    Datum der Umstellung als Anker.
  bewusst nicht mitgewandert: die Bezeichner `wochenOffenSeit` und `wochenOffen`.
    Sie benennen die **Rechnung** (die Wochen seit dem Zählbeginn), der Satz
    benennt den **Zustand**. Eine Umbenennung ginge quer durch Schema, Abfrage
    und Prüfliste, ohne dass eine Aussage dadurch wahrer würde; die Begründung
    steht im Modulkopf von `zeit.ts`, damit es nicht wie ein Versehen aussieht.
  belegt: `smoke:http` misst den Satz zum ersten Mal am **ausgelieferten** HTML
    statt am Quelltext — dafür sät das Skript eine überfällige Planaufgabe. Das
    war bis dahin eine echte Lücke: der einzige gerenderte Satz dieser Story hing
    an einer Textprüfung über die `.svelte`-Datei. Gegenprobe rot gesehen.
  status: erledigt

- betrifft: Eintrag 28 (Zeile 98), Bucket B4 der Triage
  fassung: Jedes Ziel der Navigationsleiste nennt in `gehoertDazu` die Routen,
    die zu ihm gehören, ohne unter seinem Pfad zu liegen: `/aufgabe` zu `/`,
    `/monatsplan` und `/verwaltung` zu `/mehr`. Zugeordnet nach dem **Weg
    dorthin** und nicht nach dem Thema.
  entschieden dabei: `aria-current` trägt zwei Werte, weil es zwei Aussagen sind.
    `page` heisst „das hier ist die angezeigte Seite" und wäre auf `/aufgabe` am
    Eintrag `Aufgaben` eine Falschaussage; `true` heisst „das hier ist der
    laufende Eintrag" und ist die schwächere Aussage, die dort stimmt. Sichtbar
    sind beide Zustände derselbe.
  belegt: `smoke` liest die gerenderten Routen aus dem **Baum** und hält sie
    gegen die Liste in der Komponente — eine neue Route ohne Eintrag macht die
    Prüfliste rot. Das ist die eigentliche Zusage: Story 3.2 legt zwei Routen an.
    `smoke:http` misst beide `aria-current`-Werte am ausgelieferten Dokument.
    Drei Gegenproben rot gesehen.
  status: erledigt

- betrifft: Einträge 23 und 24 (Zeilen 83, 86), Bucket B5 der Triage
  fassung: Die Zeichenklasse liegt in `src/lib/unsichtbar.ts` und hat zwei
    Leser. `U+200D` fällt nur noch **ausserhalb** einer Emoji-Folge — die
    Hautton-Modifikatoren und der Variationsselektor stehen in der Ausnahme
    ausdrücklich, weil sie selbst nicht `Extended_Pictographic` sind. Dazu
    ausgesiebt werden jetzt U+00AD, U+180E, die Bidi-Steuerzeichen
    U+202A–U+202E und U+2066–U+2069, U+2800 und die zwei Hangul-Füller U+3164
    und U+FFA0.
  zur Verdopplung: `aufgabentext.ts` und `mitgliedsname.ts` bleiben getrennt,
    und ihre Begründung dafür bleibt gültig — sie gilt den **Domänenregeln**.
    Für die Zeichenklasse trägt sie nicht: welche Zeichen keine Breite haben,
    ist eine Aussage über Unicode. Beide Einträge verlangten „gehört an beide
    Stellen zugleich"; das ist jetzt keine Zusage mehr, sondern der Bau.
  belegt: fünfzehn Zeichenproben, **jede durch beide Leser** — eine Probe an nur
    einem bliebe grün, wenn das geteilte Modul wieder auseinanderfiele. Dazu eine
    Baumbehauptung, dass die Liste unter `src/` genau einmal steht. Drei
    Gegenproben rot gesehen.
  status: erledigt

- betrifft: `.hinweis` als zweite Kopie derselben Nebentext-Regel (Review 3.1)
  fassung: `.hinweis` steht in `src/lib/styles/bedienelemente.css`, der
    Grundfall ohne Aussenabstand wie jede andere Regel dort.
    `.hinweis--am-feld` setzt den einen Schritt, den ein Nebentext unmittelbar
    unter einem Feld braucht — dort gibt es keinen `gap`-Container, sondern nur
    das Label mit seinem eigenen `margin-bottom`. Der Unterschied ist damit
    benannt statt verdoppelt.
  mitgenommen: `.zaehler` auf `/monatsplan` war die **dritte** Kopie derselben
    fünf meta-Eigenschaften und ist fort; seine Kennung `plan-zaehler` bleibt,
    denn daran hängt das `aria-describedby` des Textfeldes. Die Behauptung
    darüber schneidet seither über die Kennung statt über die Klasse — der
    bessere Anker, weil er die Identität misst und nicht die Gestaltung.
  belegt: `.hinweis` steht jetzt in der SEITENFORM-Liste. Genau die Wache, die
    der Review vermisst hat („von nichts bewacht"). Gegenprobe rot gesehen.
  status: erledigt

- betrifft: der zeilenlose Screenreader-Name (zurückgestellt aus Story 3.0.1 und
    noch einmal aus dem Review zu Story 3.1)
  fassung: Alle vier Zeilenarten in einem Zug, wie beide Einträge es verlangt
    hatten. Jede Zeilen-Aktion zeigt mit `aria-labelledby` auf sich selbst und
    dann auf die Kennung ihrer Zeile: `Umbenennen Anna Meier`,
    `Besetzen KW 36 2026`. Die eigene Kennung **zuerst**, damit die sichtbare
    Beschriftung der Anfang des Namens bleibt — wer per Sprache bedient, sagt,
    was er sieht.
  belegt: `smoke:http` misst es am ausgelieferten HTML und nicht am Quelltext.
    Der Grund ist genau: die Kennungen tragen den Zeilenschlüssel als
    Interpolation, und ob daraus ein **auflösbarer** Verweis wird, sieht man
    erst im Dokument. Ein `aria-labelledby` ins Leere ist stiller als gar keins.
  nebenbei gefunden: der Bestätigungsdialog zeigt auf eine Überschrift, die erst
    mit der gewählten Zeile entsteht. Das ist richtig so — der Dialog ist
    geschlossen, und sein Inhalt stünde sonst als leerer Satz im Quelltext jedes
    Besuchers. Als benannte Ausnahme in der Prüfung festgehalten. Drei
    Gegenproben rot gesehen.
  status: erledigt

- betrifft: die verlorene Änderung beim Umbenennen (zurückgestellt aus Story
    3.0.1)
  fassung: `bekannterName` reist als verstecktes Feld mit und entscheidet in der
    `where`-Klausel des `UPDATE`, nicht in der Route — dieselbe Bauform, mit der
    `abhaken` seit Story 1.4 das Wettrennen zweier Abhakender entscheidet.
    Passt der Abdruck nicht mehr, fällt der Versuch auf MITGLIED_NICHT_ANSPRECHBAR;
    `Lade die Liste neu.` ist auf diesen Fall die richtige Auskunft, und ein
    eigener Satz wäre der Aufzählungskanal, gegen den dieser Satz steht.
  belegt: `smoke` stellt den Fall nach — der erste Tab benennt auf `Anna Berger`
    um, der zweite schickt seinen Stand `Anna Meier` ab. Die Gegenprobe ohne die
    Bedingung im `UPDATE` zeigt genau den ursprünglichen Fehler: danach steht
    wieder `Anna Meier` in der Zeile. `smoke:http` misst das versteckte Feld am
    ausgelieferten Formular.
  status: erledigt

**Was aus dieser Datei offen bleibt** und warum:

- **Eintrag 4** (Zeile 19) — die Installation zum Home-Bildschirm ist auf keinem
  echten Gerät geprüft. Braucht ein Telefon, sonst nichts. Unverändert offen.
- **Bucket D der Triage**, fünfzehn bewusst getragene Einträge. Zwei ihrer
  Zähler standen hier auf sieben und sechs und waren damit **falsch**; die
  zweite Retrospektive zu Epic 3 hat sie als Befund D3 gemeldet, nachdem der
  erste Lauf die Bewegung schon einmal angezeigt hatte.

  **Nachgemessen am 2026-08-30 am HEAD**, kommentarfrei über `src/`:
  `request.formData()` ohne try/catch steht an **dreizehn** Stellen
  (Eintrag 21/25), harte Redirect-Pfade an **neun** (Eintrag 26). Die
  Retrospektive mass 11 und 7; die Differenz ist Story 4.1, die danach landete
  und je zwei hinzufügte — `/wissen` und `/wissen/[id]` haben beide ein
  Formular und beide eine Weiterleitung auf das Blatt.

  **Die Zahl trägt ab jetzt ihren Messweg**, weil sie sonst wieder veraltet,
  ohne dass es auffällt — das ist der Fehler, den D3 zweimal gemeldet hat:

  ```
  grep -rn "request.formData()" src/ | wc -l          # 13
  grep -rEn "redirect\(3[0-9]{2}, *['\`]" src/ | wc -l  # 10 roh, davon 1 im Kommentar -> 9
  ```

  Beide Klassen bleiben **bewusst getragen** und sind hier nur Buchführung: ein
  fehlerhafter Body ergäbe 500 statt 400, und ein hart geschriebener Pfad bricht
  still, wenn eine Route umzieht. Keine der zwei ist heute erreichbar, ohne dass
  jemand von Hand einen kaputten Rumpf schickt oder eine Route verschiebt.
- **Die Dienstart ist unmessbar** (Review 3.1) — ausdrücklich der Story
  vorbehalten, die die zweite Art einführt: dort ist die Behauptung eine Zusage,
  hier wäre sie eine Vorwegnahme.
- **`select.feld { appearance: auto }` trägt keine Behauptung** (Review 3.1) —
  gerechnete Darstellung erreicht keines der zwei Skripte. Das wäre Stufe C, und
  die bleibt an ihre eigene Auslösebedingung gebunden.
- **Retro-Punkt 15 / Befund P3**: die Barrierefreiheit ist weiterhin
  mitgenickt und nicht abgenommen. Dieser Durchgang hat zwei ihrer Posten
  gebaut (der Zeilenbezug, die zwei `aria-current`-Werte) und beide **gemessen**
  — abgenommen ist damit die Struktur im ausgelieferten Dokument, nicht das
  Erlebnis mit einem Screenreader.

## Zurückgestellt in Story 3.2 (2026-08-29)

- betrifft: der Termin auf `/einzelaufgabe` geht ohne JavaScript verloren, wenn
    der Versand abgewiesen wird
  fassung: `abweisen` trägt **einen** Rückweg für eine verworfene Eingabe
    (`eingabe`), und den bekommt der Titel — er ist der Wert, den ein Feld aus
    lauter unsichtbaren Zeichen tatsächlich verliert. Der Termin steht im `$state`
    der Komponente und übersteht einen abgewiesenen Versand **mit** JavaScript;
    ohne ist er danach leer. Die geteilte Form für inzwischen sechs Seiten dafür
    aufzuweiten war der teurere Handel — dieselbe Abwägung wie beim
    Wochenschlüssel im vierten Argument aus Story 3.1.
  warum tragbar: das Feld trägt `required`, `min` und `max`, und diese drei prüft
    der Browser von sich aus, ohne JavaScript. Die zwei serverseitigen
    Termin-Sätze sind die Auffanglinie für einen gebauten POST, nicht der übliche
    Weg. Der Titel dagegen passiert `required` und fällt erst am Server — er
    reist darum zurück.
  dritter Weg, geprüft und verworfen: die action könnte den Termin **neben**
    `abweisen` in die Nutzlast legen, statt die geteilte Form zu verbreitern. Das
    hiesse aber, den Rückgabewert nicht mehr aus `abweisen` zu bilden — und genau
    das ist die Zusage, die seit Epic 2 gilt und die `smoke` festnagelt („keine
    Seite erklärt eine eigene"). Eine Abweisung, die an einer Stelle anders
    entsteht als an den anderen sechs, ist die Drift, gegen die die eine Form
    gebaut wurde. Der Handel wäre: eine gerettete Datumseingabe gegen die
    Einheitlichkeit aller Abweisungen.
  auslöser: eine dritte Seite mit zwei Feldern, deren zweites ohne
    Browserprüfung auskommt. Dann trägt die eine Form nicht mehr, und der Rückweg
    gehört verbreitert — an allen sechs Stellen zugleich, nicht an einer.
  status: offen

## Aus dem Review zu Story 3.2 (2026-08-29)

- betrifft: eine freie Einzelaufgabe mit vergangenem Termin steht **oben** auf
    der Startseite
  evidence: `freieEinzelaufgabenLesen` filtert bewusst nicht nach Zeit und
    ordnet aufsteigend nach Termin. Beides zusammen hat eine Folge, die beim Bau
    nicht benannt war: eine im März ausgeschriebene und nie übernommene Aufgabe
    steht im September nicht etwa unten, sondern **an erster Stelle** von Block 2
    — an der aufmerksamkeitsstärksten Stelle der Anwendung, ohne jedes Zeichen,
    dass ihr Termin vorbei ist. Der Pool nebenan trägt für dieselbe Lage seit
    Story 2.2 `seit N Wochen überfällig`.
  status: offen, gehört zum Entscheid über das Verfallen (Ask First in der
    Spezifikation). Drei Fassungen sind denkbar: eine zweite Textzeile wie im
    Pool, eine Sortierung, die Vergangenes nach hinten stellt, oder ein Verfallen
    nach Frist. Die erste ist die billigste und passt zur Hausregel „der Zustand
    trägt das Wort".

- betrifft: `/einzelaufgaben` wächst unbegrenzt und beginnt mit dem Ältesten
  evidence: dieselbe aufsteigende Ordnung über **alle** Zeilen, ohne Blättern,
    ohne Archiv und ohne Trennung von Vergangenem. Die Seite beantwortet „wer hat
    was übernommen" nach einer Saison unterhalb eines Bildschirms voll erledigter
    Arbeit. Heute belanglos — zwanzig Leute schreiben eine Handvoll im Jahr aus —,
    und die Auslösebedingung ist dieselbe wie beim Eintrag darüber.
  status: offen

- betrifft: kein Korrigieren, kein Zurückgeben, kein Löschen — und die
    Asymmetrie, die daraus folgt
  evidence: ein Tippfehler im Titel einer ausgeschriebenen Einzelaufgabe bleibt
    für alle sichtbar stehen; wer übernommen hat, kommt nicht mehr heraus; der
    einzige Weg zurück auf „frei" ist das Beenden eines Zugangs. Der Review nennt
    die Asymmetrie beim Namen und sie ist der eigentliche Punkt: das **umkehrbare**
    Abhaken im Pool fragt nichts (`aufgabeWiederOeffnen` steht daneben), die
    **unumkehrbare** Übernahme bekommt den Dialog. Das ist nicht falsch — die
    Bestätigung sitzt genau dort, wo die Folge bleibt —, aber es heisst, dass die
    Bestätigung die einzige Sicherung ist.
  status: offen, drei Ask-First-Punkte der Spezifikation hängen daran (Abgeben,
    Erledigt-Zustand, Verfallen)

- betrifft: ein doppelter POST ohne JavaScript legt zwei gleichlautende
    Einzelaufgaben an
  evidence: `imFlug` sperrt den zweiten Versand nur mit JavaScript; ohne bleibt
    ein Doppelantippen oder ein Zurück-und-nochmal-Absenden ungebremst, und es
    gibt keine Löschen-Aktion, die aufräumte. **Pre-existing, nicht von dieser
    Story eingeführt:** `/aufgabe` trägt dieselbe Lücke seit Story 1.5, mit
    derselben Begründung im Kommentar. Wer sie schliesst, schliesst sie an beiden
    Stellen — etwa über eine Eindeutigkeit oder ein Erkennen der gleichen Zeile
    im selben Zeitfenster.
  status: offen

- betrifft: `maxlength` zählt UTF-16-Einheiten, die Prüfung zählt Codepoints
  evidence: ein Titel aus Emoji wird vom Browser bei 200 **Einheiten**
    abgeschnitten, während der Server 200 **Codepoints** zuliesse — die
    Begrenzung greift dann früher als zugesagt. **Pre-existing:** `/aufgabe`
    trägt dieselbe Paarung seit Story 1.5, `/verwaltung` bei den Namen ebenso.
    Ein Fix gehört an alle drei zugleich.
  status: offen

- betrifft: `.erfassen` liegt zweimal — in `/aufgabe` und `/einzelaufgabe`
  evidence: vier gleichlautende Zeilen Flexlayout. Bewusst **nicht** mit den
    anderen fünf Klassen ins geteilte Stilblatt gezogen: `.leer`, `.karte`,
    `.marke` und die zwei Bestätigungsregeln tragen eine **Rolle** — leerer
    Zustand, Karte, Abschnittsmarke —, und darum gehören sie dorthin. `.erfassen`
    ist reines Formularlayout ohne Aussage; eine generische Flexklasse im
    geteilten Blatt wäre der Anfang einer Utility-Sammlung, die dieses Projekt
    nicht hat. Zwei Kopien sind hier der kleinere Preis, und der Entscheid steht
    hier, damit die nächste Story ihn nicht neu treffen muss.
  status: getragen

## Durchgang durch die Duplikate (2026-08-29, nach der Retrospektive Epic 3)

Aktionspunkte 3, 4 und 5 der Retrospektive, abgearbeitet. Die Messung fiel von
**vierzehn** doppelten Regelkörpern auf **zwei** — und die zwei sind die, die
bleiben sollen.

- betrifft: Aktionspunkt 3 — die übrigen doppelten Regelkörper
  fassung: sechs Rollen ins geteilte Stilblatt gezogen — `.fliesstext`
    (+ `--gedaempft`), `.liste` (+ `--getrennt`), `.knoepfe`, `.nur-vorgelesen`,
    dazu drei nicht migrierte Zwillinge von `.hinweis`. Die Wache in `smoke`
    trägt jetzt zwanzig Klassen statt sieben.
  belegt: eine Kopie von `.liste` in `/mehr` macht die Prüfliste rot.
  status: erledigt

- betrifft: Aktionspunkt 4 — die Live-Region als geteilte Komponente
  fassung: **abgewichen, und zwar begründet.** Die Retrospektive sprach von drei
    Regionen; gemessen sind es dreizehn, und die zehn Fehlerregionen haben vier
    Formen — mit und ohne `id`, mit und ohne Fokusgriff, zwei mit einer Kennung
    je Datensatz. Eine Komponente bräuchte fünf Eigenschaften für fünf Attribute
    und nähme dem Prüfskript das Markup, an dem es die Attribute liest. Geteilt
    ist statt dessen `.meldung` (dritte Kopie), und `smoke` prüft **jede**
    Meldungsregion des Baums gegen `tabindex` und `bind:this` samt ihrer Zahl.
  warum das schärfer ist: eine Komponente hindert niemanden daran, sich die
    Region von Hand danebenzuschreiben — die Behauptung schon. Sie deckt jetzt
    `/dienstplan` und `/verwaltung` mit, die vorher keine Zeile hatten.
  belegt: `tabindex` aus der Dienstplan-Meldung und `bind:this` aus der
    Verwaltungs-Meldung entfernt — beide Male rot.
  status: erledigt, mit Abweichung

- betrifft: Aktionspunkt 5 — das aufklappbare Zeilenformular zusammenlegen
  fassung: die **Hülle** ist geteilt (`.zeilenform`, `__griff`, `__formular`);
    das `<form>` bleibt in seiner Route. Grund: es trägt ein literales
    `action="?/name"`, und Gate-Regel 11 leitet die Route aus dem Verzeichnis der
    Datei ab, um den Namen gegen die actions der Nachbardatei zu halten. Eine
    Komponente unter `src/lib/components/` hat kein Routenverzeichnis — die Regel
    würde blind, und ein verschriebener Aktionsname wäre wieder ein Knopf, der
    nichts tut. Was die zwei statt dessen zusammenhält, ist eine Behauptung über
    beide zugleich: dieselbe Hülle, dieselben geteilten Klassen, `open={fehlerHier}`,
    der Griff nennt sich selbst und dann die Zeile, POST mit literalem action,
    `use:enhance`.
  belegt: drei Mutationen rot — eigene Griff-Klasse zurück in den Dienstplan,
    eigene Formular-Klasse zurück in die Verwaltung, `open={fehlerHier}` weg.
    Die erste Fassung der Behauptung liess die ersten zwei **grün** durch; sie
    prüfte die Hülle, aber nicht, dass die Seiten die geteilten Klassen benutzen.
  status: erledigt, mit Abweichung

**Was mit Absicht doppelt bleibt** — und was das über die Messung sagt:

- `.erfassen` / `.pruefen` / `.aufnahme`, vier gleichlautende Formularblöcke in
  vier Routen. Byte-gleich und trotzdem nicht dasselbe.
- `.zeile__marke` und `.leer` teilen eine einzige Deklaration (`color`). Zwei
  Regeln, die sich in einer Eigenschaft treffen, sind kein Duplikat.

Beides ist **zufällige** Gleichheit. Der Durchgang hat gezeigt, dass die Messung
sie nicht von der essenziellen unterscheiden kann — sie zählt Zeichen, nicht
Bedeutung. Wer die Zahl das nächste Mal liest, liest sie darum als Liste von
Kandidaten und nicht als Liste von Fehlern.


---

## Zurückgestellt aus: code review of spec-3-2-einzelaufgabe-ausschreiben-und-uebernehmen, Durchgang 2 (2026-08-30)

Der separate Review in frischer Sitzung, den die Retrospektive Epic 3 als
Bedingung für die Abnahme benannt hat. Acht Posten, alle `low` — was in diesem
Durchgang wirklich wog, steht als Patch in der Story und nicht hier.

- **`versandFragen` setzt `versandFehler` nicht zurück.** Die zwei anderen
  Versandwege der Seite (`versandFuer:259`, `versandBestaetigen:411`) räumen die
  Fehlerregion vor dem Absenden. `versandFragen` schickt nicht ab, sondern
  öffnet den Dialog — ein alter `VERSAND_FEHLGESCHLAGEN` aus einem
  Pool-Versand bleibt darum als `fehlerOben` stehen, während darüber eine neue,
  noch offene Frage aufgeht.
  *Zurückgestellt, weil* die Geschwister beim **Absenden** räumen und nicht beim
  Öffnen; ob ein alter Fehlersatz das Öffnen eines Dialogs überleben soll, ist
  eine Frage an die Oberfläche und nicht an den Code.

- **Ein einziges `imFlug` koppelt Block 2 an Block 3.** Ein Häkchen im Pool
  sperrt jeden `Übernehmen`-Knopf, eine bestätigte Übernahme sperrt jedes
  Kästchen. Vertretbar — ein Versand je Seite —, aber nirgends benannt,
  während die zwei Blöcke sonst in jeder anderen Hinsicht als unabhängig
  argumentiert werden.

- **`noch niemand` steht als Literal in zwei Komponenten**
  (`+page.svelte:555`, `einzelaufgaben/+page.svelte:68`). Nach der eigenen Regel
  von `texte.ts` — „die Sätze, die an mehr als einer Stelle stehen müssen" —
  gehörte es dorthin. Die Story hat sich für `Du übernimmst:` eine Wache gebaut,
  dass der Satz genau einmal unter `src/` steht; für die Zeichenkette, die sie im
  selben Zug verdoppelt hat, keine.

- **Die Rückruf-Wache ist an zwei Stellen weicher, als ihre Prosa sagt.**
  `rueckrufe.length >= 7` ist eine Untergrenze, der Docblock nennt **genau**
  sieben; und `return async \([^)]*\) => \{` bricht an einer Klammer im
  Parameterkopf (Destrukturierung mit Vorgabewert, Typannotation). Ein Rückruf,
  der so durchfällt, wird still nicht gezählt, und die Untergrenze merkt es nicht.

- **`class="karte woche"` trägt einen toten Klassen-Token**
  (`dienstplan/+page.svelte:191`). Eine Regel `.woche {` gibt es seit dem Zug
  ins geteilte `.karte` nicht mehr — nur `.woche--laufend` und die `.woche__*`.
  Wer den Token liest, nimmt eine Regel an, die es nicht gibt.

- **`<title>Einzelaufgabe</title>` und `<title>Einzelaufgaben</title>`** sind in
  Tab und Verlauf ein Zeichen auseinander, für zwei Seiten, die ganz
  Verschiedenes tun: die eine ist ein Formular, die andere eine Liste.

- **Kein Index auf `signup_tasks.member_id` und `members.is_active`.** `frei()`
  fragt `is_active` bei **jedem** Lesen von `/` und `/einzelaufgaben` als
  Unterabfrage ab, und `member_id` trägt den `leftJoin` und die where-Klausel des
  UPDATE. Bei zwanzig Mitgliedern kostet das nichts. Der Posten ist, dass die
  Begründung im Schema allein `termin_at` behandelt und sich liest, als hätte sie
  den Entscheid gedeckt.

- **Der verlorene Wettlauf in Schritt 1 antwortet mit 200.** Verliert die
  zurückgegebene Frage zwischen der Antwort der action und dem Rendern ihre Zeile,
  zeigt `fehlerOben` den Satz `EINZELAUFGABE_NICHT_ANSPRECHBAR` — die
  HTTP-Antwort ist aber die erfolgreiche `art: 'fragen'`-Antwort mit 200,
  während die Matrixzeile „Wettrennen" 400 zusagt. Der eigentliche
  Schreib-Wettlauf liefert korrekt 400; gemeint ist die Statusspalte, nicht der
  Satz.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-referenz-sheets-lesen-und-schreiben.md`
  summary: `BLATT_NICHT_ANSPRECHBAR` ist auf dem Weg ohne JavaScript unerreichbar — SvelteKit fährt nach `fail(400)` die `load` des Blatts erneut, die dann 404 wirft und den getippten Text mitnimmt.
  evidence: Belegt am SvelteKit-Quelltext (2.70.3, `runtime/server/page/index.js`): nach einer abgewiesenen action rendert der Server die Seite, und dafür laufen alle `load`-Funktionen. `blattLesen` gibt null, die Route wirft `error(404)`, und die Person bekommt die Fehlerseite statt ihres offenen Formulars — genau das, was der Zweig verhindern soll. Heute nur defensiv: es gibt keine Löschen-Aktion, ein Blatt kann nur durch direkten Datenbankzugriff verschwinden. Härtung hiesse, die `load` müsste den Fehlschlag der action kennen — oder der Zweig fällt weg und der 404 wird die zugesagte Antwort.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-referenz-sheets-lesen-und-schreiben.md`
  summary: Die Zahl der Blätter ist unbegrenzt, jedes Mitglied darf anlegen, und es gibt keine Löschen-Aktion — `/wissen` kann nur wachsen.
  evidence: `/monatsplan` hat für genau diese Klasse eine `PLAN_HOECHSTZAHL`, mit der Begründung „es gibt keine Löschen-Aktion, die das wieder aufräumte". Für Blätter fehlt sie. Der Unterschied, der sie heute erträglich macht: ein Blatt lässt sich **ändern**, ein versehentlich eingefügter Chatverlauf ist also überschreibbar, und der Auslöser („ein Stapel entsteht in einem Zug") fehlt. Der Entscheid Löschen-Aktion stand unter *Ask First* der Story und ist bewusst mit Nein beantwortet; die Obergrenze war nicht Teil der Frage.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-referenz-sheets-lesen-und-schreiben.md`
  summary: Gate-Regel 1 zerlegt den ganzen CSS-Abschnitt und unterscheidet Selektor, Eigenschaft und Wert nicht — eine Klasse `.highlight` oder `.tomato` ohne Trennzeichen meldet sie als Farbe.
  evidence: Story 4.1 hat die halbe Bauform gelöst (Trennzeichen links und rechts, Fehlerprobe `regel-1f-eigenschaftsname`, fünf Verstösse ohne die Wache und null mit). Die ganze wäre, nur die **Wertseite** einer Deklaration zu lesen. Heute schlägt niemand an, weil keine Klasse im Baum so heisst; die Regel behauptet aber mehr, als sie kann, und die nächste Seite mit einer Klasse `.mark` liefe hinein.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-referenz-sheets-lesen-und-schreiben.md`
  summary: Das ERD der ARCHITECTURE-SPINE nennt `duty_weeks` weiter mit `iso_year`/`iso_week`, während die Tabelle `iso_jahr`/`iso_woche` heisst.
  evidence: Beim Nachziehen von `SHEETS` auf den Namensentscheid vom 2026-08-30 gesehen und im Nachtrag am ERD benannt. Nicht mitkorrigiert, weil eine Behauptung über eine Tabelle, die Story 4.1 nicht anfasst, nicht in einen Nachtrag zu Story 4.1 gehört. Betrifft ausserdem `duty_kind` gegen `art`.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-referenz-sheets-lesen-und-schreiben.md`
  summary: Eine Meldung, die eine Weiterleitung überlebt, steht beim Rendern schon in ihrer Live-Region — genau die Lage, die Retro-Posten B2 als „nicht verlässlich vorgelesen" benennt.
  evidence: Gilt für `?abgelegt` und `?ausgeschrieben` auf `/` seit Epic 1 und 3 ebenso wie für `?angelegt` und `?geaendert` auf `/wissen/[id]`. B2 hat die Region **immer ins Markup** gezogen und damit den Fall gelöst, in dem sie gleichzeitig entsteht; der Fall „ganze Seite lädt neu, Text ist von Anfang an da" ist ein anderer und produktweit offen. Kein Befund dieser Story allein.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-referenz-sheets-lesen-und-schreiben.md`
  summary: `smoke-http.ts` schickt mehrzeilige Feldwerte als `application/x-www-form-urlencoded` mit `\n`, während ein Browser aus einem Textfeld CRLF sendet.
  evidence: Schritt 2 von `blatttextFalten` (Zeilenenden vereinheitlichen) ist damit auf dem HTTP-Weg nie ausgeführt. Gedeckt ist er in `smoke-zugang.ts` über die multipart-Attrappe, die einen echten `FormData`-Rumpf baut und parst — dort trägt `langerTextImFormular` genau diese Zeichenform. Der Posten ist, dass der Weg von Anfang bis Ende eine Umbruchform misst, die kein Browser schickt.

## Beim Nachlauf der Aktionspunkte gefunden (2026-08-30)

- source_spec: `_bmad-output/planning-artifacts/epics.md`
  summary: UX-DR16 zählt „acht Oberflächen" und nennt darunter `/einzelaufgaben/neu` — eine Route, die es nicht gibt. Gebaut sind zehn Seiten.
  evidence: Beim Abgleich von Story 3.2 (Aktionspunkt 41, Befunde E2/E3) gesehen. `epics.md:91` führt `/`, `/aufgabe`, `/dienstplan`, `/wissen`, `/mehr`, `/monatsplan`, `/einzelaufgaben/neu` und `/verwaltung`. Gemessen am HEAD gibt es zehn `+page.svelte` unter `src/routes/`: die sieben richtig genannten plus `/einzelaufgabe` (das Formular), `/einzelaufgaben` (die Liste) und `/wissen/[id]`. `/einzelaufgaben/neu` existiert nicht und hat nie existiert — der Name stammt aus der Planung vor Story 3.2, die sich für `/einzelaufgabe` entschied. **Nicht mitkorrigiert**, weil UX-DR16 eine Design-Anforderung ist und keine Buchführung: die Zahl von acht auf zehn zu heben hiesse, die Anforderung neu zu fassen, und das gehört dem Menschen, dem sie gehört. Der Aktionspunkt 41 nannte diese Stelle nicht. Zwei Wege: die Zahl auf zehn ziehen und die zwei Routennamen richtigstellen, oder UX-DR16 ausdrücklich als Stand der Planung markieren und den Ist-Stand danebenstellen.

