/*
 * Was eine Aufgabenzeile ist — **die eine Stelle**, an der das steht.
 *
 * Bis Story 2.1 stand die Regel als lokale Prüfkette in
 * ../routes/aufgabe/+page.server.ts, mit der ausdrücklichen Begründung „genau
 * eine Wurfstelle". Mit dem Monatsplan sind es drei Leser derselben Regel:
 *
 *   1. die action `ablegen` auf /aufgabe — eine Zeile je Versand;
 *   2. die action `ablegen` auf /monatsplan — der ganze Stapel;
 *   3. der mitlaufende Zähler unter dem Textfeld auf /monatsplan, **im
 *      Browser**.
 *
 * Der dritte ist der Grund, dass es ein geteiltes Modul sein muss und keine
 * zweite Kopie: der Zähler verspricht eine Zahl (`24 Aufgaben erkannt`), die
 * der Server anschliessend einlösen muss. Zwei Fassungen derselben Regel liefen
 * auseinander, und der Knopf `24 Aufgaben ablegen` legte 23 an.
 *
 * Aus demselben Grund liegen **beide** Grenzen hier — die 200 je Zeile und die
 * 100 je Stapel. Eine Grenze, die nur der Server kennt, sperrt den Knopf erst
 * nach dem Versand; die Person hat dann schon getippt, geprüft und abgeschickt.
 *
 * Das Modul liegt in src/lib/ und nicht unter client/ oder server/: es wird von
 * beiden Seiten gelesen. Es hängt von nichts ab, damit
 * ../routes/monatsplan/+page.server.ts es über nacktes Node laden kann
 * (scripts/smoke-zugang.ts tut genau das).
 */

/**
 * Nullbreiten-Zeichen. Sie sind unsichtbar, haben keine Breite und `trim()`
 * hält sie **nicht** für Leerraum.
 *
 * Ohne dieses Aussieben besteht ein Aufgabentext aus reinen Nullbreiten-Zeichen
 * jede Prüfung und legt eine Zeile an, die im Pool als leere Zeile mit einem
 * Kästchen daneben erscheint — ohne Aussage, was zu tun ist, und ohne
 * Bearbeiten-Aktion, die sie richtigstellen könnte. Abhaken ist dann das
 * Einzige, was bleibt.
 *
 * Wortgleich mit NULLBREITE in ./mitgliedsname.ts, und diese Verdopplung
 * bleibt: dort geht es um einen Mitgliedsnamen, hier um einen Aufgabentext. Ein
 * gemeinsames Modul für beide hiesse, dass eine Änderung an der einen Seite
 * still die andere trifft.
 *
 * U+200B ZERO WIDTH SPACE, U+200C ZERO WIDTH NON-JOINER,
 * U+200D ZERO WIDTH JOINER, U+2060 WORD JOINER, U+FEFF ZERO WIDTH NO-BREAK
 * SPACE (die Form, in der eine Byte-Order-Mark beim Einfügen aus einer Datei
 * mitkommt).
 *
 * Das `g`-Flag ist Pflicht, nicht Zierat: ohne es ersetzte `replace` nur das
 * **erste** Nullbreiten-Zeichen einer Zeile. Statthaft ist es, weil
 * `String.prototype.replace` den `lastIndex` eines globalen Regex vor jedem
 * Lauf selbst auf 0 zurücksetzt — die geteilte Konstante trägt also keinen
 * Zustand von Aufruf zu Aufruf mit, was bei zwanzig bis vierzig Zeilen in einer
 * Schleife kein gedachter Fall wäre.
 */
export const NULLBREITE = /[\u200B-\u200D\u2060\uFEFF]/g;

/**
 * Die Längengrenze eines Aufgabentexts, in **Codepoints**, serverseitig
 * durchgesetzt.
 *
 * 200: `Tunnel 2 Blattläuse nachbehandeln` braucht 34, und 200 lassen Raum für
 * Ort und Zusatz, ohne dass die Zeile in der Liste zum Absatz wird. Die Grenze
 * ist eine Auslegung von „eine Aufgabe ist ein Satz" und keine Eigenschaft der
 * Daten — darum steht sie hier und nicht als CHECK in einer Migration, die man
 * zum Ändern erst schreiben müsste.
 *
 * **Zwei Wurfstellen, darum geteilt.** /aufgabe wirft sie für die eine Zeile,
 * /monatsplan für jede Zeile des Stapels. Eine zweite Zahl in der zweiten Route
 * wäre eine zweite Wahrheit über dieselbe Regel; scripts/smoke-zugang.ts hält
 * zusätzlich das `maxlength` des Feldes auf /aufgabe gegen diese Konstante.
 *
 * **Codepoints und nicht UTF-16-Einheiten, und das ist benannt.** Das
 * `maxlength` am Feld zählt Einheiten, diese Prüfung zählt Codepoints. Ein
 * gültiger Text aus 200 Codepoints, in dem ein Emoji steckt, ist im Browser 201
 * Einheiten und lässt sich im Feld nicht zu Ende tippen — die annehmende
 * Richtung der Codepoint-Zählung ist über das echte Formular also gar nicht
 * erreichbar. Angenommen und in README.md unter den benannt akzeptierten
 * Risiken festgehalten.
 */
