import { AUFGABE_HOECHSTLAENGE, aufgabentextFalten } from './aufgabentext.ts';
import { unsichtbarEntfernen } from './unsichtbar.ts';

/*
 * Was ein Wissensblatt ist — **die eine Stelle**, an der das steht.
 *
 * Zwei Leser derselben Regel, und darum ein Modul und keine zwei Ketten:
 *
 *   1. die action `anlegen` auf /wissen — ein Blatt, das noch nicht existiert;
 *   2. die action `aendern` auf /wissen/[id] — dasselbe Blatt, ein neuer Stand.
 *
 * Die zwei machen aus demselben Fehlschlag denselben Satz. Zwei Routen, die je
 * selbst deuteten, wären genau die Drift, gegen die dieses Modul steht — die
 * Bauform ist die von ./mitgliedsname.ts, mit derselben Begründung.
 *
 * **Der Titel teilt sich die bestehende Kette, der Freitext bekommt eine
 * eigene.** Das ist der Kern dieser Datei:
 *
 *   - Ein **Titel** ist derselbe Gegenstand wie ein Aufgabensatz — etwas, das
 *     jemand in einer Zeile liest. Er faltet darum über aufgabentextFalten und
 *     misst gegen AUFGABE_HOECHSTLAENGE aus ./aufgabentext.ts, die vierte
 *     Wurfstelle derselben Zahl nach /aufgabe, /monatsplan und /einzelaufgabe.
 *     Eine eigene Titelregel wäre eine zweite Wahrheit über dieselbe Sache.
 *   - Ein **Freitext** ist es nicht. `aufgabentextFalten` zieht `\s+` auf ein
 *     Leerzeichen zusammen, und der Zeilenumbruch ist Leerraum. Für einen
 *     Aufgabensatz ist das genau richtig; für ein Blatt fräse es die Absätze
 *     weg, deren Erhalt die einzige Formatierungszusage des Blatts ist. Ein
 *     Blatt zu guten Nachbarn ohne Absätze wäre eine Textwand, und die Zusage
 *     ist damit das Einzige, was zwischen „aufgeschrieben" und „lesbar" steht.
 *
 * Welche Zeichen unsichtbar sind, steht in ./unsichtbar.ts und nicht hier — das
 * ist eine Aussage über Unicode und keine über Blätter. Dritter Leser derselben
 * Klasse nach ./aufgabentext.ts und ./mitgliedsname.ts.
 *
 * Das Modul liegt in src/lib/ und nicht unter client/ oder server/, und es hängt
 * nur von den zwei Nachbarmodulen ab, die selbst von nichts abhängen:
 * scripts/smoke-zugang.ts lädt es und die zwei Routenmodule, die es einziehen,
 * mit nacktem Node. Die Importe stehen darum relativ und mit .ts-Endung, nie
 * über $lib.
 */

/** Der Text für den fehlenden Titel. Zwei Wurfstellen. */
export const BLATT_TITEL_FEHLT =
	'Ohne Titel findet das Blatt niemand wieder. Schreib in zwei, drei Wörtern, worum es geht.';

/** Der Text für den zu langen Titel. Zwei Wurfstellen. */
export const BLATT_TITEL_ZU_LANG = `Das ist zu lang für einen Titel. Höchstens ${AUFGABE_HOECHSTLAENGE} Zeichen — der Rest gehört in den Text.`;

/**
 * Die Längengrenze eines Blatt-Freitexts, in **Codepoints**, serverseitig
 * durchgesetzt.
 *
 * 8000: ein Blatt zu guten Nachbarn oder zu Starkzehrern ist eine bis zwei
 * Bildschirmseiten — grosszügig gerechnet 3000 Zeichen. 8000 lassen dafür
 * reichlich Luft und fangen trotzdem den einen Fall ab, der sonst teuer wäre:
 * ein versehentlich eingefügter ganzer Chatverlauf. Dieselbe Begründung wie
 * PLAN_HOECHSTZAHL in ./aufgabentext.ts, mit einer anderen Zahl — und mit einem
 * Mittel dagegen, das der Monatsplan nicht hat: ein Blatt lässt sich ändern.
 *
 * Die Grenze ist eine Auslegung von „ein Blatt ist ein Nachschlagetext" und
 * keine Eigenschaft der Daten — darum steht sie hier und nicht als CHECK in
 * einer Migration, die man zum Ändern erst schreiben müsste. Dieselbe
 * Begründung wie bei AUFGABE_HOECHSTLAENGE und NAME_HOECHSTLAENGE.
 *
 * **Codepoints und nicht UTF-16-Einheiten**, wie überall in dieser Kette, und
 * mit derselben benannten Folge: das `maxlength` am Feld zählt Einheiten, diese
 * Prüfung zählt Codepoints, und ein Text aus 8000 Codepoints mit einem Emoji
 * darin lässt sich im Feld nicht zu Ende tippen. Die annehmende Richtung ist
 * über das echte Formular also gar nicht erreichbar.
 */
export const BLATT_HOECHSTLAENGE = 8000;

