/*
 * Was ein Mitgliedsname ist — **die eine Stelle**, an der das steht.
 *
 * Bis Story 3.0.1 stand die Regel als lokale Prüfkette in
 * ../routes/verwaltung/+page.server.ts, mit der ausdrücklichen Begründung „eine
 * Wurfstelle". Mit dem Umbenennen sind es drei Leser derselben Regel:
 *
 *   1. die action `aufnehmen` auf /verwaltung — der Name eines neuen Zugangs;
 *   2. die action `umbenennen` daneben — derselbe Zugang, ein anderer Name;
 *   3. scripts/create-admin.ts, das erste Mitglied, **ohne** Oberfläche.
 *
 * Der dritte ist der Grund, dass es ein geteiltes Modul sein muss und keine
 * zweite Kopie — und der Beweis lag schon vor, als dieses Modul entstand: das
 * Skript prüfte den Namen mit einer eigenen Kette, ohne Nullbreiten-Sieb und
 * ohne Längengrenze, und liess damit einen Namen an, den die Oberfläche seit
 * Story 1.3 abweist. Genau die Drift, gegen die die Klammer da ist.
 *
 * Aus demselben Grund liegt auch die Grenze hier und nicht in der Route: eine
 * Zahl, die nur die Oberfläche kennt, ist die zweite Wahrheit über dieselbe
 * Regel, sobald ein zweiter Leser dazukommt.
 *
 * Das Modul liegt in src/lib/ und nicht unter client/ oder server/: es wird von
 * beiden Seiten gelesen. Es hängt von nichts ab, damit scripts/create-admin.ts
 * und scripts/smoke-zugang.ts es über nacktes Node laden können — die Importe
 * dort stehen relativ und mit .ts-Endung, nie über $lib.
 *
 * Die Bauform ist die von ./aufgabentext.ts, mit derselben Begründung. Beide
 * Module bleiben trotzdem getrennt: dort geht es um einen Aufgabentext, hier um
 * einen Mitgliedsnamen, und ein gemeinsames Modul für beide hiesse, dass eine
 * Änderung an der einen Seite still die andere trifft.
 */

/** Der Text für den einen Fall, den nur diese Regel kennt. Eine Wurfstelle. */
export const NAME_FEHLT = 'Ohne Namen geht es nicht. Trage ein, wie die Gruppe die Person nennt.';

/**
 * Die Längengrenze des Namens, serverseitig durchgesetzt.
 *
 * 80 Zeichen fassen jeden Doppelnamen mit Bindestrich und jeden Zusatz, den
 * eine Gartengruppe zur Unterscheidung braucht (`Anna Meier (Beet 12)`), und
 * halten die Zeile bei 375px in zwei Zeilen. Das `maxlength` am Feld ist die
 * Bequemlichkeit, diese Konstante die Regel: ein POST braucht kein Feld.
 */
export const NAME_HOECHSTLAENGE = 80;

/** Der Text für die Überlänge. Eine Wurfstelle. */
export const NAME_ZU_LANG = `Der Name ist zu lang. Höchstens ${NAME_HOECHSTLAENGE} Zeichen, gerne die Kurzform.`;

/**
 * Nullbreiten-Zeichen. Sie sind unsichtbar, haben keine Breite und `trim()`
 * hält sie **nicht** für Leerraum.
 *
 * Ohne dieses Aussieben besteht ein Name aus reinen Nullbreiten-Zeichen jede
 * Prüfung und legt eine Zeile an, die in der Liste als leere Lücke erscheint —
 * ohne lesbaren Namen, mit einem lebenden Einladungslink und ohne jede Aussage,
 * wer das ist. Seit Story 3.0.1 gibt es dafür ein Umbenennen; endgültig ist der
 * Fehler damit nicht mehr, aber er steht ab Story 3.1 im Dienstplan vor allen,
 * drei Monate im Voraus, bis ihn jemand bemerkt.
 *
 * Wortgleich mit NULLBREITE in ./aufgabentext.ts, und diese Verdopplung bleibt:
 * dort geht es um einen Aufgabentext, hier um einen Mitgliedsnamen.
 *
 * U+200B ZERO WIDTH SPACE, U+200C ZERO WIDTH NON-JOINER,
 * U+200D ZERO WIDTH JOINER, U+2060 WORD JOINER, U+FEFF ZERO WIDTH NO-BREAK
 * SPACE (die Form, in der eine Byte-Order-Mark beim Einfügen aus einer Datei
 * mitkommt).
 *
 * Das `g`-Flag ist Pflicht, nicht Zierat: ohne es ersetzte `replace` nur das
 * **erste** Nullbreiten-Zeichen eines Namens. Statthaft ist es, weil
 * `String.prototype.replace` den `lastIndex` eines globalen Regex vor jedem
 * Lauf selbst auf 0 zurücksetzt — die geteilte Konstante trägt also keinen
 * Zustand von Aufruf zu Aufruf mit.
 */
export const NULLBREITE = /[\u200B-\u200D\u2060\uFEFF]/g;

/**
 * Der Name, wie er in die Datenbank geht — oder null, wenn er nicht taugt.
 *
 * Reihenfolge mit Absicht: erst die Nullbreiten-Zeichen weg, dann Leerraum
 * zusammenziehen, dann trimmen. Umgekehrt bliebe `\u200B \u200B` nach dem
 * Trimmen ein nichtleerer „Name".
 *
 * Anders als aufgabentextFalten prüft diese Funktion **mit**: alle drei Leser
 * machen aus demselben Fehlschlag denselben Satz, und drei Aufrufer, die je
 * selbst deuteten, wären genau die Drift zurück, gegen die dieses Modul steht.
 */
export function namePruefen(eingabe: string): { name: string } | { fehler: string } {
	const name = eingabe.replace(NULLBREITE, '').replace(/\s+/g, ' ').trim();
	if (name === '') return { fehler: NAME_FEHLT };
	// Nach Codepoints gezählt, nicht nach UTF-16-Einheiten: ein Emoji im Namen
	// ist keine zwei Zeichen. [...name] zerlegt in Codepoints.
	if ([...name].length > NAME_HOECHSTLAENGE) return { fehler: NAME_ZU_LANG };
	return { name };
}
