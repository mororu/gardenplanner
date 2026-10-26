import { unsichtbarEntfernen } from './unsichtbar.ts';

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
 * Skript prüfte den Namen mit einer eigenen Kette, ohne Zeichensieb und
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
 * einen Mitgliedsnamen, und ein gemeinsames Modul für **die ganze Regel** hiesse,
 * dass eine Änderung an der einen Seite still die andere trifft. Geteilt ist
 * genau der eine Teil, der beiden gehört, weil er keinem von beiden gehört:
 * welche Zeichen unsichtbar sind (./unsichtbar.ts).
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

/*
 * Welche Zeichen unsichtbar sind, steht seit dem 2026-08-29 in
 * ./unsichtbar.ts und nicht mehr hier.
 *
 * Bis dahin trug dieses Modul eine eigene Konstante NULLBREITE, wortgleich mit
 * der in ./aufgabentext.ts, und die Verdopplung war begründet: es geht hier um
 * einen Mitgliedsnamen und dort um einen Aufgabentext. Für **diese**
 * Zeichenklasse trägt das nicht — welche Zeichen keine Breite haben, ist eine
 * Aussage über Unicode und keine über Namen. Die Einträge 23 und 24 der
 * zurückgestellten Arbeit haben über zwei Stories hinweg beide dasselbe
 * verlangt: „gehört an beide Stellen zugleich".
 *
 * Was diese Zeichen hier anrichten, bleibt eigen und steht darum weiter hier:
 * ein Name aus lauter unsichtbaren Zeichen erscheint in der Liste als leere
 * Lücke, mit einem lebenden Einladungslink und ohne jede Aussage, wer das ist.
 * Seit Story 3.0.1 gibt es dafür ein Umbenennen; endgültig ist der Fehler damit
 * nicht mehr, aber er steht ab Story 3.1 im Tränkeplan vor allen, drei Monate im
 * Voraus, bis ihn jemand bemerkt.
 */

/**
 * Der Name, wie er in die Datenbank geht — oder null, wenn er nicht taugt.
 *
 * Reihenfolge mit Absicht: erst die unsichtbaren Zeichen weg, dann Leerraum
 * zusammenziehen, dann trimmen. Umgekehrt bliebe `\u200B \u200B` nach dem
 * Trimmen ein nichtleerer „Name".
 *
 * Anders als aufgabentextFalten prüft diese Funktion **mit**: alle drei Leser
 * machen aus demselben Fehlschlag denselben Satz, und drei Aufrufer, die je
 * selbst deuteten, wären genau die Drift zurück, gegen die dieses Modul steht.
 */
export function namePruefen(eingabe: string): { name: string } | { fehler: string } {
	const name = unsichtbarEntfernen(eingabe).replace(/\s+/g, ' ').trim();
	if (name === '') return { fehler: NAME_FEHLT };
	// Nach Codepoints gezählt, nicht nach UTF-16-Einheiten: ein Emoji im Namen
	// ist keine zwei Zeichen. [...name] zerlegt in Codepoints.
	if ([...name].length > NAME_HOECHSTLAENGE) return { fehler: NAME_ZU_LANG };
	return { name };
}

/*
 * **Der Kurzname** (spec-notiz-und-kurzname.md, 2026-10-26).
 *
 * Wo die Oberfläche eine Person nennt — an einer Erntezeile, im Tränkeplan, an
 * einem übernommenen Termin, im Archiv —, steht nicht der volle Name, sondern
 * der **Anzeigename**: der Kurzname, wenn einer gesetzt ist, sonst das erste
 * Wort des Namens. Der volle Name bleibt dort, wo zwei Personen unterschieden
 * werden müssen: in der Verwaltung, in der Auswahl, mit der die Verwaltung
 * eine Woche im Tränkeplan besetzt, und in der Traktandenliste als abgelegter
 * Datei (die Begründungen im Spec Change Log).
 *
 * **Der Kurzname ist von Hand gepflegt und wird nicht abgeleitet** (Entscheid
 * Manuel, 2026-10-26). Im Garten gibt es zwei Personen mit gleichem Vornamen
 * und gleichem Anfangsbuchstaben des Nachnamens; `members.name` ist ein
 * einziges Feld, und ein Nachname lässt sich daraus nicht verlässlich lesen.
 * Die Regel „erstes Wort" gilt darum nur, solange niemand etwas anderes
 * eingetragen hat — und die Verwaltung sagt, wo das nötig ist
 * (`gleicheAnzeigenamen` unten).
 *
 * Die Regel steht **hier und nirgends sonst** — kein SQL-Ausdruck für das erste
 * Wort. Die Abfragen lesen `name` und `kurzname` und rufen `anzeigename`; eine
 * zweite Fassung in SQL liefe beim ersten Unterschied (Leerraum, Unicode)
 * still auseinander.
 */

/**
 * Die Längengrenze des Kurznamens, serverseitig durchgesetzt.
 *
 * 20 Zeichen: ein Kurzname ist ein Vorname mit einem Zusatz (`Nici Mü`,
 * `Anna B. 12`), kein zweiter Name. Gezählt in Codepoints wie bei namePruefen.
 */