export const AUFGABE_HOECHSTLAENGE = 200;

/**
 * Wie viele Zeilen ein Monatsplan höchstens tragen darf.
 *
 * Ein realer Monatsplan hat 20 bis 40 Aufgaben; 100 lassen reichlich Luft und
 * fangen trotzdem den einen Fall ab, der sonst teuer wäre: ein versehentlich
 * eingefügter ganzer Chatverlauf. Es gibt **keine Löschen-Aktion**, die den
 * wieder aufräumte — abhaken wäre das Einzige, was bliebe, hundertfach von Hand.
 * Die Grenze steht darum in TypeScript und nicht als CHECK in einer Migration:
 * sie ist eine Auslegung von „ein Monatsplan" und keine Eigenschaft der Daten.
 *
 * **Sie steht hier und nicht in ../routes/monatsplan/+page.server.ts**, und das
 * ist derselbe Grund, aus dem das ganze Modul existiert. Solange sie allein in
 * der Route lag, kannte der Zähler im Browser sie nicht: wer 500 Zeilen einfügte,
 * las `500 Aufgaben erkannt`, bekam ein freies `Weiter`, sah 500 Zeilen im
 * Prüfschritt — und erst der POST wies ab. Die geteilte Grenze war damit
 * ausgerechnet die eine, die der Browser nicht benutzte. Die serverseitige
 * Prüfung bleibt trotzdem die Instanz; der Browser sagt es nur früher.
 */
export const PLAN_HOECHSTZAHL = 100;

/**
 * Faltet einen Aufgabentext auf die Form, in der er in die Datenbank geht.
 *
 * Dieselbe Kette und dieselbe Reihenfolge wie namePruefen in
 * ./mitgliedsname.ts, mit Absicht: erst die Nullbreiten-Zeichen weg, dann
 * Leerraum zusammenziehen, dann trimmen.
 * Umgekehrt bliebe `\u200B \u200B` nach dem Trimmen ein nichtleerer „Text".
 *
 * Gespeichert wird die **gefaltete** Fassung: `  Beet   25   jäten  ` wird zu
 * `Beet 25 jäten`.
 *
 * Die Funktion prüft **nicht** — sie faltet. Leer und zu lang deuten die
 * Aufrufer, weil die zwei Wurfstellen daraus verschiedene Sätze machen: auf
 * /aufgabe geht es um das eine Feld, auf /monatsplan um die Zahl der zu langen
 * Zeilen im Stapel.
 */
export function aufgabentextFalten(eingabe: string): string {
	return eingabe.replace(NULLBREITE, '').replace(/\s+/g, ' ').trim();
}

/**
 * Die erkannten Aufgabenzeilen eines mehrzeiligen Texts.
 *
 * Eine Zeile ist eine Aufgabe. Zerlegt wird **vor** dem Falten, weil das Falten
 * `\s+` zu einem Leerzeichen zieht und dabei auch den Zeilenumbruch fräse — die
 * umgekehrte Reihenfolge ergäbe aus einem ganzen Monatsplan eine einzige,
 * hoffnungslos zu lange Aufgabe.
 *
 * Leere Zeilen fallen weg, und dazu zählt auch eine aus reinem Leerraum oder
 * reinen Nullbreiten-Zeichen: wer einen Plan aus einer Notiz einfügt, hat
 * Absätze dazwischen, und die sind keine Aufgaben.
 *
 * **Nicht entdoppelt.** Zwei Mal `Tunnel lüften` sind zwei Aufgaben — es gibt
 * zwei Tunnel, und die planende Person meint womöglich beide.
 *
 * Diese Funktion ist der Zähler auf /monatsplan **und** die Zerlegung in der
 * action daneben. Genau darin liegt ihr Zweck.
 */
export function zeilenErkennen(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((zeile) => aufgabentextFalten(zeile))
		.filter((zeile) => zeile !== '');
}