/** Der Text für den fehlenden Freitext. Zwei Wurfstellen. */
export const BLATT_TEXT_FEHLT =
	'Ein Blatt ohne Text steht leer in der Liste. Schreib auf, was gilt.';

/** Der Text für den zu langen Freitext. Zwei Wurfstellen. */
export const BLATT_TEXT_ZU_LANG = `Das ist mehr, als ein Blatt trägt. Höchstens ${BLATT_HOECHSTLAENGE} Zeichen — teile es auf zwei Blätter.`;

/**
 * Faltet einen Blatt-Freitext auf die Form, in der er in die Datenbank geht.
 *
 * Vier Schritte, und die Reihenfolge ist so wenig beliebig wie die in
 * `aufgabentextFalten`:
 *
 *   1. **Unsichtbare Zeichen weg.** Zuerst, aus demselben Grund wie dort: ein
 *      Text aus lauter breitenlosen Zeichen überstünde jedes spätere Trimmen
 *      und wäre ein „nichtleeres" Blatt, das als leere Fläche erscheint.
 *   2. **Ein Umbruch, eine Schreibweise.** `\r\n`, ein einzelnes `\r`, U+0085
 *      NEXT LINE und U+2028/U+2029 (LINE/PARAGRAPH SEPARATOR) werden zu `\n`.
 *      Wer aus Windows, aus einem PDF oder aus einer alten Notiz einfügt, bringt
 *      sonst Zeilenenden mit, die unter `white-space: pre-wrap` als zusätzlicher
 *      Umbruch erscheinen — dasselbe Blatt sähe je nach Herkunft anders aus.
 *
 *      **Die vier Fremdformen sind nicht Zierat, sie umgingen Schritt 4.** Der
 *      Review zu dieser Story hat es gefunden: `\n{3,}` zählt nur `\n`, und ein
 *      aus einem PDF eingefügter Text voller U+2028 hätte beliebig viele
 *      Leerzeilen behalten. Sie hier einzusammeln ist die einzige Stelle, an der
 *      das billig ist — danach sind sie von echten Umbrüchen nicht mehr zu
 *      unterscheiden.
 *   3. **Leerraum am Zeilenende weg.** `[^\S\n]` heisst „Leerraum, aber kein
 *      Umbruch": die Klasse **muss** den Umbruch ausnehmen, sonst frässe der
 *      Ausdruck mit dem `m`-Flag die Leerzeilen zwischen den Absätzen. Genau
 *      die sind hier die Aussage.
 *   4. **Ein Absatz ist eine Leerzeile, nicht sieben.** Drei und mehr Umbrüche
 *      am Stück werden zu zweien. Wer eine Seite tief scrollt, um den nächsten
 *      Absatz zu finden, liest kein Blatt mehr; und ohne diese Zeile wäre die
 *      Höhe eines Blatts eine Frage der Einfügequelle.
 *
 * Zuletzt `trim()`: Leerraum und Leerzeilen aussen tragen nichts.
 *
 * Gespeichert wird die **gefaltete** Fassung, wie bei Aufgabentext und Name.
 *
 * Die Funktion prüft **nicht** — sie faltet, und `blattTextPruefen` darunter
 * deutet. Getrennt, weil scripts/smoke-zugang.ts die Faltung an Beispielen
 * misst, die keine Deutung brauchen.
 */
export function blatttextFalten(eingabe: string): string {
	return unsichtbarEntfernen(eingabe)
		.replace(/\r\n?|[\u0085\u2028\u2029]/g, '\n')
		.replace(/[^\S\n]+$/gm, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/**
 * Der Titel, wie er in die Datenbank geht — oder der Satz, warum nicht.
 *
 * Gefaltet über aufgabentextFalten: erst die unsichtbaren Zeichen weg, dann
 * Leerraum zusammenziehen, dann trimmen. Ein Titel ist einzeilig, und ein
 * eingefügter Absatz wird hier zu Recht zu einer Zeile.
 */
export function blattTitelPruefen(eingabe: string): { titel: string } | { fehler: string } {
	const titel = aufgabentextFalten(eingabe);
	if (titel === '') return { fehler: BLATT_TITEL_FEHLT };
	// Nach Codepoints gezählt, nicht nach UTF-16-Einheiten: ein Emoji im Titel
	// ist kein zweites Zeichen. [...titel] zerlegt in Codepoints.
	if ([...titel].length > AUFGABE_HOECHSTLAENGE) return { fehler: BLATT_TITEL_ZU_LANG };
	return { titel };
}

/**
 * Der Freitext, wie er in die Datenbank geht — oder der Satz, warum nicht.
 *
 * Gefaltet über `blatttextFalten` darüber, das die Absätze stehen lässt.
 */
export function blattTextPruefen(eingabe: string): { text: string } | { fehler: string } {
	const text = blatttextFalten(eingabe);
	if (text === '') return { fehler: BLATT_TEXT_FEHLT };
	// Codepoints wie überall in dieser Kette.
	if ([...text].length > BLATT_HOECHSTLAENGE) return { fehler: BLATT_TEXT_ZU_LANG };
	return { text };
}