export const KURZNAME_HOECHSTLAENGE = 20;

/** Der Text für die Überlänge. Eine Wurfstelle. */
export const KURZNAME_ZU_LANG = `Der Kurzname ist zu lang. Höchstens ${KURZNAME_HOECHSTLAENGE} Zeichen.`;

/**
 * Der Kurzname, wie er in die Datenbank geht: gefaltet wie ein Name, **leer
 * wird null** — oder ein Fehler, wenn er zu lang ist.
 *
 * Leer ist kein Fehler, sondern der Normalfall: dann gilt das erste Wort des
 * Namens. Ein Kurzname aus lauter unsichtbaren Zeichen fällt durch die Faltung
 * auf leer und damit auf null — er wäre sonst eine leere Lücke an jeder Stelle,
 * an der die Person genannt wird.
 */
export function kurznamePruefen(eingabe: string): { kurzname: string | null } | { fehler: string } {
	const kurzname = unsichtbarEntfernen(eingabe).replace(/\s+/g, ' ').trim();
	if (kurzname === '') return { kurzname: null };
	if ([...kurzname].length > KURZNAME_HOECHSTLAENGE) return { fehler: KURZNAME_ZU_LANG };
	return { kurzname };
}

/**
 * Wie die Oberfläche eine Person nennt: der Kurzname, sonst das erste Wort des
 * Namens.
 *
 * Getrennt wird am ersten Leerraum. Ein gespeicherter Name ist über namePruefen
 * gefaltet und hat darum keinen Leerraum am Rand; die Funktion trimmt trotzdem,
 * weil sie nicht voraussetzt, woher ihre Werte kommen (ein Eingriff von Hand an
 * der Datenbank). Ein Name aus einem einzigen Wort bleibt ganz, und ein leerer
 * Kurzname zählt wie keiner.
 */
export function anzeigename(name: string, kurzname: string | null): string {
	const kurz = kurzname?.trim() ?? '';
	if (kurz !== '') return kurz;
	const gekuerzt = name.trim();
	return gekuerzt.split(/\s+/, 1)[0] ?? gekuerzt;
}

/**
 * Der Anzeigename einer Zeile aus einem leftJoin, oder null, wenn die
 * Mitgliedszeile fehlt.
 *
 * Für die Abfragen, deren Spalte `name` aus einem leftJoin auf members kommt
 * und darum nullbar ist. Ein fehlender Name kann nur aus einem Eingriff von
 * Hand an der Datenbank stammen; die Seiten schreiben dann `unbekannt`.
 */
export function anzeigenameOderNull(name: string | null, kurzname: string | null): string | null {
	return name === null ? null : anzeigename(name, kurzname);
}

/** Zwei oder mehr aktive Personen, die in der Oberfläche gleich heissen. */
export type GleicherAnzeigename = { anzeigename: string; namen: string[] };

/**
 * Welche **aktiven** Personen denselben Anzeigenamen tragen — für die Warnung
 * in der Verwaltung.
 *
 * Die Verwaltung **warnt und weist nicht ab** (spec-notiz-und-kurzname.md): wer
 * `Nici Meier` aufnimmt, während `Nici Müller` schon da ist, hat nichts falsch
 * gemacht, nur steht danach an zwei Erntezeilen `Nici`. Die Abhilfe ist ein
 * Kurzname, und die Warnung sagt, bei wem.
 *
 * Verglichen wird **ohne Gross und Klein** (`toLocaleLowerCase('de-CH')`):
 * `nici` und `Nici` sind zwei Zeichenketten, aber an einer Erntezeile dieselbe
 * Auskunft. Beendete Zugänge zählen nicht — sie erscheinen nirgends mehr als
 * handelnde Person, und eine Warnung über sie hiesse, einen Kurznamen für
 * jemanden zu pflegen, der nicht mehr da ist.
 *
 * Rein und ohne Datenbank, damit scripts/smoke-zugang.ts es direkt prüfen kann.
 * Die Reihenfolge der Gruppen folgt der ersten Person jeder Gruppe in der
 * Eingabe; die Verwaltung reicht ihre Liste schon nach Name sortiert herein.
 */
export function gleicheAnzeigenamen(
	mitglieder: readonly { name: string; kurzname: string | null; isActive: boolean }[]
): GleicherAnzeigename[] {
	const gruppen = new Map<string, GleicherAnzeigename>();
	for (const mitglied of mitglieder) {
		if (!mitglied.isActive) continue;
		const angezeigt = anzeigename(mitglied.name, mitglied.kurzname);
		const schluessel = angezeigt.toLocaleLowerCase('de-CH');
		const gruppe = gruppen.get(schluessel);
		if (gruppe === undefined) {
			gruppen.set(schluessel, { anzeigename: angezeigt, namen: [mitglied.name] });
		} else {
			gruppe.namen.push(mitglied.name);
		}
	}
	return [...gruppen.values()].filter((gruppe) => gruppe.namen.length > 1);
}
